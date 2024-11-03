import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildTextBasedChannel, Message, Snowflake, TextBasedChannel, TextChannel, ThreadAutoArchiveDuration } from "discord.js";
import { getItem, S3_PUBLIC_MEDIA_BUCKET, StudyBotJson, StudyBotMultiChoiceQuestion } from "../resource.js";
import crypto from "crypto";
import { StudyBotChannel } from "../utils.js";
import { sleep } from "orange-common-lib";

type StudyBotSoloGameSession = {
    id: string,
    examref: string,
    uid: string,
    resource: StudyBotJson
    originalMessage: Message,
    messagesStack: Message[],
    currentQuestion: number,
    metrics: {
        correct: number,
        incorrect: number,
        wrongQuestions: string[]
    },
    questionFeedback: string[]
};

const GAME_SESSIONS = new Map<string, StudyBotSoloGameSession>();

/**
 * Prepares a question for sending to the user in the study session.
 * @param game_id The ID of the game session
 * @param question The question to be sent
 * @returns An object containing the components (buttons) and embed (question text and image)
 */
async function getQuestion(game_id: string, question: StudyBotMultiChoiceQuestion) {
    const buttons = new ActionRowBuilder<ButtonBuilder>();
    for (const { id } of question.answerOptions) {
        buttons.addComponents(new ButtonBuilder(
            { label: id, style: ButtonStyle.Secondary, customId: `sb_${game_id}_${id}` }
        ));
    }

    return {
        components: [buttons],
        embed: {
            title: question.question.substring(0, 255),
            description: question.description?.substring(0, 1000) +
                `\n\n${question.answerOptions.map(option => `:regional_indicator_${option.id.toLowerCase()}: *${option.text}*`).join("\n\n")}`,
            image: { url: question.referenceImg?.startsWith("http") ? question.referenceImg : `${S3_PUBLIC_MEDIA_BUCKET}/${question.referenceImg}` },
        }
    }
}
/**
 * Sends the next question to the user in the study session.
 * @param game The StudyBotSoloGameSession object for the user
 * @param content Optional content to send before the question
 * @returns The message that was sent
 */
async function sendQuestion(game: StudyBotSoloGameSession, content: string | undefined = undefined) {
    const message = game.originalMessage;
    const { embed, components } = await getQuestion(game.id, (game.resource.data as StudyBotMultiChoiceQuestion[])[game.currentQuestion]);

    const msg = await message.reply({
        content,
        embeds: [{
            ...embed,
            footer: { text: `Question ${game.currentQuestion + 1} of ${game.resource.data.length} • Ref: ${game.examref}` }
        }],
        components
    });

    game.messagesStack.push(msg as Message);
}
/**
 * Starts a solo study session for the user, given the exam reference.
 * @param interaction The interaction object from Discord.js
 * @param examref The exam reference, must be a valid file name ending in .json
 * @param channel The channel to start the exam in.
 */
async function playSolo(interaction: ChatInputCommandInteraction<CacheType>, examref: string, channel: StudyBotChannel) {
    const game_id = crypto.randomBytes(4).toString('hex');
    const exam_code = examref.replace(".json", "");
    const uid = interaction.user.id;
    const resource = await getItem(examref, "studybot-questions");
    const currentQuestion = 0;

    if (!resource) {
        await interaction.reply({ ephemeral: true, content: "Invalid exam reference." });
        return;
    }

    setTimeout(() => {
        const game = GAME_SESSIONS.get(game_id);
        if (game) {
            finishGame(game, game.originalMessage, ":clock1: **Out of time!** ");
        }
    }, resource.metaInfo.durationMins * 60 * 1000);

    const thread = "threads" in channel ? await channel.threads.create({
        name: `${interaction.user.displayName}'s ${exam_code} exam ⸺ REF${game_id}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
        reason: `${interaction.user.displayName}'s ${exam_code} exam ⸺ REF${game_id}`
    }) : undefined;

    const message = await (thread ?? channel).send({ content: `<@${uid}>, you've started the **${exam_code}** exam. Exam attempt identifier: \`REF${game_id}\`` });

    await interaction.reply({
        ephemeral: false, content: `:clock1: You've started the exam, **${exam_code}**. You have up to **${resource.metaInfo.durationMins} minutes** to answer **all** questions.`,
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder({ label: "Go to Exam", style: ButtonStyle.Link, url: message.url }))
        ]
    });

    GAME_SESSIONS.set(game_id, {
        id: game_id, examref: exam_code, originalMessage: message, messagesStack: [],
        uid: uid, resource: resource, currentQuestion: currentQuestion,
        metrics: { correct: 0, incorrect: 0, wrongQuestions: [] }, questionFeedback: []
    });

    const game = GAME_SESSIONS.get(game_id);

    if (!game) {
        await message.reply({ embeds: [{ title: ":mag_right: Looks like the exam ended already.", description: "Feel free to start another one with `/studybot exam`." }] });
        return;
    }

    await sendQuestion(game);
}
/**
 * Processes a button interaction (answer submission) in the solo study mode.
 * @param btnInteraction The interaction object from Discord.js
 */
async function processResponse(btnInteraction: ButtonInteraction) {
    const [_, game_id, answer] = btnInteraction.customId.split("_");
    const game = GAME_SESSIONS.get(game_id);

    if (!game) {
        await btnInteraction.reply({ embeds: [{ title: ":mag_right: Looks like the exam ended already.", description: "Feel free to start another one with `/studybot exam`." }], ephemeral: true });
        return;
    }

    if (game.uid !== btnInteraction.user.id) {
        await btnInteraction.reply({ ephemeral: true, embeds: [{ title: "Error", description: "This exam is being taken by somebody else. Please start an exam yourself by running `/studybot exam` to get started." }] });
        return;
    }

    await btnInteraction.deferUpdate();

    const question_data = (game.resource.data as StudyBotMultiChoiceQuestion[])[game.currentQuestion];

    const generic_feedback = `-# Your answer to Question ${game.currentQuestion + 1} was ${answer.toUpperCase()}`;
    const wrong_answer_feedback = `That's not quite right. :thinking:\n${question_data.explanation}`;
    const correct_answer_feedback = `That's right! :white_check_mark:\n${question_data.explanation}`;

    const correct = question_data.correctAnswerIds.includes(answer);

    if (!correct) {
        game.metrics.wrongQuestions.push(`${question_data.topic}`);
    }

    game.questionFeedback.push(correct ? correct_answer_feedback : wrong_answer_feedback);

    if (game.currentQuestion === (game.resource.data.length - 1)) {
        const msg = await game.originalMessage.reply({ content: generic_feedback, });
        game.messagesStack.push(msg as Message);
        await finishGame(game, game.originalMessage);
    } else {
        game.currentQuestion++;
        game.messagesStack[game.messagesStack.length - 1].edit({ components: [] });
        await sendQuestion(game, generic_feedback);
    }
}
/**
 * Completes the study session, calculates the score, and provides a summary
 * of the user's performance. Sends feedback for each question and the overall
 * exam result.
 * 
 * @param game The current StudyBotSoloGameSession containing the user's session data
 * @param originalMessage The original message or interaction to reply to with results
 * @param endMessage Optional message to prepend to the final feedback
 */
async function finishGame(game: StudyBotSoloGameSession, originalMessage: Message | ChatInputCommandInteraction, endMessage: string = "") {
    const resource = game.resource;
    const metrics = game.metrics;

    const score = Math.round(metrics.correct / resource.data.length * 100);
    const pass = metrics.correct >= resource.metaInfo.passScore;
    let feedback = "";

    if (score < 20) { feedback += "You should consider studying this topic a lot more to get better. Good effort though."; }
    else if (score < 40) { feedback += "You're on the right track, but you have a lot more work to do to get better. Keep going!"; }
    else if (score < 50) { feedback += "Nice work! But there's a lot of room for improvement. Try to get some practical experience."; }
    else if (score < 75) { feedback += "Very strong attempt, but you're not quite there yet."; }
    else if (score < 90) { feedback += "You did really well. But there is still room for improvement. Try to get some practical experience."; }
    else if (score < 97) { feedback += "You scored extremely high which is commendable. You're almost there!"; }
    else if (score < 100) { feedback += "Near perfect! It's just that one stubborn question holding you back."; }
    else { feedback += "Woop! :100: all the way!"; }

    await originalMessage.reply({
        embeds: [{
            title: `${pass ? "Exam Passed" : "Exam Failed"}`, description: `You have completed the **${game.examref}** exam. ${feedback}`,
            footer: { text: `Ref: ${game.examref}` },
            timestamp: new Date().toISOString(),
            fields: [{ name: "Score", value: `${score}%`, inline: true }, metrics.wrongQuestions.length > 0 ? { name: "Areas for Improvement", value: metrics.wrongQuestions.join("\n") } : { name: "Next Steps", value: "If you haven't already, get some practical experience under your belt and then get certified." }]
        }], components: []
    });

    await originalMessage.reply({ content: `${endMessage}Great work <@${game.uid}>, now I'm going to add some feedback to your answers. Give me a few seconds.` });

    for (const msg of game.messagesStack.reverse()) { 
        await msg.channel.sendTyping();
        await sleep(1000);

        const feedback = game.questionFeedback.pop();

        if (feedback === undefined)
            continue;

        const newEmbeds = msg.embeds.map(embed => {
            return new EmbedBuilder()
                .setTitle(embed.title || null)
                .setDescription(embed.description || null)
                .setFooter(embed.footer ? { text: embed.footer.text } : null)
                .setImage(embed.image?.url || null);
        });

        await msg.edit({
            content: `${msg.content}. ${feedback}`,
            embeds: newEmbeds,
            components: [],
        });
    }

    await originalMessage.reply({ content: `:notepad_spiral: Thanks for taking the exam, <@${game.uid}>. Your feedback is ready to be viewed.` });
    GAME_SESSIONS.delete(game.id);
}

export { playSolo, processResponse };
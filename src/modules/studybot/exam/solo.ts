import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, GuildTextBasedChannel, Message, Snowflake, TextBasedChannel, TextChannel, ThreadAutoArchiveDuration } from "discord.js";
import { getItem, S3_PUBLIC_MEDIA_BUCKET, StudyBotJson, StudyBotMultiChoiceQuestion } from "../resource.js";
import crypto from "crypto";

type StudyBotSoloGameSession = {
    id: string,
    examref: string,
    uid: string,
    resource: StudyBotJson
    originalMessage: Message,
    currentQuestion: number,
    metrics: {
        correct: number,
        incorrect: number,
        wrongQuestions: string[]
    }
};

const GAME_SESSIONS = new Map<string, StudyBotSoloGameSession>();

async function nextQuestion(game_id: string, correct: boolean) {
    const game = GAME_SESSIONS.get(game_id);

    if (!game) {
        return { embeds: [{ title: "Error", description: "Game session not found." }] };
    }

    const resource = game.resource;
    const currentQuestion = game.currentQuestion;

    const question = (resource.data as StudyBotMultiChoiceQuestion[])[currentQuestion];
    const embed = new EmbedBuilder({
        footer: { text: `Question ${currentQuestion + 1} of ${resource.data.length} • Ref: ${game.examref}_${question.ref}` },
        title: question.question.substring(0, 255),
        description: question.description?.substring(0, 1000) +
            `\n\n${question.answerOptions.map(option => `:regional_indicator_${option.id.toLowerCase()}: *${option.text}*`).join("\n\n")}`,
        //fields: question.answerOptions.map(option => ({ name: option.id, value: option.text.substring(0, 255) })),
        image: { url: question.referenceImg?.startsWith("http") ? question.referenceImg : `${S3_PUBLIC_MEDIA_BUCKET}/${question.referenceImg}` },
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>();

    for (const { id } of question.answerOptions) {
        buttons.addComponents(new ButtonBuilder(
            { label: id, style: ButtonStyle.Secondary, customId: `sb_${game_id}_${id}` }
        ));
    }

    if (correct || currentQuestion <= 0) {
        return { embeds: [embed], components: [buttons] };
    } else {
        const explanation = (resource.data as StudyBotMultiChoiceQuestion[])[currentQuestion - 1].explanation;
        return { embeds: [embed], components: [buttons], explanation: explanation };
    }
}

async function playSolo(interaction: ChatInputCommandInteraction<CacheType>, examref: string) {
    const game_id = crypto.randomBytes(4).toString('hex');
    const exam_code = examref.replace(".json", "");
    const uid = interaction.user.id;
    const resource = await getItem(examref, "studybot-questions");
    const currentQuestion = 0;

    if (resource) {
        setTimeout(() => GAME_SESSIONS.delete(game_id), resource.metaInfo.durationMins * 60 * 1000);

        const thread = await (await interaction.client.channels.fetch("1297606662655311994") as GuildTextBasedChannel as TextChannel).threads.create({
            name: `${interaction.user.displayName}'s ${exam_code} exam ⸺ REF${game_id}`,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
            reason: `${interaction.user.displayName}'s ${exam_code} exam ⸺ REF${game_id}`
        });

        //const message = await interaction.followUp( { ephemeral: false, content: "\0" });
        const message = await thread.send({ content: `<@${uid}>, you've started the **${exam_code}** exam. Exam attempt identifier: \`REF${game_id}\`` });

        await interaction.reply({
            ephemeral: false, content: `:clock1: You've started the exam, **${exam_code}**. You have up to **${resource.metaInfo.durationMins} minutes** to answer **all** questions.`,
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder({ label: "Go to Exam", style: ButtonStyle.Link, url: message.url }))
            ]
        });


        GAME_SESSIONS.set(game_id, {
            id: game_id,
            examref: exam_code,
            originalMessage: message,
            uid: uid,
            resource: resource,
            currentQuestion: currentQuestion,
            metrics: {
                correct: 0,
                incorrect: 0,
                wrongQuestions: []
            }
        });

        const { embeds, components } = await nextQuestion(game_id, false);

        await message.reply({ embeds: embeds, components: components });
    } else {
        await interaction.reply({ ephemeral: true, content: "Invalid exam reference." });
        return;
    }
}

async function processResponse(btnInteraction: ButtonInteraction) {
    const [_, game_id, answer] = btnInteraction.customId.split("_");

    const game = GAME_SESSIONS.get(game_id);

    if (!game) {
        await btnInteraction.reply({ ephemeral: true, embeds: [{ title: "Error", description: "Game session not found." }] });
        return;
    }

    if (game.uid !== btnInteraction.user.id) {
        await btnInteraction.reply({ ephemeral: true, embeds: [{ title: "Error", description: "This exam is being taken by somebody else. Please start an exam yourself by running `/studybot exam` to get started." }] });
        return;
    }


    //const originalMessage = game.originalMessage;
    const originalMessage = btnInteraction.message as Message;
    const resource = game.resource;
    const currentQuestion = game.currentQuestion;
    const question = (resource.data as StudyBotMultiChoiceQuestion[])[currentQuestion];
    const correct = question.correctAnswerIds.includes(answer);
    const metrics = game.metrics;

    correct ? metrics.correct++ : metrics.incorrect++
    if (!correct && !metrics.wrongQuestions.includes(question.topic)) {
        metrics.wrongQuestions.push(`${question.topic}`);
    }

    GAME_SESSIONS.set(game_id, { ...game, currentQuestion: currentQuestion + 1 });

    const answer_prefix = `-# Your answer to Question ${currentQuestion + 1} was ${answer.toUpperCase()}\n\n`;
    const wrong_answer_feedback = `${answer_prefix}:no_mouth: **Not quite!**\n`;
    const correct_answer_feedback = `${answer_prefix}:white_check_mark: **Correct!**`;

    if (currentQuestion < (resource.data as StudyBotMultiChoiceQuestion[]).length - 1) {
        const { embeds, components, explanation } = await nextQuestion(game_id, correct);
        await btnInteraction.deferUpdate();
 
        if (explanation && !correct) {
            await originalMessage.reply({ content: wrong_answer_feedback + explanation, embeds: embeds, components: components });
        } else {
            await originalMessage.reply({ content: correct_answer_feedback, embeds: embeds, components: components });
        }
    } else {
        const score = Math.round(metrics.correct / (metrics.correct + metrics.incorrect) * 100);
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

        await btnInteraction.deferUpdate();

        await originalMessage.reply({
            content: correct ? correct_answer_feedback : wrong_answer_feedback + question.explanation,
            embeds: [{
                title: `${pass ? "Exam Passed" : "Exam Failed"}`, description: `You have completed the **${game.examref}** exam. ${feedback}`,
                footer: { text: `Ref: ${game.examref}` },
                timestamp: new Date().toISOString(),
                fields: [{ name: "Score", value: `${score}%`, inline: true }, metrics.wrongQuestions.length > 0 ? { name: "Areas for Improvement", value: metrics.wrongQuestions.join("\n") } : { name: "Next Steps", value: "If you haven't already, get some practical experience under your belt and then get certified." }]
            }], components: []
        });
        GAME_SESSIONS.delete(game_id);
    }
}

export { playSolo, processResponse };
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ChatInputCommandInteraction, EmbedBuilder, Message } from "discord.js";
import { getItem, S3_PUBLIC_MEDIA_BUCKET, StudyBotMultiChoiceQuestion } from "../resource.js";
import crypto from "crypto";

type StudyBotQuestionGameSession = {
    id: string,
    examref: string,
    uid: string,
    question: StudyBotMultiChoiceQuestion
};

const GAME_SESSIONS = new Map<string, StudyBotQuestionGameSession>();

async function getRandomQuestion(examref: string) {
    const resource = await getItem(examref, "studybot-questions");

    if (resource) {
        const questions = resource.data as StudyBotMultiChoiceQuestion[];
        return questions[Math.floor(Math.random() * questions.length)];
    } else {
        return undefined;
    }
}

async function nextQuestion(game_id: string) {
    const game = GAME_SESSIONS.get(game_id);

    if (!game) {
        return { embeds: [{ title: ":confused: Hmm, that question was already answered.", description: "Feel free to run `/studybot question` to quiz yourself!" }], ephemeral: true };
    }

    const question = game.question;
    const embed = new EmbedBuilder({
        footer: { text: `Ref: ${game.examref}_${question.ref}` },
        title: question.question.substring(0, 255),
        description: question.description?.substring(0, 1000) +
            `\n\n${question.answerOptions.map(option => `:regional_indicator_${option.id.toLowerCase()}: *${option.text}*`).join("\n\n")}`,
        //fields: question.answerOptions.map(option => ({ name: option.id, value: option.text.substring(0, 255) })),
        image: { url: question.referenceImg?.startsWith("http") ? question.referenceImg : `${S3_PUBLIC_MEDIA_BUCKET}/${question.referenceImg}` },
    });

    const buttons = new ActionRowBuilder<ButtonBuilder>();

    for (const { id } of question.answerOptions) {
        buttons.addComponents(new ButtonBuilder(
            { label: id, style: ButtonStyle.Secondary, customId: `sb_q_${game_id}_${id}` }
        ));
    }

    return { embeds: [embed], components: [buttons] };
}

async function questionMode(examref: string, interaction: ChatInputCommandInteraction<CacheType>) {
    const question = await getRandomQuestion(examref);

    if (question) {
        const game_id = crypto.randomBytes(4).toString('hex');

        GAME_SESSIONS.set(game_id, {
            id: game_id,
            examref: examref,
            uid: interaction.user.id,
            question: question
        });

        await interaction.reply(await nextQuestion(game_id));
    } else {
        return { embeds: [{ title: ":confused: Hmm, that question was already answered.", description: "Feel free to run `/studybot question` to quiz yourself!" }], ephemeral: true };
    }
}

async function handleQuestionResponse(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith("sb_q_")) {
        const [_, __, game_id, answer] = interaction.customId.split("_");
        const game = GAME_SESSIONS.get(game_id);

        if (!game) {
            await interaction.reply({ embeds: [{ title: ":confused: Hmm, that question was already answered.", description: "Feel free to run `/studybot question` to quiz yourself!" }], ephemeral: true }, );
            return;
        }

        if (game.uid !== interaction.user.id) {
            await interaction.reply({ ephemeral: true, embeds: [{ title: "Error", description: "Not your question." }] });
            return;
        }

        const correct = game.question.correctAnswerIds.includes(answer);

        if (correct) {
            await interaction.reply({ ephemeral: false, content: `-# Your answer was ${answer.toUpperCase()}\n:white_check_mark: **Correct!**` });
        } else {
            await interaction.reply({ ephemeral: false, content: `-# Your answer was ${answer.toUpperCase()}\n:upside_down: **Not quite!**\n\n${game.question.explanation}` });
        }

        GAME_SESSIONS.delete(game_id);
    }
}

export { questionMode, handleQuestionResponse };
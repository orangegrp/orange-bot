import { NodeHtmlMarkdown } from 'node-html-markdown';
import { createEmbed } from './embed.js';
import Discord, { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageActionRowComponentBuilder } from 'discord.js';

type OrangeQuestion = {
    category?: string | null;
    question?: string | null;
    content?: string | null;
    icon?: string | null;
    image?: string | null;
    link?: string | null;
    footer?: string | null;
    choices?: string[] | null;
    answer?: string[] | null;
    explanation?: string | null;
};

type OrangeQuestionAnswer = {
    question?: string | null;
    answerIdx: number;
    correct: boolean;
};

const QUIZZES: Map<string, OrangeQuiz> = new Map();

function quizHandler(interaction: ButtonInteraction) {
    const quizid = interaction.customId.substring(5, 13);
    const quiz = QUIZZES.get(quizid);
    console.log(quiz);
    console.dir(quiz);
    console.dir(QUIZZES);
    if (interaction.customId.startsWith('quiz-') && quiz) {
        if (!quiz.users.includes(interaction.user)) {
            interaction.reply({ ephemeral: true, content: ':slight_frown: You aren\'t part of this quiz. Please use `/quiz` to start a quiz for yourself.' });
            return;
        }
        const question = quiz.questions[quiz.index];
        quiz.answers.push({
            question: quiz.questions[quiz.index].question,
            answerIdx: Number(interaction.customId.substring(14)),
            correct: question.answer!.includes(question.choices![Number(interaction.customId.substring(14))])!
        });
        const finished = quiz.index + 1 === quiz.questions.length;
        quiz.callback(interaction.user, Number(interaction.customId.substring(14)), question, finished);

    }
    interaction.deferUpdate();
}

function registerQuiz(quiz: OrangeQuiz) {
    QUIZZES.set(quiz.quizid, quiz);
}

class OrangeQuiz {
    quizid: string;
    message: Discord.Message;
    users: Discord.User[];
    questions: OrangeQuestion[];
    answers: OrangeQuestionAnswer[] = [];

    callback: (user: Discord.User, answer: number, question: OrangeQuestion, finished: boolean) => void;

    index: number = 0;

    nhm = new NodeHtmlMarkdown(
        /* options (optional) */ {},
        /* customTransformers (optional) */ undefined,
        /* customCodeBlockTranslators (optional) */ undefined
    );

    constructor(questions: OrangeQuestion[], originalMessage: Discord.Message, users: Discord.User[], answerCallback: (user: Discord.User, answer: number, question: OrangeQuestion, finished: boolean) => void) {
        this.questions = questions;;
        this.message = originalMessage;
        this.users = users;
        this.callback = answerCallback;
        this.quizid = crypto.randomUUID().substring(0, 8);
        registerQuiz(this);
        this.updateQuestion();
    }

    updateQuestion(feedback: string = '') {
        let currentQ = this.questions[this.index];
        const answerBtns: Discord.ButtonBuilder[] = [];

        for (let i = 0; i < currentQ.choices!.length; i++) {
            // quiz-{id}-{answer index}
            // quiz-xxxxxxxx-0
            answerBtns.push(new ButtonBuilder()
                .setCustomId(`quiz-${this.quizid}-${i}`)
                .setLabel(currentQ.choices![i])
                .setStyle(ButtonStyle.Primary));
        }

        const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(answerBtns);

        if (currentQ) {
            this.message.edit({
                content: feedback,
                embeds: [createEmbed({
                    title: currentQ.question,
                    description: this.nhm.translate(currentQ.content || ""),
                    url: currentQ.link,
                    smallimage: currentQ.icon,
                    largeimage: currentQ.image,
                    footer: currentQ.footer !== undefined ? { text: currentQ.footer || ' ' } : null
                })],
                components: [row]
            });
        }
    }

    nextQuestion(feedback: string = '', embeds: Discord.APIEmbed[] = []) {
        if (this.questions[this.index + 1]) {
            this.index += 1;
            this.updateQuestion(feedback);
        } else {
            this.message.edit({
                content: this.nhm.translate(feedback || ""),
                embeds: embeds,
                components: []
            });
        }
    }

    delete() {
        QUIZZES.delete(this.quizid);
    }
}

export default OrangeQuiz
export { OrangeQuiz, OrangeQuestion, quizHandler, registerQuiz };
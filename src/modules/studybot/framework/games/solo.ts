import { APIEmbed, Message, User } from "discord.js";
import OrangeQuizBase, { OrangeQuestion } from "../presentation/quiz.js";
import createEmbed from "../presentation/embed.js";

export default function (message: Message, participants: User[], questions: OrangeQuestion[], topic: string) {
    const quiz = new OrangeQuizBase(questions, message, participants, (user, answer, question, finished) => {
        // parameter validation (autoskip if necessary)
        if (question.answer && question.choices) {
            // check answer
            if (question.answer.includes(question.choices[answer]) && !finished) {
                quiz.nextQuestion(":white_check_mark: That's right! Now try this question:");
                return;
            }
            // check finished
            if (finished) {
                const summaryEmbed = createEmbed({
                    title: `Solo quiz ${topic === "*" ? "" : `for topic **${topic}**`}`,
                    description: `Your score: ${quiz.answers.filter(a => a.correct).length}/${quiz.answers.length}`,
                });

                if (question.answer.includes(question.choices[answer])) {
                    quiz.nextQuestion("", [summaryEmbed as APIEmbed]);
                } else {
                    quiz.nextQuestion(`:bulb: Not quite.\n${question.explanation}`, [summaryEmbed as APIEmbed]);
                }
                
                return;
            }

            quiz.nextQuestion(`:bulb: Not quite.\n${question.explanation}`);
        }
    });
}
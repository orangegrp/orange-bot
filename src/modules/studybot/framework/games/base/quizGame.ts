import { Message, User } from "discord.js";
import OrangeQuizBase, { OrangeQuestion } from "../../presentation/quiz.js";
import { EventEmitter } from 'events';

type OrangeQuizEventType = "QuizBegin" | "QuizEnd" | "AnswerReceived" | "AnswersReceived" | "NextQuestion";

type OrangeQuizStartEvent = (quizBase: OrangeQuizBase) => void;
type OrangeQuizAnswerEvent = (user: User, correct: boolean, question: OrangeQuestion, answer: number, quizBase: OrangeQuizBase) => void;
type OrangeQuizAnswersEvent = (correct: User[], incorrect: User[], question: OrangeQuestion, quizBase: OrangeQuizBase) => void;
type OrangeQuizEndEvent = (correct: User[], incorrect: User[], question: OrangeQuestion, quizBase: OrangeQuizBase) => void;
type OrangeQuizNextQuestionEvent = (question: OrangeQuestion, quizBase: OrangeQuizBase) => void; 

/**
 * we want to handle
 * - quiz starts (first question begins)
 * - quiz ends (last question answered fully)
 * - when a user answers (question not finished, keep waiting for others or timeout)
 * - when all users have answered (question finished, next question ready)
 */

class OrangeQuiz extends EventEmitter {
    quizBase: OrangeQuizBase;
    answeredUsers: User[] = [];
    correctUsers: User[] = [];
    incorrectUsers: User[] = [];

    constructor(message: Message, participants: User[], questions: OrangeQuestion[], topic: string) {
        super();
        this.quizBase = new OrangeQuizBase(questions, message, participants, this.baseCallback);
        this.emit("QuizBegin" as OrangeQuizEventType, this.quizBase);
    }

    baseCallback(user: User, answer: number, question: OrangeQuestion, finished: boolean) {
        this.answeredUsers.push(user);

        if (this.answeredUsers === this.quizBase.users) {
            if (finished) {
                this.emit("QuizEnd" as OrangeQuizEventType, this.correctUsers, this.incorrectUsers, question, this.quizBase);
            } else {
                this.emit("AnswersReceived" as OrangeQuizEventType, this.correctUsers, this.incorrectUsers, question, this.quizBase);
            }

            this.answeredUsers.splice(0, this.answeredUsers.length);
            this.correctUsers.splice(0, this.correctUsers.length);
            this.incorrectUsers.splice(0, this.incorrectUsers.length);
        } else {
            if (question.answer && question.choices) {
                const correct = question.answer.includes(question.choices[answer]);
                if (correct) {
                    this.correctUsers.push(user);
                } else {
                    this.incorrectUsers.push(user);
                }
                
                this.emit("AnswerReceived" as OrangeQuizEventType, user, correct, question, answer, this.quizBase);
            }
        }
    }
}

export default OrangeQuiz;
export { OrangeQuiz, OrangeQuizStartEvent, OrangeQuizAnswerEvent, OrangeQuizAnswersEvent, OrangeQuizEndEvent, OrangeQuizNextQuestionEvent };

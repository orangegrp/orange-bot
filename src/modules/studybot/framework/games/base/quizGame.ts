import { Message, User } from "discord.js";
import OrangeQuizBase, { OrangeQuestion } from "../../presentation/quiz";

type OrangeQuizEventType = "QuizBegin" | "QuizEnd" | "AnswerReceived" | "AnswersReceived" | "NextQuestion";

type OrangeQuizStartEvent = () => void;
type OrangeQuizAnswerEvent = (user: User, correct: boolean, question: OrangeQuestion, answer: number) => void;
type OrangeQuizAnswersEvent = (correct: User[], incorrect: User[], question: OrangeQuestion) => void;
type OrangeQuizEndEvent = (correct: User[], incorrect: User[], question: OrangeQuestion) => void;
type OrangeQuizNextQuestionEvent = (question: OrangeQuestion) => void; 

type OrangeQuizEvent = OrangeQuizStartEvent | OrangeQuizAnswerEvent | OrangeQuizAnswersEvent | OrangeQuizEndEvent | OrangeQuizNextQuestionEvent;


/**
 * we want to handle
 * - quiz starts (first question begins)
 * - quiz ends (last question answered fully)
 * - when a user answers (question not finished, keep waiting for others or timeout)
 * - when all users have answered (question finished, next question ready)
 * - when the next question is presented (except first and last)
 */


class OrangeQuiz {
    quizBase: OrangeQuizBase;
    eventMap: Map<OrangeQuizEventType, OrangeQuizEvent> = new Map<OrangeQuizEventType, OrangeQuizEvent>();
    answeredUsers: User[] = [];

    constructor(message: Message, participants: User[], questions: OrangeQuestion[], topic: string) {
        this.quizBase = new OrangeQuizBase(questions, message, participants, this.baseCallback);
        const quiz_start = this.eventMap.get("QuizBegin");
        if (quiz_start) quiz_start();
    }

    baseCallback(user: User, answer: number, question: OrangeQuestion, finished: boolean) {
        this.answeredUsers.push(user);

        if (this.answeredUsers === this.quizBase.users) {
            const quiz_answers = this.eventMap.get("AnswersReceived");
            if (quiz_answers) quiz_answers(this.answeredUsers, this.quizBase.users.filter(u => !this.answeredUsers.includes(u)), question);
        }
    }

    on(event: OrangeQuizEventType, callback: () => void) {
        this.eventMap.set(event, callback);
    }
}

export default OrangeQuiz;
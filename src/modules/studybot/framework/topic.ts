import { pb, initDb } from "../../../core/pocketbase.js";
import { OrangeSlide, OrangeSlideshow } from "./presentation/slideshow.js";
import { getClosestMatches } from "../../../core/functions.js";
import { CachedLookup } from "orange-bot-base";
import { RecordModel } from "pocketbase";
import { Message } from "discord.js";
import OrangeQuizBase, { OrangeQuestion } from "./presentation/quiz.js";

async function getAllTopics(type: "slides" | "questions") {
    const topics = await pb.collection(`x_studybot_${type}`).getFullList(200, { fields: "category" });
    return [...new Set(topics)].map((record) => (record as RecordModel & { category: string }).category);
}

const studyTopicList: CachedLookup<null, string[]> = new CachedLookup(async () => await getAllTopics("slides"));
const quizTopicList: CachedLookup<null, string[]> = new CachedLookup(async () => await getAllTopics("questions"));


async function getTopic(originalMessage: Message<boolean>, type: "slides" | "questions", topic: string, count: number = 200) {
    if (!pb)
        await initDb();

    const data = await pb.collection(`x_studybot_${type}`).getFullList(count, {
        filter: topic === "*" ? '' : `category = "${topic.replace("\"", "\\\"")}"`,
        sort: type === "questions" ? '' : '+sequence',
    });

    if (data.length === 0) {
        originalMessage.edit(":upside_down: I can't find that topic in my knowledge base. It might get added soon though.");
        return;
    }

    if (type === "slides") {
        const slides = data.map((slide) => slide as RecordModel & OrangeSlide);
        return slides;
    } else if (type === "questions") {
        const questions = data.map((question) => question as RecordModel & OrangeQuestion);
        return questions;
    }
}

async function getTopicList(topic_query: string, type: "slides" | "questions"): Promise<string[]> {
    let list = await (type === "slides" ? studyTopicList : quizTopicList).get(null);

    if (list === undefined) {
        return [] as string[];
    }

    let result = getClosestMatches(topic_query, list);

    if (result === undefined) {
        return [] as string[];
    }

    return result;
}


export default getTopic;
export { getTopic, getTopicList };


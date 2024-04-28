import { CachedLookup } from "orange-bot-base";
import { pb, initDb } from "../../../core/pocketbase.js";
import { OrangeSlide, OrangeSlideshow } from "../presentation/slideshow.js";
import { RecordModel } from "pocketbase";
import { Message } from "discord.js";
import { damerauLevenshtein, getClosestMatches } from "../../../core/functions.js";
import { getLogger } from "orange-common-lib";

const logger = getLogger("studyTopic");

async function getAllTopics() {
    const topics = await pb.collection("x_studybot_slides").getFullList(200, { fields: "category" });
    return [...new Set(topics)].map((record) => (record as RecordModel & { category: string }).category);
}

const topicList: CachedLookup<null, string[]> = new CachedLookup(async () => await getAllTopics());

async function studyTopic(originalMessage: Message<boolean>, topic: string) {
    if (!pb)
        await initDb();

    const data = await pb.collection("x_studybot_slides").getFullList(200, {
        filter: `category = "${topic.replace("\"", "\\\"")}"`,
        sort: '+sequence',
    });

    if (data.length === 0) {
        originalMessage.edit(":upside_down: I can't find that topic in my knowledge base. It might get added soon though.");
        return;
    }

    const slides = data.map((slide) => slide as RecordModel & OrangeSlide);

    return new OrangeSlideshow(slides, originalMessage);
}

async function getTopicList(topic_query: string): Promise<string[]> {
    let list = await topicList.get(null);

    if (list === undefined) {
        return [] as string[];
    }

    let result = getClosestMatches(topic_query, list);

    if (result === undefined) {
        return [] as string[];
    }

    return result;
}


export default studyTopic;
export { studyTopic, getTopicList };


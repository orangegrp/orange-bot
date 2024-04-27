import { CachedLookup } from "orange-bot-base";
import { pb, initDb } from "../../../core/pocketbase.js";
import { OrangeSlide, OrangeSlideshow } from "../presentation/slideshow.js";
import { RecordModel } from "pocketbase";
import { Message } from "discord.js";
import { damerauLevenshtein } from "../../../core/functions.js";
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

async function getTopicList(topic_query: string) {
    const max_suggestions = 25;

    let similarity_threshold = 10;
    let exact_match: string | undefined = "";
    let closest_item: { item: string, distance: number }[] = [];
    let list = await topicList.get(null);

    console.dir(list);

    if (!list) {
        return [];
    }

    for (const item of list) {
        if (!item) {
            continue;
        }

        if (topic_query === item) {
            return [item];
        }

        const query_items = topic_query.includes("-") ? topic_query.split("-") : topic_query.split(' ');
        const list_items = item.includes("-") ? item.split("-") : [item]

        if (query_items.length > list_items.length) {
            continue;
        }

        let d = 0;

        for (let i = 0; i < list_items.length; i++) {
            for (let j = 0; j < query_items.length; j++) {
                d += damerauLevenshtein(list_items[i].toLowerCase(), query_items[j].toLowerCase());
            }
        }

        logger.verbose(`${item}, d: ${d}, for: ${topic_query}`);

        if (d <= similarity_threshold) {
            closest_item.push({ item: item, distance: d });
        }
    }

    logger.verbose(`exact match: ${exact_match}`);

    const closest25 = closest_item.sort((a, b) => a.distance - b.distance).slice(0, max_suggestions).map(obj => obj.item);
    logger.verbose(`closest_item: ${closest25.join(', ')}`);
    
    return [... new Set(closest25)];
}

export default studyTopic;
export { studyTopic, getTopicList };


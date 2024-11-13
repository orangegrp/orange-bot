import { CachedLookup } from "orange-bot-base";
import { supabase } from "../../core/supabase.js";
import { environment, getLogger } from "orange-common-lib";

const logger = getLogger("StudyBot Resource Manager");

const studyBotQuestions: CachedLookup<null, string[]> = new CachedLookup(async () => await getAllQuestions());
const studyBotMaterials: CachedLookup<null, string[]> = new CachedLookup(async () => await getAllStudyMaterials());


async function getAllItems(bucket: string): Promise<string[]> {
    const { data, error } = await (await supabase()).storage.from(bucket).list();

    if (error) {
        logger.warn(`Failed to list all content. ${error}`);
        return [];
    }

    if (data) {
        console.log(data);
        return data.map(item => item.name.replace(/\.json$/, ""));
    } else {
        logger.warn("Failed to list content. `data` was undefined.");
        return [];
    }
}

async function getAllQuestions(): Promise<string[]> {
    return await getAllItems("studybot-questions");
}

async function getAllStudyMaterials(): Promise<string[]> {
    return await getAllItems("studybot-content");
}

async function getItem(name: string, bucket: "studybot-questions" | "studybot-content"): Promise<StudyBotJson | undefined> {
    const { data, error } = await (await supabase()).storage.from(bucket).download(name + ".json");

    if (error) {
        logger.warn(`Failed to download content. ${error}`);
        return undefined;
    }

    if (data) {
        return JSON.parse(await data.text()) as StudyBotJson;
    } else {
        logger.warn("Failed to download content. `data` was undefined.");
        return undefined;
    }
}

export const S3_PUBLIC_MEDIA_BUCKET = `${environment.SUPABASE_SERVER}/storage/v1/object/public/studybot-media`;
export { studyBotQuestions, studyBotMaterials, getItem, getAllQuestions };

export type StudyBotMultiChoiceQuestion = {
    ref: string,
    question: string,
    topic: string,
    description?: string
    referenceImg?: string,
    answerOptions: { id: string, text: string }[],
    correctAnswerIds: string[],
    explanation?: string
};

export type StudyBotStudyMaterial = {
    ref: string,
    title: string,
    description: string,
    referenceImg?: string
    sourceIcon?: string
    sourceUrl?: string
};

export type StudyBotMetainfo = {
    type: "Question" | "StudyMaterial",
    durationMins: number
    passScore: number
};

export type StudyBotJson = {
    ref: string,
    type: "Question" | "StudyMaterial",
    metaInfo: StudyBotMetainfo,
    data: StudyBotMultiChoiceQuestion[] | StudyBotStudyMaterial[]
};
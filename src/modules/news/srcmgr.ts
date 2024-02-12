import path from "path";
import fs from "fs";
import { NewsConfig, NewsSource } from "./news";
import { getLogger } from "orange-common-lib";
import crypto from "crypto";

const logger = getLogger("news srcMgr");
const config_file_path = path.resolve("config", "news.json");
var config: NewsConfig | null = null;

function getSourceHashExceptId(source: NewsSource) {
    const hashAttribs = [
        source.name,
        source.aiSummary,
        source.crawl,
        source.feedType,
        source.feedUrl,
    ];

    return crypto.createHash("md5").update(hashAttribs.join("")).digest("hex");
}

function initSources() {
    if (fs.existsSync(config_file_path)) {
        logger.log(`Reading news config from ${config_file_path} ...`);
        config = JSON.parse(fs.readFileSync(config_file_path).toString());
    } else {
        logger.log(`Creating ${config_file_path} ...`);

        config = {
            enabled: false,
            channel_id: "",
            sources: []
        }

        fs.writeFileSync(config_file_path, JSON.stringify(config));
    }
}

function saveSources() {
    logger.log(`Saving news config to ${config_file_path} ...`);
    fs.writeFileSync(config_file_path, JSON.stringify(config));
}

function reloadSoruces() {
    logger.log(`Reloading news config from ${config_file_path} ...`);
    config = null;
    initSources();
}

function addSource(source: NewsSource) {
    if (config) {
        const source_hash = getSourceHashExceptId(source);

        if (config.sources.find(s => getSourceHashExceptId(s) === source_hash)) {
            throw new Error("News source failed distinct hash validation check.");
        }

        logger.log(`Adding news source "${source.name}" with id "${source.id}" to ${config_file_path} ...`);
        config.sources.push(source);
        saveSources();
    } else {
        initSources();
        addSource(source);
    }
}

function removeSource(source_id: string) {
    if (config) {
        logger.log(`Removing news source with id "${source_id}" from ${config_file_path} ...`);
        config.sources = config.sources.filter(source => source.id !== source_id);
        saveSources();
    } else {
        initSources();
        removeSource(source_id);
    }
}

function getSource(source_id: string): NewsSource | null {
    if (config) {
        return config.sources.find(source => source.id === source_id) || null;
    } else {
        initSources();
        return getSource(source_id);
    }
}

function getSources(): NewsSource[] | null {
    if (config) {
        return config.sources;
    } else {
        initSources();
        return getSources();
    }
}

function updateSource(source_id: string, source: NewsSource) {
    if (config) {
        logger.log(`Updating news source with id "${source_id}" in ${config_file_path} ...`);
        config.sources = config.sources.map(s => s.id === source_id ? source : s);
        saveSources();
    } else {
        initSources();
        updateSource(source_id, source);
    }
}

export { initSources, reloadSoruces, addSource, removeSource, getSource, getSources, updateSource };
import path from "path";
import fs from "fs";
import { NewsGuildConfig, NewsConfig, NewsSource } from "./news";
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
            guilds: {}
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

function addSource(gid: string, source: NewsSource) {
    if (config) {
        const source_hash = getSourceHashExceptId(source);

        if (config.guilds[gid].sources.find(s => getSourceHashExceptId(s) === source_hash)) {
            throw new Error("News source failed distinct hash validation check.");
        }

        logger.log(`Adding news source "${source.name}" with id "${source.id}" to ${config_file_path} ...`);
        config.guilds[gid].sources.push(source);
        saveSources();
    } else {
        initSources();
        addSource(gid, source);
    }
}

function removeSource(gid: string, source_id: string) {
    if (config) {
        logger.log(`Removing news source with id "${source_id}" from ${config_file_path} ...`);
        config.guilds[gid].sources = config.guilds[gid].sources.filter(source => source.id !== source_id);
        saveSources();
    } else {
        initSources();
        removeSource(gid, source_id);
    }
}

function getSource(gid: string, source_id: string): NewsSource | null {
    if (config) {
        return config.guilds[gid].sources.find(source => source.id === source_id) || null;
    } else {
        initSources();
        return getSource(gid, source_id);
    }
}

function getSources(gid: string): NewsSource[] | null {
    if (config) {
        return config.guilds[gid].sources;
    } else {
        initSources();
        return getSources(gid);
    }
}

function getSettings(): Omit<NewsConfig, "guilds"> {
    return config ? config : function (): Omit<NewsConfig, "guilds"> { initSources(); return getSettings(); }();
}

function getGuildSettings(gid: string): Omit<NewsGuildConfig, "sources"> | null {
    if (config) {
        return config.guilds[gid];
    } else {
        initSources();
        return getGuildSettings(gid);
    }
}

function updateSource(gid: string, source_id: string, source: NewsSource) {
    if (config) {
        logger.log(`Updating news source with id "${source_id}" in ${config_file_path} for guild ${gid }...`);
        config.guilds[gid].sources = config.guilds[gid].sources.map(s => s.id === source_id ? source : s);
        saveSources();
    } else {
        initSources();
        updateSource(gid, source_id, source);
    }
}

function setSettings(settings: Omit<NewsConfig, "guilds">) {
    if (config) {
        logger.log(`Updating news config in ${config_file_path} ...`);
        Object.assign(config, settings);
        saveSources();
    } else {
        initSources();
        setSettings(settings);
    }
    saveSources();
}

function setGuildSettings(gid: string, settings: Omit<NewsGuildConfig, "sources">) {
    if (config) {
        logger.log(`Updating news config in ${config_file_path} for guild ${gid} ...`);
        Object.assign(config.guilds[gid], settings);
        saveSources();
    } else {
        initSources();
        setGuildSettings(gid, settings);
    }
}

function addGuild(gid: string, settings: NewsGuildConfig) {
    if (config) {
        logger.log(`Adding news config in ${config_file_path} for guild ${gid} ...`);
        config.guilds[gid] = settings;
        saveSources();
    } else {
        initSources();
        addGuild(gid, settings);
    }
}

function removeGuild(gid: string) {
    if (config) {
        logger.log(`Deleting news config in ${config_file_path} for guild ${gid} ...`);
        delete config.guilds[gid];
        saveSources();
    } else {
        initSources();
        removeGuild(gid);
    }
}

export { initSources, reloadSoruces, addSource, removeSource, getSource, getSources, updateSource, getSettings, setSettings, getGuildSettings, setGuildSettings, addGuild, removeGuild };
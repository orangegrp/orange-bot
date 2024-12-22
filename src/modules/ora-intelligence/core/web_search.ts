import fetch from "node-fetch";
import { sleep } from "orange-common-lib";
import { getLogger } from "orange-common-lib";

const logger = getLogger("web_search");

/**
 * @description Performs a web search using the Brave search API.
 * @param {string} searchQuery The query to search for.
 * @param {string} [region="ALL"] The region to search within. Defaults to "ALL".
 * @param {"news"|"videos"|"web"|"images"|"all"} [searchType="all"] The type of search to perform. Defaults to "all".
 * @param {string|null|undefined} [freshness] The freshness of the search results. Defaults to undefined.
 * @returns {boolean|{images: string[]}|{[searchType]: any}} The search results. If searchType is "images", returns an object with an "images" property containing an array of image URLs. If searchType is "all", returns an object containing all search results. If searchType is any other value, returns the search results for that type. If the search fails, returns false.
 */
async function performWebSearch(searchQuery: string, region: string = "ALL", searchType: "news" | "videos" | "web" | "images" | "all" = "all", freshness: string | null | undefined = null) {
    const image_url = `https://api.search.brave.com/res/v1/images/search?count=4&safesearch=off&q=`
    const search_url = `https://api.search.brave.com/res/v1/web/search?summary=true&extra_snippets=true&country=${encodeURIComponent(region)}&count=5&safesearch=off&q=`;
    const api_key = process.env.BRAVE_API_KEY;

    if (!api_key) return false;

    logger.log(`${searchType} search for "${searchQuery}", in region "${region}", with a freshness of ${freshness}...`);

    await sleep(1000); // prevent brave from getting angry

    try {
        if (searchType === "images") {
            const result = await fetch(`${image_url}${encodeURIComponent(searchQuery)}`, {
                headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": api_key }
            });

            const json_result = await result.json();
            let urls = [];
            for (const image_result of json_result.results) {
                urls.push(image_result.properties.url);
            }
            return { images: urls };
        } else {
            const result = await fetch(`${search_url}${encodeURIComponent(searchQuery)}${freshness !== null && freshness !== undefined ? `&freshness=${encodeURIComponent(freshness)}` : ""}`, {
                headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": api_key }
            });

            const json_result = await result.json();

            if (searchType === "all")
                return json_result;
            else {
                const specific_result = json_result[searchType];
                return specific_result === undefined ? json_result : specific_result;
            }
        }
    } catch {
        return false;
    }
}

export { performWebSearch };
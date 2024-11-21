import fetch from "node-fetch";
import { sleep } from "orange-common-lib";
import util from "util";
import { getLogger } from "orange-common-lib";

const logger = getLogger("web_search");

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
            //console.log(util.inspect(json_result, { depth: null }));
            if (searchType === "all")
                return json_result;
            else {
                const specific_result = json_result[searchType];
                if (specific_result === undefined)
                    return json_result;
                else
                    return specific_result;
            }
        }
    }  catch  {
        return false;
    }
}

export { performWebSearch };
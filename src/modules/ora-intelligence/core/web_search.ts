import fetch from "node-fetch";
import { sleep } from "orange-common-lib";
import util from "util";

async function performWebSearch(query: string) {
    const url = "https://api.search.brave.com/res/v1/web/search?count=5&safesearch=off&q=";
    const api_key = process.env.BRAVE_API_KEY;

    if (!api_key) return false;

    await sleep(1000); // prevent brave from getting angry

    try {
        const result = await fetch(`${url}${encodeURIComponent(query)}`, {
            headers: { "Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": api_key }
        });
        
        const json_result = await result.json();
        //console.log(util.inspect(json_result, { depth: null }));
        return json_result;
    }  catch  {
        return false;
    }
}

export { performWebSearch };
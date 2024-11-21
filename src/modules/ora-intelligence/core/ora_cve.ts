import { Message } from "discord.js";
import { AssistantCore } from "../openai/assistant_core.js";
import { sleep } from "orange-common-lib";
import { getCveInfoData } from "../../cve/cveApi.js";

type OraCveInputData = {
    cve_id: string
    cwe_ids: string[],
    description: string,
    cvss_data: {
        v4: number,
        v3_1: number,
        v3: number,
        v2: number,
    },
    vendor_data: {
        vendors: string[],
        products: string[],
    }
    dateSubmitted: string
};

class OraCve extends AssistantCore {
    constructor(assistant_id: string, model: string = "gpt-4o-mini") {
        super("ora_cve", assistant_id, model);
    }
    async askOra(cve_id: string) {
        const data = await getCveInfoData(cve_id);
        if (!data) return false;

        let [vendors, products] = data.vendors.map(entry => {
            const [vendor, product] = entry.split("$PRODUCT$").slice(0, 2);
            return [vendor, product];
        }).reduce((acc, [vendor, product]) => {
            if (vendor !== undefined)
                acc[0].push(vendor);
            if (product !== undefined)
                acc[1].push(product); 
            return acc;
        }, [[] as string[], [] as string[]]);


        vendors = [...new Set(vendors)];
        products = [...new Set(products)];

        if (vendors.length > 24) {
            vendors = vendors.slice(0, 24);
            vendors.push('...');
        }

        if (products.length > 24) {
            products = products.slice(0, 24);
            products.push('...');
        }

        const simplified_data: OraCveInputData = {
            cve_id: data.cve_id,
            cwe_ids: data.weaknesses,
            description: data.description,
            cvss_data: {
                v4: data.metrics.cvssV4_0.data.score ?? -1,
                v3_1: data.metrics.cvssV3_1.data.score ?? -1,
                v3: data.metrics.cvssV3_0.data.score ?? -1,
                v2: data.metrics.cvssV2_0.data.score ?? -1,
            },
            vendor_data: {
                vendors: vendors,
                products: products,
            },
            dateSubmitted: data.created_at
        };
        
        const json = JSON.stringify(simplified_data);

        const thread = await super.createNewThread();
        if (!thread) return false;

        const ai_input = await super.createThreadMessage(thread.id, json);
        if (!ai_input) return false;

        const run_id = await this.run(thread.id);
        if (!run_id) return false;
        
        const run = await this.waitForResponse(thread.id, run_id);
        if (!run) return false;
        
        const response = await this.getResponse(thread.id);
        if (!response) return false;
        
        return response.content.filter(t => t.type === "text").map(t => t.text.value).join("\n");
    }
    private async run(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        const run = await super.runThread(thread.id);
        if (!run) return false;
        return run.id;
    }
    private async waitForResponse(thread_id: string, run_id: string, typingIndicatorFunction: Function | undefined = undefined) {
        let run = await super.getThreadRun(thread_id, run_id);
        for (let i = 0; i < 100; i++) {
            run = await super.getThreadRun(thread_id, run_id);
            if (!run || run.status === "in_progress" || run.status === "queued") await sleep(100);
            else break;
            
            if (typingIndicatorFunction) typingIndicatorFunction();
        }
        if (!run) return false;
        return run;
    }
    private async getResponse(thread_id: string) {
        const messages = await super.getThreadMessages(thread_id);
        if (!messages || messages.data.length < 1) return false;
        const lastMessage = messages.data[0];
        if (lastMessage.role !== "assistant") return false;
        return lastMessage;
    }
}

export { OraCve };
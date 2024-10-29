/// cveInfo.ts - cve module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 28/04/2024.

import { getLogger, environment } from "orange-common-lib";
import util from "util";
import { OpenCveV2CveSearch, OpenCveV2InfoResult } from "./cve2";

const logger = getLogger("CVE API");

/**
 * OpenCVE.io API request wrapper.
 * @param query_url Full API request URL.
 * @returns `JSON` response, type `any` or undefined if error.
 */
async function openCveApiRequest(query_url: string) {
    //logger.log(`${environment.OPENCVE_USER} : ${environment.OPENCVE_PASS}`);
    const response = await fetch(query_url, {
        headers:
        {
            'Authorization': 'Basic ' + Buffer.from(environment.OPENCVE_USER + ":" + environment.OPENCVE_PASS).toString('base64'),
            'Accept': 'application/json'
        }
    });
    
    console.log(query_url);

    if (response.status === 404) {
        return undefined;
    } else if (!`${response.status}`.startsWith("20")) {
        logger.error(util.inspect(response, { depth: null }));
        throw new Error(`Failed to retrieve data. Server returned code ${response.status}`);
    }

    const x =  await response.json();
    console.log(util.inspect(x, { depth: null }));
    return  x;
}

/**
 * CVE search method.
 * @param args Object containing optional parameters: `keyword`, `vendor`, `product`, `cvss`, `cwe`
 * @param page Page number to query.
 * @returns Lookup result.
 */
async function getCvesData(args: { keyword?: string | null, vendor?: string | null, product?: string | null, cvss?: string | null, cwe?: string | null }, page: number = 1): Promise<OpenCveV2CveSearch | undefined> {
    let api_url = 'https://app.opencve.io/api/cve';
    const append_query = (param: string, value: string) => api_url += `${(api_url.endsWith("/cve") ? '?' : "&")}${param}=${value}`;

    for (const [key, value] of Object.entries(args)) {
        if (key && value) append_query(key, value);
    }

    if (page > 1) {
        append_query("page", page.toString());
    }
    
    return await openCveApiRequest(api_url) as OpenCveV2CveSearch; //as OpenCveAPIResults;
}

/**
 * CVE ID lookup method.
 * @param cveid Common vulnerabilites and exposures (CVE) identifier.
 * @returns Lookup result.
 */
async function getCveInfoData(cveid: string): Promise<OpenCveV2InfoResult | undefined> {
    let api_url = 'https://app.opencve.io/api/cve/' + encodeURIComponent(cveid);
    return await openCveApiRequest(api_url) as OpenCveV2InfoResult;//as OpenCveAPIResultsInfo;
}

/**
 * {deprecated} CWE ID lookup method.
 * @param cweid Common Weakness and Exploitation (CWE) identifier.
 * @returns Lookup result.
 */
async function getCweInfoData(cweid: string): Promise<OpenCweAPICweResultsInfo | undefined> {
    let api_url = 'https://app.opencve.io/api/cwe/' + encodeURIComponent(cweid);
    return await openCveApiRequest(api_url) as OpenCweAPICweResultsInfo;
}

export { getCvesData, getCveInfoData, getCweInfoData };
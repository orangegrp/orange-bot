/// cveInfo.ts - cve module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 28/04/2024.

/**
 * OpenCVE.io API request wrapper.
 * @param query_url Full API request URL.
 * @returns `JSON` response, type `any` or undefined if error.
 */
async function openCveApiRequest(query_url: string) {
    const response = await fetch(query_url, {
        headers:
        {
            'Authorization': 'Basic ' + Buffer.from(process.env.OPENCVE_USER + ":" + process.env.OPENCVE_PASS).toString('base64'),
            'Accept': 'application/json'
        }
    });

    if (response.status === 404) {
        return undefined;
    } else if (!`${response.status}`.startsWith("20")) {
        throw new Error(`Failed to retrieve data. Server returned code ${response.status}`);
    }

    return response.json();
}

/**
 * CVE search method.
 * @param args Object containing optional parameters: `keyword`, `vendor`, `product`, `cvss`, `cwe`
 * @param page Page number to query.
 * @returns Lookup result.
 */
async function getCvesData(args: { keyword?: string | null, vendor?: string | null, product?: string | null, cvss?: string | null, cwe?: string | null }, page: number = 1): Promise<OpenCveAPIResults | undefined> {
    let api_url = 'https://www.opencve.io/api/cve';
    const append_query = (param: string, value: string) => api_url += `${(api_url.endsWith("/cve") ? '?' : "&")}${param}=${value}`;

    for (const [key, value] of Object.entries(args)) {
        if (key && value) append_query(key, value);
    }

    if (page > 1) {
        append_query("page", page.toString());
    }
    
    return await openCveApiRequest(api_url) as OpenCveAPIResults;
}

/**
 * CVE ID lookup method.
 * @param cveid Common vulnerabilites and exposures (CVE) identifier.
 * @returns Lookup result.
 */
async function getCveInfoData(cveid: string): Promise<OpenCveAPIResultsInfo | undefined> {
    let api_url = 'https://www.opencve.io/api/cve/' + encodeURIComponent(cveid);
    return await openCveApiRequest(api_url) as OpenCveAPIResultsInfo;
}

/**
 * CWE ID lookup method.
 * @param cweid Common Weakness and Exploitation (CWE) identifier.
 * @returns Lookup result.
 */
async function getCweInfoData(cweid: string): Promise<OpenCweAPICweResultsInfo | undefined> {
    let api_url = 'https://www.opencve.io/api/cwe/' + encodeURIComponent(cweid);
    return await openCveApiRequest(api_url) as OpenCweAPICweResultsInfo;
}

export { getCvesData, getCveInfoData, getCweInfoData };
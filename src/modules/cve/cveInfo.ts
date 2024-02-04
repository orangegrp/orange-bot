async function getCvesData(args: { keyword?: string | null, vendor?: string | null, product?: string | null, cvss?: string | null, cwe?: string | null }, page: number = 1): Promise<OpenCveAPIResults | undefined> {
    let api_url = 'https://www.opencve.io/api/cve';
    const append_query = (param: string, value: string) => api_url.endsWith("/cve") ? (api_url += `?${param}=${value}`) : (api_url += `&${param}=${value}`);

    if (args.keyword) {
        append_query("search", args.keyword);
    }
    if (args.vendor) {
        append_query("vendor", args.vendor);
    }
    if (args.product) {
        append_query("product", args.product);
    }
    if (args.cvss) {
        append_query("cvss", args.cvss);
    }
    if (args.cwe) {
        append_query("cwe", args.cwe);
    }
    if (page > 1) {
        append_query("page", page.toString());
    }

    const response = await fetch(api_url, { headers: 
        { 'Authorization': 'Basic ' + Buffer.from(process.env.OPENCVE_USER + ":" + process.env.OPENCVE_PASS).toString('base64'),
          'Accept': 'application/json' }});
    
    const res_json = await response.json();

    if (response.status === 404 || res_json === undefined || res_json.length < 1) {
        return undefined;
    } else if (!`${response.status}`.startsWith("20")){
        throw new Error(`Failed to retrieve data. Code: ${response.status}`);
    }

    return res_json as OpenCveAPIResults;
}

async function getCveInfoData(cveid: string): Promise<OpenCveAPIResultsInfo | undefined> {
    let api_url = 'https://www.opencve.io/api/cve/' + encodeURIComponent(cveid);

    const response = await fetch(api_url, { headers: 
        { 'Authorization': 'Basic ' + Buffer.from(process.env.OPENCVE_USER + ":" + process.env.OPENCVE_PASS).toString('base64'),
          'Accept': 'application/json' }});

    const res_json = await response.json();

    if (response.status === 404 || res_json === undefined || res_json.length < 1) {
        return undefined;
    } else if (!`${response.status}`.startsWith("20")){
        throw new Error(`Failed to retrieve data. Code: ${response.status}`);
    }

    return res_json as OpenCveAPIResultsInfo;
}

async function getCweInfoData(cweid: string): Promise<OpenCweAPICweResultsInfo | undefined> {
    let api_url = 'https://www.opencve.io/api/cwe/' + encodeURIComponent(cweid);

    const response = await fetch(api_url, { headers: 
        { 'Authorization': 'Basic ' + Buffer.from(process.env.OPENCVE_USER + ":" + process.env.OPENCVE_PASS).toString('base64'),
          'Accept': 'application/json' }});

    const res_json = await response.json();

    if (response.status === 404 || res_json === undefined || res_json.length < 1) {
        return undefined;
    } else if (!`${response.status}`.startsWith("20")){
        throw new Error(`Failed to retrieve data. Code: ${response.status}`);
    }

    return res_json as OpenCweAPICweResultsInfo;
}

export { getCvesData, getCveInfoData, getCweInfoData };
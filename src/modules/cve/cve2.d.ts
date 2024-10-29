type OpenCveV2CveSearch = {
    count: number,
    next: string,
    previous: string,
    results: OpenCveV2CveSearchResult[]
};

type OpenCveV2CveSearchResult = {
    created_at: string,
    updated_at: string,
    cve_id: string,
    description: string,
};

// cwe search is removed

type OpenCveV2InfoResult = {
    created_at: string,
    updated_at: string,
    cve_id: string,
    title: string,
    description: string,
    metrics: {
        key: { data: {}, proivder: null },
        ssvc: { data: {}, provider: null },
        cvssV2_0: { data: { score: number, vector: string }, provider: string },
        cvssV3_0: { data: { score: number, vector: string }, provider: string },
        cvssV3_1: { data: { score: number, vector: string }, provider: string },
        cvssV4_0: { data: {}, provider: null },
        threat_severity: { data: string, provider: string }
    },
    weaknesses: string[],
    vendors: string[]
}

export { OpenCveV2CveSearch, OpenCveV2CveSearchResult, OpenCveV2InfoResult };
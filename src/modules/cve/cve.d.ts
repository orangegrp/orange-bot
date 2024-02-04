type OpenCveAPIResults = {
    id: string,
    summary: string,
    created_at: string,
    upstringd_at: string
}[];

type OpenCweAPICweResultsInfo = {
    id: string,
    name: string, 
    description: string
};

type OpenCveAPIResultsInfo = {
    id: string,
    summary: string,
    created_at: string,
    upstringd_at: string,
    cvss: {
        v2: number,
        v3: number,
    }
    vendors: any,
    cwes: string[],
    raw_nvd_data: {
        cve: {
            data_type: string,
            references: {
                reference_data: {
                    url: string,
                    name: string,
                    tags: string[],
                    refsource: string
                }[]
            },
            data_format: string,
            description: {
                description_data: {
                    lang: string,
                    value: string
                }[]
            },
            problemtype: {
                problemtype_data: {
                    description: {
                        lang: string,
                        value: string
                    }[]
                }[]
            },
            data_version: string,
            CVE_data_meta: {
                ID: string,
                ASSIGNER: string
            }
        },
        impact: {
            baseMetricV2: {
                cvssV2: {
                    version: string,
                    baseScore: number,
                    accessVector: string,
                    vectorString: string,
                    authentication: string,
                    integrityImpact: string,
                    accessComplexity: string,
                    availabilityImpact: string,
                    confidentialityImpact: string
                },
                severity: string,
                acInsufInfo: boolean,
                impactScore: number,
                obtainAllPrivilege: boolean,
                exploitabilityScore: number,
                obtainUserPrivilege: boolean,
                obtainOtherPrivilege: boolean,
                userInteractionRequired: boolean
            },
            baseMetricV3: {
                cvssV3: {
                    scope: string,
                    version: string,
                    baseScore: number,
                    attackVector: string,
                    baseSeverity: string,
                    vectorString: string,
                    integrityImpact: string,
                    userInteraction: string,
                    attackComplexity: string,
                    availabilityImpact: string,
                    privilegesRequired: string,
                    confidentialityImpact: string
                },
                impactScore: number,
                exploitabilityScore: number
            }
        },
        publishedstring: string,
        configurations: {
            nodes: {
                operator: string,
                cpeMatch: {
                    criteria: string,
                    vulnerable: boolean,
                    matchCriteriaId: string
                }[]
            }[],
            CVE_data_version: string
        }[],
        lastModifiedstring: string
    }
};
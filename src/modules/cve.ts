import { ArgType, type Command } from "orange-bot-base/dist/command.js";
import { EmbedBuilder, InteractionEditReplyOptions, InteractionReplyOptions } from "discord.js";
import { decode } from "html-entities";
import type { Bot } from "orange-bot-base";
import { getLogger } from "orange-common-lib";

function removeHtmlTagsAndDecode(str: string | undefined, limitLength: number = -1): string | undefined {
    if (str === null || str === '' || str === undefined)
        return undefined;
    else
        str = str.toString();

    const old_str = decode(str.replace(/(<([^>]+)>)/ig, '').replace(/\[([\w\s]+)\]/g, '$1'));
    const new_str = old_str.substring(0, limitLength === -1 ? str.length : limitLength);
    return new_str + (new_str.length === old_str.length ? '' : '...');
}

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

async function getCves(args: { keyword?: string | null, vendor?: string | null, product?: string | null, cvss?: string | null, cwe?: string | null }, page: number = 1): Promise<InteractionReplyOptions> {
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
        return ( { embeds: [{
            title: `CVE Search`,
            description: 'No CVEs found',
            footer: { text: `Data from opencve.io` },
            timestamp: new Date().toISOString()
        }] });
    } else if (!`${response.status}`.startsWith("20")){
        return ( { embeds: [{
            title: `CVE Search`,
            description: 'Failed to retrieve data. Code: ' + response.status,
            footer: { text: `Data from opencve.io` },
            timestamp: new Date().toISOString()
        }] });
    }

    const data = res_json as OpenCveAPIResults;
    const len = Math.min(data.length, 5);
    
    const embed = new EmbedBuilder({
        title: `Top ${len} CVEs found`,
        description: 'Can\'t find what you are looking for? Try refining your search terms or use a CVE number.',
        footer: { text: `Data from opencve.io` }
    });

    for (let i = 0; i < len; i++) {
        embed.addFields( { name: data[i].id, value: removeHtmlTagsAndDecode(data[i].summary, 200)! } );
    }

    return { embeds: [embed] };
}

const command = {
    name: "cve",
    description: "CVE lookup utility",
    options: {
        info: {
            description: "Lookup a CVE number",
            args: {
                cve: {
                    type: ArgType.STRING,
                    description: "CVE number",
                    required: true
                }
            }
        },
        cwe: {
            description: "Lookup a CWE number",
            args: {
                cwe: {
                    type: ArgType.STRING,
                    description: "CWE number",
                    required: true
                }
            }
        },
        search: {
            description: "Search for a CVE",
            args: {
                keyword: {
                    type: ArgType.STRING,
                    description: "Filter by keyword in summary",
                    required: false
                },
                vendor: {
                    type: ArgType.STRING,
                    description: "Filter by vendor",
                    required: false
                },
                product: {
                    type: ArgType.STRING,
                    description: "Filter by product name",
                    required: false
                },
                cvss: {
                    type: ArgType.STRING,
                    description: "Filter by CVSS score",
                    choices: [
                        { name: "Low", value: "low" },
                        { name: "Medium", value: "medium" },
                        { name: "High", value: "high" },
                        { name: "Critical", value: "critical" }
                    ],
                    required: false
                },
                cwe: {
                    type: ArgType.STRING,
                    description: "Filter by CWE number",
                    required: false
                },
                page: {
                    type: ArgType.INTEGER,
                    description: "Page number",
                    required: false
                }
            }
        }
    }
} satisfies Command;

export default function (bot: Bot) { 
    bot.commandManager.addCommand(command, async (interaction, args) => {
        if (args.subCommand == "search") {
            if (args.product && !args.vendor) {
                await interaction.reply({embeds: [{
                    title: `CVE Search`,
                    description: 'Please specify a vendor in addition to product',
                    footer: { text: `Data from opencve.io` },
                    timestamp: new Date().toISOString()
                }]});
            } else {
                await interaction.deferReply();
                await interaction.editReply(await getCves( {
                    keyword: args.keyword,
                    vendor: args.vendor,
                    product: args.product,
                    cvss: args.cvss,
                    cwe: args.cwe
                }, args.page));
            }
        }
    });
};
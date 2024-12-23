/// lookup.ts - CVE lookup module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 21/07/2024.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions } from "discord.js";
import { getCveInfoData, getCvesData, getCweInfoData } from "./cveApi.js";
import { removeHtmlTagsAndDecode } from "../../core/functions.js";
import { getLogger } from "orange-common-lib";

const logger = getLogger("/cve");

/**
 * Generates a CWE information embed.
 * @param cweid CWE identifier.
 * @returns `InteractionReplyOptions` object containing the embed with information about the CWE.
 */
async function getCweInfo(cweid: string): Promise<InteractionReplyOptions> {
    try {
        const data = await getCweInfoData(cweid);

        if (data === undefined) {
            return ({
                embeds: [{
                    title: `CWE Search`,
                    description: `No CWE entries found that match "${cweid}"`,
                    timestamp: new Date().toISOString()
                }]
            });
        }

        const embed = new EmbedBuilder({
            title: `Information for ${data.id}`,
            description: removeHtmlTagsAndDecode(`### ${data.name}\n${data.description}`, 1512),
            footer: { text: `Data from opencve.io` },
            timestamp: new Date().toISOString()
        });

        return { embeds: [embed] };
    } catch (err: any) {
        return ({
            embeds: [{
                title: `Something went wrong with the search`,
                description: err.message,
                timestamp: new Date().toISOString()
            }]
        });
    }
}

/**
 * Returns impact information about a CVE.
 * @param data Raw CVE data.
 * @param cveid CVE identifier.
 * @returns List of affected vendors, products and versions. `{ affectedVendors, affectedProducts, affectedVersions }`
 */
async function getImpactInformation(data: OpenCveAPIResultsInfo, cveid: string) {
    var affectedVendors = [];
    var affectedProducts = [];
    var affectedVersions = [];

    try {
        for (let i = 0; i < data.raw_nvd_data.configurations.length; i++) {
            try {
                for (let j = 0; j < data.raw_nvd_data.configurations[i].nodes.length; j++) {
                    const node = data.raw_nvd_data.configurations[i].nodes[j];

                    if (node.cpeMatch === undefined)
                        continue;

                    try {
                        for (let k = 0; k < node.cpeMatch.length; k++) {
                            const match = node.cpeMatch[k];
                            const versionTokens = match.criteria.split(':');

                            affectedVendors.push(versionTokens[3]);
                            affectedProducts.push(versionTokens[4]);

                            if (versionTokens[5] !== '*')
                                affectedVersions.push(versionTokens[5]);
                        }
                    } catch (err: any) {
                        logger.warn(`AT [k] Could not parse raw nvd data for ${cveid}, error: ${err}`);
                        continue;
                    }
                }
            } catch (err: any) {
                logger.warn(`AT [j] Could not parse raw nvd data for ${cveid}, error: ${err}`);
                continue;
            }
        }
    } catch (err: any) {
        logger.warn(`AT [i] Could not parse raw nvd data for ${cveid}, error: ${err}`);
    }

    affectedVendors = affectedVendors.filter((v, i, a) => a.indexOf(v) === i);
    if (affectedVendors.length > 32) {
        affectedVendors = affectedVendors.slice(0, 32);
        affectedVendors.push('...');
    }

    affectedProducts = affectedProducts.filter((v, i, a) => a.indexOf(v) === i);
    if (affectedProducts.length > 32) {
        affectedProducts = affectedProducts.slice(0, 32);
        affectedProducts.push('...');
    }

    affectedVersions = affectedVersions.filter((v, i, a) => a.indexOf(v) === i);
    if (affectedVersions.length > 32) {
        affectedVersions = affectedVersions.slice(0, 32);
        affectedVersions.push('...');
    }

    return { affectedVendors, affectedProducts, affectedVersions };
}

/**
 * Generates a CVE information embed.
 * @param cveid CVE identifier.
 * @returns `InteractionReplyOptions` object containing the embed with information about the CVE.
 */
async function getCveInfo(cveid: string): Promise<InteractionReplyOptions> {
    try {
        const data = await getCveInfoData(cveid);

        if (data === undefined) {
            return ({
                embeds: [{
                    title: `CVE Search`,
                    description: `No CVE entries found that match "${cveid}"`,
                    timestamp: new Date().toISOString()
                }]
            });
        }

        const embed = new EmbedBuilder({
            title: `Information for ${data.cve_id}`,
            description: removeHtmlTagsAndDecode(data.description, 1024),
            url: `https://www.cve.org/CVERecord?id=${data.cve_id}`,
            footer: { text: `Data from opencve.io` },
            timestamp: new Date().toISOString()
        });

        if (data.metrics.cvssV3_0.data!== null || data.metrics.cvssV3_1.data !== null) {
            const cvss_score = data.metrics.cvssV3_0.data.score ?? data.metrics.cvssV3_1.data.score ?? -1;
            if (cvss_score === -1) { embed.addFields({ name: 'Severity', value: `:white_circle: Unknown` }); }
            else if (cvss_score < 0.1) { embed.addFields({ name: 'Severity', value: `:white_circle: None - ${cvss_score}` }); }
            else if (cvss_score < 4.0) { embed.addFields({ name: 'Severity', value: `:green_circle: Low - ${cvss_score}` }); }
            else if (cvss_score < 7.0) { embed.addFields({ name: 'Severity', value: `:yellow_circle: Medium - ${cvss_score}` }); }
            else if (cvss_score < 9.0) { embed.addFields({ name: 'Severity', value: `:orange_circle: High - ${cvss_score}` }); }
            else { embed.addFields({ name: 'Severity', value: `:red_circle: Critical - ${cvss_score}` }); }
        } else if (data.metrics.cvssV2_0.data !== null) {
            const cvss_score = data.metrics.cvssV2_0.data.score ?? -1;
            if (cvss_score === -1) { embed.addFields({ name: 'Severity', value: `:white_circle: Unknown` }); }
            else if (cvss_score < 4.0) { embed.addFields({ name: 'Severity', value: `:green_circle: Low - ${cvss_score}` }); }
            else if (cvss_score < 7.0) { embed.addFields({ name: 'Severity', value: `:yellow_circle: Medium - ${cvss_score}` }); }
            else { embed.addFields({ name: 'Severity', value: `:red_circle: High - ${cvss_score}` }); }
        }

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


        if (vendors.length > 0)
            embed.addFields({ name: 'Affected Vendors', value: vendors.map(vendor => `\`${vendor}\``).join(', ') });
        if (products.length > 0)
            embed.addFields({ name: 'Affected Products', value: products.map(product => `\`${product}\``).join(', ') });


        /*
        const { affectedVendors, affectedProducts, affectedVersions } = await getImpactInformation(data, cveid);

        if (affectedVendors.length > 0)
            embed.addFields({ name: 'Affected Vendors', value: affectedVendors.map(vendor => `\`${vendor}\``).join(', ') });
        if (affectedProducts.length > 0)
            embed.addFields({ name: 'Affected Products', value: affectedProducts.map(product => `\`${product}\``).join(', ') });
        if (affectedVersions.length > 0)
            embed.addFields({ name: 'Affected Versions', value: affectedVersions.map(version => `\`${version}\``).join(', ') });

        let cweInformation = '';
        for (let i = 0; i < Math.min(data.cwes.length, 3); i++) {
            const cweInfo = await getCweInfoData(data.cwes[i]);
            if (cweInfo !== undefined) {
                cweInformation += `${cweInfo.name ?? 'Unknown'} (${cweInfo.id})`;
                if (cweInfo.description !== null && cweInfo.description !== undefined) {
                    cweInformation += ` - ${cweInfo.description.replace(/\r/g, '').replace(/\n/g, '')}`;
                }
                cweInformation += '\n';
            }
        }
        */

        if (data.weaknesses.length !== 0) {
            embed.addFields({ name: 'Vulnerability Type(s)', value: data.weaknesses.map(weakness => `\`${weakness}\``).join(', ') });
        }

        embed.addFields({ name: 'Date Submitted', value: new Date(data.created_at).toDateString() });

        const buttons = new ActionRowBuilder<ButtonBuilder>();

        buttons.addComponents(new ButtonBuilder({
            label: 'View on NVD',
            url: `https://nvd.nist.gov/vuln/detail/${cveid}`,
            style: ButtonStyle.Link
        }));

        buttons.addComponents(new ButtonBuilder({
            label: 'Ask Ora',
            customId: `ora_cve_${cveid}`,
            style: ButtonStyle.Primary
        }).setEmoji("✨"));

        return { embeds: [embed], components: [buttons] };
    }
    catch (err: any) {
        return ({
            embeds: [{
                title: `Something went wrong with the search`,
                description: err.message,
                timestamp: new Date().toISOString()
            }]
        });
    }
}

/**
 * Generates a Discord embed containing search results for `/cve search` command.
 * @param args Parameters object.
 * @param page Page number
 * @returns `InteractionReplyOptions` containing embed and component row containing buttons for quick follow up queries.
 */
async function getCves(args: { keyword?: string | null, vendor?: string | null, product?: string | null, cvss?: string | null, cwe?: string | null }, page: number = 1): Promise<InteractionReplyOptions> {
    try {
        const data = await getCvesData(args, page);

        if (data === undefined) {
            return ({
                embeds: [{
                    title: `CVE Search`,
                    description: 'No CVEs found',
                    timestamp: new Date().toISOString()
                }]
            });
        }

        const len = Math.min(data.count, 5);

        const embed = new EmbedBuilder({
            title: `Top ${len} CVEs found out of ${data.count}`,
            description: "Can't find what you are looking for? Trying specifying the \`vendor\`, \`product\`, \`cvss\` or a different \`page\` number.",
            footer: { text: `Data from opencve.io` },
            timestamp: new Date().toISOString()
        });

        const buttons = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < len; i++) {
            embed.addFields({ name: `${i + 1}.)  ${data.results[i].cve_id}`, value: removeHtmlTagsAndDecode(data.results[i].description, 200)! });
            buttons.addComponents(new ButtonBuilder(
                { label: `${i + 1}`, style: ButtonStyle.Secondary, customId: `cve_${data.results[i].cve_id}` }
            ));
        }

        embed.addFields({ name: 'Learn More', value: ":information_source: Click on a button to learn more about the particular vulnerability." });

        return { embeds: [embed], components: buttons.components.length > 0 ? [buttons] : undefined };
    }
    catch (err: any) {
        return ({
            embeds: [{
                title: `Something went wrong with the search`,
                description: err.message,
                footer: { text: `Data from opencve.io` },
                timestamp: new Date().toISOString()
            }]
        });
    }
}

export { getCves, getCveInfo, getCweInfo, getImpactInformation };
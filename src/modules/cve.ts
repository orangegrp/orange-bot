/// cve.ts - CVE lookup module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 28/04/2024.

import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { removeHtmlTagsAndDecode } from "../core/functions.js";
import { getCvesData, getCveInfoData, getCweInfoData } from "./cve/cveInfo.js";
import {
    ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions
} from "discord.js";

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
            footer: { text: `Content for this search retrieved from opencve.io` },
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
            title: `Information for ${data.id}`,
            description: removeHtmlTagsAndDecode(data.summary, 1024),
            url: `https://www.cve.org/CVERecord?id=${data.id}`,
            footer: { text: `Content for this search retrieved from opencve.io` },
            timestamp: new Date().toISOString()
        });

        if (data.cvss.v3 !== null) {
            if (data.cvss.v3 < 0.1) { embed.addFields({ name: 'Severity', value: `:white_circle: None - ${data.cvss.v3}` }); }
            else if (data.cvss.v3 < 4.0) { embed.addFields({ name: 'Severity', value: `:green_circle: Low - ${data.cvss.v3}` }); }
            else if (data.cvss.v3 < 7.0) { embed.addFields({ name: 'Severity', value: `:yellow_circle: Medium - ${data.cvss.v3}` }); }
            else if (data.cvss.v3 < 9.0) { embed.addFields({ name: 'Severity', value: `:orange_circle: High - ${data.cvss.v3}` }); }
            else { embed.addFields({ name: 'Severity', value: `:red_circle: Critical - ${data.cvss.v3}` }); }
        } else if (data.cvss.v2 !== null) {
            if (data.cvss.v2 < 4.0) { embed.addFields({ name: 'Severity', value: `:green_circle: Low - ${data.cvss.v2}` }); }
            else if (data.cvss.v2 < 7.0) { embed.addFields({ name: 'Severity', value: `:yellow_circle: Medium - ${data.cvss.v2}` }); }
            else { embed.addFields({ name: 'Severity', value: `:red_circle: High - ${data.cvss.v2}` }); }
        }

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

        if (data.cwes.length !== 0) {
            embed.addFields({ name: 'Vulnerability Type', value: cweInformation });
        }

        embed.addFields({ name: 'Date Submitted', value: new Date(data.created_at).toDateString() });

        return { embeds: [embed] };
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

        const len = Math.min(data.length, 5);

        const embed = new EmbedBuilder({
            title: `Top ${len} CVEs found`,
            description: "Can't find what you are looking for? Trying specifying the \`vendor\`, \`product\`, \`cvss\` or a different \`page\` number.",
            footer: { text: `Content for this search retrieved from opencve.io.` },
            timestamp: new Date().toISOString()
        });

        const buttons = new ActionRowBuilder<ButtonBuilder>();

        for (let i = 0; i < len; i++) {
            embed.addFields({ name: `${i + 1}.)  ${data[i].id}`, value: removeHtmlTagsAndDecode(data[i].summary, 200)! });
            buttons.addComponents(new ButtonBuilder(
                { label: `${i + 1}`, style: ButtonStyle.Secondary, customId: `cve_${data[i].id}` }
            ));
        }

        embed.addFields({ name: 'Learn More', value: ":information_source: Click on a button to learn more about the particular vulnerability." });

        return { embeds: [embed], components: [buttons] };
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

const command = {
    name: "cve",
    description: "CVE lookup utility",
    notes: "This command uses a cloud service. Data you provide may be shared with [opencve.io](https://opencve.io) (:flag_fr:), subject to their [terms](https://www.opencve.io/terms).",
    options: {
        info: {
            description: "Lookup a CVE number",
            args: {
                cveid: {
                    type: ArgType.STRING,
                    description: "CVE number",
                    required: true
                }
            }
        },
        cwe: {
            description: "Lookup a CWE number",
            args: {
                cweid: {
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


/**
 * Quick search handler (user clicks on numbered button after using `/cve search`)
 * @param interaction Interaction object.
 */
async function cveButtonHandler(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith("cve_")) {
        const cveid = interaction.customId.split("_")[1];
        await interaction.reply(await getCveInfo(cveid));
    }
}

/**
 * CVE search command
 * @param interaction Interaction object.
 * @param args Arguments.
 */
async function searchCommandHandler(interaction: ChatInputCommandInteraction, args: { product: string | undefined, vendor: string | undefined, cwe: string | undefined, cvss: string | undefined, keyword: string | undefined, page: number | undefined }) {
    if (args.product && !args.vendor) {
        await interaction.reply({
            embeds: [{
                title: `CVE Search`,
                description: 'Please specify a vendor in addition to product',
                timestamp: new Date().toISOString()
            }]
        });
    }

    await interaction.deferReply();
    const cwe = args.cwe ? args.cwe.trim() : undefined;
    const cwe_param = cwe ? (cwe.startsWith("CWE-") ? cwe : "CWE-" + cwe) : undefined;
    await interaction.editReply(await getCves({
        keyword: args.keyword,
        vendor: args.vendor,
        product: args.product,
        cvss: args.cvss,
        cwe: cwe_param
    }, args.page));
}

/**
 * `cve.ts` - CVE lookup module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot) {
    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            await cveButtonHandler(interaction);
        }
    });

    bot.commandManager.addCommand(command, async (interaction, args) => {
        if (args.subCommand === "search") {
            await searchCommandHandler(interaction, args);
        }
        else if (args.subCommand === "info") {
            await interaction.deferReply();
            const id = args.cveid.trim();
            const param = id.startsWith("CVE-") ? id : "CVE-" + id;
            await interaction.editReply(await getCveInfo(param));
        }
        else if (args.subCommand === "cwe") {
            await interaction.deferReply();
            const id = args.cweid.trim();
            const param = id.startsWith("CWE-") ? id : "CWE-" + id;
            await interaction.editReply(await getCweInfo(param));
        }
    });
};

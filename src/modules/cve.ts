/// cve.ts - CVE lookup module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 21/07/2024.

import type { Bot, Command, Module } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getCveInfo, getCves, getCweInfo } from "./cve/lookups.js";
import { OraCve } from "./ora-intelligence/core/ora_cve.js";

let oraCve: OraCve | undefined = undefined;

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
        /*
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
        */
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
    if (interaction.customId.startsWith("ora_cve_")){
        const cveid = interaction.customId.split("_")[2];
        if (!oraCve) {
            await interaction.reply({
                embeds: [{
                    title:  `This feature is unavailable at the moment.`,
                    timestamp: new Date().toISOString()
                }]
            });
            return;
        }

        await interaction.deferReply();

        const buttons = new ActionRowBuilder<ButtonBuilder>();

        buttons.addComponents(new ButtonBuilder({
            label: 'View on NVD',
            url: `https://nvd.nist.gov/vuln/detail/${cveid}`,
            style: ButtonStyle.Link
        }));

        interaction.message.edit({ components: [buttons] });

        const response = await oraCve.askOra(cveid);
        if (!response) {
            await interaction.editReply({
                embeds: [{
                    title:  `Something went wrong.`,
                    timestamp: new Date().toISOString()
                }]
            });
            return;
        }

        await interaction.editReply( { content: response.substring(0, 1999), embeds: [
            { color: 0xff6723, footer: { text: "✨ Powered by Ora Intelligence • AI can make mistakes" } }
        ] } );
    }
    
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
export default function (bot: Bot, module: Module) {

    oraCve = new OraCve("asst_PPiDj623siqnJN6tpHZTmX5m");

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            await cveButtonHandler(interaction);
        }
    });

    module.addCommand(command, async (interaction, args) => {
        if (args.subCommand === "search") {
            await searchCommandHandler(interaction, args);
        }
        else if (args.subCommand === "info") {
            await interaction.deferReply();
            const id = args.cveid.trim();
            const param = id.startsWith("CVE-") ? id : "CVE-" + id;
            await interaction.editReply(await getCveInfo(param));
        }
        /*
        else if (args.subCommand === "cwe") {
            await interaction.deferReply();
            const id = args.cweid.trim();
            const param = id.startsWith("CWE-") ? id : "CWE-" + id;
            await interaction.editReply(await getCweInfo(param));
        }
        */
    });
};
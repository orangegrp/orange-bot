/// cve.ts - CVE lookup module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 21/07/2024.

import type { Bot, Command, Module } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import { getCveInfo, getCves, getCweInfo } from "./cve/lookups.js";


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
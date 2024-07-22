/// image.ts - HTML image generation module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import type { Bot, Command, Module } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { execSync } from "child_process";
import nodeHtmlToImage from "node-html-to-image";
import { AttachmentBuilder } from "discord.js"

const logger = getLogger("image");
const IMAGE_STYLE_HTML = `<link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">
                          <style> body { padding: 5px; height: fit-content; width: fit-content; font-family: "Open Sans", sans-serif; color: whitesmoke; }</style>`

const command = {
    name: "image",
    description: "Renders HTML to an image using Chromium engine",
    notes: "This command uses an external proprietary program. Data you provide will be processed by [Google Chrome](https://www.google.com/chrome/privacy/) (:flag_us:) on a server we control.",
    args: {
        html: {
            type: ArgType.STRING,
            required: true,
            description: "HTML to render"
        }
    }
} satisfies Command;

/**
 * Determines if the system is running inside Alpine Linux. (this is required so that it uses correct Chromium binary inside our Docker image)
 * @returns `true` if the system is an Alpine Linux, otherwise `false`.
 */
function isAlpine() {
    try {
        const os_info = execSync("cat /etc/os-release", { encoding: "utf-8" });
        const is_alpine = os_info.trim().toLocaleLowerCase().includes("alpine");
        logger.verbose(`Alpine detected: ${is_alpine ? "Yes" : "No"} System: ${os_info}`);
        return is_alpine;
    } catch (error: any) {
        logger.error(error);
        logger.warn("Failed to grab system info. Probably not a Linux system.");
        return false;
    }
}

/**
 * Generates an image from input HTML content.
 * @param inputHtml HTML content.
 * @returns An image buffer.
 */
async function generateImage(inputHtml: string) {
    const html = IMAGE_STYLE_HTML + inputHtml;

    logger.verbose("Generating image...");

    const image = await nodeHtmlToImage({
        puppeteerArgs: { executablePath: isAlpine() ? "/usr/bin/chromium-browser" : undefined, args: ["--headless", "--disable-gpu"] },
        html: html,
        transparent: true, waitUntil: "networkidle0",
    });

    logger.verbose("Image generated.");

    return image;
}

/**
 * `image.ts` - HTML image generation module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot, module: Module) {
    module.addCommand(command, async (interaction, args) => {
        await interaction.deferReply();

        try {
            const image = await generateImage(args.html);

            if (!(image instanceof Buffer)) 
                throw new Error("Image generation failed.");

            await interaction.editReply({ files: [new AttachmentBuilder(image, { name: "image.png" })] });

            logger.info("Image was sent.");
        }
        catch (err: any) {
            logger.error(err);
            interaction.editReply("Image generation failed.");
        }
    });
}
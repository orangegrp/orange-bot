import { ArgType, type Command } from "orange-bot-base/dist/command.js";
import nodeHtmlToImage from "node-html-to-image";
import type { Bot } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { AttachmentBuilder } from "discord.js"
import { execSync } from "child_process";

function isAlpine() {
    try {
        const os_info = execSync("cat /etc/os-release", { encoding: "utf-8" });
        const is_alpine = os_info.trim().toLocaleLowerCase().includes("alpine");
        logger.verbose(`Alpine detected: ${is_alpine ? "Yes": "No"} System: ${os_info}`);
        return is_alpine;
    } catch (error: any) {
        logger.error(error);
        logger.warn("Failed to grab system info. Probably not a Linux system.");
        return false;
    }
}


const logger = getLogger("image");

const IMAGE_STYLE_HTML = `<link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">
                          <style> body { padding: 5px; height: fit-content; width: fit-content; font-family: "Open Sans", sans-serif; color: whitesmoke; }</style>`

const command = {
    name: "image",
    description: "Renders HTML to an image using Chromium",
    args: {
        html: {
            type: ArgType.STRING,
            required: true,
            description: "HTML to render"
        }
    }
} satisfies Command;

export default function (bot: Bot) {
    bot.commandManager.addCommand(command, async (interaction, args) => {
        const html = IMAGE_STYLE_HTML + args.html;

        await interaction.deferReply();

        try {
            logger.info("Generating image...");

            const image = await nodeHtmlToImage({
                puppeteerArgs: { executablePath: isAlpine() ? "/usr/bin/chromium-browser" : undefined, args: ["--headless", "--disable-gpu"] },
                html: html,
                transparent: true, waitUntil: "networkidle0",
            });

            if (!(image instanceof Buffer)) throw new Error("idk");

            await interaction.editReply({ files: [new AttachmentBuilder(image, { name: "image.png" })] });

            logger.info("image sent.");
        }
        catch (err: any) {
            logger.error(err);
            interaction.editReply("Image generation failed.");
        }
    });
}
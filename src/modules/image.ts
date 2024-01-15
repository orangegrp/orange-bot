import { ArgType, type Command } from "orange-bot-base/dist/command.js";
import nodeHtmlToImage from 'node-html-to-image';
import type { Bot } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { AttachmentBuilder } from 'discord.js'

const logger = getLogger("image");


const IMAGE_STYLE_HTML = `<link href='https://fonts.googleapis.com/css2?family=Open+Sans&display=swap' rel='stylesheet'>
                          <style> body { padding: 5px; height: fit-content; width: fit-content; font-family: 'Open Sans', sans-serif; color: whitesmoke; }</style>`

const command = {
    name: "image",
    description: "renders html to an image",
    args: {
        html: {
            type: ArgType.STRING,
            required: true,
            description: "html to render"
        }
    }
} satisfies Command;

export default function(bot: Bot) {
    bot.commandManager.addCommand(command, async (interaction, args) => {
        const html = IMAGE_STYLE_HTML + args.html;

        await interaction.deferReply();

        try {
            logger.info("Generating image...");

            const image = await nodeHtmlToImage({
                html: html,
                transparent: true, waitUntil: "networkidle0",
            });

            if (!(image instanceof Buffer)) throw new Error("idk");
            
            await interaction.editReply({files: [new AttachmentBuilder(image, { name: "image.png" })]});

            logger.info("image sent.");
        }
        catch {
            interaction.editReply("Image generation failed.");
        }
    });
}
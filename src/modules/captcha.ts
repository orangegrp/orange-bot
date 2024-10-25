import { ArgType, Bot, Command, Module } from "orange-bot-base";
import { generateCaptcha } from "./captcha/captcha_generator.js";
import { AttachmentBuilder, ButtonStyle, ComponentType } from "discord.js";

const CAPTCHA_MAP = new Map<string, number>();

const command = {
    name: "captcha",
    description: "Complete a security check",
    notes: "Used for new member verification.",
    args: {
        id: {
            type: ArgType.STRING,
            description: "Security check reference",
            required: true
        },
        answer: {
            type: ArgType.INTEGER,
            description: "Security check answer",
            required: true
        }
    }
} as const satisfies Command;

export default function (bot: Bot, module: Module) {

    module.addCommand(command, async (interaction, args) => {
        if (CAPTCHA_MAP.has(args.id)) {
            if (CAPTCHA_MAP.get(args.id) === args.answer) {
                await interaction.reply({
                    embeds: [{ description: "### :white_check_mark: Verified!", }]
                });
            } else {
                await interaction.reply({
                    embeds: [{ description: "### :x: Security check failed!", }]
                });
            }
        } else {
            await interaction.reply({
                embeds: [{ description: `:warning: Invalid security check reference. The entered reference code \`${args.id}\` could not be found.`, }]
            });
        }
    });

    module.addChatInteraction(async msg => {
        if (msg.content.includes("testcaptcha")) {
            const { image, answer, id } = await generateCaptcha();
            CAPTCHA_MAP.set(id, answer);

            await msg.reply({
                files: [new AttachmentBuilder(image as Buffer, { name: 'image.png' })],
                embeds: [
                    {
                        title: "Security Check",
                        image: { url: "attachment://image.png" },
                        description: `We need to verify that you are a good human. Please complete the security check.`,
                        fields: [{ name: "Reference:", value: `\`\`\`${id}\`\`\`` }],
                        thumbnail: { url: "https://img.icons8.com/fluency/48/passport.png" },
                        footer: { text: "If you encounter issues, please reach out to an admin." }
                    }
                ]
            });

            //await msg.channel.send({ files: [new AttachmentBuilder(image as Buffer, { name: "image.png" })] });
        }
    })
}
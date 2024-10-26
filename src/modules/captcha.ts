import { ArgType, Bot, Command, Module } from "orange-bot-base";
import { generateCaptcha } from "./captcha/captcha_generator.js";
import { AttachmentBuilder, ButtonStyle, ComponentType } from "discord.js";
import { getLogger } from "orange-common-lib";

const logger = getLogger("CAPTCHA");
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
            logger.log(`${interaction.user.username} (${interaction.user.id}) completed security check ${args.id}`);

            if (CAPTCHA_MAP.get(args.id) === args.answer) {
                logger.log(`${interaction.user.username} (${interaction.user.id}) completed security check ${args.id} successfully (Answer: ${args.answer})`);
                CAPTCHA_MAP.delete(args.id);
                await interaction.reply({
                    embeds: [{ description: "### :white_check_mark: Verified!", }]
                });
            } else {
                logger.log(`${interaction.user.username} (${interaction.user.id}) failed security check ${args.id}, Answer: ${args.answer}, Correct: ${CAPTCHA_MAP.get(args.id)}`);
                CAPTCHA_MAP.delete(args.id);
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

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith("captcha_regen_")) {
                const old_id = interaction.customId.split("_")[2];
                const { image, answer, id } = await generateCaptcha(interaction.user.id);
                CAPTCHA_MAP.set(id, answer);
                await interaction.update({
                    files: [new AttachmentBuilder(image as Buffer, { name: 'image.png' })],
                    embeds: [
                        {
                            title: "Security Check",
                            image: { url: "attachment://image.png" },
                            description: `We need to verify that you are a good human. Please complete the security check.`,
                            fields: [{ name: "Reference:", value: `\`\`\`${id}\`\`\`` }],
                            footer: { text: "If you encounter issues, please reach out to an admin." }
                        }
                    ],
                    components: [
                        {
                            type: ComponentType.ActionRow,
                            components: [
                                {
                                    type: ComponentType.Button,
                                    label: "Regenerate challenge",
                                    style: ButtonStyle.Primary,
                                    customId: `captcha_regen_${id}`
                                }
                            ]
                        }
                    ]
                });
                CAPTCHA_MAP.delete(old_id);
            }
        }
    })

    module.addChatInteraction(async msg => {
        if (msg.content.includes("testcaptcha")) {
            const { image, answer, id } = await generateCaptcha(msg.author.id);
            CAPTCHA_MAP.set(id, answer);

            await msg.reply({
                files: [new AttachmentBuilder(image as Buffer, { name: 'image.png' })],
                embeds: [
                    {
                        title: "Security Check",
                        image: { url: "attachment://image.png" },
                        description: `We need to verify that you are a good human. Please complete the security check.`,
                        fields: [{ name: "Reference:", value: `\`\`\`${id}\`\`\`` }],
                        footer: { text: "If you encounter issues, please reach out to an admin." }
                    }
                ],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                label: "Regenerate challenge",
                                style: ButtonStyle.Primary,
                                customId: `captcha_regen_${id}`
                            }
                        ]
                    }
                ]
            });

            //await msg.channel.send({ files: [new AttachmentBuilder(image as Buffer, { name: "image.png" })] });
        }
    })
}
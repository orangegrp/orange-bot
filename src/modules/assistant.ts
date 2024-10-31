import { Bot, Command, Module } from "orange-bot-base";
import { generate_no_context, generate_with_context } from "./gpt/openai.js";
import { getLogger } from "orange-common-lib";
import { APIEmbed, ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Interaction, Message } from "discord.js";
import { CostMgr, ora_user } from "./gpt/costmgr.js";
import scheduler from "node-schedule";

// THIS MODULE WILL BE RE-WRITTEN IN THE NEXT UPDATE TO BETA!

const logger = getLogger("assistant");

const command = {
    name: "ora",
    description: "Ora assistant",
    options: {
        enable: {
            description: "Enable Ora assistant for your account",
            args: {}
        },
        account: {
            description: "View your Ora assistant account",
            args: {}
        }
    }
} satisfies Command;


export default async function (bot: Bot, module: Module) {
    const costMgr = new CostMgr(bot);
    await costMgr.config.waitForReady();

    scheduler.scheduleJob("0 0 * * *", () => costMgr.resetAllDailyCaps());

    bot.client.on("interactionCreate", async interaction => {
        if (!module.handling) return;
        if (interaction.isButton() && interaction.customId.startsWith("ora_")) {
            await interaction.deferReply();
            await createAccountCmdBtn(interaction, bot);
        }
    });

    module.addCommand(command, async (interaction, args) => {
        if (args.subCommand === "enable") {
            await createAccountCommand(interaction);
        } else if (args.subCommand === "account") {
            await getAccountInfo(interaction);
        }
    });

    //module.addChatInteraction(async msg => {
    bot.client.on("messageCreate", async msg => {
        if (!module.handling) return;
        //logger.info("Received message: " + msg.content);

        if (!bot.client.user) {
            logger.warn("bot.client.user not set! Cannot reply to AI request!");
            return;
        }

        const is_replying_to_context = msg.reference && msg.reference.messageId && context_map.has(msg.reference?.messageId);
        const is_starting_new_ctx = msg.content.startsWith(`<@${bot.client.user.id}>`);

        if (!is_replying_to_context && !is_starting_new_ctx) {
            //logger.info("Not replying to context or starting new context");
            return;
        }

        if (!(await costMgr.allowUser(msg.author.id))) {
            logger.info("User is not allowed to use Ora Assistant yet, lets make them a new account");

            if ((await createOraAccount(msg, msg.author.id)) === false) {
                return;
            }
        }

        logger.info("User is allowed to use Ora Assistant");

        await chatWithAI(msg);
    });


    const context_map: Map<string, string> = new Map();

    async function createAccountCommand(interaction: ChatInputCommandInteraction) {
        const buttons = new ActionRowBuilder<ButtonBuilder>();
        buttons.addComponents(new ButtonBuilder(
            { label: `Create Ora Account`, style: ButtonStyle.Success, customId: `ora_${interaction.user.id}` }
        ));

        logger.log("Checking for existing account (a 404 error is normal if it happens) ...");

        if (await costMgr.userExists(interaction.user.id)) {
            await interaction.reply({
                embeds: [
                    {
                        title: "Ora Assistant",
                        description: `You already have an Ora account. You can view information about it using \`/ora account\`.`
                    }
                ]
            });
            return;
        }

        interaction.reply({
            components: [buttons],
            embeds: [
                {
                    title: "Ora Assistant",
                    description: `### Fair use:\n` +
                        `The fair use policy applies to all users of Ora and breaches may result in restrictions being applied. In a nutshell:\n` +
                        `• Please do not spam the assistant with long messages.\n` +
                        `• Try to keep chat threads short.\n` +
                        `• Avoid situations where prompt-induced overgeneration can occur.\n` +
                        `### Privacy:\n` +
                        `orange Bot collects limited information about each request you make to Ora. The information includes:\n` +
                        `• Your Discord display name and snowflake identifier.\n` +
                        `• The cost and number of tokens associated with the request.\n\n` +
                        `Ora is based on the \`gpt-3.5-turbo-0125\` model by OpenAI. Data you provide to Ora may be shared with ` +
                        `OpenAI Ireland Ltd (:flag_ie:) and OpenAI, L.L.C (:flag_us:), subject to OpenAI's [privacy policy](https://openai.com/policies/privacy-policy). ` +
                        `In addition, when you talk to Ora, orange Bot will also provide Ora with additional context including:\n` +
                        `• Your Discord display name and snowflake identifier.\n`
                }
            ]
        });
    }

    async function getAccountInfo(interaction: ChatInputCommandInteraction) {
        logger.log("Checking for existing account (a 404 error is normal if it happens) ...");

        if (!await costMgr.userExists(interaction.user.id)) {
            await interaction.reply({
                embeds: [
                    {
                        title: "Ora Assistant",
                        author: { name: `No account found.` },
                        description: `We couldn't find an account for you. You can register to use Ora with \`/ora enable\`.`
                    }
                ]
            });
            return;
        }

        const userInfo = await costMgr.getUser(interaction.user.id);

        const cost_per_1k_usd_input = Number(process.env.OPENAI_INPUT_COST!);
        const cost_per_1k_usd_output = Number(process.env.OPENAI_OUTPUT_COST!);

        const daily_cap = `**$${userInfo.dailyCost.toFixed(2)}**/**$${userInfo.dailyCostCap.toFixed(2)}**`;
        const total_cost = `**$${userInfo.totalCost.toFixed(4)}**`;
        const total_requests = `**${userInfo.totalRequests}**`;
        const total_tokens = `**${userInfo.totalTokens}**`;

        const ban_status = !userInfo.banned ? ":white_check_mark: **Account is active**" : ":warning: **Account is suspended**";
        const other_status = userInfo.dailyCost >= userInfo.dailyCostCap ? ":clock12: **Daily cap reached**" : undefined;

        await interaction.reply({
            embeds: [
                {
                    //author: { name: `Account ID: ${existing_account.id}` },
                    description: `### Account information\n` +
                        `Status: ` + (other_status ?? ban_status) + `\n` +
                        `### Cost awareness\n` +
                        `Daily cap: ` + daily_cap + `\n` +
                        `Total requests: ` + total_requests + `\n` +
                        `Total tokens: ` + total_tokens + `\n` +
                        `Total cost: ` + total_cost + `\n` +
                        `### OpenAI Rates\n` +
                        `**$${cost_per_1k_usd_input.toFixed(4)}**/1k input tokens\n` +
                        `**$${cost_per_1k_usd_output.toFixed(4)}**/1k output tokens`
                }
            ]
        });
    }

    async function chatWithAI(msg: Message) {
        msg.channel.sendTyping();
        const existing_account = await costMgr.getUser(msg.author.id);

        const user = msg.author.displayName;
        const id = msg.author.id;

        var result: { response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean, extra?: APIEmbed[], extra_text?: string };

        if (msg.reference && msg.reference.messageId && context_map.has(msg.reference.messageId)) {
            logger.info(`Using previous context: ${context_map.get(msg.reference.messageId)}`);
            result = await generate_with_context(context_map.get(msg.reference.messageId)!, user, id, msg.content.replace(/<@\d+>/g, '').trim(), "asst_c053PWqAKmuUgJ0whEjGpJzG");
        } else {
            result = await generate_no_context(user, id, msg.content.replace(/<@\d+>/g, '').trim(), "asst_c053PWqAKmuUgJ0whEjGpJzG");
            logger.info(`Using new context: ${result.thread_id}`);
        }
        console.log(result)

        const sys_prompt_tokens = Number(process.env.SYS_PROMPT_TKS ?? 0) + Number(process.env.SYS_PROMPT_PFX ?? 0) + Number(process.env.FNC_PROMPT_TKS ?? 0);
        const input_tokens = result.input_tokens ?? 0;
        const output_tokens = result.output_tokens ?? 0;

        const { total_tokens, input_cost, output_cost, total_cost } = costMgr.calculateCost(sys_prompt_tokens, input_tokens, output_tokens);

        const cost_info = `Input cost: $${input_cost.toFixed(4)} (${input_tokens} tokens)\n` +
            `Output cost: $${output_cost.toFixed(4)} (${output_tokens} tokens)\n` +
            `Total cost: $${(total_cost).toFixed(4)} (${total_tokens} total tokens)`;
        logger.info(cost_info);

        if (result.response) {
            var embeds: APIEmbed[] = [];

            if (result.extra) {
                embeds.push(...result.extra);
            }

            if (result.new_context) {
                embeds.push({ color: 0xffff00, description: `This dialogue is in a new context window.` });
            }

            if (process.env.OPENAI_SHOW_PRICE && process.env.OPENAI_SHOW_PRICE === "true") {
                embeds.push(
                    {
                        description: `This request: **$${total_cost.toFixed(4)}** (**${total_tokens}** tokens)\n` +
                            `**$${(total_cost * 60).toFixed(2)}**/h\u00A0\u00A0` +
                            `**$${(total_cost * 60 * 24).toFixed(2)}**/d\u00A0\u00A0` +
                            `**$${(total_cost * 60 * 24 * 7).toFixed(2)}**/w\u00A0\u00A0` +
                            `**$${(total_cost * 60 * 24 * 30).toFixed(2)}**/m\u00A0\u00A0` +
                            `**$${(total_cost * 60 * 24 * 365).toFixed(2)}**/y`,
                        footer: { text: `${input_tokens} tokens in \u00A0\u00A0 ${output_tokens} tokens out \u00A0\u00A0 ${total_tokens} tokens/min` },
                    }
                );
            }

            const reply = await msg.reply({ content: result.response + (result.extra_text && result.extra_text.length > 1 ? `${result.extra_text}\n\n` : ""), embeds: embeds });

            if (result.thread_id) {
                context_map.set(reply.id, result.thread_id);
                setTimeout(() => context_map.delete(reply.id), 1000 * 60 * 60 * 24 * 7);
            }
        }
        else {
            msg.reply({
                embeds: [{
                    title: "Could not generate response",
                    description: "The response I received from OpenAI was `undefined`.",
                }]
            });
        }

        costMgr.config.user(id).setMany({
            totalRequests: existing_account.totalRequests + 1,
            totalTokens: existing_account.totalTokens + total_tokens,
            dailyCost: existing_account.dailyCost + total_cost,
            totalCost: existing_account.totalCost + total_cost
        });
    }

    async function createOraAccount(message: Message, user_id: string): Promise<boolean> {
        if (await costMgr.userExists(user_id)) {
            return true;
        } else {
            logger.log("Creating new account ...");
            const new_account_id = await costMgr.createOraUser(user_id, message.author.displayName);
            if (!new_account_id) {
                return false;
            }
            return true;
        }
    }

    async function createAccountCmdBtn(interaction: ButtonInteraction, bot: Bot) {
        const user_id = interaction.customId.split("_")[1];

        if (interaction.user.id !== user_id) {
            await interaction.editReply({
                embeds: [
                    {
                        title: "Ora Assistant",
                        author: { name: `Failed to create an account.` },
                        description: `Please use \`/ora enable\` to enable your own account.`
                    }
                ]
            });
            return;
        }

        logger.log("Checking for existing account (a 404 error is normal if it happens) ...");

        if (await costMgr.userExists(user_id)) {
            await interaction.editReply({
                embeds: [
                    {
                        title: "Ora Assistant",
                        description: `You already have an Ora account.`
                    }
                ]
            });
            return;
        } else {
            logger.log("Creating new account ...");
            const new_account_id = await costMgr.createOraUser(user_id, interaction.user.displayName);

            if (!new_account_id) {
                await interaction.editReply({
                    embeds: [
                        {
                            title: "Ora Assistant",
                            author: { name: `Failed to create an account.` },
                            description: `Something went wrong. Please try again later.`
                        }
                    ]
                });
                return;
            }

            await interaction.editReply({
                embeds: [
                    {
                        title: "Ora Assistant",
                        author: { name: `Account ID: ${new_account_id}` },
                        description: `Your account has been created. You can now use Ora.\n` +
                            `### Getting started\n` +
                            `You can start a conversation with Ora by mentioning her:\n\n` +
                            `<@${bot.client.user?.id}> Hi Ora, I need help with something.\n\n` +
                            `> The mention must be at the beginning of the message.\n\n` +
                            `If you want to continue a conversation, you can reply to Ora's messages.\n` +
                            `### Cost awareness:\n` +
                            `Ora is free to use within the standard daily cap limits. ` +
                            `You can access cost related information related to your usage by running \`/ora account\`. ` +
                            `The costs are calculated using the latest rates from [OpenAI](https://openai.com/pricing). The rates may be subject to change.\n` +
                            `### Limitations\n` +
                            `Please be aware that Ora is free to use within the standard daily cap limits and ` +
                            `context windows are limited to 5 messages.`,
                    }
                ]
            });
        }

        if (interaction.message.deletable) {
            await interaction.message.delete();
        }
    }
};
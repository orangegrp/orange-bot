import { Bot, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { OraChat } from "./ora-intelligence/core/ora_chat.js";
import { discordMessageSplitter, getCodeBlock } from "../core/functions.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, messageLink } from "discord.js";
import { CodeRunner } from "./code-runner/codeRunner.js";
import { Language, LanguageAlias } from "./code-runner/languages.js";

const logger = getLogger("Ora Chat");

const CODERUNNER_SERVER = process.env.CODERUNNER_SERVER;
const CODERUNNER_API_KEY = process.env.CODERUNNER_API_KEY;

export default async function (bot: Bot, module: Module) {
    const oraChat = new OraChat("asst_Q0MdDbLSFkNzCovK4DXlgvq9");
    if (!CODERUNNER_SERVER) return logger.warn("CODERUNNER_SERVER not set!");
    if (!CODERUNNER_API_KEY) return logger.warn("CODERUNNER_API_KEY not set!");
    const codeRunner = new CodeRunner({
        server: CODERUNNER_SERVER,
        apiKey: CODERUNNER_API_KEY,
    });

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith("ora_run")) {
                await interaction.deferReply();
                const result = getCodeBlock(interaction.message.content);
                if (!result) {
                    await interaction.editReply({ content: ":thinking: Something went wrog while trying to run the code." });
                    return;
                } else {
                    const { language, source_code } = result;
                    try {
                        const start_time = Date.now();
                        const run_result = await codeRunner.runCodeV1(source_code, language as Language | LanguageAlias);
                        const run_time = ((Date.now() - start_time) / 1000).toFixed(1);
                        const embed = new EmbedBuilder({
                            title: `Executed \`${language}\` code (${run_time}s).`,
                            author: { name: `Run ID: ${run_result.jobId}` },
                            description: (run_result.processOutput.length > 0 ? `\`\`\`ansi\n${run_result.processOutput}\`\`\`` : 'No output received.') + `\nExit code: ${run_result.exitCode}`,
                            footer: { text: `Powered by Piston (emkc.org)` },
                            timestamp: new Date().toISOString(),
                        });
                        const reply = await interaction.editReply({ embeds: [embed] });   
                        if (reply) {
                            const original_id = interaction.customId.split("_")[2];
                            console.log(original_id);
                            const original_message = await interaction.channel?.messages.fetch(original_id);
                            console.log(original_message?.id);
                            if (original_message) {
                                const thread_id = oraChat.getChatByMessageId(original_id);
                                console.log(thread_id);
                                if (thread_id) { 
                                    await oraChat.addExistingMessageToThread(thread_id, reply, true);
                                }
                            }
                        }
                    } catch (error: Error | any) {
                        await interaction.editReply({ content: ":x: Something went wrog while trying to run the code." });
                        logger.error(error);
                    }
                }
            }
        }
    })
    bot.client.on("messageCreate", async msg => {
        //if (!module.handling) return;
        if (!bot.client.user) return;
        if (msg.author.bot) return;
        if (msg.author.id === bot.client.user.id) return;

        async function runChat(thread_id: string) {
            msg.channel.sendTyping();
            const thread = await oraChat.getChat(thread_id);
            if (!thread) return false;
            msg.channel.sendTyping();
            if (!msg.reference?.messageId) {
                const message = await oraChat.sendMessage(thread, msg);
                if (!message) return false;
            } else {
                const replyTarget = await msg.channel.messages.fetch(msg.reference.messageId);
                const message = await oraChat.replyToMessage(thread, msg, replyTarget);
                if (!message) return false;
            }
            msg.channel.sendTyping();
            const run = await oraChat.runChat(thread);
            if (!run) return false;
            msg.channel.sendTyping();
            const run_result = await oraChat.waitForChat(thread, run, async () => await msg.channel.sendTyping());
            if (!run_result) return false;
            msg.channel.sendTyping();
            const chatMessage = await oraChat.getChatMessage(thread);
            if (!chatMessage) return false;

            const replies = [];

            /*
            for (const msgChunk of chatMessage.content.filter(t => t.type === "text").map(t => t.text.value)) {
                await msg.channel.sendTyping();
                const msgdata = await msg.reply(msgChunk);
                replies.push(msgdata);
            }*/

            for (const msgChunk of discordMessageSplitter(chatMessage.content.filter(t => t.type === "text").map(t => t.text.value).join("\n"))) {
                await msg.channel.sendTyping();

                if (getCodeBlock(msgChunk)) {
                    const buttons = new ActionRowBuilder<ButtonBuilder>();
                    buttons.addComponents(new ButtonBuilder({
                        label: 'Run Code',
                        customId: `ora_run_${msg.id}`,
                        style: ButtonStyle.Primary
                    }).setEmoji("✨"));

                    const msgData = await msg.reply({ content: msgChunk, allowedMentions: { parse: [] }, components: [buttons] });
                    //const msgData = await bot.noPingReply(msg, { content: msgChunk });
                    replies.push(msgData);
                } else {
                    const msgData = await msg.reply({ content: msgChunk, allowedMentions: { parse: [] } });
                    //const msgData = await bot.noPingReply(msg, { content: msgChunk });
                    replies.push(msgData);
                }
            }
            //const reply = await msg.reply({ content: chatMessage.content.filter(t => t.type === "text").map(t => t.text.value).join("\n") });
            replies.forEach(async r => await oraChat.updateChatMap(thread, r.id));
        }

        if (msg.content.startsWith(`<@${bot.client.user.id}>`)) {
            msg.content = msg.content.replace(`<@${bot.client.user.id}>`, "");
            if (msg.reference?.messageId) {
                msg.channel.sendTyping();
                const message = await msg.channel.messages.fetch(msg.reference.messageId);
                const thread_id = await oraChat.newChat(message, true, message.author.id === bot.client.user.id);
                if (!thread_id) return;
                await oraChat.updateChatMap(thread_id, msg.id);
                await runChat(thread_id);
                return;
            } else if (msg.channel.isThread()) {
                msg.channel.sendTyping();
                const messages = await msg.channel.messages.fetch({ before: msg.id, limit: 16 });
                const thread_id = await oraChat.newChat();
                if (!thread_id) return;
                for (const [_, message] of messages) {
                    await oraChat.addExistingMessageToThread(thread_id, message, message.author.id === bot.client.user.id);
                }
                await runChat(thread_id);
                return;
            }
            msg.channel.sendTyping();
            const thread_id = await oraChat.newChat();
            if (!thread_id) return;
            try {
                // add other reply contexts
                const twoHoursAgo = msg.createdTimestamp - (2 * 60 * 60 * 1000);
                const messages = (await msg.channel.messages.fetch({ before: msg.id, limit: 16 })).filter(m => 
                    m.mentions.users.has(bot.client.user!.id) && 
                    m.createdTimestamp >= twoHoursAgo
                );
                for (const [_, message] of messages) {
                    await oraChat.addExistingMessageToThread(thread_id, message, message.author.id === bot.client.user.id);
                }
            } catch { }
            await oraChat.addExistingMessageToThread(thread_id, msg);
            await runChat(thread_id);
        } else if (msg.reference?.messageId) {
            const thread_id = oraChat.getChatByMessageId(msg.reference.messageId);
            if (!thread_id) {
                const message = await msg.channel.messages.fetch(msg.reference.messageId);
                if (message.author.id === bot.client.user?.id) {
                    msg.channel.sendTyping();
                    const thread_id = await oraChat.newChat(message, true, true);
                    if (!thread_id) return;
                    await oraChat.updateChatMap(thread_id, msg.id);
                    await runChat(thread_id);
                }
                return;
            }
            await runChat(thread_id);
        }
    });
}
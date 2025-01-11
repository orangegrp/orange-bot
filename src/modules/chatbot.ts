import { Bot, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { OraChat } from "./ora-intelligence/core/ora_chat.js";
import { discordMessageSplitter, getCodeBlock } from "../core/functions.js";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ClientUser, EmbedBuilder, Message, OmitPartialGroupDMChannel } from "discord.js";
import { CodeRunner } from "./code-runner/codeRunner.js";
import { Language, LanguageAlias, languageAliases, languages } from "./code-runner/languages.js";
import { CodeRunnerJobResult } from "./code-runner/types/codeRunner.js";
import { MessageContent } from "openai/resources/beta/threads/messages.js";

const logger = getLogger("Ora Chat");
let oraChat: OraChat | undefined = undefined;

const CODERUNNER_SERVER = process.env.CODERUNNER_SERVER;
const CODERUNNER_API_KEY = process.env.CODERUNNER_API_KEY;

const timedelta = (start: number, end: number) => {
    const delta = end - start;
    const seconds = delta / 1000;
    return `${seconds.toFixed(2)}s`;
}

export default async function (bot: Bot, module: Module) {
    oraChat = new OraChat("asst_Q0MdDbLSFkNzCovK4DXlgvq9");

    if (!CODERUNNER_SERVER || !CODERUNNER_API_KEY) {
        logger.warn("Missing required environment variables for code runner");
        return;
    }

    const codeRunner = new CodeRunner({
        server: CODERUNNER_SERVER,
        apiKey: CODERUNNER_API_KEY,
    });

    /**
     * Handles the execution of code extracted from a Discord interaction message.
     * 
     * This function defers the reply, extracts a code block from the message content,
     * and attempts to execute it using the CodeRunner service. If the code execution
     * is successful, an embed message with the execution result is sent as a reply.
     * In case of failure or error during execution, an error message is logged and
     * an error notification is sent as a reply.
     * 
     * @param interaction - The Discord interaction object containing the message and context.
     */
    async function handleCodeExecution(interaction: ButtonInteraction) {
        if (!oraChat) return;

        await interaction.deferReply();
        const result = getCodeBlock(interaction.message.content);

        if (!result) {
            await interaction.editReply({ content: ":thinking: Something went wrong while trying to run the code." });
            return;
        }

        const { language, source_code } = result;

        try {
            const start_time = Date.now();
            const run_result = await codeRunner.runCodeV1(source_code, language as Language | LanguageAlias);
            const run_time = ((Date.now() - start_time) / 1000).toFixed(1);

            const embed = createCodeExecutionEmbed(language, run_time, run_result);
            const reply = await interaction.editReply({ embeds: [embed] });

            await handleCodeExecutionReply(interaction, reply);
        } catch (error: unknown) {
            await interaction.editReply({ content: ":x: Something went wrong while trying to run the code." });
            logger.error(error instanceof Error ? error.message : String(error));
        }
    }

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton() && interaction.customId.startsWith("ora_run")) {
            await handleCodeExecution(interaction);
        }
    });

    bot.client.on("typingStart", async typing => {
        if (!typing.channel || !typing.user) return;
        if (typing.user.bot) return;
        if (typing.user.id === bot.client.user?.id) return;
        if (!oraChat) return;
        oraChat.createPreemptiveThread();
    });

    bot.client.on("messageCreate", async msg => {
        if (!oraChat || !shouldProcessMessage(msg, bot.client.user)) return;
        const start_time = Date.now();
        if (msg.content.startsWith(`<@${bot.client.user?.id}>`)) {
            await handleMention(msg, bot);
        } else if (msg.reference?.messageId) {
            await handleReply(msg, bot);
        }
        const end_time = Date.now();
        logger.info(`Message processed in ${timedelta(start_time, end_time)}`);
    });
}

function createCodeExecutionEmbed(language: string, run_time: string, run_result: CodeRunnerJobResult) {
    return new EmbedBuilder({
        title: `Executed \`${language}\` code (${run_time}s).`,
        author: { name: `Run ID: ${run_result.jobId}` },
        description: (run_result.processOutput.length > 0 ?
            `\`\`\`ansi\n${run_result.processOutput}\`\`\`` :
            'No output received.') + `\nExit code: ${run_result.exitCode}`,
        footer: { text: `Powered by Piston (emkc.org)` },
        timestamp: new Date().toISOString(),
    });
}
/**
 * Processes and replies to a code execution interaction by adding the reply to the associated
 * chat thread. It fetches the original message and thread ID from the interaction custom ID,
 * and adds the reply to the thread if a valid thread ID is found.
 * @param interaction - The Discord interaction object containing the message and context.
 * @param reply - The reply message object.
 * @param oraChat - The OraChat instance.
 */
async function handleCodeExecutionReply(interaction: ButtonInteraction, reply: Message) {
    if (!reply || !oraChat) return;

    const original_id = interaction.customId.split("_")[2];
    const original_message = await interaction.channel?.messages.fetch(original_id);

    if (original_message) {
        const thread_id = oraChat.getChatByMessageId(original_id);
        if (thread_id) {
            await oraChat.addExistingMessageToThread(thread_id, reply, true);
        }
    }
}
/**
 * Sends chat responses by processing and replying to message content within a chat thread.
 * 
 * This function processes the provided chat message content, splits it into manageable chunks,
 * and sends each chunk as a reply to the original message. If a code block is detected within
 * a chunk and is executable, a "Run Code" button is added to the reply to allow code execution.
 * 
 * @param msg - The original message to reply to.
 * @param chatMessageContent - The array of message content pieces to process and send as replies.
 * @param thread_id - The ID of the chat thread associated with the message.
 * @param oraChat - The OraChat instance used for processing messages and threads.
 * @returns An array of message objects that were sent as replies.
 */
async function sendChatResponses(msg: OmitPartialGroupDMChannel<Message>, chatMessageContent: MessageContent[]) {
    const replies = [];
    const messageContent = chatMessageContent
        .filter(t => t.type === "text")
        .map(t => t.text.value)
        .join("\n");

    for (const msgChunk of discordMessageSplitter(messageContent)) {
        await msg.channel.sendTyping();
        const result = getCodeBlock(msgChunk);

        const text = msgChunk;

        if (isExecutableCode(result)) {
            const button = createRunCodeButton(msg.id);
            const msgData = await msg.reply({
                content: text,
                allowedMentions: { parse: [] },
                components: [button]
            });
            replies.push(msgData);
        } else {
            const msgData = await msg.reply({
                content: text,
                allowedMentions: { parse: [] },
                embeds: []
            });
            replies.push(msgData);
        }
    }
    return replies;
}
/**
 * Checks if the given code block result is a valid, executable code block.
 * @param result - The result of getCodeBlock() to check.
 * @returns true if the code block is executable, false otherwise.
 */
function isExecutableCode(result: false | {
    language: string,
    source_code: string
}) {
    return result && (
        languages.includes(result.language as Language) ||
        languageAliases.includes(result.language as LanguageAlias)
    );
}
/**
 * Creates a Discord button for running code within a message.
 * The returned button is an ActionRowBuilder containing a single ButtonBuilder.
 * The button is labeled as "Run Code", is a primary button style, and shows a sparkling star emoji.
 * The button's custom ID is prefixed with "ora_run_" and is suffixed with the given message ID.
 * @param {string} msgId - The message ID to associate with the button
 * @returns {ActionRowBuilder<ButtonBuilder>} The button as an ActionRowBuilder
 */
function createRunCodeButton(msgId: string) {
    const buttons = new ActionRowBuilder<ButtonBuilder>();
    buttons.addComponents(
        new ButtonBuilder({
            label: 'Run Code',
            customId: `ora_run_${msgId}`,
            style: ButtonStyle.Primary
        }).setEmoji("✨")
    );
    return buttons;
}
/**
 * Checks if a message should be processed by the chatbot.
 * @param {Message} msg - The message to check
 * @param {ClientUser | null}} clientUser - The bot user object
 * @returns {boolean} Whether the message should be processed
 */
function shouldProcessMessage(msg: Message, clientUser: ClientUser | null) {
    if (!clientUser) return false;
    if (msg.author.bot) return false;
    if (msg.author.id === clientUser.id) return false;
    if (!msg.mentions.has(clientUser)) return false;
    return true;
}
/**
 * Handles a chat interaction by managing message sending, replying, and processing
 * within a specified chat thread. It sends typing indicators at various stages to
 * indicate ongoing processing.
 * 
 * @param thread_id - The ID of the chat thread to handle.
 * @param msg - The message object representing the user's message.
 * @returns A boolean indicating success or failure of handling the chat.
 */
async function handleChat(thread_id: string, msg: OmitPartialGroupDMChannel<Message>) {
    if (!oraChat) return;

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

    /*  

    /// This is the old implementation.

    msg.channel.sendTyping();
    const run = await oraChat.runChat(thread);
    if (!run) return false;

    msg.channel.sendTyping();
    const run_result = await oraChat.waitForChat(thread, run, async () => await msg.channel.sendTyping());
    if (!run_result) return false;

    msg.channel.sendTyping();
    const chatMessage = await oraChat.getChatMessage(thread);
    if (!chatMessage) return false;
    */

    const chatMessage = await oraChat.runChatStreamed(thread);
    if (!chatMessage) return false;

    const replies = await sendChatResponses(msg, chatMessage.content);

    replies.forEach(async r => { 
        await r.suppressEmbeds(true);
        await oraChat!.updateChatMap(thread, r.id)
    });
}
/**
 * Handle a message that mentions the bot and has a message reference.
 * @param msg Message to handle.
 * @param bot Orange Bot instance.
 * @param oraChat OraChat instance.
 * @returns Nothing.
 */
async function handleMentionWithReference(msg: OmitPartialGroupDMChannel<Message>, bot: Bot) {
    if (!oraChat) return;
    msg.channel.sendTyping();
    if (!msg.reference?.messageId) return;

    const message = await msg.channel.messages.fetch(msg.reference.messageId);
    const thread_id = await oraChat.newChat(message, true, message.author.id === bot.client.user?.id);
    if (!thread_id) return;

    await oraChat.updateChatMap(thread_id, msg.id);
    await handleChat(thread_id, msg);
}
/**
 * Handle a message that mentions the bot in a thread.
 * @param msg Message to handle.
 * @param bot Orange Bot instance.
 * @param oraChat OraChat instance.
 * @returns Nothing.
 */
async function handleMentionInThread(msg: OmitPartialGroupDMChannel<Message>, bot: Bot) {
    if (!oraChat) return;
    msg.channel.sendTyping();
    const messages = await msg.channel.messages.fetch({ before: msg.id, limit: 16 });
    const thread_id = await oraChat.newChat();
    if (!thread_id) return;

    for (const [_, message] of messages) {
        await oraChat.addExistingMessageToThread(thread_id, message, message.author.id === bot.client.user?.id);
    }
    await handleChat(thread_id, msg);
}
/**
 * Handle a message that mentions the bot but is not a reply.
 * @param msg Message to handle.
 * @param bot Orange Bot instance.
 * @param oraChat OraChat instance.
 * @returns Nothing.
 */
async function handleDirectMention(msg: OmitPartialGroupDMChannel<Message>, bot: Bot) {
    if (!oraChat) return;
    msg.channel.sendTyping();

    const thread_id = await oraChat.newChat();
    if (!thread_id) return;

    try {
        const twoHoursAgo = msg.createdTimestamp - (2 * 60 * 60 * 1000);
        const messages = (await msg.channel.messages.fetch({ before: msg.id, limit: 16 }))
            .filter(m => bot.client.user && m.mentions.users.has(bot.client.user.id) && m.createdTimestamp >= twoHoursAgo);

        for (const [_, message] of messages) {
            await oraChat.addExistingMessageToThread(thread_id, message, message.author.id === bot.client.user?.id);
        }
    } catch (error) {
        logger.error(`Error fetching message history: ${error}`);
    }

    await oraChat.addExistingMessageToThread(thread_id, msg);
    await handleChat(thread_id, msg);
}
/**
 * Handle a message that mentions the bot.
 * @param msg Message to handle.
 * @param bot Orange Bot instance.
 * @param oraChat OraChat instance.
 * @returns Nothing.
 */
async function handleMention(msg: OmitPartialGroupDMChannel<Message>, bot: Bot) {
    if (!bot.client.user) return;
    msg.content = msg.content.replace(`<@${bot.client.user.id}>`, "");
    if (msg.reference?.messageId) {
        await handleMentionWithReference(msg, bot);
    } else if (msg.channel.isThread()) {
        await handleMentionInThread(msg, bot);
    } else {
        await handleDirectMention(msg, bot);
    }
}
/**
 * Handle a message reply.
 * @param msg Message to handle.
 * @param bot Orange Bot instance.
 * @param oraChat OraChat instance.
 * @returns Nothing.
 */
async function handleReply(msg: OmitPartialGroupDMChannel<Message>, bot: Bot) {
    if (!oraChat || !msg.reference?.messageId) return;
    const thread_id = oraChat.getChatByMessageId(msg.reference.messageId);
    if (!thread_id) {
        const message = await msg.channel.messages.fetch(msg.reference.messageId);
        if (message.author.id === bot.client.user?.id) {
            msg.channel.sendTyping();
            const new_thread_id = await oraChat.newChat(message, true, true);
            if (!new_thread_id) return;
            await oraChat.updateChatMap(new_thread_id, msg.id);
            await handleChat(new_thread_id, msg);
        }
        return;
    }

    await handleChat(thread_id, msg);
}
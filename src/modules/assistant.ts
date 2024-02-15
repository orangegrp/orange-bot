import { Bot } from "orange-bot-base";
import { generate_no_context, generate_with_context } from "./gpt/openai.js";
import { getLogger } from "orange-common-lib";
import { EmbedBuilder } from "discord.js";

const logger = getLogger("assistant");

function calculateCost(sys_prompt_tokens: number, input_tokens: number, output_tokens: number): {
    total_tokens: number,
    input_cost: number,
    output_cost: number,
    total_cost: number
} {
    const cost_per_1k_usd_input = 0.0005;
    const cost_per_1k_usd_output = 0.0015;
    const total_tokens = input_tokens + output_tokens;

    const input_cost = ((input_tokens + sys_prompt_tokens)  / 1000) * cost_per_1k_usd_input;
    const output_cost = (output_tokens / 1000) * cost_per_1k_usd_output;
    const total_cost = input_cost + output_cost;

    return { total_tokens, input_cost, output_cost, total_cost };
}

const context_map: Map<string, string> = new Map();

export default function (bot: Bot) { 
    bot.client.on("messageCreate", async msg => {
        if (bot.client.user && (msg.reference && msg.reference.messageId && context_map.has(msg.reference?.messageId) || (msg.mentions.has(bot.client.user) && msg.content.startsWith(`<@${bot.client.user.id}>`)))) {
            msg.channel.sendTyping();

            const user = msg.author.displayName;
            const id = msg.author.id;

            var result: { response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean };

            if (msg.reference && msg.reference.messageId && context_map.has(msg.reference.messageId)) {
                logger.info(`Using previous context: ${context_map.get(msg.reference.messageId)}`);
                result = await generate_with_context(context_map.get(msg.reference.messageId)!, user, id, msg.content.replace(/<@\d+>/g, '').trim(), "asst_c053PWqAKmuUgJ0whEjGpJzG");
            } else {
                result = await generate_no_context(user, id, msg.content.replace(/<@\d+>/g, '').trim(), "asst_c053PWqAKmuUgJ0whEjGpJzG");
                logger.info(`Using new context: ${result.thread_id}`);
            }
      
            //const result = await generate_no_context(user, id, msg.content.replace(/<@\d+>/g, '').trim(), "asst_c053PWqAKmuUgJ0whEjGpJzG");

            const sys_prompt_tokens = 269 + 25;
            const input_tokens = result.input_tokens ?? 0;
            const output_tokens = result.output_tokens ?? 0;

            const { total_tokens, input_cost, output_cost, total_cost } = calculateCost(sys_prompt_tokens, input_tokens, output_tokens);

            const cost_info = `Input cost: $${input_cost.toFixed(4)} (${input_tokens} tokens)\n` +
                `Output cost: $${output_cost.toFixed(4)} (${output_tokens} tokens)\n` +
                `Total cost: $${(total_cost).toFixed(4)} (${total_tokens} total tokens)`;
            logger.info(cost_info);

            if (result.response) {
                const reply = await msg.reply(result.response);

                if (result.thread_id) {
                    context_map.set(reply.id, result.thread_id);
                    setTimeout(() => context_map.delete(reply.id), 3600000); 
                }
            }
            else {
                msg.reply({embeds: [{
                    title: "Could not generate response",
                    description: "The response I received from OpenAI was `undefined`.",
                }]});
            }

            if (result.new_context) {
                msg.channel.send({
                    embeds: [
                        {
                            color: 0xffff00,
                            description: `This dialogue is in a new context window.`
                        }
                    ]
                }); 
            }
            
            msg.channel.send({
                embeds: [
                    {
                        description: `This request: **$${total_cost.toFixed(4)}** (**${total_tokens}** tokens)\n` +
                                     `**$${(total_cost * 60).toFixed(2)}**/h\u00A0\u00A0` +
                                     `**$${(total_cost * 60 * 24).toFixed(2)}**/d\u00A0\u00A0` +
                                     `**$${(total_cost * 60 * 24 * 7).toFixed(2)}**/w\u00A0\u00A0` +
                                     `**$${(total_cost * 60 * 24 * 30).toFixed(2)}**/m\u00A0\u00A0` +
                                     `**$${(total_cost * 60 * 24 * 365).toFixed(2)}**/y`,
                        footer: { text: `${input_tokens} tokens in \u00A0\u00A0 ${output_tokens} tokens out \u00A0\u00A0 ${total_tokens} tokens/min` },
                    }
                ]
            });

            
        }
    });  
};
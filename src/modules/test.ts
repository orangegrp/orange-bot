import type { Bot } from "orange-bot-base"
export default function(bot: Bot) {
    bot.addChatCommand("test", (msg, args) => {
        msg.reply("orange")
    })
}
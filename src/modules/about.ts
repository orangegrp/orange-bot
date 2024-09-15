import type { Bot, Command, Module } from "orange-bot-base";
import chalk from "chalk";
import { AsciiTable3, AlignmentEnum } from "ascii-table3";
import { captureConsole } from "../core/functions.js";

const aboutCommand = {
    name: "about",
    description: "Shows info about the bot",
    args: {}
} as const satisfies Command;

function getPeerInfo(bot: Bot): { name: string, priority: number, alive: boolean, knownDead: boolean }[] {
    if (!bot.syncHandler) return [];

    const peers: { name: string, priority: number, alive: boolean, knownDead: boolean }[] = [];
    for (const peer of bot.syncHandler.peers.values()) {
        //if (!peer.alive) continue;
        //if (peer.knownDead) continue;

        peers.push({ name: peer.name, priority: peer.priority, alive: peer.alive, knownDead: peer.knownDead });
    }

    return peers;
}

function getModuleInfo(bot: Bot): { name: string, handler: string, disabled: boolean, me: boolean }[] {
    const modules_info: { name: string, handler: string, disabled: boolean, me: boolean }[] = [];
    for (const cmd of bot.commandManager.commands.values()) {
        const module = cmd.module.name;
        const unavailable = cmd.module.isUnavailable;
        const handler = cmd.module.handler;
        const me = cmd.module.isHandling;

        modules_info.push({ name: module, handler: handler ?? "nobody", disabled: unavailable, me: me })
    }
    return modules_info;
}


export default function (bot: Bot, module: Module) {
    module.addCommand(aboutCommand, (interaction, args) => {
        const peersList = getPeerInfo(bot);
        const moduleInfo = getModuleInfo(bot);

        console.table(peersList);
        console.table(moduleInfo);

        let peer_table = new AsciiTable3("Peer Information")
            .setHeading("Name", "Priority", "Alive", "Known Dead")
            .setAlign(1, AlignmentEnum.LEFT)
            .setAlign(2, AlignmentEnum.CENTER)
            .setAlign(3, AlignmentEnum.CENTER)
            .setAlign(4, AlignmentEnum.CENTER)
            .addRowMatrix(
                peersList.map(peer => {
                    const this_peer = peer.name === bot.instanceName;

                    const peer_name = peer.name.length < 16 ? `${peer.name}${this_peer ? " (this)" : ""}` : `${peer.name.substring(0, 8)}...${this_peer ? " (this)" : ""}`;

                    const peer_alive = this_peer ? "-" : peer.alive ? chalk.green("Yes") : chalk.red("No");
                    const peer_dead = this_peer ? "-" : peer.knownDead ? "Yes" : "No";

                    return [this_peer ? chalk.cyan(peer_name) : peer_dead ? chalk.white(peer_name) : peer_alive ? chalk.green(peer_name) : chalk.red(peer_name), chalk.yellow(peer.priority), peer_alive, chalk.gray(peer_dead)]
                })
            );

        let module_table = new AsciiTable3("Module Information")
            .setHeading("Name", "Handler", "Active")
            .setAlign(1, AlignmentEnum.LEFT)
            .setAlign(2, AlignmentEnum.LEFT)
            .setAlign(3, AlignmentEnum.CENTER)
            .addRowMatrix(
                moduleInfo.map(module => {
                    const module_name = module.name.length < 16 ? module.name : `${module.name.substring(0, 8)}...`;
                    const handler_name = module.handler.length < 16 ? `${module.handler}${module.me ? " (this)" : ""}` : `${module.handler.substring(0, 14)}...${module.me ? " (this)" : ""}`;
                    const module_enabled = !module.disabled || handler_name !== "nobody" ? chalk.green("Yes") : chalk.gray("No");

                    return [chalk.white(module_name), module.me ? chalk.cyan(handler_name) : handler_name === "nobody" ? chalk.black(handler_name) : chalk.gray(handler_name), module_enabled];
                })
            );
            
        const peer_table_str = captureConsole<string>(peer_table.toString() as any);
        const module_table_str = captureConsole<string>(module_table.toString() as any);

        console.log(peer_table_str);
        console.log(module_table_str);

        interaction.reply({
            embeds: [{
                title: "orange🟠 Bot",
                timestamp: new Date().toISOString(),
                description: `\`\`\`ansi\n${peer_table_str}${module_table_str}\`\`\``,
                fields: [
                    { name: "Instance", value: bot.instanceName, inline: true },
                    { name: "Environment", value: bot.env, inline: true },
                    { name: "Version", value: bot.version, inline: true },
                    { name: "Prefix", value: bot.prefix, inline: true },
                ]
            }]
        });
    })
}
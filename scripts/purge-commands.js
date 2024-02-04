import { REST, Routes } from "discord.js";
import readline from "node:readline";
import "dotenv/config";

const start_time = new Date();

function showSpinner(task) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
  
    return setInterval(() => {
        let end_time = new Date();
        let delta = end_time - start_time;
        process.stdout.write(`\r${task} (${(delta / 1000).toFixed(1)}s) `.replace('>', spinner[i]));
        i = (i + 1) % spinner.length;
    }, 100);
}

function unshowSpinner(spinner, status) {
    clearInterval(spinner);
    process.stdout.write(`\r${status}\x1b[K\n`);
}

const clientId = process.env.BOT_CLIENT;
const guildId = process.env.DEPLOY_GUILD;
const token = process.env.BOT_TOKEN;
const rest = new REST().setToken(token);

const warning = "⚠️  READ THIS WARNING BEFORE YOU USE THIS SCRIPT ⚠️ \n" +
                "• This script is intended for exceptioonal circumstances where all commands must be purged.\n" +
                "• Only use this script to perform a 'factory reset' of all the slash commands when all else fails.\n" +
                "• Using this script will destroy ALL guild and global slash commands and may prevent the recreation for a limited amount of time due to API quota.\n" +
                "\nAre you sure you want to continue (y/n)? ";

let terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

terminal.question(warning, (answer) => {
    if (answer === "y") {
        terminal.question(`1/2 > Destroy ALL application guild commands for ${guildId}? (y/n) `, async (answer) => {
            if (answer === "y") {
                let t = showSpinner("1/2 > Destroying all guild commands");
                // For guild-based commands
                try {
                    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
                    unshowSpinner(t, "1/2 ✅ Destroyed all guild commands");
                }
                catch (e) {
                    unshowSpinner(t, "1/2 ❌ Failed to destroy all guild commands"); console.error(e) 
                }
            }
        
            terminal.question(`2/2 > Destroy ALL application global commands? (y/n) `, async (answer) => {
                if (answer === "y") {
                    let t = showSpinner("2/2 > Destroying all global commands");
                    // For global commands
                    try {
                        await rest.put(Routes.applicationCommands(clientId), { body: [] });
                        unshowSpinner(t, "2/2 ✅ Destroyed all guild commands");
                    }
                    catch (e) {
                        unshowSpinner(t, "2/2 ❌ Failed to destroy all global commands"); console.error(e);
                    }
                    terminal.close();
                } else {
                    terminal.close();
                }
            });
        }); 
    } else {      
        terminal.close();
    }
});

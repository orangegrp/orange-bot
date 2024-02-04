import { REST, Routes } from "discord.js";
import "dotenv/config";

const clientId = process.env.BOT_CLIENT;
const guildId = process.env.DEPLOY_GUILD;
const token = process.env.BOT_TOKEN;

const rest = new REST().setToken(token);

// For guild-based commands
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
    .then(() => console.log('Successfully deleted all guild commands.'))
    .catch(console.error);

// For global commands
rest.put(Routes.applicationCommands(clientId), { body: [] })
    .then(() => console.log('Successfully deleted all application commands.'))
    .catch(console.error);
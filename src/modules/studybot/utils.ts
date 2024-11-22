import type { Channel, PrivateThreadChannel, PublicThreadChannel, TextChannel, VoiceChannel } from "discord.js";
import { ChannelType } from "discord.js";

type StudyBotChannel = TextChannel | PrivateThreadChannel | PublicThreadChannel<boolean> | VoiceChannel;

function isValidStudyBotChannel(channel: Channel): channel is StudyBotChannel {
    if (!channel.isTextBased()) return false;
    if (channel.isDMBased()) return false;
    if (channel.type === ChannelType.GuildStageVoice) return false;
    if (channel.type === ChannelType.GuildAnnouncement) return false;
    return true
}

export type { StudyBotChannel }
export { isValidStudyBotChannel }
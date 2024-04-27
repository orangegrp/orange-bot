import { ColorResolvable, EmbedAuthorOptions, EmbedBuilder, EmbedFooterOptions } from "discord.js";

type OrangeEmbedInfo = {
    title?: string | null,
    description?: string | null,
    url?: string | null,
    smallimage?: string | null,
    largeimage?: string | null,
    author?: EmbedAuthorOptions | null,
    color?: ColorResolvable | null,
    footer?: EmbedFooterOptions | null,
    timestamp?: number | Date | null | undefined
};

/**
 * Generates a discord.js embed from the information supplied.
 * @param data Embed information object.
 * @returns {EmbedBuilder}
 */
function createEmbed(data: OrangeEmbedInfo): EmbedBuilder {
    const embed = new EmbedBuilder();

    embed.setTitle(data.title || null);
    embed.setDescription(data.description || null);
    embed.setURL(data.url || null);
    embed.setThumbnail(data.smallimage || null);
    embed.setImage(data.largeimage || null);
    embed.setAuthor(data.author || null);
    embed.setColor(data.color || null);
    embed.setFooter(data.footer || null);
    embed.setTimestamp(data.timestamp);

    return embed;
}

export default createEmbed;
export { createEmbed, OrangeEmbedInfo };
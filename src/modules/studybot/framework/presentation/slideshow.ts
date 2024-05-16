import { createEmbed } from './embed.js';
import Discord, { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, MessageActionRowComponentBuilder } from 'discord.js';
import { NodeHtmlMarkdown, NodeHtmlMarkdownOptions } from 'node-html-markdown';

type OrangeSlide = {
    category?: string | null;
    title?: string | null;
    content?: string | null;
    icon?: string | null;
    image?: string | null;
    link?: string | null;
    footer?: string | null;
    sequence?: number | null;
};

const SLIDESHOWS: Map<string, OrangeSlideshow> = new Map();

function slideShowHandler(interaction: ButtonInteraction) {
    const showid = interaction.customId.substring(15);
    const slideshow = SLIDESHOWS.get(showid);
    if (interaction.customId.startsWith('slideshow-prev-') && slideshow) {
        slideshow.prevSlide();
        interaction.deferUpdate();
    } else if (interaction.customId.startsWith('slideshow-next-') && slideshow) {
        slideshow.nextSlide();
        interaction.deferUpdate();
    } else {
        interaction.reply({
            ephemeral: true, embeds: [createEmbed({
                title: ':film_frames: Cannot find the slideshow',
                description: 'That slideshow doesn\'t exist in memory anymore. Please create a new slideshow and try again.'
            })]
        });
    }
}

function registerSlideshow(slideshow: OrangeSlideshow) {
    SLIDESHOWS.set(slideshow.showid, slideshow);
}

class OrangeSlideshow {
    showid: string;
    message: Discord.Message;
    slides: OrangeSlide[];
    index: number = 0;

    constructor(slides: OrangeSlide[], originalMessage: Discord.Message) {
        this.slides = slides;
        this.message = originalMessage;
        this.showid = crypto.randomUUID().substring(0, 8);
        registerSlideshow(this);
        this.updateSlide();
    }

    nhm = new NodeHtmlMarkdown(
        /* options (optional) */ {},
        /* customTransformers (optional) */ undefined,
        /* customCodeBlockTranslators (optional) */ undefined
    );

    addSlide(slide: OrangeSlide) {
        this.slides.push(slide);
    }

    removeSlide(slide: OrangeSlide) {
        this.slides.splice(this.slides.indexOf(slide), 1);
    }

    updateSlide() {
        let currentSlide = this.slides[this.index];

        if (currentSlide) {
            const prevBtn = new ButtonBuilder().setCustomId(`slideshow-prev-${this.showid}`).setLabel('◀').setStyle(ButtonStyle.Secondary);
            const nextBtn = new ButtonBuilder().setCustomId(`slideshow-next-${this.showid}`).setLabel('▶').setStyle(ButtonStyle.Secondary);
            const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(prevBtn, nextBtn);

            this.message.edit({
                content: '',
                embeds: [createEmbed({
                    title: currentSlide.title,
                    description: this.nhm.translate(currentSlide.content || ""),
                    url: currentSlide.link,
                    smallimage: currentSlide.icon,
                    largeimage: currentSlide.image,
                    footer: currentSlide.footer !== undefined ? { text: `Slide ${this.index + 1} of ${this.slides.length} ${currentSlide.footer}` } : null
                })],
                components: [row]
            });
        }
    }

    nextSlide() {
        if (this.slides[this.index + 1]) {
            this.index += 1;
            this.updateSlide();
        }
    }

    prevSlide() {
        if (this.slides[this.index - 1]) {
            this.index -= 1;
            this.updateSlide();
        }
    }
}

export default OrangeSlideshow;
export { OrangeSlideshow, OrangeSlide, slideShowHandler, registerSlideshow };
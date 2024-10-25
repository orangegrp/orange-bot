import { readFileSync } from "fs";
import nodeHtmlToImage from "node-html-to-image";
import { getLogger } from "orange-common-lib";
import puppeteer from 'puppeteer-core';

const logger = getLogger("captcha_generator");

const captcha_html_data = readFileSync("./config/captcha/captcha_template.html").toString();

async function generateImage(inputHtml: string) {
    logger.verbose("Generating image...");

    let browser;

    try {
        browser = await puppeteer.launch({
            executablePath: "/usr/bin/firefox-nightly",
            browser: "firefox",
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless']
        });

        const page = await browser.newPage();
        await page.setContent(inputHtml, { waitUntil: 'networkidle0' });

        // Set the viewport size explicitly
        await page.setViewport({
            width: 300,
            height: 172,
            deviceScaleFactor: 1,
        });

        const image = await page.screenshot({
            type: "png"
        });

        logger.verbose("Image generated successfully.");
        return Buffer.from(image);

    } catch (error: any) {
        logger.error(`Error generating image: ${error.message}`);
        logger.error(error.stack);
        logger.warn("Failed to generate image.");
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function generateCaptcha() {
    const html = captcha_html_data;

    const v1 = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    let v2 = String.fromCharCode(97 + Math.floor(Math.random() * 26));

    while (v2 === v1)
        v2 = String.fromCharCode(97 + Math.floor(Math.random() * 26));

    const d1 = Math.floor(Math.random() * 10);
    const d2 = Math.floor(Math.random() * 10);

    const dd1 = Math.floor(Math.random() * 10);
    const dd2 = Math.floor(Math.random() * 10);

    const op1 = [v1, v2, Math.floor(Math.random() * 10).toString()][Math.floor(Math.random() * 3)];
    const op2 = [v1, v2, Math.floor(Math.random() * 10).toString()][Math.floor(Math.random() * 3)];
    const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];

    const answer = eval(`let ${v1} = ${d1}; let ${v2} = ${d2}; ${op1} ${op} ${op2}`);

    const modifiedHtml = html.replace("{{v1}}", v1)
        .replace("{{v2}}", v2)
        .replace("{{d1}}", d1.toString())
        .replace("{{d2}}", d2.toString())
        .replace("{{dv1}}", v1)
        .replace("{{dv2}}", v2)
        .replace("{{dd1}}", dd1.toString())
        .replace("{{dd2}}", dd2.toString())
        .replace("{{op}}", op)
        .replace("{{op1}}", op1)
        .replace("{{op2}}", op2);

    console.log(modifiedHtml)

    return {
        image: await generateImage(modifiedHtml),
        answer,
        id: crypto.randomUUID()
    }
}

export { generateCaptcha };

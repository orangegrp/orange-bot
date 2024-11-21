import { decode } from "html-entities";
import { Writable } from "stream";


function number2emoji(num: number): string {
    return String.fromCodePoint(0x1F51F + num);
}

function removeHtmlTagsAndDecode(str: string | undefined, limitLength: number = -1): string | undefined {
    if (str === null || str === '' || str === undefined)
        return undefined;
    else
        str = str.toString();

    const old_str = decode(str.replace(/(<([^>]+)>)/ig, '').replace(/\[([\w\s]+)\]/g, '$1'));
    const new_str = old_str.substring(0, limitLength === -1 ? str.length : limitLength);
    return new_str + (new_str.length === old_str.length ? '' : '...');
}

function captureConsole<T>(data: T[]): string {
    // Create a custom writable stream that captures data into a string
    class StringWriter extends Writable {
        private content: string = '';

        _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
            this.content += chunk.toString();
            callback();
        }

        getString(): string {
            return this.content;
        }
    }

    // Create an instance of the custom writable stream
    const writer = new StringWriter();

    // Temporarily replace console.log to capture output
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
        writer.write(args.join(' ') + '\n');
    };

    // Capture console.table output
    console.log(data);

    // Restore the original console.log
    console.log = originalConsoleLog;

    // Return the captured table output as a string
    return writer.getString();
}

function captureConsoleTable<T>(data: T[]): string {
    // Create a custom writable stream that captures data into a string
    class StringWriter extends Writable {
        private content: string = '';

        _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
            this.content += chunk.toString();
            callback();
        }

        getString(): string {
            return this.content;
        }
    }

    // Create an instance of the custom writable stream
    const writer = new StringWriter();

    // Temporarily replace console.log to capture output
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
        writer.write(args.join(' ') + '\n');
    };

    // Capture console.table output
    console.table(data);

    // Restore the original console.log
    console.log = originalConsoleLog;

    // Return the captured table output as a string
    return writer.getString();
}

function discordMessageSplitter(message: string): string[] {
    const maxLength = 1900;
    if (message.length <= maxLength) return [message];

    const messageChunks: string[] = [];
    let currentChunk = "";
    let inCodeBlock = false;
    let currentLanguage = "";

    // Split by lines first
    const lines = message.split('\n');

    for (const line of lines) {
        // Check for code block start/end
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                const langMatch = line.match(/^```(\w+)/);
                currentLanguage = langMatch ? langMatch[1] : '';
            } else {
                inCodeBlock = false;
            }
        }

        // Calculate the line to add, considering code block markers if needed
        let lineToAdd = line;
        if (inCodeBlock && currentChunk === "") {
            // Start new chunk with code block marker
            lineToAdd = "```" + currentLanguage + "\n" + line;
        }

        // If a single line is longer than maxLength, split by markdown-safe boundaries
        if (line.length >= maxLength) {
            const words = line.split(/(\s+)/);
            for (const word of words) {
                if (currentChunk.length + word.length > maxLength) {
                    if (inCodeBlock) {
                        // Close code block before splitting
                        messageChunks.push(currentChunk.trim() + "\n```");
                        currentChunk = "```" + currentLanguage + "\n";
                    } else {
                        messageChunks.push(currentChunk.trim());
                        currentChunk = "";
                    }
                }
                currentChunk += word;
            }
            continue;
        }

        // If adding this line would exceed maxLength, start a new chunk
        if (currentChunk.length + lineToAdd.length + 1 > maxLength) {
            if (inCodeBlock) {
                // Close code block before splitting
                messageChunks.push(currentChunk.trim() + "\n```");
                currentChunk = "```" + currentLanguage + "\n";
            } else {
                messageChunks.push(currentChunk.trim());
                currentChunk = "";
            }
        }
        
        currentChunk += lineToAdd + '\n';
    }

    // Push the last chunk if it's not empty
    if (currentChunk.trim()) {
        if (inCodeBlock) {
            messageChunks.push(currentChunk.trim() + "\n```");
        } else {
            messageChunks.push(currentChunk.trim());
        }
    }

    return messageChunks;
}
    
function getCodeBlock(content: string) { 
    // Check for code blocks with language specifiers
    const codeBlockMatch = content.match(/```([^\n]+)\n([\s\S]*?)```/);
    if (codeBlockMatch) {
        const language = codeBlockMatch[1];
        const source_code = codeBlockMatch[2];

        return { language, source_code };
    } 
    
    return false;
}


export { number2emoji, removeHtmlTagsAndDecode, captureConsoleTable as generateTable, captureConsole, discordMessageSplitter, getCodeBlock };
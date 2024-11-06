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

export { number2emoji, removeHtmlTagsAndDecode, captureConsoleTable as generateTable, captureConsole };
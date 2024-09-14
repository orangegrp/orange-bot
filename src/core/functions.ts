import { decode } from "html-entities";
import { getLogger } from "orange-common-lib";
import { Writable } from "stream";

const logger = getLogger("functions");

function damerauLevenshtein(a: string, b: string, bonus: number = 2, sequenceLength: number = 5): number {
    const lenA = a.length;
    const lenB = b.length;
    const dist: number[][] = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(null));

    if (a === b) {
        return -(a.length * bonus);
    }

    if (b > a) {
        return b.length;
    }

    for (let i = 0; i <= lenA; i++) {
        dist[i][0] = i;
    }
    for (let j = 0; j <= lenB; j++) {
        dist[0][j] = j;
    }

    for (let i = 1; i <= lenA; i++) {
        for (let j = 1; j <= lenB; j++) {
            let cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let minDist = dist[i - 1][j] + 1; // deletion
            let tempDist = dist[i][j - 1] + 1; // insertion
            let substitution = dist[i - 1][j - 1] + cost; // substitution

            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                tempDist = dist[i - 2][j - 2] + cost;
            }

            if (i > sequenceLength && j > sequenceLength) {
                let matchCount = 0;
                for (let k = 1; k <= sequenceLength; k++) {
                    if (a[i - k] === b[j - k]) {
                        matchCount++;
                    } else {
                        break;
                    }
                }
                if (matchCount === sequenceLength) {
                    substitution -= bonus;
                }
            }

            minDist = Math.min(minDist, tempDist, substitution);

            if (i === 1 && j === 1 && a[0] === b[0]) {
                minDist -= bonus;
            }

            dist[i][j] = minDist;
        }
    }

    return dist[lenA][lenB];
}

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

function getClosestMatches(input: string, sourcelst: string[], options?: { maxSuggestions?: number, similarityThreshold?: number, sequenceLength?: number, bonus?: number }): string[] | undefined {
    const max_suggestions = options?.maxSuggestions ?? 25;
    const similarity_threshold = options?.similarityThreshold ?? 10;

    if (sourcelst.length < 1)
        return undefined;

    console.dir(sourcelst);

    let closest_item: { item: string, distance: number }[] = [];
    let exact_match: string | undefined = "";

    for (const item of sourcelst) {
        if (!item)
            continue;

        if (input === item)
            return [item];

        const input_tokens = input.split(/[^\w]|[_]/g); // match any non-word char AND underscore.
        const item_tokens = item.split(/[^\w]|[_]/g);

        if (input_tokens.length > item_tokens.length)
            continue;

        let distance = 0;

        for (let i = 0; i < item_tokens.length; i++) {
            for (let j = 0; j < input_tokens.length; j++) {
                distance += damerauLevenshtein(item_tokens[i].toLowerCase(), input_tokens[j].toLowerCase(), options?.sequenceLength, options?.bonus);
            }
        }

        logger.verbose(`Distance between ${input} and ${item} is ${distance}`);

        if (distance <= similarity_threshold) {
            closest_item.push({ item, distance });
        }
    }

    logger.verbose(`Exact match is ${exact_match}`);
    const closest = closest_item.sort((a, b) => a.distance - b.distance).slice(0, max_suggestions).map(obj => obj.item);
    logger.verbose(`Closest item is ${closest[0]}`);

    return [... new Set(closest)];
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


export { damerauLevenshtein, number2emoji, removeHtmlTagsAndDecode, getClosestMatches, captureConsoleTable as generateTable, captureConsole};
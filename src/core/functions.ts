import { decode } from "html-entities";

function damerauLevenshtein(a: string, b: string, bonus: number = 2): number {
    const lenA = a.length;
    const lenB = b.length;
    const dist: number[][] = Array(lenA +  1).fill(null).map(() => Array(lenB +  1).fill(null));

    if (a === b) {
        return -(a.length * bonus);
    }

    if (b > a) {
        return b.length;
    }

    for (let i =  0; i <= lenA; i++) {
        dist[i][0] = i;
    }
    for (let j =  0; j <= lenB; j++) {
        dist[0][j] = j;
    }

    for (let i =  1; i <= lenA; i++) {
        for (let j =  1; j <= lenB; j++) {
            let cost = a[i - 1] === b[j - 1] ?   0 :   1;
            let minDist = dist[i - 1][j] + 1; // deletion
            let tempDist = dist[i][j - 1] + 1; // insertion
            let substitution = dist[i - 1][j - 1] + cost; // substitution

            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                tempDist = dist[i - 2][j - 2] + cost;
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

export { damerauLevenshtein, number2emoji, removeHtmlTagsAndDecode };
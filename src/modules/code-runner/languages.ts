import { CachedLookup } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { damerauLevenshtein, getClosestMatches } from "../../core/functions.js";

const logger = getLogger("code-runner-languages");

const languages = [
    "awk", "bash", "befunge93", "brachylog", "brainfuck", "bqn", "c", "c++", "cjam", "clojure",
    "cobol", "coffeescript", "cow", "crystal", "csharp", "csharp.net", "d", "dart", "dash",
    "dragon", "elixir", "emacs", "emojicode", "erlang", "file", "forte", "forth", "fortran",
    "freebasic", "fsharp.net", "fsi", "go", "golfscript", "groovy", "haskell", "husk",
    "iverilog", "japt", "java", "javascript", "jelly", "julia", "kotlin", "lisp", "llvm_ir",
    "lolcode", "lua", "matl", "nasm", "nasm64", "nim", "ocaml", "octave", "osabie", "paradoc",
    "pascal", "perl", "php", "ponylang", "powershell", "prolog", "pure", "pyth", "python",
    "python2", "racket", "raku", "retina", "rockstar", "rscript", "ruby", "rust", "samarium",
    "scala", "smalltalk", "sqlite3", "swift", "typescript", "basic", "basic.net", "vlang",
    "vyxal", "yeethon", "zig"
] as const;

const languageAliases = [
    "sh", "b93", "cpp", "g++", "clojure", "cob", "coffeescript", "cow", "crystal", "csharp", "csharp.net",
    "deno", "deno-ts", "deno-js", "basic", "visual-basic", "visual-basic.net", "vb", "vb.net", "vb-dotnet",
    "dotnet-vb", "basic-dotnet", "dotnet-basic", "fsharp", "fs", "f#", "fs.net", "f#.net", "fsharp-dotnet",
    "fs-dotnet", "f#-dotnet", "dotnet-fsharp", "dotnet-fs", "dotnet-fs", "fsx", "fsharp-interactive",
    "f#-interactive", "dotnet-fsi", "fsi-dotnet", "fsi.net", "erlang", "erl", "escript", "executable",
    "elf", "binary", "forter", "gforth", "bas", "fbc", "basic", "qbasic", "quickbasic", "gawk", "gcc", "cpp",
    "g++", "gdc", "fortran", "f90", "go", "golang", "golfscript", "groovy", "gvy", "haskell", "hs", "verilog",
    "vvp", "japt", "java", "javascript", "js", "jl", "kt", "lisp", "cl", "sbcl", "commonlisp", "llvm", "llvm-ir",
    "ll", "lol", "lci", "csharp", "mono", "mono-csharp", "mono-c#", "mono-cs", "c#", "cs", "vb", "mono-vb",
    "mono-basic", "visual-basic", "visual basic", "asm", "nasm32", "nasm", "asm64", "nim", "node-javascript",
    "node-js", "javascript", "js", "ocaml", "ml", "matlab", "m", "osabie", "05AB1E", "usable", "paradoc", "freepascal",
    "pp", "pas", "pl", "php", "pony", "ponyc", "prolog", "plg", "pure", "ps", "pwsh", "ps1", "pyth", "py", "py3",
    "python3", "python3.12", "rkt", "raku", "rakudo", "perl6", "p6", "pl6", "ret", "rock", "rocky", "r", "ruby3", "rb",
    "rs", "sm", "sc", "st", "sqlite", "sql", "swift", "ts", "node-ts", "tsc", "typescript5", "ts5", "v", "yeethon3", "zig"
] as const;

type Language = typeof languages extends readonly (infer T)[] ? T : never
type LanguageAlias = typeof languageAliases extends readonly (infer T)[] ? T : never

// string format: language-runtime-version OR language-version

type PistonRuntimes = {
    language: string,
    version: string,
    aliases: string[],
    runtime?: string,
}[];

const crsLanguages: CachedLookup<null, string[]> = new CachedLookup(async () => await getLanguages(true));
const pistonRuntimes: CachedLookup<null, PistonRuntimes> = new CachedLookup(async () => await getLanguages(false));

async function getClosestEnvString(language: string): Promise<string[]> {
    let envs = await crsLanguages.get(null);

    if (envs === undefined) {
        return [] as string[];
    }

    let result = getClosestMatches(language, envs, { similarityThreshold: 15, bonus: 10, sequenceLength: 5});

    if (result === undefined) {
        return [] as string[];
    }

    return result;
}

declare const CrsRunLanguageSymbol: unique symbol;
type CrsRunLanguage = "" & { readonly [CrsRunLanguageSymbol]: typeof CrsRunLanguageSymbol };
declare const CrsRunRuntimeSymbol: unique symbol;
type CrsRunRuntime = "" & { readonly [CrsRunRuntimeSymbol]: typeof CrsRunRuntimeSymbol };
declare const CrsRunVersionSymbol: unique symbol;
type CrsRunVersion = "" & { readonly [CrsRunVersionSymbol]: typeof CrsRunVersionSymbol };

type CrsRunEnvInfo = { 
    readonly language: CrsRunLanguage, 
    readonly runtime?: CrsRunRuntime, 
    readonly version: CrsRunVersion
};
type CrsRunEnvInfoUnverified = { 
    readonly language: string, 
    readonly runtime?: string, 
    readonly version: string
};

async function getRunEnvInfo(runEnvString: string): Promise<CrsRunEnvInfo | { error: string }> {
    const parts = runEnvString.split('-');

    if (parts.length !== 2 && parts.length !== 3) {
        return { error: `Invalid language/environment string: ${runEnvString}` };
    }
    
    const runEnv = {
        language: parts[0],
        version: (parts.length === 2) ? parts[1] : parts[2],
        runtime: (parts.length === 3) ? parts[1] : undefined
    };

    const runtimes = await pistonRuntimes.get(null);

    if (!runtimes) {
        throw new Error("Known runtimes undefined.");
    }

    if (!isRunEnv(runEnv, runtimes)) {
        return { error: `Invalid language/environment string: ${runEnvString}` };
    }

    return runEnv;
}
function isRunEnv(runEnv: CrsRunEnvInfoUnverified, runtimes: PistonRuntimes): runEnv is CrsRunEnvInfo {
    for (const runtime of runtimes) {
        if (runEnv.language !== runtime.language) continue;
        if (runEnv.runtime !== runtime.runtime) continue;
        if (runEnv.version !== runtime.version) continue;
        return true;
    }
    return false;
}


async function getLanguages<T extends boolean>(strings: T): Promise<T extends true ? string[] : PistonRuntimes> {
    let api_url = `https://${process.env.CODERUNNER_SERVER}/api/v2/info`;

    logger.info("FETCHING LANGUAGES");

    const response = await fetch(api_url, {
        headers: {
            'Authorization': `${process.env.CODERUNNER_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const data = await response.json() as PistonRuntimes;

    if (strings) {
        return data.map(env => env.runtime ? `${env.language}-${env.runtime}-${env.version}` : `${env.language}-${env.version}`) as T extends true ? string[] : PistonRuntimes;
    }

    return data as T extends true ? string[] : PistonRuntimes;
}

export { languages, languageAliases, crsLanguages, getRunEnvInfo, getClosestEnvString };
export type { Language, LanguageAlias, CrsRunEnvInfo };
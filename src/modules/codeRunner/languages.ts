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

const languageAliasMap: Record<string, string[]> = {
    "matl": [],
    "bash": ["sh"],
    "befunge93": ["b93"],
    "bqn": [],
    "brachylog": [],
    "brainfuck": ["bf"],
    "cjam": [],
    "clojure": ["clojure", "clj"],
    "cobol": ["cob"],
    "coffeescript": ["coffeescript", "coffee"],
    "cow": ["cow"],
    "crystal": ["crystal", "cr"],
    "dart": [],
    "dash": ["dash"],
    "basic.net": ["basic", "visual-basic", "visual-basic.net", "vb", "vb.net", "vb-dotnet", "dotnet-vb", "basic-dotnet", "dotnet-basic"],
    "fsharp.net": ["fsharp", "fs", "f#", "fs.net", "f#.net", "fsharp-dotnet", "fs-dotnet", "f#-dotnet", "dotnet-fsharp", "dotnet-fs", "dotnet-fs"],
    "csharp.net": ["csharp", "c#", "cs", "c#.net", "cs.net", "c#-dotnet", "cs-dotnet", "csharp-dotnet", "dotnet-c#", "dotnet-cs", "dotnet-csharp"],
    "fsi": ["fsx", "fsharp-interactive", "f#-interactive", "dotnet-fsi", "fsi-dotnet", "fsi.net"],
    "dragon": [],
    "elixir": ["elixir", "exs"],
    "emacs": ["emacs", "el", "elisp"],
    "emojicode": ["emojic"],
    "erlang": ["erlang", "erl", "escript"],
    "file": ["executable", "elf", "binary"],
    "forte": ["forter"],
    "forth": ["gforth"],
    "freebasic": ["bas", "fbc", "basic", "qbasic", "quickbasic"],
    "awk": ["gawk"],
    "c": ["gcc"],
    "c++": ["cpp", "g++"],
    "d": ["gdc"],
    "fortran": ["fortran", "f90"],
    "go": ["go", "golang"],
    "golfscript": ["golfscript"],
    "groovy": ["groovy", "gvy"],
    "haskell": ["haskell", "hs"],
    "husk": [],
    "iverilog": ["verilog", "vvp"],
    "japt": ["japt"],
    "java": [],
    "jelly": [],
    "julia": ["jl"],
    "kotlin": ["kt"],
    "lisp": ["lisp", "cl", "sbcl", "commonlisp"],
    "llvm_ir": ["llvm", "llvm-ir", "ll"],
    "lolcode": ["lol", "lci"],
    "lua": [],
    "csharp": ["mono", "mono-csharp", "mono-c#", "mono-cs", "c#", "cs"],
    "basic": ["vb", "mono-vb", "mono-basic", "visual-basic", "visual basic"],
    "nasm": ["asm", "nasm32"],
    "nasm64": ["asm64"],
    "nim": [],
    "javascript": ["node-javascript", "node-js", "javascript", "js"],
    "ocaml": ["ocaml", "ml"],
    "octave": ["matlab", "m"],
    "osabie": ["osabie", "05AB1E", "usable"],
    "paradoc": ["paradoc"],
    "pascal": ["freepascal", "pp", "pas"],
    "perl": ["pl"],
    "php": [],
    "ponylang": ["pony", "ponyc"],
    "prolog": ["prolog", "plg"],
    "pure": [],
    "powershell": ["ps", "pwsh", "ps1"],
    "pyth": ["pyth"],
    "python": ["py", "py3", "python3", "python3.12"],
    "racket": ["rkt"],
    "raku": ["raku", "rakudo", "perl6", "p6", "pl6"],
    "retina": ["ret"],
    "rockstar": ["rock", "rocky"],
    "rscript": ["r"],
    "ruby": ["ruby3", "rb"],
    "rust": ["rs"],
    "samarium": ["sm"],
    "scala": ["sc"],
    "smalltalk": ["st"],
    "sqlite3": ["sqlite", "sql"],
    "swift": ["swift"],
    "typescript": ["ts", "node-ts", "tsc", "typescript5", "ts5"],
    "vlang": ["v"],
    "vyxal": [],
    "yeethon": ["yeethon3"],
    "zig": [],
};

type Language = typeof languages extends readonly (infer T)[] ? T : never
type LanguageAlias = typeof languageAliases extends readonly (infer T)[] ? T : never
type LanguageMap = typeof languageAliasMap extends readonly (infer T)[] ? T : never

export { languages, languageAliases, languageAliasMap };
export type { Language, LanguageAlias, LanguageMap }
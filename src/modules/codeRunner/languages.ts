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

type Language = typeof languages extends readonly (infer T)[] ? T : never

export { languages }
export type { Language }
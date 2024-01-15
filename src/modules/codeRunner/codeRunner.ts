import { CodeRunnerJobResult, CodeRunnerOptions } from "./types/codeRunner";
import { Logger, getLogger } from "orange-common-lib";
import { languages } from "./languages.js";
import type { Language } from "./languages.js";


class CodeRunnerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CodeRunnerError";
    }
}


class CodeRunner {
    private readonly logger: Logger;
    private readonly options: CodeRunnerOptions;
    constructor(options: CodeRunnerOptions, logger?: Logger) {
        this.options = options;
        this.logger = logger ? logger.sublogger("codeRunner") : getLogger("codeRunner");
    }
    /**
     * verifies that a language is a valid language
     * @param language language name
     * @returns { boolean } is language valid
     */
    checkLang(language: string): language is Language {
        return languages.includes(language as Language);
    }
    /**
     * run code
     * @param code code to run
     * @param language language of the code
     * @returns result of running
     */
    async runCode(code: string, language: Language, stdin?: string): Promise<CodeRunnerJobResult> {
        if (!languages.includes(language)) {
            throw new TypeError(`"${language}" is not a supported language`);
        }
        try {
            const response = await fetch(`https://${this.options.server}/api/v1/execute`, {
                headers: {
                    'Authorization': this.options.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    code: code,
                    lang: language,
                    stdin: stdin, 
                    args: [] 
                }), 
                method: 'POST'
            });

            if (response.status !== 200) {
                throw new CodeRunnerError(`CodeRunner service responded with ${response.status}`);
            }

            const reply = await response.json();

            // this is all unsafe volk...
            const processOutput: string = (reply['data']['run']['output'] as string)
                .substring(0, Math.min(1000, (reply['data']['run']['output'] as string).length)).replace('```', '`\u200b`\u200b`');
            const compilerOutput: string = reply['data']['compile'] != undefined ? reply['data']['compile']['output']
                .substring(0, Math.min(1000, (reply['data']['compile']['output'] as string).length)).replace('```', '`\u200b`\u200b`') : '';
            const exitCode: number = reply['data']['run']['code'];

            return { processOutput, compilerOutput, exitCode };

        }
        catch (err) {
            this.logger.warn(`Failed to process a coderunner request due to an error. ${err}`);
            throw new CodeRunnerError(`CodeRunner failed for mystery reasons`);
        }
    }
}

export { CodeRunner }
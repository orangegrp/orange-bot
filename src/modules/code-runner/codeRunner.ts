import { CodeRunnerJobResult, CodeRunnerOptions, CrsReply } from "./types/codeRunner";
import { Logger, getLogger } from "orange-common-lib";
import { languages, languageAliases } from "./languages.js";
import type { CrsRunEnvInfo, Language, LanguageAlias } from "./languages.js";
import util from "util";
import { CRS_PORT } from "./crsCompat/index.js";

import "./crsCompat/index.js";

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
        this.options.server = "/127.0.0.1:" + CRS_PORT;
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
     * verifies that a language is a valid language
     * @param language language name
     * @returns { boolean } is language valid
     */
    checkLangAlias(language: string): language is LanguageAlias {
        return languageAliases.includes(language as LanguageAlias);
    }

    /**
     * run code
     * @param code code to run
     * @param language language of the code
     * @returns result of running
     */
    async runCodeV1(code: string, language: Language | LanguageAlias, stdin?: string, argv?: string[]): Promise<CodeRunnerJobResult> {
        if (!languages.includes(language as Language) && !languageAliases.includes(language as LanguageAlias)) {
            throw new TypeError(`"${language}" is not a supported language`);
        }

        try {
            const response = await fetch(`http://${this.options.server}/api/v1/execute`, {
                headers: {
                    'Authorization': this.options.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    code: code,
                    lang: language,
                    stdin: stdin, 
                    args: argv
                }), 
                method: 'POST'
            });

            if (response.status !== 200) {
                throw new CodeRunnerError(`CodeRunner service responded with ${response.status}`);
            }

            const reply = await response.json();

            this.logger.verbose(util.inspect(reply, { showHidden: false, depth: null }));

            const { id, data } = reply as CrsReply;

            const processOutput: string = data.run.output.replace(/`/g, '\u1fef');
            const compilerOutput: string = data.compile ? data.compile.output.replace(/`/g, '\u1fef') : '';
            const exitCode: number = data.run.code;

            return { processOutput: processOutput, compilerOutput: compilerOutput, exitCode: exitCode, jobId: id };
        }
        catch (err) {
            this.logger.warn(`Failed to process a coderunner request due to an error. ${err}`);
            throw new CodeRunnerError(`CodeRunner failed for mystery reasons`);
        }
    }


        /**
     * run code
     * @param code code to run
     * @param language language of the code
     * @returns result of running
     */
    async runCodeV2(code: string, runtime: CrsRunEnvInfo, stdin?: string, argv?: string[]): Promise<CodeRunnerJobResult> {

        try {
            const response = await fetch(`http://${this.options.server}/api/v2/execute`, {
                headers: {
                    'Authorization': this.options.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    code: code,
                    lang: runtime.language,
                    version: runtime.version,
                    runtime: runtime.runtime,
                    stdin: stdin, 
                    args: argv
                }), 
                method: 'POST'
            });

            if (response.status !== 200) {
                throw new CodeRunnerError(`CodeRunner service responded with ${response.status}`);
            }

            const reply = await response.json();

            this.logger.verbose(util.inspect(reply, { showHidden: false, depth: null }));

            const { id, data } = reply as CrsReply;

            const processOutput: string = data.run.output.replace(/`/g, '\u1fef');
            const compilerOutput: string = data.compile ? data.compile.output.replace(/`/g, '\u1fef') : '';
            const exitCode: number = data.run.code;

            return { processOutput: processOutput, compilerOutput: compilerOutput, exitCode: exitCode, jobId: id };
        }
        catch (err) {
            this.logger.warn(`Failed to process a coderunner request due to an error. ${err}`);
            throw new CodeRunnerError(`CodeRunner failed for mystery reasons`);
        }
    }
}

export { CodeRunner }
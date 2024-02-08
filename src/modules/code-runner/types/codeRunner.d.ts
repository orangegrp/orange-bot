type CodeRunnerOptions = {
    server: string,
    apiKey: string,
}

type CodeRunnerJobResult = {
    processOutput: string,
    compilerOutput: string,
    exitCode: number,
    jobId: string
}

type PistonReply = {
    language: string,
    version: string,
    run: {
        stdout: string,
        stderr: string,
        output: string,
        code: number,
        signal: number,
    },
    compile?: {
        stdout: string,
        stderr: string,
        output: string,
        code: number,
        signal: number
    }
};

type CrsReply = {
    id: string,
    data: PistonReply
};

export { CodeRunnerOptions, CodeRunnerJobResult, CrsReply, PistonReply };
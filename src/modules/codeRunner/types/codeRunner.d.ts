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

export { CodeRunnerOptions, CodeRunnerJobResult };
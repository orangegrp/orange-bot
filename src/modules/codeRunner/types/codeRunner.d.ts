type CodeRunnerOptions = {
    server: string,
    apiKey: string,
}

type CodeRunnerJobResult = {
    processOutput: string,
    compilerOutput: string,
    exitCode: number
}

export { CodeRunnerOptions, CodeRunnerJobResult };
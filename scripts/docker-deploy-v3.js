import "dotenv/config";
import { spawn } from "child_process";
import { clearInterval } from "timers";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import chalk from "chalk";

const buildx_container_name = `orange-${crypto.randomBytes(4).toString('hex')}`;
const start_time = new Date();
const active_pids = [];
let task = null;

let current_line = "";

function showSpinner(text) {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
  
    return setInterval(() => {
        let end_time = new Date();
        let delta = end_time - start_time;

        let terminalWidth = process.stdout.columns || 80;
        let cleanedLine = current_line.replace(/[\x00-\x1F\x7F\x1B]/g, "");
        let timeInfo = `(${(delta / 1000).toFixed(1)}s)`;
        let maxTextLength = terminalWidth - text.length - timeInfo.length - 5;

        if (cleanedLine.length > maxTextLength) {
            cleanedLine = cleanedLine.substring(0, maxTextLength - 3) + '...';
        }

        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`\r${chalk.white(text)} ${chalk.cyan(timeInfo)} ${chalk.gray(cleanedLine)}`.replace(">", spinner[i]));
        i = (i + 1) % spinner.length;
    }, 100);
}

function unshowSpinner(spinner, status) {
    clearInterval(spinner);
    process.stdout.write(`\r${status}\x1b[K\n`);
}

function showStep(step, steps, cmd, args) {
    console.log(`${step}/${steps} > ${cmd} ${args !== undefined ? args.join(" ") : ""}`);
}

function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);
        active_pids.push(child.pid);

        current_line = "";
        let output = "";

        child.stdout.on('data', (data) => { output += data.toString(); current_line = data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); current_line = data.toString(); });

        child.on('close', (code) => {
            active_pids.splice(active_pids.findIndex((pid) => pid === child.pid), 1);
            if (code === 0) {
                resolve(output);
            } else {
                reject(output);
            }
        });

        if (options.input !== undefined) {
            child.stdin.write(options.input);
            child.stdin.end();
        }
    });
}

/*
{
    step: 1,
    steps: 7,
    commands: [
        { name: "", args: [] },
    ],
    functions: [
        { name: "", func: () => {} },
    ]
    description: "",
    input: "",
    cwd: ""
}
*/

async function executeStep(stage) {
    if (stage.commands) {
        for (let command of stage.commands) {
            showStep(stage.step, stage.steps, command.name, command.args);
        }
    }
    if (stage.functions) {
        for (let _function of stage.functions) {
            showStep(stage.step, stage.steps, _function.name);
        }
    }

    task = showSpinner(`${stage.step}/${stage.steps} > ${stage.description}`);

    try {
        if (stage.commands) {
            for (let command of stage.commands) {
                await runCommand(command.name, command.args, { stdio: 'pipe', shell: true, input: stage.input, cwd: stage.cwd, env: { ...process.env, NODE_ENV: "production" } });
            }
        }
        if (stage.functions) {
            for (let _function of stage.functions) {
                await _function.func();
            }
        }

        unshowSpinner(task, `✅ ${stage.description} completed!`);
        return true;
    } catch (err) {
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `❌ Deploy failed. (${(delta / 1000).toFixed(1)}s). ${stage.description} failed!`);
        console.error(err);
        return false;
    }
}

async function sigintHandler() {
    clearInterval(task);
    task = showSpinner("❗> Stopping builds");

    try {      
        await runCommand("docker", ["buildx", "stop", buildx_container_name], { stdio: 'pipe', shell: true });
       
        for (let pid of active_pids) {
            process.kill(pid, 'SIGTERM');
        }
        
        unshowSpinner(task, `🛑 Stopped build. Had to SIGTERM ${active_pids.length} task(s)`);
    } catch (err) {
        unshowSpinner(task, "⚠️  Could not stop build properly!");
        console.log(err);
    }

    try {
        await buildx_cleanup(4, 4);

        task = showSpinner("❗ > Cleaning up remmants");
        await runCommand("docker", ["buildx", "rm", "--force", buildx_container_name], { stdio: 'pipe', shell: true});

        unshowSpinner(task, "☑️  Clean up completed!");
    } catch (err) {
        unshowSpinner(task, "⚠️  Clean up completed! (Possible issues)");
        console.log(err);
    }

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r❌ Build aborted by user (${(delta / 1000).toFixed(1)}s).`);

    process.exit(2);
}

process.on("SIGINT", sigintHandler);

async function docker_login(step, steps, username, password) {
    const name = "docker";
    const args = [
        "login",
        "-u " + username,
        "--password-stdin"
    ];

    return await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Login to Docker Hub",
        input: password
    });
}

async function buildx_init(step, steps) {
    const name = "docker";
    const args = [
        "buildx",
        "create",
        "--name " + buildx_container_name,
        "--use",
        "--bootstrap",
        "--platform linux/amd64,linux/arm64",
        "--driver docker-container",
        "--driver-opt network=host"
    ];

    return await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Initialise Docker buildx environment",
        
    });
}

async function buildx_build(step, steps, target_img, version, dockerfile, latest) {
    const name = "docker";
    const args = [
        "buildx",
        "build",
        "--platform linux/amd64,linux/arm64",
        "-t", target_img + ":" + version,
        latest ? ("-t", target_img + ":latest") : "",
        "-f", dockerfile,
        "--push",
        "."
    ];

    return await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Run Docker buildx build for multiarch",
        
    });
}

async function buildx_cleanup(step, steps) {
    const name = "docker";
    const args_1 = [
        "buildx",
        "stop",
    ];
    const args_2 = [
        "buildx",
        "rm",
        "--all-inactive",
        "--force",
    ];
    const args_3 = [
        "buildx",
        "prune",
        "--force",       
    ];


    return await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args_1 },
            { name: name, args: args_2 },
            { name: name, args: args_3 },
        ],
        description: "Cleanup Docker buildx environment",
        
    });
}

async function purge_dockerDir(step, steps, dockerDir) {
    const func1 = async () => {
        fs.rmSync(dockerDir, { recursive: true, force: true });
    }
    const func2 = async () => {
        if (!fs.existsSync(dockerDir)) {
            fs.mkdirSync(dockerDir);
        }
    }

    return await executeStep({
        step: step,
        steps: steps,
        functions: [
            { name: `DELETE "${dockerDir}"`, func: func1 },
            { name: `CREATE DIR "${dockerDir}"`, func: func2 },
        ], 
        description: "Purge docker output directory",
    });
}

async function copy_localmodules(step, steps, modulesDir, dockerDir) {
    const func1 = async () => {
        const target = path.resolve(dockerDir, "local_modules");
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target);
        }
        fs.cpSync(modulesDir, target, { recursive: true, force: true });
    }
    const func2 = async () => {
        const target = path.join(dockerDir, "local_modules", "orange-common-lib", "dist");
        if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true });   
        }
    }
    const func3 = async () => {
        const target = path.join(dockerDir, "local_modules", "orange-bot-base", "dist");
        if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true });   
        }
    }
    const func4 = async () => {
        const target = path.join(dockerDir, "local_modules", "orange-common-lib", "tsconfig.buildinfo")
        if (fs.existsSync(target)) {
            fs.rmSync(target, { force: true });
        }
    }
    const func5 = async () => {
        const target = path.join(dockerDir, "local_modules", "orange-bot-base", "tsconfig.buildinfo")
        if (fs.existsSync(target)) {
            fs.rmSync(target, { force: true });
        }
    }

    return await executeStep({
        step: step,
        steps: steps,
        functions: [
            { name: `COPY local_modules INTO "${dockerDir}"`, func: func1 },
            { name: `DELETE dist FOR orange-common-lib`, func: func2 },
            { name: `DELETE dist FOR orange-bot-base`, func: func3 },
            { name: `DELETE tsconfig.buildinfo FOR orange-common-lib`, func: func4 },
            { name: `DELETE tsconfig.buildinfo FOR orange-bot-base`, func: func5 },
        ], 
        description: "Copy and clean local modules",
    });
}

async function copy_rootfiles(step, steps, srcDir, rootFiles, dockerDir) {
    const func1 = async () => {
        const target = path.resolve(dockerDir, "src");
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target);
        }
        fs.cpSync(srcDir, target, { recursive: true, force: true });
    }
    const func2 = async () => {
        for (const file of rootFiles) {
            fs.copyFileSync(file, path.join(dockerDir, path.basename(file)));
        }
    }

    return await executeStep({
        step: step,
        steps: steps,
        functions: [
            { name: `COPY "${srcDir}" INTO "${dockerDir}"`, func: func1 },
            { name: `COPY "${rootFiles.join(", ")}" INTO "${dockerDir}"`, func: func2 },
        ],
        description: "Copy project files",
    });
}

async function install_packages(step, steps, dockerDir) {
    const name = "npm";
    const args = [
        "ci",
        "--only=production"
    ];

    return await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Install packages",
        cwd: dockerDir
    });
}

async function build_project(step, steps, dockerDir) {
    const name = "tsc";
    const args = [
        "--sourceMap false",
        "--removeComments true",
        "--downlevelIteration",
        "--target es2016",
        "--esModuleInterop true",
        "--module es2022",
        "--skipDefaultLibCheck true",
        "--declaration false",
        "--moduleResolution node",
        "--project tsconfig.json",
    ];

    const result_1 = await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Build project 1/4 (orange-common-lib)",
        cwd: path.join(dockerDir, "local_modules", "orange-common-lib"),
    });

    const result_2 = await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Build project 2/4 (orange-bot-base)",
        cwd: path.join(dockerDir, "local_modules", "orange-bot-base"),
    });

    const result_3 = await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: name, args: args },
        ],
        description: "Build project 3/4 (orange-bot)",
        cwd: dockerDir
    });

    const result_4 = await executeStep({
        step: step,
        steps: steps,
        commands: [
            { name: "npm", args: ["dedupe"] },
            { name: "npm", args: ["prune"] },
        ],
        description: "Build project 4/4"
    });

    return result_1 && result_2 && result_3 && result_4;
}

async function main() {
    console.log("orange🟠 docker-deploy.js V3 Script\n");
    console.log("Executing script ...\n");

    if (process.argv.length < 3) {
        console.log("Usage: npm run docker-deploy <version | latest> <opt:latest>");
        process.exit(0);
    }

    let DEPLOY_VERSION = process.argv[2] || "latest";
    let DEPLOY_LATEST = process.argv[3] === "latest" || DEPLOY_VERSION === "latest";
    let DOCKER_FILE = "./Dockerfile";
    let TARGET_IMAGE = "a4004/orange-bot";    

    const DOCKER_DIR = path.resolve("./docker");
    const LMODULES_DIR = path.resolve("./local_modules");
    const SRC_DIR = path.resolve("./src");
    const ROOT_FILES = [
        path.resolve("./tsconfig.json"),
        path.resolve("./package.json"),
        path.resolve("./package-lock.json"),
        path.resolve("./entrypoint.sh")
    ];

    if (!await purge_dockerDir(1, 9, DOCKER_DIR))
        return;
    if (!await copy_localmodules(2, 9, LMODULES_DIR, DOCKER_DIR))
        return;
    if (!await copy_rootfiles(3, 9, SRC_DIR, ROOT_FILES, DOCKER_DIR))
        return;
    if (!await install_packages(4, 9, DOCKER_DIR))
        return;
    if (!await build_project(5, 9, DOCKER_DIR))
        return;
    if (!await docker_login(6, 9, process.env.DOCKER_USERNAME, process.env.DOCKER_PASSWORD))
        return;
    if (!await buildx_init(7, 9))
        return;
    if (!await buildx_build(8, 9, TARGET_IMAGE, DEPLOY_VERSION, DOCKER_FILE, DEPLOY_LATEST))
        return;
    if (!await buildx_cleanup(9, 9))
        return;

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r🍊 Successfully deployed orange🟠 Bot (${(delta / 1000).toFixed(1)}s).`);

    process.exit(0);
}

main();
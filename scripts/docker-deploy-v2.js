import "dotenv/config";
import { spawn } from "child_process";
import { clearInterval } from "timers";
import crypto from "crypto";

const buildx_container_name = `orange-${crypto.randomBytes(4).toString('hex')}`;
const start_time = new Date();
const active_pids = [];
let task = null;

function showSpinner(text) {
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
  
    return setInterval(() => {
        let end_time = new Date();
        let delta = end_time - start_time;
        process.stdout.write(`\r${text} (${(delta / 1000).toFixed(1)}s) `.replace(">", spinner[i]));
        i = (i + 1) % spinner.length;
    }, 100);
}

function unshowSpinner(spinner, status) {
    clearInterval(spinner);
    process.stdout.write(`\r${status}\x1b[K\n`);
}

function showCommand(step, steps, cmd, args) {
    console.log(`${step}/${steps} > ${cmd} ${args !== undefined ? args.join(" ") : ""}`);
}

function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);
        active_pids.push(child.pid);

        let output = '';

        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });

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
    ]
    description: "",
    input: undefined
}
*/

async function executeStep(stage) {
    for (let command of stage.commands) {
        showCommand(stage.step, stage.steps, command.name, command.args);
    }

    task = showSpinner(`${stage.step}/${stage.steps} > ${stage.description}`);

    try {
        for (let command of stage.commands) {
            await runCommand(command.name, command.args, { stdio: 'pipe', shell: true, input: stage.input });
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
        input: undefined
    });
}

async function buildx_build(step, steps, target_img, version, dockerfile) {
    const name = "docker";
    const args = [
        "buildx",
        "build",
        "--platform linux/amd64,linux/arm64",
        "-t", target_img + ":" + version,
        "-t", target_img + ":latest",
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
        input: undefined
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
        input: undefined
    });
}

async function main() {
    console.log("orange🟠 docker-deploy.js Script\n");

    console.log("Executing script ...\n");

    let DEPLOY_VERSION = "";
    let DOCKER_FILE = "";
    let TARGET_IMAGE = "";

    if (process.argv.includes("/drti") || process.argv.includes('/d')) {
        DOCKER_FILE = "./drti.Dockerfile";
        TARGET_IMAGE = "a4004/orange-bot-drti";
    }
    else if (process.argv.includes("/bot") || process.argv.includes('/b')) {
        DOCKER_FILE = "./Dockerfile";
        TARGET_IMAGE = "a4004/orange-bot";     
    } 
    else {
        console.log("Usage: npm run docker-deploy </bot | /b | /drti | /d> <version>");
        process.exit(0);
    }

    DEPLOY_VERSION = process.argv[3] || "latest";

    if (!await docker_login(1, 4, process.env.DOCKER_USERNAME, process.env.DOCKER_PASSWORD))
        return;
    if (!await buildx_init(2, 4))
        return;
    if (!await buildx_build(3, 4, TARGET_IMAGE, DEPLOY_VERSION, DOCKER_FILE))
        return;
    if (!await buildx_cleanup(4, 4))
        return;

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r🍊 Successfully deployed orange🟠 Bot (${(delta / 1000).toFixed(1)}s).`);

    process.exit(0);
}

main();
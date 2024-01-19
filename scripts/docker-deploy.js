import "dotenv/config";
import { spawn } from "child_process";
import { clearInterval } from "timers";

/// ENV VARIABLES:
// DOCKER_USERNAME
// DOCKER_PASSWORD

/// ARGV:
// DEPLOY_VERSION (first parameter, when called through npm)
// DOCKER_FILE
// TARGET_IMAGE

const DEPLOY_VERSION = process.argv[2] || "latest";
const DOCKER_FILE = process.argv[3] || "./Dockerfile";
const TARGET_IMAGE = process.argv[4] || "a4004/orange-bot";

const login_cmd = `docker login -u ${process.env.DOCKER_USERNAME} --password-stdin`;
const buildx_init_cmd = `docker buildx create --use`;
const buildx_build_cmd = `docker buildx build --platform linux/amd64,linux/arm64 -t ${TARGET_IMAGE}:${DEPLOY_VERSION} -t ${TARGET_IMAGE}:latest -f ${DOCKER_FILE} --push .`;
const buildx_cleanup = `docker buildx stop && docker buildx rm --all-inactive --force && docker buildx prune --force`;

const start_time = new Date();
const active_pids = [];
let task = null;

function showSpinner(task) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
  
    return setInterval(() => {
        process.stdout.write(`\r${task} `.replace('>', spinner[i]));
        i = (i + 1) % spinner.length;
    }, 100);
}

function unshowSpinner(spinner, status) {
    clearInterval(spinner);
    process.stdout.write(`\r${status}\x1b[K\n`);
}

process.on('SIGINT', async () => {
    clearInterval(task);
    task = showSpinner("🛑 Stopping build");

    try {
        for (let pid of active_pids) {
            process.kill(pid, 'SIGTERM');
        }
        unshowSpinner(task, "🛑 Build stopped");
    } catch (err) {
        unshowSpinner(task, "⚠️  Failed to stop builds");
        console.log(err);
    }

    await step4_cleanup();

    process.exit();
});

function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);

        active_pids.push(child.pid);

        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

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

async function step4_cleanup() {
    console.log(buildx_cleanup);
    task = showSpinner(`4/4 > Clean up buildx environment`);

    try { 
        await runCommand(buildx_cleanup, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `4/4 ✅ Clean up completed!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `4/4 ⚠️  Finished with warnings (${(delta / 1000).toFixed(1)}s). Clean up failed!`); 
        console.error(err);
        process.exit(2); 
    }
}

async function step3_build() {
    console.log(buildx_build_cmd);

    if (DEPLOY_VERSION === "latest") {
        const end_time = new Date();
        const delta = end_time - start_time;
        console.warn(`⚠️  No version specified for deployment! Aborting the build operation (${(delta / 1000).toFixed(1)}s).`);
        process.exit(1);
    }

    task = showSpinner(`3/4 > Running buildx deploy`);

    try { 
        await runCommand(buildx_build_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `3/4 ✅ Docker buildx build complete!`) 
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `3/4 ❌ Build failed (${(delta / 1000).toFixed(1)}s). Buildx failed!`); 
        console.error(err); 
        await step4_cleanup();
        process.exit(1); 
    }
}

async function step2_init() {
    console.log(buildx_init_cmd);
    task = showSpinner(`2/4 > Initialising Docker buildx environment`);

    try { 
        await runCommand(buildx_init_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `2/4 ✅ Docker buildx environment initialised!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `2/4 ❌ Build failed (${(delta / 1000).toFixed(1)}s). Failed to initialise Docker buildx environment!`); 
        console.error(err); 
        await step4_cleanup();
        process.exit(1); 
    }
}

async function step1_login() {
    console.log(login_cmd);
    task = showSpinner(`1/4 > Login to Docker hub`);

    try { 
        await runCommand(login_cmd, [], { stdio: 'pipe', shell: true, input: `${process.env.DOCKER_PASSWORD}\n` });
        unshowSpinner(task, `1/4 ✅ Logged into Docker Hub as ${process.env.DOCKER_USERNAME}!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `1/4 ❌ > Build failed (${(delta / 1000).toFixed(1)}s). Could not log into Docker Hub!`); 
        console.error(err);
        await step4_cleanup();
        process.exit(1); 
    }
}

async function main() {
    console.log("orange🟠 docker-deploy.js Script\nUsage:\tnpm run docker-deploy <version> <optional: docker file> <optional: target image>\ne.g.\tnpm run docker-deploy 1.0 ./Dockerfile a4004/orange-bot\n\tnpm run docker-deploy 1.0\n");
    console.log("Executing script ...\n");

    await step1_login();
    await step2_init();
    await step3_build();
    await step4_cleanup();

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r🍊 Successfully deployed orange🟠 Bot (${(delta / 1000).toFixed(1)}s).`);

    process.exit(0);
}

main();
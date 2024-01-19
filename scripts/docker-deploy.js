import "dotenv/config";
import { spawn } from "child_process";

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

function runCommand(command, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, options);

        let output = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
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

async function main() {
    console.log("orange🟠 docker-deploy.js Script\nUsage:\tnpm run docker-deploy <version> <optional: docker file> <optional: target image>\ne.g.\tnpm run docker-deploy 1.0 ./Dockerfile a4004/orange-bot\n\tnpm run docker-deploy 1.0\n");
    console.log("Executing script ...\n");

    const start_time = new Date();

    console.log(login_cmd);
    const task1 = showSpinner(`1/3 > Login to Docker hub`);

    try { 
        await runCommand(login_cmd, [], { stdio: 'pipe', shell: true, input: `${process.env.DOCKER_PASSWORD}\n` });
        unshowSpinner(task1, `1/3 ✅ Logged into Docker Hub as ${process.env.DOCKER_USERNAME}!`);
    } catch (err) { 
        unshowSpinner(task1, "1/3 ❌ > Build failed. Could not log into Docker Hub!"); 
        console.error(err);
        process.exit(1); 
    }

    console.log(buildx_init_cmd);
    const task2 = showSpinner(`2/3 > Initialising Docker buildx environment`);

    try { 
        await runCommand(buildx_init_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task2, `2/3 ✅ Docker buildx environment initialised!`);
    } catch (err) { 
        unshowSpinner(task2, "2/3 ❌ Build failed. Failed to initialise Docker buildx environment!"); 
        console.error(err); 
        process.exit(1); 
    }

    console.log(buildx_build_cmd);

    if (DEPLOY_VERSION === "latest") {
        console.warn("⚠️  No version specified for deployment! Aborting the build operation.");
        process.exit(1);
    }

    const task3 = showSpinner(`3/3 > Running buildx deploy`);

    try { 
        await runCommand(buildx_build_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task3, `3/3 ✅ Docker buildx build complete!`) 
    } catch (err) { 
        unshowSpinner(task3, "3/3 ❌ Build failed. Buildx failed!"); 
        console.error(err); 
        process.exit(1); 
    }

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r🍊 Successfully deployed orange🟠 Bot (${(delta / 1000).toFixed(1)}s).`);

    process.exit(0);
}

main();
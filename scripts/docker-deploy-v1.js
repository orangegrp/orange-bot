import "dotenv/config";
import { spawn } from "child_process";
import { clearInterval } from "timers";
import path from "path";
import fs from "fs";
import crypto from "crypto";

let DEPLOY_VERSION = process.argv[3] || "latest";
let DOCKER_FILE = "";
let TARGET_IMAGE = "";

const start_time = new Date();
const active_pids = [];
let task = null;

const BUILD_DIR = path.resolve("./docker");

function showSpinner(task) {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
  
    return setInterval(() => {
        let end_time = new Date();
        let delta = end_time - start_time;
        process.stdout.write(`\r${task} (${(delta / 1000).toFixed(1)}s) `.replace('>', spinner[i]));
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

    await step1_purge();
    await step7_cleanup();

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

async function step7_cleanup() {
    const buildx_cleanup = `docker buildx stop && docker buildx rm --all-inactive --force && docker buildx prune --force`;

    console.log(buildx_cleanup);
    task = showSpinner(`7/7 > Clean up environment`);

    try {
        await runCommand(buildx_cleanup, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `7/7 ✅ Clean up completed!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `7/7 ⚠️  Finished with warnings (${(delta / 1000).toFixed(1)}s). Clean up failed!`); 
        console.error(err);
        process.exit(2); 
    }
}

async function step6_build() {
    const buildx_build_cmd = `docker buildx build --platform linux/amd64,linux/arm64 -t ${TARGET_IMAGE}:${DEPLOY_VERSION} -t ${TARGET_IMAGE}:latest -f ${DOCKER_FILE} --push .`;

    console.log(buildx_build_cmd);

    if (DEPLOY_VERSION === "latest") {
        console.warn(`⚠️  No version specified for deployment! I will override the latest version`);
    }

    task = showSpinner(`6/7 > Running buildx deploy`);

    try { 
        await runCommand(buildx_build_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `6/7 ✅ Docker buildx build complete!`) 
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `6/7 ❌ Build failed (${(delta / 1000).toFixed(1)}s). Buildx failed!`); 
        console.error(err); 
        await step7_cleanup();
        process.exit(1); 
    }
}

async function step5_init() {
    const buildx_init_cmd = `docker buildx create --name orange-${crypto.randomBytes(4).toString('hex')} --use --bootstrap --platform linux/amd64,linux/arm64 --driver docker-container --driver-opt network=host`;

    console.log(buildx_init_cmd);
    task = showSpinner(`5/7 > Initialising Docker buildx environment`);

    try { 
        await runCommand(buildx_init_cmd, [], { stdio: 'pipe', shell: true }); 
        unshowSpinner(task, `5/7 ✅ Docker buildx environment initialised!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `5/7 ❌ Build failed (${(delta / 1000).toFixed(1)}s). Failed to initialise Docker buildx environment!`); 
        console.error(err); 
        await step7_cleanup();
        process.exit(1); 
    }
}

async function step4_login() {
    const login_cmd = `docker login -u ${process.env.DOCKER_USERNAME} --password-stdin`;

    console.log(login_cmd);
    task = showSpinner(`4/7 > Login to Docker hub`);

    try { 
        await runCommand(login_cmd, [], { stdio: 'pipe', shell: true, input: `${process.env.DOCKER_PASSWORD}\n` });
        unshowSpinner(task, `4/7 ✅ Logged into Docker Hub as ${process.env.DOCKER_USERNAME}!`);
    } catch (err) { 
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `4/7 ❌ > Build failed (${(delta / 1000).toFixed(1)}s). Could not log into Docker Hub!`); 
        console.error(err);
        await step7_cleanup();
        process.exit(1); 
    }
}

async function step3_copy() {
    const files =  ["entrypoint.sh"];
    console.log(`COPY ${files.join(" ")} INTO ${BUILD_DIR}`);
    task = showSpinner(`3/7 > Copying essential objects into "${BUILD_DIR}"`);

    try {
        for (const file of files) {
            fs.copyFileSync(file, `${BUILD_DIR}/${file}`);
        }
        unshowSpinner(task, `3/7 ✅ Copied ${files.length} essential objects into "${BUILD_DIR}"!`);
    } catch (err) {
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `3/7 ❌ > Build failed (${(delta / 1000).toFixed(1)}s). Failed to copy objects!`); 
        console.error(err);
        await step7_cleanup();
        process.exit(1); 
    }
}


async function step2_compile() {
    const args = [
        "--sourceMap false",
        "--removeComments",
        "--downlevelIteration",
        "--target es2016",
        "--esModuleInterop",
        "--module es2022",
        "--moduleResolution node",
        "--project tsconfig.json",
    ];

    const common_lib = "local_modules/orange-common-lib";
    const base = "local_modules/orange-bot-base";

    if (!fs.existsSync(`${BUILD_DIR}/${common_lib}`)) {
        fs.mkdirSync(`${BUILD_DIR}/${common_lib}`, { recursive: true });
    }
    if (!fs.existsSync(`${BUILD_DIR}/${base}`)) {
        fs.mkdirSync(`${BUILD_DIR}/${base}`, { recursive: true });
    }

    console.log(`COPY package.json package-lock.json INTO ${BUILD_DIR}`);
    console.log(`npm ci`);

    const { args1, args2, args3, args4 } = { args1: [], args2: [`--outDir "${BUILD_DIR}/${common_lib}"`, ...args], args3: [`--outDir "${BUILD_DIR}/${base}"`, ...args], args4: [`--outDir "${BUILD_DIR}"`, ...args] };

    const cmd1 = `cd ${BUILD_DIR} && npm ci`;
    const cmd2 = `cd ./${common_lib} && tsc`;
    const cmd3 = `cd ./${base} && tsc`;
    const cmd4 = `tsc`;

    console.log(cmd1 + args1.join(" "));
    console.log(cmd2 + args2.join(" "));
    console.log(cmd3 + args3.join(" "));
    console.log(cmd4 + args4.join(" "));

    task = showSpinner(`2/7 > Building orange🟠 Bot into output directory "${BUILD_DIR}"`);

    try {
        ["package.json", "package-lock.json"].forEach(file => {
            fs.copyFileSync(file, `${BUILD_DIR}/${file}`);
        });

        await runCommand(cmd1, args1, { stdio: 'pipe', shell: true });
        await runCommand(cmd2, args2, { stdio: 'pipe', shell: true });
        await runCommand(cmd3, args3, { stdio: 'pipe', shell: true });
        await runCommand(cmd4, args4, { stdio: 'pipe', shell: true });

        unshowSpinner(task, `2/7 ✅ Compiled orange🟠 Bot into output directory "${BUILD_DIR}"!`);
    } catch (err) {
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `2/7 ❌ > Build failed (${(delta / 1000).toFixed(1)}s). Compilation failed.`); 
        console.error(err);
        await step7_cleanup();
        process.exit(1); 
    }
}

async function step1_purge() {
    task = showSpinner(`1/7 > Purge "${BUILD_DIR}" output directory`);

    try {
        fs.rmSync(BUILD_DIR, { recursive: true, force: true });
        unshowSpinner(task, `1/7 ✅ Purged "${BUILD_DIR}" output directory!`);

        if (!fs.existsSync(BUILD_DIR)) {
            fs.mkdirSync(BUILD_DIR);
        }
    } catch (err) {
        const end_time = new Date();
        const delta = end_time - start_time;
        unshowSpinner(task, `1/7 ❌ > Build failed (${(delta / 1000).toFixed(1)}s). Failed to purge "docker" output directory!`); 
        console.error(err);
        await step7_cleanup();
        process.exit(1); 
    }
}


async function main() {
    console.log("orange🟠 docker-deploy.js Script\n");
    console.log("⚠️  Steps 1 through 3 are currently DISABLED for orange-bot builds pending potential fixes or deprecation.\n");

    if (process.argv.includes("/drti") || process.argv.includes('/d')) {
        console.log("Executing script ...\n");

        DOCKER_FILE = "./drti.Dockerfile";
        TARGET_IMAGE = "a4004/orange-bot-drti";

        task = showSpinner(`1/7 > Skipping step 1`);
        unshowSpinner(task, `1/7 ✅ Skipped step 1`);

        task = showSpinner(`2/7 > Skipping step 2`);
        unshowSpinner(task, `2/7 ✅ Skipped step 2`);

        task = showSpinner(`3/7 > Skipping step 3`);
        unshowSpinner(task, `3/7 ✅ Skipped step 3`);

        await step4_login();
        await step5_init();
        await step6_build();
        await step7_cleanup();
    }
    else if (process.argv.includes("/bot") || process.argv.includes('/b')) {
        console.log("Executing script ...\n");

        DOCKER_FILE = "./Dockerfile";
        TARGET_IMAGE = "a4004/orange-bot";

        //await step1_purge();
        //await step2_compile();
        //await step3_copy();

        task = showSpinner(`1/7 > Skipping step 1`);
        unshowSpinner(task, `1/7 ✅ Skipped step 1`);

        task = showSpinner(`2/7 > Skipping step 2`);
        unshowSpinner(task, `2/7 ✅ Skipped step 2`);

        task = showSpinner(`3/7 > Skipping step 3`);
        unshowSpinner(task, `3/7 ✅ Skipped step 3`);

        await step4_login();
        await step5_init();
        await step6_build();
        await step7_cleanup();
    } else {
        console.log("Usage: npm run docker-deploy </bot | /b | /drti | /d> <version>");
        process.exit(0);
    }

    const end_time = new Date();
    const delta = end_time - start_time;

    console.info(`\n\r🍊 Successfully deployed orange🟠 Bot (${(delta / 1000).toFixed(1)}s).`);

    process.exit(0);
}

main();
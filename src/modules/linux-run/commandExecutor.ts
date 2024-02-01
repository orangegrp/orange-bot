
import { NodeSSH, type SSHExecCommandResponse } from "node-ssh"
import type { Logger } from "orange-common-lib";
import { Readable } from "stream";
import crypto from "crypto";


const PROCESS_COMMAND = `sudo -S bash -c 'ps -o exe= -u \${SSH_USER}'`
const KILL_COMMAND = `sudo -S bash -c 'ps -o exe=,pid=,etimes= -u \${SSH_USER} | while read line; do { IFS=" "; declare -a process=($line); if [ "\${process[2]}" -gt "5" ]; then kill -SIGKILL "\${process[1]}"; echo "\${process[0]} (pid \${process[1]})"; fi; }; done;'`

type CommandExecutorOpts = {
    host: string,
    port: number,
    username: string,
    password: string,
    rootUsername: string,
    rootPassword: string,
};

class CommandExecutor {
    readonly opts: CommandExecutorOpts;
    readonly ssh: NodeSSH;
    readonly sshRoot: NodeSSH;
    private readonly logger: Logger; 
    constructor(opts: CommandExecutorOpts, logger: Logger) {
        this.opts = opts;
        this.ssh = new NodeSSH();
        this.sshRoot = new NodeSSH();
        this.logger = logger.sublogger("commandExecutor");
    }

    private async connectSSH(root: boolean = false) {
        const ssh = root ? this.sshRoot : this.ssh;
        if (ssh.isConnected()) return;
        await (ssh).connect({
            host: this.opts.host,
            port: this.opts.port,
            username: root ? this.opts.rootUsername : this.opts.username,
            password: root ? this.opts.rootPassword : this.opts.password,
            timeout: 10000,
        });
    }

    private readableFromArray(array: string[]) {
        array.reverse();
        const readable = new Readable({ read: () => { 
            if (array.length > 0) readable.push(array.pop() + "\n");
        } });
        return readable;
    }

    /**
     * Runs commands directly, with no limitations, optionally as root.
     * No error handling.
     * No safety or cleanup.
     * Only use if you 100% know what you're doing.
     * @param commands array of commands to run
     * @param root whether to run as root or not
     * @returns output from command 
     */
    async runCommandUnsafe(commands: string[], root: boolean = false): Promise<SSHExecCommandResponse> {
        await this.connectSSH(root);
        const stdin = this.readableFromArray(commands);

        return await (root ? this.sshRoot : this.ssh).execCommand("bash", { stdin });
    }

    /**
     * Reboots the machine commands are ran on.
     */
    async reboot() {
        await this.runCommandUnsafe([
            "sudo -S shutdown -r now",
            this.opts.rootPassword,
            "exit"
        ], true);
    }

    /**
     * Runs a linux command or commands.
     * Time limit of 5 seconds on commands, will hard kill everything after 10 seconds.
     * This should be safe with untrusted commands.
     * @param command command or commands to run
     * @param callback callback to get stdout and stderror as chunks, always ending on newlines.
     * @returns output from command or error
     */
    async runCommand(command: string | string[], callback?: (output: string) => void) {
        await this.connectSSH();

        // commands as array 
        const commands = typeof command === "string" ? [command] : command
        
        /// EXPLANATION OF THIS BLACK MAGIC
        // bash has a 'trap' feature which captures the signals and exit codes of a child script.
        // so what happens when a script is run is this: (note this example is like a bash file not a one liner that is used here)

        /*
            // trap function
            jh_000000() {
                local pid=$1; shift                 // get the pid of the user entered script
                wait $pid                           // wait for the script to finish
                exit $?                             // exit this host script with the same code of the script that was just run
            }

            eval <USER ENTERED SCRIPT HERE> &       // execute the user entered script in the background
            child=$!                                // get the pid of the script
            trap 'jh_000000 "$child"; exit' CHLD    // set the trap (this will be called once the script finishes, is killed, etc)

            ...
            // kill stuff that topias wrote
        */

        // then as a result the call from `timeout -k 2s 6s bash` will be returned.

        const random_fn = `jh_${crypto.randomBytes(8).toString('hex')}`;
        this.logger.verbose(`Generating secure trap function name = ${random_fn} ...`);

        // evil bash magic 
        commands.splice(0, 0, `${random_fn}() { local ec=$?; local pid=$1; shift; wait $pid && exit $ec; }`);
        commands[commands.length - 1] = `eval "trap '' CHLD; ${commands[commands.length - 1].replace(/['"`\\]/g, '\\$&')}" &`; 

        commands.push("child=$!");
        commands.push(`trap '${random_fn} "$child"; exit' CHLD`);

        // commands to Readable
        const stdin = this.readableFromArray(commands);

        // 5 second timeout to kill the child process
        setTimeout(() => {            
            stdin.push("{ kill -s SIGINT $child; kill -s SIGINT $$; } 2>/dev/null\n");
        }, 5000);

        // 10 second timeout to kill everything
        setTimeout(() => this.cleanUp(), 10000);

        // if callback exists, create a stdout handler
        const [onstdOut, finishChunked] = callback ? this.readOutputChunked(callback) : [undefined, undefined];

        try {
            // run the commands
            const output = await this.ssh.execCommand("timeout -k 2s 6s bash", { stdin, onStdout: onstdOut, onStderr: onstdOut });
            
            // if finishChunked is defined call it (will execute the callback one last time with the rest of the output)
            if (finishChunked) finishChunked();
            return { output }
        }
        catch (e) {
            this.logger.error("error running command: ");
            this.logger.error(e as any);
            return { error: e }
        }
    }

    private readOutputChunked(callback: (output: string) => void): [(chunk: Buffer) => void, () => void] {
        let finished = false;
        let messageBuffer = "";

        function onStdout(chunk: Buffer) {
            const message = chunk.toString();
            if (!message) return;
            messageBuffer += message;
        }
        function finishChunked() {
            finished = true;
            if (messageBuffer) callback(messageBuffer);
        }

        let outChars = 0;
        let outLines = 0;
        let lastEnd = 0;

        async function sendOutputLoop() {
            while (!finished) {
                const end = messageBuffer.lastIndexOf("\n");
                const lines = messageBuffer.split(/\r\n|\r|\n/).length;

                if (outChars > 2000 || outLines + lines > 20) {
                    await (() => new Promise(r => setTimeout(r, 1000)))();
                    continue;
                }

                if (!messageBuffer || end == lastEnd) {
                    await (() => new Promise(r => setTimeout(r, 1000)))();
                    continue;
                }

                callback(messageBuffer.slice(0, end));

                messageBuffer = messageBuffer.slice(end);

                lastEnd = end;
            }
        }

        sendOutputLoop();

        return [onStdout, finishChunked];
    }


    async cleanUp() {
        let kill = false;
    
        try {    
            const result = await this.runCommandUnsafe([
                PROCESS_COMMAND.replace("${SSH_USER}", this.opts.username),
                this.opts.rootPassword,
                "exit"
            ], true);

            for (const line of result.stdout.split(/\r\n|\r|\n/)) {
                if (!["/usr/sbin/sshd", "/usr/lib/systemd/systemd", ""].includes(line.trim())) {
                    kill = true;
                }
            }
        }
        catch (e) {
            
        }
    
        if (!kill) return;

        const cmds = [
            KILL_COMMAND.replace("${SSH_USER}", this.opts.username),
            this.opts.rootPassword
        ]
        for (let i = 0; i < 9; i++) {
            cmds.push(KILL_COMMAND);
        }
        cmds.push("exit");
        
        try {
            const result = await this.runCommandUnsafe(cmds, true);
            if (!result.stdout) return;
    
            this.logger.warn("had to force kill. stdout: " + result.stdout);
        }
        catch (e: any) {
            this.logger.error("Error killing: ");
            this.logger.error(e);
        }
    }
    
}


export { CommandExecutor }
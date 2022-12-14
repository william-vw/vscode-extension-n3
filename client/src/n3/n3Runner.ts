import { ChildProcess, spawn } from "child_process";
import { window } from "vscode";
import { n3OutputChannel } from "./n3OutputChannel";

// import $rdf = require('rdflib');
// const store = $rdf.graph()

export class Runner {

    private _process: ChildProcess | undefined;
    private _output: Array<Buffer> = [];
    private _errors: Array<Buffer> = [];

    public runN3ExecuteCommand(command: string, args: string[], n3: string, cwd?: string) {
        n3OutputChannel.show();

        // n3OutputChannel.append("args? " + args + "\n");
        this._process = spawn(command, args, { cwd: cwd, shell: true });

        this._process.stdin.end(n3, () => {
            // n3OutputChannel.append("done writing to stdin\n");
        });

        this._process.stdout.on('data', (data) => {
            this._output.push(data);
        });

        this._process.stderr.on('data', (data) => {
            this._errors.push(data);
        });

        this._process.on("exit", async (code) => {
            // n3OutputChannel.append("exited process: " + code + "\n");

            if (code != 0) {
                window.showErrorMessage(`n3 rules failed (exit code ${code})`);

                let error = Buffer.concat(this._errors).toString().split("\n").join("\n");
                n3OutputChannel.append(error);

                return;
            }

            // window.showInformationMessage("n3 rules successfully executed.");

            let output = Buffer.concat(this._output).toString();
            n3OutputChannel.append(output);

            // this._output = [];
            // try {
            //     const python = spawn('python3', ['format_results.py', output])

            //     python.stdout.on('data', (data) => {
            //         this._output.push(data);
            //     });
            //     python.stderr.on('data', (code) => {
            //         //console.log(`stderr: ${code}`);
            //         // window.showInformationMessage(`child process close all stdio with code ${code}`);
            //     });
            //     python.on('close', (code) => {
            //         let formatted = Buffer.concat(this._output).toString();
            //         n3OutputChannel.append(formatted);
            //     });

            // } catch (e) {
            //     window.showErrorMessage("Failed serializing result to output window");
            //     console.error(e);
            // }
        });
    }
}

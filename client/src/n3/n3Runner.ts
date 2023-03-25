import { ChildProcess, spawn } from "child_process";
import { ExtensionContext, window, workspace } from "vscode";
import { n3OutputChannel } from "./n3OutputChannel";
import N3Execute from "./n3Execute";

const { PythonShell } = require('python-shell')
// const $rdf = require('rdflib')
// const N3 = require('n3');

export class Runner {

    private _process: ChildProcess | undefined;
    private _output: Array<Buffer> = [];
    private _errors: Array<Buffer> = [];

    public runN3Command(command: string, args: string[], cwd: string, execute: N3Execute, context: ExtensionContext) {
        n3OutputChannel.clear();
        n3OutputChannel.show();

        let config = workspace.getConfiguration("n3Execute");
        let reasoner = config.get<string>("reasoner");

        // n3OutputChannel.append("command?\n" + command + "\n" + JSON.stringify(args) + "\n\n");
        this._process = spawn(command, args, { cwd: cwd, shell: true });

        // this._process.stdin.end(n3, () => {
        //     // n3OutputChannel.append("\ndone writing to stdin\n");
        // });

        this._process.stdout.on('data', (data) => {
            this._output.push(data);
        });

        this._process.stderr.on('data', (data) => {
            this._errors.push(data);
        });

        this._process.on("exit", async (code) => {
            // n3OutputChannel.append("exited process: " + code + "\n");

            if (code != 0) {
                if (reasoner == "eye" && code == 127) {
                    window.showErrorMessage(`n3 rules failed.
                        please install latest version of eye at https://github.com/eyereasoner/eye/releases`);
                    return;
                }

                window.showErrorMessage(`n3 rules failed (exit code ${code}). see output for details.`);

                let error = Buffer.concat(this._errors).toString();
                n3OutputChannel.append(error);

                return;
            }

            // window.showInformationMessage("n3 rules successfully executed.");

            let output = Buffer.concat(this._output).toString();

            if (execute.n3.length > 1) {
                output = `# loaded files: ${execute.n3.join(" ")}\n\n${output}`;
            }

            if (execute.debug) {
                n3OutputChannel.appendLine("INFERENCES:");
            }

            // if (reasoner == "eye" && config.get("prettyPrintEyeOutput"))
            //     this.prettyPrintOutput(output, context);
            // else
            n3OutputChannel.append(output);

            if (execute.debug) {
                n3OutputChannel.appendLine("");
                n3OutputChannel.appendLine("TRACES (see README for help):");

                let trace = Buffer.concat(this._errors).toString();
                if (config.get("postProcessEyeTraces")) {
                    let traces = trace.split("\n");

                    let map = {};
                    traces.forEach(e => {
                        if (e) {
                            let matches = /(.+) TRACE (.+)/.exec(e);
                            if (matches) {
                                let key = matches[1];
                                let value = matches[2];
                                if (map[key]) map[key].push(value); else map[key] = [value];
                            }
                        }
                    });
                    
                    for (let key in map) {
                        let unique = [... new Set(map[key])]

                        n3OutputChannel.appendLine(key + ":");
                        unique.forEach(e => n3OutputChannel.appendLine(e));
                        n3OutputChannel.appendLine("");
                    }

                } else
                    n3OutputChannel.appendLine(trace);
            }
        });
    }
}

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

            if (execute.debug) {
                let trace = Buffer.concat(this._errors).toString()

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
                    
                    n3OutputChannel.appendLine("TRACES (see README for help):");
                    for (let key in map) {
                        let unique = [... new Set(map[key])]

                        n3OutputChannel.appendLine(key + ":");
                        unique.forEach(e => n3OutputChannel.appendLine(e));
                        n3OutputChannel.appendLine("");
                    }

                } else
                    n3OutputChannel.appendLine(trace);
            }

            if (execute.debug && config.get("postProcessEyeTraces")) {
                n3OutputChannel.appendLine("");
                n3OutputChannel.appendLine("INFERENCES:");
            }

            if (reasoner == "eye" && config.get("prettyPrintEyeOutput"))
                this.prettyPrintOutput(output, context);
            else
                n3OutputChannel.append(output);
        });
    }

    // pretty printing
    private prettyPrintOutput(output: string, context: ExtensionContext) {
        this._output = [];
        this._errors = [];

        try {
            // - rdflib.py (PythonShell)
            let options = {
                args: [output],
                mode: 'text',
                pythonOptions: ['-u'], // get print results in real-time
            }

            let path = context.asAbsolutePath("client/src/n3/format_results.py");
            // n3OutputChannel.append("path? " + path + "\n");
            PythonShell.run(path, options, function (err, results) {
                if (err) {
                    window.showErrorMessage("pretty-printing failed. see output for details.");
                    n3OutputChannel.append(err);

                } else {
                    results = results.join("\n");
                    // results is an array consisting of messages collected during execution
                    n3OutputChannel.append(results);
                }
            });

            // - rdflib.py (spawn)
            // let path = context.asAbsolutePath("client/src/n3/format_results.py");
            // n3OutputChannel.append(path + "\n");

            // const python = spawn('python3', [path, output])
            // python.stdout.on('data', (data) => {
            //     this._output.push(data);
            // });
            // python.stderr.on('data', (data) => {
            //     this._errors.push(data);
            // });
            // python.on('close', (code) => {
            //     if (code != 0) {
            //         window.showErrorMessage(`pretty-printing failed (exit code ${code})`);

            //         let error = Buffer.concat(this._errors).toString();
            //         n3OutputChannel.append(error);

            //         return;
            //     }

            //     let formatted = Buffer.concat(this._output).toString();
            //     n3OutputChannel.append(formatted);
            // });

            // - rdflib.js
            // (package.json: "rdflib": "2.2.21")
            // const store = $rdf.graph();
            // let doc = $rdf.sym('https://example.com/');
            // $rdf.parse(output, store, doc.uri, 'text/n3');
            // let formatted = $rdf.serialize(doc, store, doc.uri, 'text/n3');
            // n3OutputChannel.append(formatted);

            // - N3.js
            // (package.json: "n3": "1.16.3")
            // let writer = new N3.Writer();
            // let parser = new N3.Parser();
            // parser.parse(output, (error, quad, prefixes) => {
            //     if (quad)
            //         writer.addQuad(quad);
            //     else if (error)
            //         n3OutputChannel.append("pretty-printing: error parsing output: " + error + "\n");
            //     else {
            //         writer.end((error, result) => {
            //             if (error)
            //                 n3OutputChannel.append("pretty-printing: error printing output: " + error + "\n");
            //             else
            //                 n3OutputChannel.append(result);
            //         });
            //     }
            // });

        } catch (e) {
            window.showErrorMessage("pretty-printing: error: " + e);
        }
    }
}

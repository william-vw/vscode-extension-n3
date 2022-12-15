import { ChildProcess, spawn } from "child_process";
import { ExtensionContext, window, workspace } from "vscode";
import { n3OutputChannel } from "./n3OutputChannel";

const { PythonShell } = require('python-shell')
// const $rdf = require('rdflib')
// const N3 = require('n3');

export class Runner {

    private _process: ChildProcess | undefined;
    private _output: Array<Buffer> = [];
    private _errors: Array<Buffer> = [];

    public runN3ExecuteCommand(command: string, args: string[], n3: string, cwd: string, context: ExtensionContext) {
        n3OutputChannel.clear();
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

                let error = Buffer.concat(this._errors).toString();
                n3OutputChannel.append(error);

                return;
            }

            // window.showInformationMessage("n3 rules successfully executed.");

            let output = Buffer.concat(this._output).toString();

            let config = workspace.getConfiguration("n3Exec");
            if (!config.get("prettyPrintOutput")) {
                n3OutputChannel.append(output);

                return;
            }

            // pretty printing

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
                        window.showErrorMessage("pretty-printing failed");
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
        });
    }
}

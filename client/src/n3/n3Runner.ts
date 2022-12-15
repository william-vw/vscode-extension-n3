import { ChildProcess, spawn } from "child_process";
import { window, workspace } from "vscode";
import { n3OutputChannel } from "./n3OutputChannel";

const $rdf = require('rdflib')

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

            let config = workspace.getConfiguration("n3Exec");
            if (!config.get("prettyPrintOutput")) {
                n3OutputChannel.append(output);

                return;
            }

            this._output = [];

            try {
                const store = $rdf.graph();

                let doc = $rdf.sym('https://example.com/');
                $rdf.parse(output, store, doc.uri, 'text/n3');

                n3OutputChannel.append($rdf.serialize(doc, store, doc.uri, 'text/n3'));
                
            } catch (e) {
                n3OutputChannel.append("error pretty-printing output: " + e);
            }
        });
    }
}

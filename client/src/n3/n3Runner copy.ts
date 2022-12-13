import {ChildProcess, spawn} from "child_process";
import {ViewColumn, window, workspace} from "vscode";
import {n3OutputChannel} from "./n3OutputChannel";
import {join} from "path";


export class Runner {

    private _process: ChildProcess | undefined;
    private _chunks: Array<Buffer> = [];

    public runN3ExecuteCommand(command: string, args: string[], n3: string, cwd?: string) {
        n3OutputChannel.clear();
        n3OutputChannel.show();

        this._process = spawn(command, args, {cwd: cwd, shell: true});

        this._process.stdin.end(n3, () => {
            //n3OutputChannel.append("file path written to stdin");
        });

        this._process.stdout.on('data', (data) => {
            this._chunks.push(data);
        });

        this._process.stderr.on('data', (data) => {
            //n3OutputChannel.append(data.toString());
            window.showInformationMessage(data.toString());            
        });

        this._process.on("exit", async (code) => {
            if (code === 0) {
                window.showInformationMessage("N3 Rule successfully executed.");
                try {
                    //turn the buffer into a list of lines and then join them back together
                    let out = Buffer.concat(this._chunks).toString().split("\n")
                    let doc = out.join("\n");
                    const python = spawn('python3', ['format_results.py', doc])

                    python.stdout.on('data', function (data) {
                        n3OutputChannel.append(data.toString());
                    });
                    python.on('close', (code) => {
                        console.log(`child process close all stdio with code ${code}`);
                        // send data to browser
                        //n3OutputChannel.append(dataToSend));
                    });


                } catch (e) {
                    window.showErrorMessage("Failed serializing result to output window");
                    console.error(e);
                }
            } else if (code === 1) {
                window.showInformationMessage("N3 Rule failed.");
            }
        });
    }
}

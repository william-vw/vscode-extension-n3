import {workspace} from "vscode";
import {Runner} from "./n3Runner";
import * as path from 'path';
import N3Execute from "./n3Execute";

// import { n3OutputChannel } from "./n3OutputChannel";

export async function executeN3ExecuteCommand(execute: N3Execute) {
    let args = getN3ExecuteCommandArgs(execute);
    let cwd: string | undefined;
    if (workspace.workspaceFolders) {
        cwd = path.join(workspace.workspaceFolders[0].uri.fsPath);
    }

    let commandRunner: Runner = new Runner();
    commandRunner.runN3ExecuteCommand(execute.reasoner, args, execute.n3, cwd);
}

function getN3ExecuteCommandArgs(execute: N3Execute): string[] {
    let config = workspace.getConfiguration("n3Exec");
    let passCmd = (config.get("onlyShowInferences") ? "--pass-only-new" : "--pass-all");
    
    return [
        "--nope",
        `"${execute.n3}"`,
        passCmd,
        "--quiet",
    ];
}
import {workspace} from "vscode";
import {Runner} from "./n3Runner";
import * as path from 'path';
import { N3Execute } from "./n3Execute";

export async function executeN3ExecuteCommand(execute: N3Execute) {
    let args = getN3ExecuteCommandArgs(execute);
    let cwd: string | undefined;
    if (workspace.workspaceFolders) {
        cwd = path.join(workspace.workspaceFolders[0].uri.fsPath);
    }

    let commandRunner: Runner = new Runner();
    commandRunner.runN3ExecuteCommand("eye", args, execute.n3, cwd);
}

function getN3ExecuteCommandArgs(execute: N3Execute): string[] {
    return [
        "--nope",
        `"${execute.n3}"`,
        //"--pass-only-new", 
        "--pass-all",
        //"--output out.n3", 
        "--quiet",
    ];
}
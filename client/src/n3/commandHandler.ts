import { ExtensionContext, workspace, WorkspaceConfiguration } from "vscode";
import { Runner } from "./n3Runner";
import * as path from 'path';
import N3Execute from "./n3Execute";

// import { n3OutputChannel } from "./n3OutputChannel";

export async function executeN3Command(execute: N3Execute, context: ExtensionContext) {
    let config = workspace.getConfiguration("n3Execute");

    let command = null, args = null;
    switch (execute.reasoner) {

        case 'eye':
            command = "eye";
            args = eyeCommandArgs(execute, config);
            break;
        
        case 'jen3':
            command = "java";
            args = jen3CommandArgs(execute, config);
            break;
    }

    
    let cwd: string | undefined;
    if (workspace.workspaceFolders) {
        cwd = path.join(workspace.workspaceFolders[0].uri.fsPath);
    }

    let commandRunner: Runner = new Runner();
    commandRunner.runN3Command(command, args, cwd, execute, context);
}

function eyeCommandArgs(execute: N3Execute, config: WorkspaceConfiguration): string[] {
    let passCmd = (config.get("onlyShowInferences") ? "--pass-only-new" : "--pass-all");
    
    let args = [
        "--nope",
        `--n3 "${execute.n3}"`,
        passCmd,
        "--quiet"
    ];

    if (config.get("extraEyeArguments")) {
        let extraArgs = config.get<string>("extraEyeArguments");
        args.push(extraArgs);
    }

    return args;
}

function jen3CommandArgs(execute: N3Execute, config: WorkspaceConfiguration): string[] {
    let jarPath: string = config.get("jen3Path");
    let flag = (config.get("onlyShowInferences") ? "-inferences" : "-conclusion");

    return [ 
        "-jar", 
        jarPath, 
        `-n3 "${execute.n3}"`,
        flag 
    ];
}
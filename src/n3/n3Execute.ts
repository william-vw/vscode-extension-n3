import {window, workspace} from "vscode";
import { executeN3ExecuteCommand } from "./commandHandler";

export interface N3Execute {
    n3: string
    out: string
}

export async function runN3Execute(): Promise<void> {
    let configuration = workspace.getConfiguration("n3");
    let reasoner = configuration.get<string>("reasoner");

    if (reasoner === undefined) {
        window.showErrorMessage("No n3 reasoner configured");
        return;
    }

    if (window.activeTextEditor === undefined) {
        window.showErrorMessage("No valid n3 file opened");
        return;
    }
    // get a IO handle on the activeTextEditor file
    let n3File = window.activeTextEditor.document.uri.fsPath;
    
    if (n3File === undefined) {
        window.showErrorMessage("No valid n3 file");
        return;
    }

    const n3Execute: N3Execute = {
        // xml: xml,
        //n3: n3File[0].fsPath,
        n3: n3File,
        out: "out.n3"
        // processor: processor
    };

    await executeN3ExecuteCommand(n3Execute);
}
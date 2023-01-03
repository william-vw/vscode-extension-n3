import { ExtensionContext, window, workspace } from "vscode";
import { executeN3ExecuteCommand } from "./commandHandler";
// import { n3OutputChannel } from "./n3OutputChannel";

export default interface N3Execute {
    reasoner: string
    n3: string
    // out: string
}

export async function runN3Execute(context: ExtensionContext): Promise<void> {
    // n3OutputChannel.clear();
    // n3OutputChannel.show();

    let config = workspace.getConfiguration("n3Exec");
    let reasoner = config.get<string>("reasoner");

    if (reasoner === undefined) {
        window.showErrorMessage("No n3 reasoner configured");
        return;
    }

    // let reasoner = "eye";
    // let reasoner = `swipl -x ${context.asAbsolutePath("opt/eye/lib/eye.pvm")} -- `;

    if (reasoner == "jen3" && config.get<string>("jen3Path") == "") {
        window.showErrorMessage("Indicate the jen3 reasoner path in settings.");
        return;
    }

    // get a IO handle on the activeTextEditor file
    let editor = window.activeTextEditor;

    if (editor === undefined) {
        window.showErrorMessage("No active text editor found.");
        return;
    }

    // if (editor !== undefined)
    //     n3OutputChannel.append("active? " + editor.document.uri.fsPath + "\n");

    if (editor.document.uri.scheme == "untitled") {
        window.showErrorMessage("Save file before executing n3 code.");
        return;
    }

    // gotcha: if cursor is in terminal window, 
    // then that one will be the activeTextEditor

    // instead, try one of the (other) visible text editors
    if (editor.document.uri.scheme == "output") {
        editor = undefined;

        // get first visible editor with "file" scheme
        // (if multiple are visible (split screen), select first one)
        for (let visibleEditor of window.visibleTextEditors) {

            if (visibleEditor.document.uri.scheme == "file") {
                editor = visibleEditor;
                break;
            }
        }
    }

    // if (editor !== undefined)
    //     n3OutputChannel.append("selected? " + JSON.stringify(editor.document) + "\n");

    if (editor === undefined) {
        window.showErrorMessage("No suitable text editor found.");
        return;
    }

    let n3File = editor.document.uri.fsPath;

    if (n3File === undefined) {
        window.showErrorMessage("Could not get file path of n3 document.");
        return;
    }

    const n3Execute: N3Execute = {
        reasoner: reasoner,
        n3: n3File,
        // out: "out.n3"
    };

    await executeN3ExecuteCommand(n3Execute, context);
}
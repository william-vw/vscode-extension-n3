import { ExtensionContext, TextDocument, window, workspace } from "vscode";
import { executeN3Command } from "./commandHandler";
import { n3OutputChannel } from "./n3OutputChannel";

const util = require('util');
const exec = util.promisify(require('child_process').exec);

export default interface N3Execute {
    reasoner: string
    n3: string[]
    debug: boolean
    // out: string
}

export async function runN3Execute(context: ExtensionContext): Promise<void> {
    n3OutputChannel.show();

    let config = workspace.getConfiguration("n3Execute");
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

    runN3(reasoner, false, context);
}

export async function runN3Debug(context: ExtensionContext): Promise<void> {
    n3OutputChannel.show();

    let reasoner = "eye";
    if (checkEyeVersion())
        runN3(reasoner, true, context);
}

async function checkEyeVersion(): Promise<boolean> {
    try {
        const { stdout, stderr } = await exec("eye --version");

        let matches: Array<string> = /EYE v(.+).(.+).([^\s]+)/.exec(stderr);
        let majorVersion: number = parseInt(matches[1]);

        if (majorVersion > 20) {
            window.showErrorMessage(`for debugging, please install latest version of eye at https://github.com/eyereasoner/eye/releases (found major version ${majorVersion})`);
            return false;
        }

        return true;

    } catch (e) {
        // n3OutputChannel.appendLine(e);
        window.showErrorMessage(`please install latest version of eye at https://github.com/eyereasoner/eye/releases`);

        return false;
    }
}

async function runN3(reasoner: string, debug: boolean, context: ExtensionContext): Promise<void> {
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

    let folder = n3File.substring(0, n3File.lastIndexOf("/"));
    let alsoloads = getAlsoLoads(editor.document, folder);
    
    // n3OutputChannel.append("alsoloads " + JSON.stringify(alsoloads, null, 4) + "\n");

    const n3Execute: N3Execute = {
        reasoner: reasoner,
        n3: [n3File, ...alsoloads],
        debug: debug
    };

    await executeN3Command(n3Execute, context);
}

function getAlsoLoads(document: TextDocument, folder): string[] {
    let prefix = /^\s*#\s*@alsoload\s+((.*?)(\s+(.*?))*)$/;
    
    let alsoloads: string[] = [];
    for (let i = 0; ; i++) {
        let line = document.lineAt(i).text;
        if (line.trim().length == 0)
            continue;

        let match = line.match(prefix);
        // n3OutputChannel.append("match " + JSON.stringify(match, null, 4) + "\n");
        if (match) {

            let files: string[] = match[1].split(/\s/)
                .map(file => {
                    file = file.trim();
                    if (!file)
                        return file;
                    if (!file.startsWith("/")) {
                        file = folder + "/" + file;
                    }
                    return file;

                })
                // drop the empty strings
                .filter(f => f);

            // n3OutputChannel.append("files " + JSON.stringify(files, null, 4) + "\n");
            alsoloads.push(...files);
        
        } else
            break;
    }

    return alsoloads;
}
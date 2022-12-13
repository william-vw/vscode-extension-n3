// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { commands, ExtensionContext } from 'vscode';
import { runN3Execute } from './n3/n3Execute';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	context.subscriptions.push(commands.registerCommand("n3.execute", async () => {
        await runN3Execute();
    }));
}

// this method is called when your extension is deactivated
export function deactivate() { }

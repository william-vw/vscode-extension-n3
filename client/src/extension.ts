/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { commands, ExtensionContext, languages, Position, Range, Selection, TextEditor, TextEditorEdit, window, workspace } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { runN3Execute, runN3Debug } from './n3/n3Execute';
import { n3OutputChannel } from "./n3/n3OutputChannel";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	n3OutputChannel.show();

	// - LSP client

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let config = workspace.getConfiguration("n3LspServer");
	let configNsPath = config.get<string>("namespacesFile");

	let ns;
	if (configNsPath) {
		try {
			ns = require(configNsPath);
		} catch (e) {
			window.showErrorMessage(`error loading namespaces file ${configNsPath}`)
		}
	}
	if (ns == undefined) {
		let nsPath = context.asAbsolutePath("namespaces.json");
		ns = require(nsPath);
	}


	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'n3' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		initializationOptions: ns
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'N3languageServer',
		'N3 Language Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	// - N3Execute

	context.subscriptions.push(commands.registerCommand("n3.execute", async () => {
		await runN3Execute(context);
	}));

	// - N3Debug

	context.subscriptions.push(commands.registerCommand("n3.debug", async () => {
		await runN3Debug(context);
	}));

	let traceInsert = new TraceInsert();
	context.subscriptions.push(commands.registerTextEditorCommand("n3.addTrace",
		async (editor: TextEditor, edit: TextEditorEdit) =>
			editor.selections.forEach((selection, i) => traceInsert.insert(editor, edit, selection))
	));
}

class TraceInsert {

	prefix = "T";
	cnt = 0;

	insert(editor: TextEditor, edit: TextEditorEdit, selection: Selection): void {
		let text = `"${(this.prefix + this.cnt++)}" log:trace (  ) .`;
		let pos = selection.active;

		let priorNewline = false;
		let priorEndChar = "";
		let nextNewline = false;
		let indent = "";

		// not at start of line, so may need newline for this trace
		if (pos.character > 0) {
			let wsRange = editor.document.getWordRangeAtPosition(
				new Position(pos.line, 0), /\s+/);

			// if all prior characters are whitespaces, don't need newline
			if (!(wsRange !== undefined && wsRange.end.character >= pos.character)) {
				priorNewline = true;

				let line = editor.document.lineAt(pos.line).text;
				// if needed, add an ending "." for prior line
				if (!line.trim().endsWith(".")) {
					// (let's not add illegal syntax)
					if (!line.substring(0, pos.character).trim().endsWith("{"))
						priorEndChar = (line.endsWith(" ") ? "" : " ") + ".";
				}
			}
		}

		let nextChar = editor.document.getText(
			new Range(new Position(pos.line, pos.character + 1), pos));
		// if any next character, insert newline to put it on next line
		if (nextChar != "") {
			nextNewline = true;
		}

		// - if any newline, then figure out indentation from current line

		if ((priorNewline || nextNewline) && pos.line > 0) {
			// get range of whitespaces at current line
			let range = editor.document.getWordRangeAtPosition(
				new Position(pos.line, 0), /\s+/);

			if (range !== undefined) {
				// let's not add an indent if it does not line up with the current cursor
				if (!nextNewline || range.end.character == pos.character) {
					let numSpaces = range.end.character - range.start.character;
					indent = new Array(numSpaces + 1).join(" ");
				}
			}
		}

		text =
			(priorNewline ? priorEndChar + "\n" + indent
				: "") +
			text +
			(nextNewline ? "\n" + indent : "");

		edit.insert(pos, text);
		// n3OutputChannel.debug("select", selection.active);
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

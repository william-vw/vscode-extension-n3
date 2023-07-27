/* eslint-disable @typescript-eslint/no-var-requires */
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import {
	commands,
	ExtensionContext,
	languages,
	Position,
	Range,
	Selection,
	TextEdit,
	TextEditor,
	TextEditorEdit,
	window,
	workspace,
} from "vscode";

import * as vscode from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TextDocument,
	TransportKind,
} from "vscode-languageclient/node";

import { runN3Execute, runN3Debug } from "./n3/n3Execute";
import { n3OutputChannel } from "./n3/n3OutputChannel";

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	n3OutputChannel.show();

	// - LSP client

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join("server", "out", "server.js")
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions,
		},
	};

	const serverConfig: object = getServerConfig(context);

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: "file", language: "n3" }],
		synchronize: {
			// configurationSection: 'n3LspServer', // need to pre-process our config first (getServerConfig)
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
		},
		initializationOptions: serverConfig,
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		"N3languageServer",
		"N3 Language Server",
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	// - N3Execute

	context.subscriptions.push(
		commands.registerCommand("n3.execute", async () => {
			await runN3Execute(context);
		})
	);

	// - N3Debug

	context.subscriptions.push(
		commands.registerCommand("n3.debug", async () => {
			await runN3Debug(context);
		})
	);

	// insert test traces
	const traceInsert = new TraceInsert();
	context.subscriptions.push(
		commands.registerTextEditorCommand(
			"n3.addTrace",
			async (editor: TextEditor, edit: TextEditorEdit) =>
				editor.selections.forEach((selection, i) =>
					traceInsert.insert(editor, edit, selection)
				)
		)
	);
	
	workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration("n3LspServer")) {
			const serverConfig = getServerConfig(context);

			// n3OutputChannel.append(`onDidChangeConfiguration: ${JSON.stringify(serverConfig, null, 4)}`);
			client.sendNotification("update/config", serverConfig);
		}
	});

	// execute updates requested from server
	// (in our case, requests to insert namespaces)
	client.onReady().then(() => {
		client.onNotification("update/namespaces", (edits: InsertNamespace[]) => {
			//   n3OutputChannel.append("received: " + JSON.stringify(edits, null, 4));

			const editor = vscode.window.activeTextEditor;
			edits.forEach((edit) => {
				const txtEdit = edit.edit;
				editor.edit((editBuilder) => {
					editBuilder.insert(txtEdit.range.start, txtEdit.newText);
				});
				window.showInformationMessage(`Inserted namespace: "${edit.ns.prefix}"`);
			});
		});
	});
}

function getServerConfig(context: ExtensionContext): object {
	const config = workspace.getConfiguration("n3LspServer");

	const serverConfig = {
		ns: { map: undefined, mode: undefined },
		ac: { enabled: undefined, vocabTermMap: undefined },
	};

	// namespaces file

	const configNsPath = config.get<string>("namespacesFile");
	const nsMapPath = configNsPath
		? configNsPath
		: context.asAbsolutePath("data/namespaces.json");
	const nsMode = config.get<string>("insertNamespaces");
	try {
		serverConfig.ns.map = require(nsMapPath);
		serverConfig.ns.mode = nsMode;
	} catch (e) {
		window.showErrorMessage(
			`error loading namespaces file ${configNsPath}: ${e}`
		);
	}

	// auto-complete

	const configAc = config.get<boolean>("autocomplete");
	serverConfig.ac.enabled = configAc;

	if (configAc) {
		const configAcWithVocabs = config.get<boolean>(
			"autocompleteWithWellKnownVocabularies"
		);

		if (configAcWithVocabs) {
			let vocabFileMapPath = config.get<string>("vocabulariesFile");
			if (!vocabFileMapPath)
				vocabFileMapPath = context.asAbsolutePath("data/vocab/vocabularies.json");

			const rootPath = vocabFileMapPath.substring(0, vocabFileMapPath.lastIndexOf("/"));

			let path: string;
			try {
				const vocabFileMap = require(vocabFileMapPath);
				const vocabTermMap = {};
				for (const key in vocabFileMap) {
					const file: string = vocabFileMap[key];
					path = `${rootPath}/${file}`;
					vocabTermMap[key] = require(path);
				}

				serverConfig.ac.vocabTermMap = vocabTermMap;

			} catch (e) {
				window.showErrorMessage(
					`Error loading vocabulary terms file ${path}:\n${e}`
				);
			}
		}
	}

	// n3OutputChannel.append("config: " + JSON.stringify(serverConfig));
	return serverConfig;
}

interface InsertNamespace {
	ns: NsInfo;
	edit: TextEdit;
}

interface NsInfo {
	prefix: string,
	uri: string
}

class TraceInsert {
	prefix = "T";
	cnt = 0;

	insert(editor: TextEditor, edit: TextEditorEdit, selection: Selection): void {
		let text = `"${this.prefix + this.cnt++}" log:trace (  ) .`;
		const pos = selection.active;

		let priorNewline = false;
		let priorEndChar = "";
		let nextNewline = false;
		let indent = "";

		// not at start of line, so may need newline for this trace
		if (pos.character > 0) {
			const wsRange = editor.document.getWordRangeAtPosition(
				new Position(pos.line, 0),
				/\s+/
			);

			// if all prior characters are whitespaces, don't need newline
			if (!(wsRange !== undefined && wsRange.end.character >= pos.character)) {
				priorNewline = true;

				const line = editor.document.lineAt(pos.line).text;
				// if needed, add an ending "." for prior line
				if (!line.trim().endsWith(".")) {
					// (let's not add illegal syntax)
					if (!line.substring(0, pos.character).trim().endsWith("{"))
						priorEndChar = (line.endsWith(" ") ? "" : " ") + ".";
				}
			}
		}

		const nextChar = editor.document.getText(
			new Range(new Position(pos.line, pos.character + 1), pos)
		);
		// if any next character, insert newline to put it on next line
		if (nextChar != "") {
			nextNewline = true;
		}

		// - if any newline, then figure out indentation from current line

		if ((priorNewline || nextNewline) && pos.line > 0) {
			// get range of whitespaces at current line
			const range = editor.document.getWordRangeAtPosition(
				new Position(pos.line, 0),
				/\s+/
			);

			if (range !== undefined) {
				// let's not add an indent if it does not line up with the current cursor
				if (!nextNewline || range.end.character == pos.character) {
					const numSpaces = range.end.character - range.start.character;
					indent = new Array(numSpaces + 1).join(" ");
				}
			}
		}

		text =
			(priorNewline ? priorEndChar + "\n" + indent : "") +
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

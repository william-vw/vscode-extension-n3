/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { commands, ExtensionContext, languages, window, workspace } from 'vscode';

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
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

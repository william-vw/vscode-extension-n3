/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	CodeAction,
	CodeActionKind,
	DocumentFormattingParams,
	Command,
	TextDocumentEdit,
	Position,
	TextEdit
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const n3 = require('./n3Main.js');
// import * as should from 'should';
import { spawnSync } from "child_process";
import { format, join, resolve } from 'path';
import { PythonShell } from 'python-shell';
import { resourceLimits } from 'worker_threads';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let namespaces: Map<string, string>;

connection.onInitialize((params: InitializeParams) => {
	namespaces = new Map(Object.entries(params.initializationOptions));
	// connection.console.log("init: " + [...namespaces]);

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			// completionProvider: {
			// 	resolveProvider: true
			// },
			codeActionProvider: true,
			// documentFormattingProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.n3LspServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'n3LspServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

const MSG_UNKNOWN_PREFIX = "Unknown prefix: ";

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	// const settings = await getDocumentSettings(textDocument.uri);

	const text = textDocument.getText();

	// TODO take into account maxProblems
	// settings.maxNumberOfProblems
	// let problems = 0;

	const diagnostics: Diagnostic[] = [];

	n3.parse(text,
		{
			syntaxError: function (recognizer: any, offendingSymbol: any,
				line: any, column: any, msg: string, err: any) {

				// connection.console.log("syntaxError: " + offendingSymbol + " - " +
				// 	line + " - " + column + " - " + msg + " - " + err);

				var start, end;
				if (offendingSymbol != null) {
					// see Token class in n3Main.js
					start = textDocument.positionAt(offendingSymbol.start);
					end = textDocument.positionAt(offendingSymbol.stop);
				} else {
					start = { line: line, character: column }
					end = start
				}

				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {
						start: start,
						end: end
					},
					message: msg,
					source: 'n3'
				};

				diagnostics.push(diagnostic);
			},

			unknownPrefix: function (prefix: string, pName: string, line: number, start: number, end: number) {
				// connection.console.log("unknownPrefix: " + prefix + " - " + pName + " - " + line + " - " + start + " - " + end);

				line = line - 1; // ??
				let startPos = { line: line, character: start }
				let endPos = { line: line, character: start + prefix.length }

				let msg = MSG_UNKNOWN_PREFIX + prefix;
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {
						start: startPos,
						end: endPos
					},
					message: msg,
					source: 'n3'
				};
				diagnostics.push(diagnostic);
			},

			consoleError: function (type: string, line: string, start: string, end: string, msg: string) {
				connection.console.log("consoleError" + type + " - " + line + " - " + start + " - " + end + " - " + msg);
			}

			// newAstLine: function(line:string) {
			// 	connection.console.log("ast" + line);
			// }
		});

	// connection.console.log("diagnostics?\n" + JSON.stringify(diagnostics, null, 4));
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onCodeAction((params) => {
	// connection.console.log("params? " + JSON.stringify(params, null, 4));
	let diagnostics = params.context.diagnostics;

	// connection.console.log("diagns? " + JSON.stringify(diagnostics, null, 4));
	let codeActions: CodeAction[] = [];
	for (let diagnostic of diagnostics) {
		if (diagnostic.message.startsWith(MSG_UNKNOWN_PREFIX)) {
			let prefix: string = diagnostic.message.substring(MSG_UNKNOWN_PREFIX.length);

			if (namespaces.has(prefix)) {
				let ns = namespaces.get(prefix);
				let directive = `@prefix ${prefix}: <${ns}> . \n`;

				const codeAction: CodeAction = {
					title: `Import ${prefix} namespace`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					edit: {
						changes: {
							[params.textDocument.uri]: [{
								range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
								newText: directive
							}]
						}
					}
				}
				codeActions.push(codeAction);
			}
		}
	}
	// connection.console.log("codeActions? " + JSON.stringify(codeActions, null, 4));
	return codeActions;
});

// connection.onDocumentFormatting(formatDocument);

// async function formatDocument(params: DocumentFormattingParams): Promise<TextEdit[]> {
// 	let doc = documents.get(params.textDocument.uri)!;

// 	let text: string = doc.getText();
// 	let formatted: string | undefined = /* await */ formatCode(text);

// 	if (formatted) {
// 		// connection.console.log("formatted? " + formatted);
// 		let edit: TextEdit = {
// 			range: { start: { line: 0, character: 0 }, end: { line: doc.lineCount, character: 0 } },
// 			newText: formatted
// 		};

// 		// connection.console.log("edit?\n" + JSON.stringify(edit, null, 4));
// 		return [edit];

// 	} else
// 		return [];
// }

// function formatCode(text: string) {
// 	const result = spawnSync('python3', 
// 		['/Users/wvw/git/n3/vscode/n3-vscode/vscode-lsp-n3/server/src/format_results.py', text]);
// 	//const result = spawnSync('python3', ['format_results.py', text]);

// 	// it('should be able to execute a string of python code', function (done) {
// 	// 	PythonShell.runString('print("hello");print("world")', undefined, function (err, results) {
// 	// 		if (err) return done(err);
// 	// 		results.should.be.an.Array().and.have.lengthOf(2);
// 	// 		results.should.eql(['hello', 'world']);
// 	// 		done();
// 	// 	});
// 	// });
// 	// return "success";

// 	// connection.console.log("stdout: " + result.stdout);
// 	switch (result.status) {

// 		case 0:
// 			return result.stdout.toString();

// 		default:
// 			connection.console.error(result.stderr.toString());
// 			return undefined;
// 	}

// 	// return new Promise((resolve, reject) => {
// 	// this works
// 	// resolve("abc");

// 	// but not this
// 	// let output: string, error: string;
// 	// spawn('python3', ['/Users/wvw/git/n3/vscode/n3-vscode/vscode-lsp-n3/server/src/format_results.py', text]);
// 	// python.stdout.on('data', function (data) {
// 	// 	// connection.console.log("data? " + data);
// 	// 	output = data;
// 	// });
// 	// python.stderr.on('data', function (data) {
// 	// 	// connection.console.log("error? " + data);
// 	// 	error = data;
// 	// });
// 	// python.on('close', (code) => {
// 	// 	connection.console.log(`child process closed with code ${code}`);
// 	// 	switch (code) {
// 	// 		case 0:
// 	// 			connection.console.log("resolving: " + output);
// 	// 			resolve(output);
// 	// 			break;

// 	// 		default:
// 	// 			reject(error)
// 	// 			break;
// 	// 	}
// 	// });
// 	// });
// }

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// // This handler provides the initial list of the completion items.
// connection.onCompletion(
// 	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
// 		// The pass parameter contains the position of the text document in
// 		// which code complete got requested. For the example we ignore this
// 		// info and always provide the same completion items.
// 		return [
// 			{
// 				label: 'TypeScript',
// 				kind: CompletionItemKind.Text,
// 				data: 1
// 			},
// 			{
// 				label: 'JavaScript',
// 				kind: CompletionItemKind.Text,
// 				data: 2
// 			}
// 		];
// 	}
// );

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
// 	(item: CompletionItem): CompletionItem => {
// 		if (item.data === 1) {
// 			item.detail = 'TypeScript details';
// 			item.documentation = 'TypeScript documentation';
// 		} else if (item.data === 2) {
// 			item.detail = 'JavaScript details';
// 			item.documentation = 'JavaScript documentation';
// 		}
// 		return item;
// 	}
// );

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

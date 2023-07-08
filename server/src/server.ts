/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-case-declarations */
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
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	CodeAction,
	CodeActionKind,
	DocumentFormattingParams,
	TextEdit
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

const n3 = require('./parser/n3Main_nodrop.js');

import { DocTokens } from './ac/DocTokens.js';

// import * as should from 'should';
// import { spawnSync } from "child_process";
// import { format, join, resolve } from 'path';
// import { PythonShell } from 'python-shell';
// import { resourceLimits } from 'worker_threads';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;


// - server globals

const MSG_UNKNOWN_PREFIX = "Unknown prefix: ";

let knownNsMap: Map<string, string>;
let prefixMap: Map<string, string>;
let acTokens : DocTokens;

// ... needed
let curTextDocument: TextDocument;


// - server initialization

interface InitOptions {
	nsMap: object,
	ac: AcOptions
}

interface AcOptions {
	enabled: boolean,
	vocabMap: object
}

connection.onInitialize((params: InitializeParams) => {
	const initOptions : InitOptions = params.initializationOptions;
	
	knownNsMap = new Map(Object.entries(initOptions.nsMap));
	connection.console.log("init: " + JSON.stringify(initOptions, null, 4));

	const acOptions : AcOptions = initOptions.ac;
	if (acOptions.enabled) {
		acTokens = new DocTokens();
		// (only need to keep namespaces for auto-complete)
		prefixMap = new Map();
	}

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
			documentFormattingProvider: true,
			completionProvider: {
				triggerCharacters: ['<', '?', ':']
			}
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


// - server configuration 

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
let globalSettings: any;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<any>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <any>(
			(change.settings.n3LspServer)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<any> {
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


// - parse n3 document
// (includes syntax validation, updating AC tokens)

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	// const settings = await getDocumentSettings(textDocument.uri);

	const uri = textDocument.uri;

	curTextDocument = textDocument;
	const text = textDocument.getText();

	// TODO take into account maxProblems
	// settings.maxNumberOfProblems
	// let problems = 0;

	const diagnostics: Diagnostic[] = [];

	// reset collected auto-complete tokens, namespaces

	if (acTokens)
		acTokens.reset(uri);

	if (prefixMap)
		prefixMap = new Map();

	// connection.console.log("n3?\n" + JSON.stringify(n3, null, 4));
	n3.parse(text,
		{
			syntaxError: function (recognizer: any, offendingSymbol: any,
				line: any, column: any, msg: string, err: any) {

				// connection.console.log("syntaxError: " + offendingSymbol + " - " +
				// 	line + " - " + column + " - " + msg + " - " + err);

				let start, end;
				if (offendingSymbol != null) {
					// see Token class in n3Main.js
					start = textDocument.positionAt(offendingSymbol.start);
					end = textDocument.positionAt(offendingSymbol.stop);
				} else {
					start = { line: line, character: column };
					end = start;
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
				const startPos = { line: line, character: start };
				const endPos = { line: line, character: start + prefix.length };

				const msg = MSG_UNKNOWN_PREFIX + prefix;
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {
						start: startPos,
						end: endPos
					},
					message: msg,
					source: 'n3',
					data: textDocument
				};
				diagnostics.push(diagnostic);
			},

			consoleError: function (type: string, line: string, start: string, end: string, msg: string) {
				connection.console.log("consoleError" + type + " - " + line + " - " + start + " - " + end + " - " + msg);
			},

			onTerm: function(type: string, term: any) {
				// connection.console.log(type + ": " + JSON.stringify(term));

				// collect auto-complete tokens
				if (acTokens)
					acTokens.add(uri, type, term);
			},

			onPrefix: function(prefix: string, uri: string) {
				// connection.console.log("prefix? " + prefix + ", " + uri);

				// collect namespaces
				if (prefixMap)
					prefixMap.set(prefix, uri);
			}

			// newAstLine: function(line:string) {
			// 	connection.console.log("ast" + line);
			// }
		});

	// connection.console.log("diagnostics?\n" + JSON.stringify(diagnostics, null, 4));
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}


// - import namespaces

connection.onCodeAction((params) => {
	// connection.console.log("params? " + JSON.stringify(params, null, 4));
	const diagnostics = params.context.diagnostics;

	// connection.console.log("diagns? " + JSON.stringify(diagnostics, null, 4));
	const codeActions: CodeAction[] = [];
	for (const diagnostic of diagnostics) {

		if (diagnostic.message.startsWith(MSG_UNKNOWN_PREFIX)) {
			const prefix: string = diagnostic.message.substring(MSG_UNKNOWN_PREFIX.length);

			if (knownNsMap.has(prefix)) {
				const ns = knownNsMap.get(prefix);
				const directive = `@prefix ${prefix}: <${ns}> .\n`;

				// keep any commented lines at the top
				// (could be annotations such as @alsoload)

				const lineNr = skipComments(curTextDocument.getText());
				const codeAction: CodeAction = {
					title: `Import ${prefix} namespace`,
					kind: CodeActionKind.QuickFix,
					diagnostics: [diagnostic],
					edit: {
						changes: {
							[params.textDocument.uri]: [{
								range: { start: { line: lineNr, character: 0 }, end: { line: lineNr, character: 0 } },
								newText: directive
							}]
						}
					}
				};
				codeActions.push(codeAction);
			}
		}
	}
	// connection.console.log("codeActions? " + JSON.stringify(codeActions, null, 4));
	return codeActions;
});

function skipComments(text: string): number {
	let lineCnt = -1, startIdx: number, endIdx = -1, curLine: string;
	do {
		startIdx = endIdx + 1;
		endIdx = text.indexOf("\n", startIdx);
		curLine = text.substring(startIdx, endIdx).trim();

		lineCnt++;

	} while (curLine.startsWith("#"));

	// skip newlines that come after as well
	while (curLine.trim() == "") {
		startIdx = endIdx + 1;
		endIdx = text.indexOf("\n", startIdx);
		curLine = text.substring(startIdx, endIdx).trim();

		lineCnt++;
	}

	return lineCnt;
}


// - format n3 document

connection.onDocumentFormatting(formatDocument);

async function formatDocument(params: DocumentFormattingParams): Promise<TextEdit[]> {
	const doc = documents.get(params.textDocument.uri)!;
	const settings = await getDocumentSettings(params.textDocument.uri);

	const text: string = doc.getText();
	const formatted: string | undefined = await formatCode(text, settings);

	if (formatted) {
		// connection.console.log("formatted? " + formatted);
		const edit: TextEdit = {
			range: { start: { line: 0, character: 0 }, end: { line: doc.lineCount, character: 0 } },
			newText: formatted
		};

		// connection.console.log("edit?\n" + JSON.stringify(edit, null, 4));
		return [ edit ];

	} else
		return [];
}

async function formatCode(text: string, settings: any) {
	const formatNs = settings["formatNamespaces"];
	return n3.format(text,{
			tab: 4,
			graphOnNewline: true,
			formatNamespaces: formatNs
		});
}

// connection.onDidChangeWatchedFiles(_change => {
// 	// Monitored files have change in VSCode
// 	connection.console.log('We received an file change event');
// });


// - auto-completion of terms

connection.onCompletion(
	(params: TextDocumentPositionParams): CompletionItem[] => {
		if (!acTokens)
			return [];

		const uri = params.textDocument.uri;
		// connection.console.log("uri? " + uri);
		
		const doc = documents.get(uri)!;

		const symbol = doc.getText(
			{
				start: params.position,
				end: { line: params.position.line, character: params.position.character - 1 }
			}
		);
		// connection.console.log("symbol? " + symbol);

		let type, local = false, needle;
		switch (symbol) {

			case '?':
				type = 'qvar';
				local = true;
				break;
			case '<':
				type = 'iri';
				break;
			case ':':
				let expanded = doc.getText(
					{
						start: { line: params.position.line, character: 0 },
						end: params.position
					}
				);
				expanded = expanded.substring(expanded.lastIndexOf(" ") + 1);
				// connection.console.log("expanded? " + expanded);
				if (expanded == '_:') {
					type = 'bnode';
					local = true;
				} else {
					type = 'pname';
					// get all localnames under the "needle" prefix
					// (vscode will take care of auto-completion for any returned strings)
					needle = expanded.substring(0, expanded.length - 1);
				}
				break;
			default:
				return [];
		}

		let results: string[];
		if (local)
			results = acTokens.get(uri, type, needle);
		else
			results = acTokens.getAll(type, needle);

		// connection.console.log("results? " + results);

		return results.map(str => CompletionItem.create(str));
	}
);

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

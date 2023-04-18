import * as vscode from 'vscode';
import { CtnCompletionProvider } from './CtnCompletionProvider';

export function activate(context: vscode.ExtensionContext) 
{
    const selector = { scheme: 'file', language: 'ctn' };
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(selector, new CtnCompletionProvider(), '@', ':')
    );
}

// This method is called when your extension is deactivated
export function deactivate() {}

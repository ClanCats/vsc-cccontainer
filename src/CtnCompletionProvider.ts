import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as ospath from 'path';
import { execSync, spawn } from 'child_process';

const availableServices: string[] = [];
const availableParamterKeys: string[] = [];
let lastContainerCacheScan = 0;

function uniquifyAvailableServices() {
    const uniqueAvailableServices = new Set(availableServices);
    availableServices.length = 0;
    availableServices.push(...uniqueAvailableServices);
}

function scanContainerCacheFile() {
    const cachePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath + '/var/cache/AppContainer.php';
    // check if the cache file has been modifed since last scan
    const cacheFileStats = fs.statSync(cachePath);
    if (cacheFileStats.mtimeMs > lastContainerCacheScan) {
        lastContainerCacheScan = cacheFileStats.mtimeMs;

        // read the file
        const cacheFile = fs.readFileSync(cachePath, 'utf8');

        // check if we can access a php binary, if none is configured
        // we check if the binary is in the current $PATH   
        let phpBinary: string | undefined = vscode.workspace.getConfiguration('ctn').get('phpBinary');
        if (!phpBinary) {
            phpBinary = execSync('which php').toString().trim();

            // if the returned string is empty or "php not found" we can't use php and 
            // just continue the scan without php
            if (phpBinary === '' || phpBinary === 'php not found') {
                scanContainerCacheFileWithoutPHP(cachePath, cacheFile);
                return;
            }

            // update the php binary setting
            vscode.workspace.getConfiguration('ctn').update('phpBinary', phpBinary, true);
        }

        // use php to get the service names
        scanContainerCacheFileWithPHP(cachePath, cacheFile, phpBinary.trim());
    }
}

function scanContainerCacheFileWithoutPHP(path: string, contents: string) {
    const serviceResolverTypeLine = contents.match(/protected array \$serviceResolverType = \[.*\]/g);

    // just use a regex to find all service names
    if (serviceResolverTypeLine && serviceResolverTypeLine.length > 0) {
        const serviceNameMatches = serviceResolverTypeLine[0].matchAll(/'([a-zA-Z\._]+)'/g);
        for (const serviceName of serviceNameMatches) {
            availableServices.push(serviceName[1]);
        }
    }

    uniquifyAvailableServices();
}

function scanContainerCacheFileWithPHP(path: string, contents: string, phpBinary: string) {
    // first determine the container class name
    const matches = contents.matchAll(/class ([A-Za-z]+) extends ClanCatsContainer/g);
    const containerClassName = matches.next().value[1];
    if (!containerClassName || containerClassName.length === 0) {
        // if we can't determine the container class name we can't use php
        scanContainerCacheFileWithoutPHP(path, contents);
        return;
    }

    // remove the "extends ClanCatsContainer" part from the code
    contents = contents.replace(/extends ClanCatsContainer[0-9a-z]+/g, '');

    // create a temporary php file
    const tempDir = os.tmpdir();
    const tempFile = ospath.join(tempDir, 'ctn_' + Math.random().toString(36).substring(2) + '.php');

    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
    }

    let phpExtractionCode = `
    // make all properties accessible
    $containerRefl = new ReflectionClass(${containerClassName}::class);
    foreach ($containerRefl->getProperties() as $property) {
        $property->setAccessible(true);
    }

    $container = new ${containerClassName}();
    
    // get the paramters
    $data = [];
    $data['parameters'] = $containerRefl->getProperty('parameters')->getValue($container);

    echo json_encode($data);
    `;

    // dump the container code into the temporary file
    fs.writeFileSync(tempFile, contents + phpExtractionCode);

    // run the php code
    const result = execSync(phpBinary + ' ' + tempFile).toString();

    // try to decode the result
    try {
        const data = JSON.parse(result);

        // assign the available parameters
        availableParamterKeys.length = 0;
        availableParamterKeys.push(...Object.keys(data.parameters));
    } catch (e) {
        console.error('error: ' + e);
    }
}

export class CtnCompletionProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {

    provideCompletionItems(
        document: vscode.TextDocument, position: vscode.Position,
        token: vscode.CancellationToken, context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        scanContainerCacheFile();

        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        
        if (linePrefix.startsWith('@')) {
            // use the available services as completion items
            return availableServices.map((str) => new vscode.CompletionItem(str, vscode.CompletionItemKind.Class));
        }

        if (linePrefix.startsWith(':')) {
            // use the available parameters as completion items
            return availableParamterKeys.map((str) => new vscode.CompletionItem(str, vscode.CompletionItemKind.Variable));
        }

        return undefined;
    }

    // findAtStrings(document) {
    //     const regex = /@[A-Za-z0-9\.\_]+/g;
    //     const atStrings = new Set();
    //     const text = document.getText();

    //     let match;
    //     while ((match = regex.exec(text)) !== null) {
    //         atStrings.add(match[0]);
    //     }

    //     return Array.from(atStrings);
    // }
}
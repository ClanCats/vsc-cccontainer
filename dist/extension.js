/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CtnCompletionProvider = void 0;
const vscode = __webpack_require__(1);
const fs = __webpack_require__(3);
const os = __webpack_require__(5);
const ospath = __webpack_require__(6);
const child_process_1 = __webpack_require__(4);
const availableServices = [];
const availableParamterKeys = [];
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
        let phpBinary = vscode.workspace.getConfiguration('ctn').get('phpBinary');
        if (!phpBinary) {
            phpBinary = (0, child_process_1.execSync)('which php').toString().trim();
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
function scanContainerCacheFileWithoutPHP(path, contents) {
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
function scanContainerCacheFileWithPHP(path, contents, phpBinary) {
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
    const result = (0, child_process_1.execSync)(phpBinary + ' ' + tempFile).toString();
    // try to decode the result
    try {
        const data = JSON.parse(result);
        // assign the available parameters
        availableParamterKeys.length = 0;
        availableParamterKeys.push(...Object.keys(data.parameters));
    }
    catch (e) {
        console.error('error: ' + e);
    }
}
class CtnCompletionProvider {
    provideCompletionItems(document, position, token, context) {
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
}
exports.CtnCompletionProvider = CtnCompletionProvider;


/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("os");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("path");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const vscode = __webpack_require__(1);
const CtnCompletionProvider_1 = __webpack_require__(2);
function activate(context) {
    const selector = { scheme: 'file', language: 'ctn' };
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, new CtnCompletionProvider_1.CtnCompletionProvider(), '@', ':'));
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=extension.js.map
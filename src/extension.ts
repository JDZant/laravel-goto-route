// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Extension is activating...');

	// Add a test command
	let testCommand = vscode.commands.registerCommand('laravel-goto-route.test', () => {
		vscode.window.showInformationMessage('Laravel Goto Route Test Command Executed!');
	});

	// Register providers for both PHP and Blade files
	let phpProvider = vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', language: 'php' },
		new LaravelRouteDefinitionProvider()
	);

	let bladeProvider = vscode.languages.registerDefinitionProvider(
		{ scheme: 'file', pattern: '**/*.blade.php' },
		new LaravelBladeRouteProvider()
	);

	context.subscriptions.push(testCommand, phpProvider, bladeProvider);
	
	vscode.window.showInformationMessage('🚀 Laravel Goto Route: Extension is now active!');
}

class LaravelRouteDefinitionProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Definition | undefined> {
		const wordRange = document.getWordRangeAtPosition(position);
		if (!wordRange) {
			return undefined;
		}

		// Get the line text
		const lineText = document.lineAt(position.line).text;
		
		// Check if this line contains a route definition
		if (!this.isRouteLine(lineText)) {
			return undefined;
		}

		// Extract controller and method from the line
		const routeInfo = this.extractRouteInfo(lineText);
		if (!routeInfo) {
			return undefined;
		}

		// Find the controller file
		const controllerFile = await this.findControllerFile(routeInfo.controller);
		if (!controllerFile) {
			return undefined;
		}

		// Return the location
		return new vscode.Location(
			vscode.Uri.file(controllerFile),
			new vscode.Position(0, 0)  // For now, just go to the start of the file
		);
	}

	private isRouteLine(line: string): boolean {
		return line.includes('Route::') && 
			   (line.includes('->controller(') || line.includes('uses =>'));
	}

	private extractRouteInfo(line: string): { controller: string, method: string } | null {
		// Add regex patterns to extract controller and method
		const patterns = [
			/controller\(['"](.*?)['"],\s*['"](.*?)['"]\)/,  // Route::get()->controller('UserController', 'index')
			/uses\s*=>\s*['"](.*?)@(.*?)['"]/  // 'uses' => 'UserController@index'
		];

		for (const pattern of patterns) {
			const match = line.match(pattern);
			if (match) {
				return {
					controller: match[1],
					method: match[2]
				};
			}
		}

		return null;
	}

	private async findControllerFile(controllerName: string): Promise<string | undefined> {
		// Search in common Laravel controller locations
		const locations = [
			'app/Http/Controllers',
			'app/Controllers'
		];

		for (const location of locations) {
			const files = await vscode.workspace.findFiles(
				`${location}/**/${controllerName}.php`
			);

			if (files.length > 0) {
				return files[0].fsPath;
			}
		}

		return undefined;
	}
}

class LaravelBladeRouteProvider implements vscode.DefinitionProvider {
	async provideDefinition(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Definition | undefined> {
		// Get the line text
		const lineText = document.lineAt(position.line).text;

		// Get the word at position
		const word = document.getText(document.getWordRangeAtPosition(position));

		// Extract the full route name
		const routeName = this.getFullRouteName(lineText, word, position);
		if (!routeName) {
			vscode.window.showWarningMessage('❌ Could not find complete route name');
			return undefined;
		}

		// Search in route files
		const routeLocation = await this.findRouteDefinition(routeName);
		if (!routeLocation) {
			vscode.window.showErrorMessage(`❌ Could not find route '${routeName}' in route files`);
			return undefined;
		}

		return routeLocation;
	}

	private getFullRouteName(line: string, clickedWord: string, position: vscode.Position): string | null {
		const patterns = [
			/route\(['"]([a-zA-Z0-9\-\._]+)['"](?:\s*,\s*.*?)?\)/g,
			/\{\{\s*route\(['"]([a-zA-Z0-9\-\._]+)['"](?:\s*,\s*.*?)?\)\s*\}\}/g
		];

		for (const pattern of patterns) {
			const matches = Array.from(line.matchAll(pattern));
			for (const match of matches) {
				const [fullMatch, routeName] = match;
				// Find the start position of the route name in the line
				const startIndex = line.indexOf(routeName);
				const endIndex = startIndex + routeName.length;
				
				// Check if the clicked position is within the route name
				if (position.character >= startIndex && position.character <= endIndex) {
					vscode.window.showInformationMessage(`✅ Found route: ${routeName}`);
					return routeName;
				}
			}
		}

		return null;
	}

	private async findRouteDefinition(routeName: string): Promise<vscode.Location | undefined> {
		try {
			const routeFiles = await vscode.workspace.findFiles(
				'routes/**/*.php',
				'**/vendor/**'
			);

			// Split the route name to handle grouped routes
			const routeParts = routeName.split('.');
			
			for (const file of routeFiles) {
				const document = await vscode.workspace.openTextDocument(file);
				const text = document.getText();
				
				// Look for various route definition patterns
				const patterns = [
					// Standard name definition
					new RegExp(`->name\\(['"]${routeName}['"]\\)`, 'm'),
					// Group prefix definition
					new RegExp(`['"]as['"]\\s*=>\\s*['"]${routeParts[0]}\\.${routeParts[1]}\\.['"]`, 'm'),
					// Route definition with the last part of the route name
					new RegExp(`Route::(?:get|post|put|patch|delete)\\(['"]/?${routeParts[routeParts.length - 1]}['"]`, 'm')
				];

				for (const pattern of patterns) {
					const match = pattern.exec(text);
					if (match) {
						// Find the line number
						const lines = text.split('\n');
						let lineNumber = 0;
						let currentPos = 0;

						for (let i = 0; i < lines.length; i++) {
							if (currentPos + lines[i].length >= match.index) {
								// Look backwards to find the start of the route definition or group
								let startLine = i;
								while (startLine > 0 && 
									   !lines[startLine].trim().startsWith('Route::') && 
									   !lines[startLine].includes('->name') &&
									   !lines[startLine].includes("'as' =>")) {
									startLine--;
								}

								const range = new vscode.Range(
									new vscode.Position(startLine, 0),
									new vscode.Position(i, lines[i].length)
								);

								const uri = vscode.Uri.file(file.fsPath);
								await vscode.window.showTextDocument(uri, {
									selection: range,
									preserveFocus: false,
									preview: false
								});

								return new vscode.Location(uri, range);
							}
							currentPos += lines[i].length + 1;
						}
					}
				}
			}

			vscode.window.showWarningMessage(`❌ Route '${routeName}' not found in route files`);
			return undefined;

		} catch (error: any) {
			vscode.window.showErrorMessage(`🐛 Error: ${error.message}`);
			return undefined;
		}
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	vscode.window.showInformationMessage('Laravel Goto Route has been deactivated');
}

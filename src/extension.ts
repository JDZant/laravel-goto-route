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

	// Add the command handler
	let gotoRouteCommand = vscode.commands.registerCommand('laravel-goto-route.gotoRoute', async ({ routeName }) => {
		try {
			const routeProvider = new LaravelBladeRouteProvider();
			const location = await routeProvider.findRouteDefinition(routeName);
			
			if (location) {
				await vscode.window.showTextDocument(location.uri, {
					selection: location.range,
					preserveFocus: false,
					preview: false
				});
			}
		} catch (error) {
			console.error('Error executing goto command:', error);
			vscode.window.showErrorMessage('Failed to open route definition');
		}
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

	// Add hover provider for both PHP and Blade files
	let hoverProvider = vscode.languages.registerHoverProvider(
		[
			{ scheme: 'file', language: 'php' },
			{ scheme: 'file', pattern: '**/*.blade.php' }
		],
		{
			provideHover(document, position, token) {
				const lineText = document.lineAt(position.line).text;
				const routeName = new LaravelBladeRouteProvider().getFullRouteName(lineText, position);
				
				if (routeName) {
					const commandUri = vscode.Uri.parse(
						`command:laravel-goto-route.gotoRoute?${encodeURIComponent(JSON.stringify({ routeName }))}`
					);
					const contents = new vscode.MarkdownString(
						`[Go to route definition](${commandUri})\n\nRoute: \`${routeName}\``
					);
					contents.isTrusted = true;
					return new vscode.Hover(contents);
				}
				return null;
			}
		}
	);

	context.subscriptions.push(testCommand, phpProvider, bladeProvider, hoverProvider, gotoRouteCommand);
	
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
		console.log('Starting route lookup...');
		
		// Get the line text
		const lineText = document.lineAt(position.line).text;
		console.log('Line text:', lineText);

		// Extract the full route name
		const routeName = this.getFullRouteName(lineText, position);
		if (!routeName) {
			console.log('No route name found');
			return undefined;
		}

		console.log('Found route name:', routeName);

		// Search in route files
		const routeLocation = await this.findRouteDefinition(routeName);
		if (!routeLocation) {
			vscode.window.showWarningMessage(`❌ Route '${routeName}' not found in route files`);
			return undefined;
		}

		return routeLocation;
	}

	public async findRouteDefinition(routeName: string): Promise<vscode.Location | undefined> {
		try {
			console.log('Searching for route:', routeName);
			
			// Split route name to get the file prefix and route name
			const [filePrefix, routeSuffix] = routeName.split('.');
			console.log('File prefix:', filePrefix, 'Route suffix:', routeSuffix);

			// First try to find an exact match file
			let routeFiles = await vscode.workspace.findFiles(
				`routes/web/${filePrefix}.php`,
				'**/vendor/**'
			);

			console.log('Found route files:', routeFiles.map(f => f.fsPath));

			for (const file of routeFiles) {
				const document = await vscode.workspace.openTextDocument(file);
				const text = document.getText();
				
				// First, try to find the route suffix in the file
				const routeIndex = text.indexOf(routeSuffix);
				if (routeIndex === -1) {
					console.log('Route suffix not found in file');
					continue;
				}

				// Find the line number for this index
				const lines = text.split('\n');
				let currentIndex = 0;
				let targetLine = 0;

				for (let i = 0; i < lines.length; i++) {
					if (currentIndex + lines[i].length >= routeIndex) {
						targetLine = i;
						break;
					}
					currentIndex += lines[i].length + 1; // +1 for the newline character
				}

				console.log(`Found route suffix at line ${targetLine}: ${lines[targetLine]}`);

				// Look backwards to find the start of the route definition or group
				let startLine = targetLine;
				while (startLine > 0) {
					const currentLine = lines[startLine].trim();
					if (currentLine.startsWith('Route::') || 
						currentLine.includes('Route::group') ||
						currentLine.includes("'as' =>") ||
						currentLine.includes('"as" =>')) {
						break;
					}
					startLine--;
				}

				// Look forward to find the end of the route definition
				let endLine = targetLine;
				while (endLine < lines.length - 1) {
					if (lines[endLine].includes(';') || 
						lines[endLine].includes('});')) {
						break;
					}
					endLine++;
				}

				const range = new vscode.Range(
					new vscode.Position(startLine, 0),
					new vscode.Position(endLine, lines[endLine].length)
				);

				const uri = vscode.Uri.file(file.fsPath);
				await vscode.window.showTextDocument(uri, {
					selection: range,
					preserveFocus: false,
					preview: false
				});

				return new vscode.Location(uri, range);
			}

			console.log('Route not found in any file');
			return undefined;

		} catch (error: any) {
			console.error('Error searching for route:', error);
			vscode.window.showErrorMessage(`Error finding route: ${error.message}`);
			return undefined;
		}
	}

	public getFullRouteName(line: string, position: vscode.Position): string | null {
		const patterns = [
			/route\(['"]([a-zA-Z0-9\-\._]+)['"](?:\s*,\s*.*?)?\)/g,
			/\{\{\s*route\(['"]([a-zA-Z0-9\-\._]+)['"](?:\s*,\s*.*?)?\)\s*\}\}/g
		];

		for (const pattern of patterns) {
			const matches = Array.from(line.matchAll(pattern));
			for (const match of matches) {
				const [fullMatch, routeName] = match;
				const startIndex = line.indexOf(routeName);
				const endIndex = startIndex + routeName.length;
				
				if (position.character >= startIndex && position.character <= endIndex) {
					console.log('Found route name:', routeName);
					return routeName;
				}
			}
		}

		return null;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	vscode.window.showInformationMessage('Laravel Goto Route has been deactivated');
}

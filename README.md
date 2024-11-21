# Laravel Goto Route

A Visual Studio Code extension that enables clicking through from Laravel routes to their corresponding controller files.

## Features

* Click-through navigation from route definitions to controller files
* Supports both modern and legacy Laravel route syntax:
  * Modern: `Route::get('/users', [UserController::class, 'index'])`
  * Legacy: `Route::get('users', 'UserController@index')`

## Requirements

* Visual Studio Code 1.60.0 or newer
* PHP files with Laravel route definitions

## Usage

1. Open a Laravel project in VSCode
2. Open any route file (e.g., `routes/web.php` or `routes/api.php`)
3. Click on any controller reference in a route definition
4. The extension will navigate you to the corresponding controller file

## Supported Route Patterns

The extension recognizes these route definition patterns:
* `Route::get('/path', [Controller::class, 'method'])`
* `Route::post('/path', 'Controller@method')`
* And other HTTP verbs (put, patch, delete, etc.)

## Extension Settings

This extension contributes no additional settings.

## Known Issues

* Currently navigates to the start of the controller file rather than the specific method

## Release Notes

### 1.0.0

Initial release of Laravel Goto Route
* Basic route-to-controller navigation
* Support for common Laravel route patterns

## Contributing

The source code for this extension is available on GitHub. Contributions are welcome!

## License

This extension is licensed under the MIT License.

# Laravel Goto Route

A Visual Studio Code extension that enables clicking through Laravel route names to their definitions in your route files.

## Features

- Click through route names in Blade files to jump to their definitions
- Supports:
  - Standard route definitions (`->name('route.name')`)
  - Route groups with prefixes
  - Nested route groups
  - Hyphenated route names
- Works in both PHP and Blade files

## Usage

Place your cursor on any route name in a `route()` helper and click through with `Ctrl+Click` (Windows/Linux) or `Cmd+Click` (Mac).

Examples:

```blade
<a href="{{ route('products.show') }}">
<a href="{{ route('auth.settings.profile') }}">
<a href="{{ route('blog.categories.create') }}">
```

## Requirements

- Visual Studio Code 1.60.0 or higher
- Laravel project with route files in the standard `routes/` directory

## Extension Settings

This extension contributes the following settings:

* `laravelGotoRoute.enabled`: Enable/disable the extension

## Known Issues

Please report issues on the [GitHub repository](https://github.com/JDZant/laravel-goto-route/issues).

## Release Notes

### 1.0.0

Initial release:
- Basic route navigation
- Support for grouped routes
- Support for hyphenated route names

## Publisher

JDZant

## License

This extension is licensed under the [MIT License](LICENSE) ([https://opensource.org/license/mit](https://opensource.org/license/mit)).


# Development

Notes for working on the extension. This file is not part of the published package.

### Building from Source

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new Extension Development Host window. The default **Run Extension (test workspace)** configuration opens `test-workspace/` with sample buttons

### Project Structure

```
src/
├── extension.ts          # Activation, commands
├── buttons.ts            # Button store: user settings and workspace storage
├── runner.ts             # Sends commands to the terminal, tracks run status
├── runStatus.ts          # Status types and formatting
├── variables.ts          # ${...} variables: parsing, substitution, inputs validation
├── inputs.ts             # Asks for ${input:…} values, runs a button
├── sections.ts           # Groups and scopes as sections of the view
├── statusBar.ts          # Buttons pinned to the status bar
├── gitAliases.ts         # Reads, parses and writes git aliases
├── aliasManager.ts       # "Git Aliases…" list with add / edit / delete
├── picker.ts             # "Run Command Button…" quick pick
├── view.ts               # Webview provider (Activity Bar and panel)
└── test/                 # Extension tests
media/
├── view.css              # Webview styles
└── view.js               # Webview script
```

### Tests and CI

`npm test` compiles the tests, builds the extension, runs the linter and then the tests inside VS Code. The [CI workflow](.github/workflows/ci.yml) does the same on every push to `master` and on pull requests, and uploads the packaged `.vsix` as an artifact.

### Releasing

See [RELEASE_GUIDE.md](RELEASE_GUIDE.md) (in Polish) for GitHub Releases and publishing to the Marketplace.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

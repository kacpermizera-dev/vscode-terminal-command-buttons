<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Terminal Command Buttons - VS Code Extension

This is a VS Code extension project. Please use the get_vscode_api with a query as input to fetch the latest VS Code API references.

## Extension Overview

This extension adds configurable command buttons to the VS Code terminal interface:

- **Webview Panel**: Creates a side panel with scrollable command buttons
- **Terminal Integration**: Executes commands directly in the active terminal
- **Configuration**: Users can add, edit, and remove custom command buttons
- **Persistence**: Button configurations are saved in workspace/user settings

## Key Features

1. **Side Panel with Buttons**: Webview panel displaying configurable command buttons
2. **Terminal Execution**: Commands execute in the currently active terminal
3. **Button Management**: Add, edit, delete, and reorder command buttons
4. **Settings Integration**: Uses VS Code configuration API for persistence
5. **Command Palette**: Quick access to extension commands

## Architecture

- **Extension Entry Point**: `src/extension.ts` - Main activation and registration
- **Webview Provider**: Manages the button panel interface
- **Command Execution**: Integrates with VS Code terminal API
- **Configuration**: Uses workspace/user settings for button storage
- **UI Components**: HTML/CSS/JS for the webview interface

## Development Guidelines

- Use VS Code Extension API best practices
- Implement proper webview security
- Handle terminal states and multiple terminals
- Provide clear user feedback for actions
- Follow VS Code UI/UX guidelines

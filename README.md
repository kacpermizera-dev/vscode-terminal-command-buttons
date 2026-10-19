# 🖥️ Terminal Command Buttons

A VS Code extension that adds configurable command buttons to your terminal interface. Execute your most-used commands with a single click!

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Language-blue)
![License](https://img.shields.io/badge/License-MIT-green)
[![Latest Release](https://img.shields.io/github/v/release/kacpermizera-dev/vscode-terminal-command-buttons)](https://github.com/kacpermizera-dev/vscode-terminal-command-buttons/releases)

## ✨ Features

- **🎯 Quick Commands**: Add custom command buttons for instant execution
- **🪟 Next to the Terminal**: Keep the buttons in a split view right beside your terminal
- **🧩 Icons or List**: Compact icon buttons with hover details, or a list with name and command
- **⚙️ Easy Configuration**: Add, edit, delete and reorder buttons directly from the UI
- **🎨 Color Coding**: Pick a color from the palette or a custom one
- **💾 Persistent Storage**: Your buttons are saved in workspace/user settings
- **🔗 Terminal Integration**: Commands execute in your active terminal

## 📦 Installation

### Option 1: Download Release (Recommended)

1. Go to [Releases](https://github.com/kacpermizera-dev/vscode-terminal-command-buttons/releases)
2. Download the latest `terminal-command-buttons-x.x.x.vsix` file
3. Open VS Code
4. Press `Ctrl+Shift+P` and type "Extensions: Install from VSIX..."
5. Select the downloaded `.vsix` file
6. Look for the terminal icon in Activity Bar!

### Option 2: Build from Source

```bash
git clone https://github.com/kacpermizera-dev/vscode-terminal-command-buttons.git
cd vscode-terminal-command-buttons
npm install
npm run package
npx @vscode/vsce package
code --install-extension terminal-command-buttons-0.1.0.vsix
```

## 🚀 Quick Start

### Getting Started

1. Open the **Command Buttons** tab in the bottom panel (next to Terminal, Problems, Output)
2. Click the split icon in its header to move it **next to the terminal**
3. The buttons are also available from the **terminal icon** in the Activity Bar (left sidebar)

### Adding Your First Button

1. Click the **+** tile after your buttons
2. Enter:
   - **Name**: Display name (e.g., "List Files")
   - **Command**: Command to execute (e.g., `ls -la`)
   - **Icon** (optional): A [codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html) name (e.g., `git-branch`); without it the button shows the name's initials
   - **Color**: Pick one from the palette, or the rainbow tile for a custom color
3. Click **"Add"**
4. Click your new button to execute the command!

## 🎯 Usage

### Custom Commands

Add any command you use frequently:

- `npm install` - Install dependencies
- `npm start` - Start development server
- `git pull` - Pull latest changes
- `docker ps` - List Docker containers
- `python --version` - Check Python version

### Managing Buttons

- **Execute**: Click any button to run its command (or focus it and press `Enter`)
- **Details**: Hover a button in the icon layout to see its name and command
- **Edit / Delete**: Right-click a button, or use the pencil and trash icons on hover in the list layout
- **Reorder**: Drag a button to a new position, or focus it and press `Alt+Arrow`
- **Layout**: Switch between icons and list with the layout icon in the view header
- **Add New**: Use the **+** tile or Command Palette
- **Organize**: Use different colors and icons to group related commands

## ⚙️ Configuration

The extension stores button configurations in VS Code settings:

```json
{
  "terminalCommandButtons.buttons": [
    {
      "id": "unique-id",
      "name": "My Command",
      "command": "echo 'Hello World'",
      "color": "#3794ff",
      "icon": "terminal"
    }
  ],
  "terminalCommandButtons.layout": "icons",
  "terminalCommandButtons.windowsLeadingSpace": true
}
```

| Setting | Default | Description |
| --- | --- | --- |
| `terminalCommandButtons.buttons` | `[]` | Your command buttons. In untrusted workspaces, buttons from workspace settings are ignored. |
| `terminalCommandButtons.layout` | `icons` | `icons` for compact icon buttons, `list` for one row per button. |
| `terminalCommandButtons.windowsLeadingSpace` | `true` | On Windows, prefix commands with a space. Works around Git Bash dropping the first character ([microsoft/vscode#275625](https://github.com/microsoft/vscode/issues/275625)). |

## 🔧 Commands

Access these commands via the Command Palette:

- **Terminal Command Buttons: Open Terminal Command Buttons** - Open the buttons panel
- **Terminal Command Buttons: Add New Command Button** - Add a button via input prompts
- **Terminal Command Buttons: Show Buttons Next to Terminal** - Move the panel view next to the terminal
- **Terminal Command Buttons: Toggle Icons / List Layout** - Switch the button layout

## 📋 Requirements

- VS Code 1.101.0 or higher
- Terminal access in your workspace

## 🏗️ Development

### Building from Source

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new Extension Development Host window

### Project Structure

```
src/
├── extension.ts          # Main extension logic
└── test/
    └── extension.test.ts # Extension tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md).

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- VS Code Extension API documentation
- VS Code community for inspiration and feedback

---

**Made with ❤️ for VS Code developers**

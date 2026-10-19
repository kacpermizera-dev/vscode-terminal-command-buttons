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
- **🚦 Run Status**: A dot on each button shows whether its last run is running, succeeded or failed
- **▶️ Terminal Toolbar**: **Run Command Button…** and **Rerun Last Command** right in the terminal's title bar
- **🌿 Git Aliases**: See your git aliases and what they expand to, add, edit or delete them without touching `.gitconfig`
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
code --install-extension terminal-command-buttons-0.2.0.vsix
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
- **Details**: Hover a button to see its full command, the git alias it calls and its last run
- **Edit / Delete**: Right-click a button, or use the pencil and trash icons on hover in the list layout
- **Reorder**: Drag a button to a new position, or focus it and press `Alt+Arrow`
- **Layout**: Switch between icons and list with the layout icon in the view header
- **Add New**: Use the **+** tile or Command Palette
- **Organize**: Use different colors and icons to group related commands

### Run Status

After you run a button, a small dot shows how its last run went: pulsing while it runs, green when it exited with code 0, red when it failed. Hover the button for the exit code, duration and when it ran.

The status comes from VS Code's [terminal shell integration](https://code.visualstudio.com/docs/terminal/shell-integration) (bash, zsh, fish, PowerShell, Git Bash). In shells without it, such as `cmd.exe`, the dot stays grey: the command was sent, but its result is unknown.

### Terminal Toolbar

Two icons appear in the terminal panel's title bar:

- **▶ Run Command Button…** opens a picker with all your buttons and their last status
- **↻ Rerun Last Command** runs the last command sent by the extension again

Both are also in the Command Palette; **Run Command Button…** is also in the terminal's right-click menu.

### Git Aliases

**Git Aliases…** (the branch icon in the buttons view header) lists your aliases from `git config`, grouped into repository (`.git/config`) and global (`~/.gitconfig`), with what each one expands to. Aliases starting with `!` run a shell command and are marked as such.

- **Add**: pick **Add alias…**, enter a name and a value, and choose global or this repository
- **Edit**: select an alias (or its pencil icon) to change its name or value
- **Delete**: use the trash icon
- **Open file**: open the config file the alias comes from; system aliases can only be viewed

If a button's command calls an alias (e.g. `git lg -5`), its tooltip shows the alias expansion. In untrusted workspaces only your global aliases are read and edited, not the ones from the repository's `.git/config`.

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
- **Terminal Command Buttons: Run Command Button…** - Pick a button to run
- **Terminal Command Buttons: Git Aliases…** - View, add, edit or delete git aliases
- **Terminal Command Buttons: Rerun Last Command** - Run the last command again

## 📋 Requirements

- VS Code 1.101.0 or higher
- Terminal access in your workspace

## 🏗️ Development

### Building from Source

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` to open a new Extension Development Host window. The default **Run Extension (test workspace)** configuration opens `test-workspace/` with sample buttons

### Project Structure

```
src/
├── extension.ts          # Activation, commands
├── buttons.ts            # Reading and saving buttons in settings
├── runner.ts             # Sends commands to the terminal, tracks run status
├── runStatus.ts          # Status types and formatting
├── gitAliases.ts         # Reads, parses and writes git aliases
├── aliasManager.ts       # "Git Aliases…" list with add / edit / delete
├── picker.ts             # "Run Command Button…" quick pick
├── view.ts               # Webview provider (Activity Bar and panel)
└── test/                 # Extension tests
media/
├── view.css              # Webview styles
└── view.js               # Webview script
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

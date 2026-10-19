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
- **🔤 Variables**: `${input:name}` asks for a value when you click; `${file}`, `${workspaceFolder}`, `${selectedText}` and more come from the editor
- **🗂️ Global or Per Workspace**: Keep a button everywhere, or only in the current workspace
- **⏹️ Own Terminal, Stop / Restart**: Give a long-running command (dev server, watcher) its own terminal and stop or restart it from the button
- **📁 Groups**: Sort buttons into groups such as Git or Build; collapse them in the list layout
- **📌 Status Bar**: Pin your most used buttons to the status bar
- **✋ Ask Before Running**: A confirmation for commands like `git push --force`
- **🎨 Color Coding**: Pick a color from the palette or a custom one
- **🔒 Nothing in Your Repository**: Buttons live in VS Code (user settings and workspace storage), never in the project's files

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
code --install-extension terminal-command-buttons-0.4.0.vsix
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
   - **Group** (optional): A section in the view, e.g. `Git`; existing groups are suggested
   - **Only in this workspace** (optional): Show the button only in the folder or workspace that is open now
   - **Ask before running** (optional): Confirm first, showing the command with its variables filled in
   - **Show in status bar** (optional): Also put the button in the status bar
   - **Advanced** (optional): A terminal of its own, see below
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
- **Reorder**: Drag a button to a new position within its group, or focus it and press `Alt+Arrow`
- **Layout**: Switch between icons and list with the layout icon in the view header
- **Add New**: Use the **+** tile or Command Palette
- **Organize**: Use different colors and icons to group related commands

### Groups

Give buttons a **Group** in the form (e.g. Git, Build, Docker) to show them in sub-sections. Groups live inside **This workspace** / **All workspaces**: buttons without a group stay at the top of their part, groups follow in the order of their first button, so adding a group never moves the other buttons. Click a header to collapse it: **This workspace** / **All workspaces** in both layouts, groups in the list layout. **Collapse / Expand All** in the view header collapses everything, or expands it again when all is collapsed. The **Run Command Button…** picker uses the same order.

### Status Bar

**Show in status bar** also puts the button in the status bar at the bottom of the window, on the left (next to the git branch), with its icon and name. Click it to run the button. With shell integration the icon spins while the command runs and a failed last run turns the item red; in `cmd.exe` the item stays plain, because the result is unknown.

### Global and Workspace Buttons

Each button is either shown in **all workspaces** (the default) or **only in this workspace** (the checkbox in the form). When you have both kinds, the view shows workspace buttons first, then global ones, each with its own groups.

Nothing is written to your project:

- Global buttons are stored in your **user settings** (`terminalCommandButtons.buttons`) and follow you through Settings Sync.
- Workspace buttons are stored in **VS Code's own storage** for that workspace, outside the project folder, so they never show up in `git status`.

Buttons that older versions saved in a project's `.vscode/settings.json` still show up in the workspace group. A bar at the top of the view offers to **Move into VS Code** (or **Keep** them where they are); the same is available as **Move Buttons from .vscode/settings.json into VS Code** in the Command Palette.

### Variables and Inputs

Commands can contain variables that are filled in when you click the button. You don't have to type them: use **Insert…** next to the Command field to add one at the cursor.

| Variable | Value |
| --- | --- |
| `${input:name}` | Asks you for a value. The last value is suggested next time. |
| `${file}`, `${relativeFile}`, `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileExtname}`, `${fileDirname}` | The file open in the editor |
| `${workspaceFolder}`, `${workspaceFolderBasename}` | The workspace folder of that file, or the first folder |
| `${selectedText}`, `${lineNumber}` | The selection and cursor line in the editor |
| `${env:NAME}` | An environment variable |

Other `${...}` text, such as `${HOME}` in bash, is left alone for the shell. Values are inserted as they are, so add quotes where the shell needs them, e.g. `git commit -m "${input:message}"` or `npx jest "${relativeFile}"`. Pressing `Esc` at a question cancels the run. **Rerun Last Command** repeats the command with the same values.

**Insert… → Ask when clicked** adds `${input:value}` with the name selected, so you can type a better one (e.g. `branch`). For every question in the command, the form shows a row under **Questions**:

- **Text**: a text box when you click the button
- **List**: pick one of the options you enter, separated by commas (e.g. `main, develop`)
- **List from command**: pick one line of a command's output, e.g. `git branch --format=%(refname:short)` for your branches. The command runs in the workspace folder with your system shell (`cmd.exe` on Windows) and has 5 seconds to finish
- **Default** (optional): the first suggestion; after that your last answer is suggested

In user `settings.json` the same is stored as `inputs`, like in `tasks.json`; there you can also add a `description` or `"password": true`.

### Own Terminal, Stop and Restart

Put a name under **Advanced → Terminal** (e.g. `dev`) to run the button in its own terminal instead of the active one. The terminal is created when needed and reused afterwards, so a dev server or a watcher does not block the terminal you work in.

While a command runs, its row in the list layout shows **Stop** (sends `Ctrl+C`) and **Restart** (stops, waits for the command to end, runs it again). In the icon layout, right-click the button. Stop and restart need shell integration, like the run status.

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

Global buttons can also be edited in your user `settings.json`:

```json
{
  "terminalCommandButtons.buttons": [
    {
      "id": "unique-id",
      "name": "Checkout",
      "command": "git checkout ${input:branch}",
      "color": "#3794ff",
      "icon": "git-branch",
      "inputs": [{ "id": "branch", "type": "pickString", "options": ["main", "develop"] }]
    },
    {
      "id": "dev-server",
      "name": "Dev server",
      "command": "npm run dev",
      "color": "#89d185",
      "icon": "rocket",
      "terminal": "dev"
    }
  ],
  "terminalCommandButtons.layout": "icons",
  "terminalCommandButtons.windowsLeadingSpace": true
}
```

| Setting | Default | Description |
| --- | --- | --- |
| `terminalCommandButtons.buttons` | `[]` | Buttons shown in every workspace. Workspace-only buttons are stored inside VS Code instead. |
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

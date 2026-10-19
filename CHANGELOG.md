# Change Log

All notable changes to the "terminal-command-buttons" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2026-10-19

First release on the VS Code Marketplace.

### Added

- Extension icon and Marketplace listing (description, keywords, banner).
- CI on GitHub Actions: build, lint, tests and the packaged `.vsix` on every push and pull request.

### Changed

- README written for the Marketplace page; development notes moved to `DEVELOPMENT.md`, release steps to `RELEASE_GUIDE.md`.

## [0.4.0] - 2026-10-19

### Added

- **Groups**: a Group field in the form (existing names are suggested) shows buttons in sub-sections such as Git or Build, inside This workspace / All workspaces. Adding a group does not move the other buttons. The Run picker uses the same order.
- Collapsible sections: This workspace / All workspaces in both layouts, groups in the list layout, and **Collapse / Expand All** in the view header.
- **Ask before running**: a confirmation with the command as it will run, variables filled in. **Rerun Last Command** asks too.
- **Show in status bar**: pinned buttons in the status bar, with a spinning icon while running and red after a failed run.
- **List from command** for questions: the options are the lines of a command's output, e.g. `git branch --format=%(refname:short)`.
- On first start, the extension offers to show the buttons next to the terminal.

## [0.3.0] - 2026-10-19

### Added

- Variables in commands: `${input:name}` asks for a value when the button is clicked (the last value is suggested next time); `${file}`, `${relativeFile}`, `${workspaceFolder}`, `${selectedText}`, `${lineNumber}`, `${env:NAME}` and more come from the editor. Other `${...}`, such as `${HOME}`, is left for the shell.
- **Insert…** next to the Command field adds a variable at the cursor, so there is no syntax to remember.
- **Questions** in the form: for each `${input:…}` choose a text box or a list of options (comma separated) and an optional default. Stored as `inputs`, like in `tasks.json`, where `description` and `password` are also supported.
- Buttons can be global or **only in this workspace** (checkbox in the form; disabled with a hint when no folder is open). The view groups them when both kinds exist.
- Optional `terminal` per button: the command runs in its own named terminal, created when needed and reused.
- **Stop** and **Restart** for a running command: in the list row, and in the right-click menu.

### Changed

- Nothing is written to the project anymore. Global buttons are always saved in user settings; workspace buttons are stored in VS Code's workspace storage. Before, the first button in a folder could be saved to `.vscode/settings.json`.
- Buttons from an older `.vscode/settings.json` are shown in the workspace group. A bar in the view (and a Command Palette command) moves them into VS Code.
- Run status is tracked per button, so buttons with variables keep their status.
- **Rerun Last Command** repeats the last run with the same variable values.

## [0.2.0] - 2026-10-19

### Added

- Run status on each button: a dot shows whether the last run is running, succeeded or failed; the tooltip shows the exit code, duration and when it ran. Uses terminal shell integration; in shells without it the result is shown as unknown.
- **Run Command Button…** and **Rerun Last Command** in the terminal panel's title bar, the Command Palette and (Run…) the terminal's right-click menu.
- **Git Aliases…** (icon in the buttons view header): lists global and repository aliases with their expansion, and adds, edits, renames or deletes them; shell aliases (`!…`) are marked.
- Tooltips of buttons that call a git alias show the alias expansion.

### Changed

- Every button has a tooltip in both layouts, with the full command, the git alias it calls and its last run.
- In the list layout, the edit and delete icons no longer stay visible after clicking a button.
- The extension code is split into modules, and the webview's CSS and JavaScript moved to `media/`.

### Security

- In untrusted workspaces only global git aliases are read and edited, not the repository's `.git/config`.

## [0.1.0] - 2026-10-19

### Added

- Command Buttons view in the bottom panel that can sit next to the terminal (split view). Use the split icon in the view header or **Show Buttons Next to Terminal**.
- Compact icon layout: buttons show a codicon (or the name's initials) and reveal the name and command on hover.
- List layout with name and command per row; switch with the layout icon in the view header (`terminalCommandButtons.layout`).
- Optional `icon` per button (any [codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html) name).
- Edit buttons: right-click a button (Run / Edit / Delete), or use the pencil and trash icons on hover in the list layout.
- Reorder buttons by drag and drop, or with Alt+Arrow keys.
- Color palette with a custom color picker that follows the VS Code theme.
- Setting `terminalCommandButtons.windowsLeadingSpace` (on by default): on Windows, commands are sent with a leading space to work around Git Bash dropping the first character ([microsoft/vscode#275625](https://github.com/microsoft/vscode/issues/275625)).

### Changed

- Running a button keeps focus in the buttons view; a new terminal waits until the shell is ready before the command is sent.
- Deleting a button asks for confirmation.
- Buttons are saved where they are defined (workspace or user settings), instead of always to the workspace.

### Security

- Button names and commands are rendered as text, not HTML.
- The webview uses a Content Security Policy with a nonce.
- Buttons defined in workspace settings are ignored in untrusted workspaces (Workspace Trust).

## [0.0.1]

- Initial release

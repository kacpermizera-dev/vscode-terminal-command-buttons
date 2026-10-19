# Change Log

All notable changes to the "terminal-command-buttons" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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

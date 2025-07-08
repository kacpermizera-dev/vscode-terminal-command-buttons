import * as vscode from "vscode";

// Interfejs dla przycisku komendy
interface CommandButton {
  id: string;
  name: string;
  command: string;
  color: string;
}

// Provider dla webview panelu
export class TerminalButtonsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "terminalCommandButtons.buttonsView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Obsługa wiadomości z webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        console.log("Received message from webview:", message);

        switch (message.type) {
          case "executeCommand":
            this.executeCommand(message.command);
            break;
          case "addButton":
            console.log("Processing addButton message");
            this.addButton(message.button);
            break;
          case "deleteButton":
            this.deleteButton(message.buttonId);
            break;
          case "getButtons":
            this.sendButtonsToWebview();
            break;
        }
      },
      undefined,
      this._context.subscriptions
    );

    // Wyślij początkowe przyciski
    this.sendButtonsToWebview();
  }

  // Wykonanie komendy w aktywnym terminalu
  private executeCommand(command: string) {
    const activeTerminal = vscode.window.activeTerminal;

    if (!activeTerminal) {
      // Stwórz nowy terminal jeśli żaden nie jest aktywny
      const newTerminal = vscode.window.createTerminal("Command Terminal");
      newTerminal.show();
      newTerminal.sendText(command, true);
    } else {
      // Użyj istniejącego terminala
      activeTerminal.show();
      activeTerminal.sendText(command, true);
    }
  }

  // Dodanie nowego przycisku
  public async addButton(button: CommandButton) {
    console.log("Adding button:", button);

    try {
      const config = vscode.workspace.getConfiguration(
        "terminalCommandButtons"
      );
      const buttons = config.get<CommandButton[]>("buttons", []);

      button.id = Date.now().toString();
      buttons.push(button);

      console.log("All buttons after adding:", buttons);

      // Sprawdź czy mamy workspace
      const hasWorkspace =
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0;
      console.log("Has workspace:", hasWorkspace);

      // Spróbuj najpierw zapisać do workspace (tylko jeśli jest dostępny), jeśli nie działa - użyj global
      let configTarget = vscode.ConfigurationTarget.Global;
      let configLocation = "global";

      if (hasWorkspace) {
        try {
          await config.update(
            "buttons",
            buttons,
            vscode.ConfigurationTarget.Workspace
          );
          configLocation = "workspace";
          console.log("Button saved to workspace config");
        } catch (workspaceError) {
          console.log(
            "Workspace config failed, trying global:",
            workspaceError
          );
          await config.update(
            "buttons",
            buttons,
            vscode.ConfigurationTarget.Global
          );
          console.log("Button saved to global config");
        }
      } else {
        await config.update(
          "buttons",
          buttons,
          vscode.ConfigurationTarget.Global
        );
        console.log("No workspace available, saved to global config");
      }

      this.sendButtonsToWebview();

      // Pokaż powiadomienie o sukcesie
      vscode.window.showInformationMessage(
        `Command button "${button.name}" added successfully to ${configLocation} settings!`
      );
    } catch (error) {
      console.error("Error adding button:", error);
      vscode.window.showErrorMessage(`Failed to add button: ${error}`);
    }
  }

  // Usunięcie przycisku
  private async deleteButton(buttonId: string) {
    try {
      const config = vscode.workspace.getConfiguration(
        "terminalCommandButtons"
      );
      const buttons = config.get<CommandButton[]>("buttons", []);

      const updatedButtons = buttons.filter((button) => button.id !== buttonId);

      // Spróbuj najpierw zapisać do workspace, jeśli nie działa - użyj global
      try {
        await config.update(
          "buttons",
          updatedButtons,
          vscode.ConfigurationTarget.Workspace
        );
        console.log("Button deleted from workspace config");
      } catch (workspaceError) {
        console.log("Workspace config failed, trying global:", workspaceError);
        await config.update(
          "buttons",
          updatedButtons,
          vscode.ConfigurationTarget.Global
        );
        console.log("Button deleted from global config");
      }

      this.sendButtonsToWebview();
      vscode.window.showInformationMessage(
        "Command button deleted successfully!"
      );
    } catch (error) {
      console.error("Error deleting button:", error);
      vscode.window.showErrorMessage(`Failed to delete button: ${error}`);
    }
  }

  // Wysłanie przycisków do webview
  private sendButtonsToWebview() {
    if (this._view) {
      const config = vscode.workspace.getConfiguration(
        "terminalCommandButtons"
      );
      const buttons = config.get<CommandButton[]>(
        "buttons",
        this.getDefaultButtons()
      );

      console.log("Configuration found:", config);
      console.log("Buttons from config:", buttons);
      console.log("Sending buttons to webview:", buttons);

      this._view.webview.postMessage({
        type: "buttonsUpdate",
        buttons: buttons,
      });
    } else {
      console.log("Webview not available, cannot send buttons");
    }
  }

  // Domyślne przyciski
  private getDefaultButtons(): CommandButton[] {
    return [
      { id: "1", name: "Lista plików", command: "ls -la", color: "#007acc" },
      {
        id: "2",
        name: "Node.js wersja",
        command: "node --version",
        color: "#68217a",
      },
      {
        id: "3",
        name: "NPM wersja",
        command: "npm --version",
        color: "#cb3837",
      },
      { id: "4", name: "Git status", command: "git status", color: "#f05032" },
      { id: "5", name: "Katalog roboczy", command: "pwd", color: "#28a745" },
    ];
  }

  // Generowanie HTML dla webview
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terminal Command Buttons</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 10px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-weight: bold;
            font-size: 14px;
        }
        
        .add-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .add-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .buttons-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .command-button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        }
        
        .command-button:hover {
            background-color: var(--vscode-list-hoverBackground);
            transform: translateY(-1px);
        }
        
        .button-info {
            display: flex;
            flex-direction: column;
            flex: 1;
        }
        
        .button-name {
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .button-command {
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-descriptionForeground);
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .delete-btn {
            background: var(--vscode-errorBackground);
            color: var(--vscode-errorForeground);
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 8px;
        }
        
        .delete-btn:hover {
            opacity: 0.8;
        }
        
        .add-form {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 5px;
            padding: 15px;
            margin-top: 10px;
            display: none;
        }
        
        .add-form.show {
            display: block;
        }
        
        .form-group {
            margin-bottom: 12px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 5px;
            font-size: 13px;
            font-weight: bold;
        }
        
        .form-input {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
            box-sizing: border-box;
        }
        
        .form-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .form-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        
        .form-button {
            padding: 8px 16px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .save-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .save-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .cancel-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .cancel-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .color-preview {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            margin-left: 8px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbarSlider-background);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-activeBackground);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🖥️ Terminal Commands</div>
        <button class="add-button" onclick="toggleAddForm()">+ Add</button>
    </div>
    
    <div class="buttons-container" id="buttonsContainer">
        <!-- Buttons will be added here dynamically -->
    </div>
    
    <div class="add-form" id="addForm">
        <div class="form-group">
            <label class="form-label">Button Name:</label>
            <input type="text" class="form-input" id="buttonName" placeholder="e.g., List Files">
        </div>
        <div class="form-group">
            <label class="form-label">Command:</label>
            <input type="text" class="form-input" id="buttonCommand" placeholder="e.g., ls -la">
        </div>
        <div class="form-group">
            <label class="form-label">Color:</label>
            <input type="color" class="form-input" id="buttonColor" value="#007acc">
        </div>
        <div class="form-actions">
            <button class="form-button cancel-btn" onclick="hideAddForm()">Cancel</button>
            <button class="form-button save-btn" onclick="saveButton()">Save</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let buttons = [];

        // Request initial buttons
        vscode.postMessage({ type: 'getButtons' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('Webview received message:', message);
            
            switch (message.type) {
                case 'buttonsUpdate':
                    console.log('Updating buttons with:', message.buttons);
                    buttons = message.buttons;
                    renderButtons();
                    break;
            }
        });

        function renderButtons() {
            console.log('Rendering buttons:', buttons);
            const container = document.getElementById('buttonsContainer');
            container.innerHTML = '';

            buttons.forEach(button => {
                console.log('Rendering button:', button);
                const buttonElement = document.createElement('div');
                buttonElement.className = 'command-button';
                buttonElement.style.borderLeftColor = button.color;
                buttonElement.style.borderLeftWidth = '4px';
                
                buttonElement.innerHTML = \`
                    <div class="button-info">
                        <div class="button-name">\${button.name}</div>
                        <div class="button-command">\${button.command}</div>
                    </div>
                    <div class="color-preview" style="background-color: \${button.color}"></div>
                    <button class="delete-btn" onclick="deleteButton('\${button.id}')" title="Delete button">×</button>
                \`;
                
                buttonElement.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('delete-btn')) {
                        executeCommand(button.command);
                    }
                });
                
                container.appendChild(buttonElement);
            });
        }

        function executeCommand(command) {
            vscode.postMessage({
                type: 'executeCommand',
                command: command
            });
        }

        function toggleAddForm() {
            const form = document.getElementById('addForm');
            form.classList.toggle('show');
            if (form.classList.contains('show')) {
                document.getElementById('buttonName').focus();
            }
        }

        function hideAddForm() {
            document.getElementById('addForm').classList.remove('show');
            clearForm();
        }

        function clearForm() {
            document.getElementById('buttonName').value = '';
            document.getElementById('buttonCommand').value = '';
            document.getElementById('buttonColor').value = '#007acc';
        }

        function saveButton() {
            const name = document.getElementById('buttonName').value.trim();
            const command = document.getElementById('buttonCommand').value.trim();
            const color = document.getElementById('buttonColor').value;

            console.log('Saving button:', { name, command, color });

            if (!name || !command) {
                console.log('Validation failed: missing name or command');
                alert('Please fill in both name and command fields.');
                return;
            }

            const buttonData = {
                name: name,
                command: command,
                color: color
            };

            console.log('Sending addButton message to extension with data:', buttonData);
            
            vscode.postMessage({
                type: 'addButton',
                button: buttonData
            });

            console.log('Message sent, hiding form');
            hideAddForm();
        }

        function deleteButton(buttonId) {
            vscode.postMessage({
                type: 'deleteButton',
                buttonId: buttonId
            });
        }

        // Allow Enter key to save button
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.getElementById('addForm').classList.contains('show')) {
                saveButton();
            } else if (e.key === 'Escape') {
                hideAddForm();
            }
        });
    </script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Terminal Command Buttons extension is now active!");

  // Rejestracja providera webview
  const provider = new TerminalButtonsProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TerminalButtonsProvider.viewType,
      provider
    )
  );

  // Komenda do otwierania panelu przycisków
  const openButtonsPanel = vscode.commands.registerCommand(
    "terminalCommandButtons.openButtonsPanel",
    () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.terminalCommandButtons"
      );
    }
  );

  // Komenda do dodania nowego przycisku
  const addButton = vscode.commands.registerCommand(
    "terminalCommandButtons.addButton",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter button name",
        placeHolder: "e.g., List Files",
      });

      if (!name) return;

      const command = await vscode.window.showInputBox({
        prompt: "Enter command",
        placeHolder: "e.g., ls -la",
      });

      if (!command) return;

      // Dodaj przycisk przez provider
      provider.addButton({
        id: Date.now().toString(),
        name,
        command,
        color: "#007acc",
      });
    }
  );

  context.subscriptions.push(openButtonsPanel, addButton);
}

export function deactivate() {}

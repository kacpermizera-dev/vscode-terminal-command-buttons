import * as vscode from "vscode";
import {
  deleteButton,
  getButtons,
  getLayout,
  reorderButtons,
  saveButton,
} from "./buttons";
import { GitAliases, findAliasForCommand } from "./gitAliases";
import { Runner } from "./runner";

// Losowy nonce dla Content Security Policy webview
function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

// Provider dla webview panelu
export class TerminalButtonsProvider implements vscode.WebviewViewProvider {
  // Widok na Activity Bar
  public static readonly viewType = "terminalCommandButtons.buttonsView";
  // Widok w panelu dolnym, do przeniesienia obok terminala
  public static readonly panelViewType = "terminalCommandButtons.panelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _viewType: string,
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _runner: Runner,
    private readonly _gitAliases: GitAliases
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Aliasy mogły się zmienić, gdy widok był schowany
    webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          this._gitAliases.refresh();
        }
      },
      undefined,
      this._context.subscriptions
    );

    // Obsługa wiadomości z webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "executeCommand":
            this._runner.run(message.command);
            break;
          case "saveButton":
            saveButton(message.button);
            break;
          case "deleteButton":
            deleteButton(message.buttonId);
            break;
          case "reorderButtons":
            if (Array.isArray(message.ids)) {
              reorderButtons(message.ids);
            }
            break;
          case "getButtons":
            this.sendButtonsToWebview();
            this._gitAliases.refresh();
            break;
        }
      },
      undefined,
      this._context.subscriptions
    );
  }

  // Wysłanie przycisków do webview
  public sendButtonsToWebview() {
    if (this._view) {
      const buttons = getButtons();
      // Rozwinięcie aliasu do dymka przycisku, np. "git lg" -> "log --oneline --graph"
      const aliasHints: Record<string, string> = {};
      buttons.forEach((button) => {
        const alias = findAliasForCommand(button.command, this._gitAliases.all);
        if (alias) {
          aliasHints[button.id] = `git ${alias.name} = ${alias.expansion}`;
        }
      });

      this._view.webview.postMessage({
        type: "buttonsUpdate",
        buttons,
        layout: getLayout(),
        aliasHints,
        statuses: this._runner.getStatuses(),
        now: Date.now(),
      });
    }
  }

  // Sam status, bez przebudowy przycisków (nie gubi fokusu ani przeciągania)
  public sendStatusesToWebview() {
    this._view?.webview.postMessage({
      type: "statusUpdate",
      statuses: this._runner.getStatuses(),
      now: Date.now(),
    });
  }

  // Otwarcie formularza edycji w tym widoku
  public showEditForm(buttonId: string) {
    this._view?.webview.postMessage({ type: "editButton", buttonId });
  }

  // Generowanie HTML dla webview
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "node_modules",
        "@vscode",
        "codicons",
        "dist",
        "codicon.css"
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "view.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "view.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${codiconsUri}">
    <link rel="stylesheet" href="${styleUri}">
    <title>Terminal Command Buttons</title>
</head>
<body data-view="${this._viewType}">
    <div class="buttons" id="buttons"></div>

    <form class="form" id="form" novalidate>
        <div class="fields">
            <div class="field">
                <label for="name">Name</label>
                <input id="name" placeholder="Git status" autocomplete="off">
            </div>
            <div class="field field-command">
                <label for="command">Command</label>
                <input id="command" placeholder="git status" autocomplete="off">
            </div>
            <div class="field">
                <label for="icon">Icon</label>
                <div class="input-with-preview">
                    <span class="preview-box"><span id="iconPreview"></span></span>
                    <input id="icon" list="iconList" placeholder="git-branch" autocomplete="off">
                </div>
            </div>
            <div class="field field-color">
                <label for="color">Color</label>
                <div class="color-row">
                    <div class="swatches" id="swatches" role="group" aria-label="Preset colors"></div>
                    <div class="input-with-preview hex-field">
                        <span class="preview-box"><span class="color-preview" id="colorPreview"></span></span>
                        <input id="color" maxlength="7" placeholder="#3794ff" autocomplete="off" spellcheck="false">
                    </div>
                </div>
                <div class="picker" id="picker" hidden>
                    <div class="sv" id="sv"><div class="sv-thumb" id="svThumb"></div></div>
                    <div class="hue" id="hue"><div class="hue-thumb" id="hueThumb"></div></div>
                </div>
            </div>
        </div>
        <datalist id="iconList"></datalist>
        <div class="error" id="error"></div>
        <div class="actions">
            <button type="button" class="secondary" id="cancel">Cancel</button>
            <button type="submit" class="primary" id="save">Save</button>
        </div>
    </form>

    <div class="tooltip" id="tooltip" role="tooltip"></div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

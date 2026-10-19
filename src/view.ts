import * as vscode from "vscode";
import { ButtonStore, getLayout, groupNames } from "./buttons";
import { arrangeButtons } from "./sections";
import { GitAliases, findAliasForCommand } from "./gitAliases";
import { runButton } from "./inputs";
import { Runner } from "./runner";

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export class TerminalButtonsProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "terminalCommandButtons.buttonsView";
  public static readonly panelViewType = "terminalCommandButtons.panelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _viewType: string,
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _store: ButtonStore,
    private readonly _runner: Runner,
    private readonly _gitAliases: GitAliases
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    const disposables: vscode.Disposable[] = [];
    webviewView.onDidDispose(() => {
      if (this._view === webviewView) {
        this._view = undefined;
      }
      disposables.forEach((d) => d.dispose());
    });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          this._gitAliases.refresh();
        }
      },
      undefined,
      disposables
    );

    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "runButton": {
            const button = this._store.find(message.buttonId);
            if (button) {
              runButton(this._runner, button, this._context.globalState);
            }
            break;
          }
          case "stopButton":
            this._runner.stop(message.buttonId);
            break;
          case "restartButton":
            this._runner.restart(message.buttonId);
            break;
          case "saveButton":
            this._store.save(message.button);
            break;
          case "deleteButton":
            this._store.delete(message.buttonId);
            break;
          case "migrateLegacy":
            this._store.migrateLegacy();
            break;
          case "dismissLegacy":
            this._store.dismissLegacy();
            break;
          case "reorderButtons":
            if (Array.isArray(message.ids)) {
              this._store.reorder(
                message.ids.filter((id: unknown): id is string => typeof id === "string")
              );
            }
            break;
          case "getButtons":
            this.sendButtonsToWebview();
            this._gitAliases.refresh();
            break;
        }
      },
      undefined,
      disposables
    );
  }

  public sendButtonsToWebview() {
    if (this._view) {
      const buttons = this._store.getAll();
      const aliasHints: Record<string, string> = {};
      buttons.forEach((button) => {
        const alias = findAliasForCommand(button.command, this._gitAliases.all);
        if (alias) {
          aliasHints[button.id] = `git ${alias.name} = ${alias.expansion}`;
        }
      });

      const arranged = arrangeButtons(buttons).map(({ button, section, group }) => ({
        ...button,
        section,
        group,
      }));

      this._view.webview.postMessage({
        type: "buttonsUpdate",
        buttons: arranged,
        groups: groupNames(buttons),
        layout: getLayout(),
        hasWorkspace: this._store.hasWorkspace,
        legacyCount: this._store.showLegacyNotice ? this._store.legacyCount : 0,
        aliasHints,
        statuses: this._runner.getStatuses(),
        now: Date.now(),
      });
    }
  }

  public sendStatusesToWebview() {
    this._view?.webview.postMessage({
      type: "statusUpdate",
      statuses: this._runner.getStatuses(),
      now: Date.now(),
    });
  }

  public showEditForm(buttonId: string) {
    this._view?.webview.postMessage({ type: "editButton", buttonId });
  }

  public toggleCollapseAll() {
    this._view?.webview.postMessage({ type: "toggleCollapseAll" });
  }

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
    <div class="notice" id="legacyNotice" role="status" hidden>
        <span class="codicon codicon-info notice-icon" aria-hidden="true"></span>
        <span class="notice-text" id="legacyText"></span>
        <span class="notice-actions">
            <button type="button" class="primary" id="legacyMove">Move into VS Code</button>
            <button type="button" class="secondary" id="legacyKeep">Keep</button>
        </span>
    </div>

    <div class="buttons" id="buttons"></div>

    <form class="form" id="form" novalidate>
        <div class="fields">
            <div class="field">
                <label for="name">Name</label>
                <input id="name" placeholder="Git status" autocomplete="off">
            </div>
            <div class="field field-command">
                <label for="command">Command</label>
                <div class="input-with-action">
                    <input id="command" placeholder="git status" autocomplete="off" spellcheck="false">
                    <select id="insertVariable" aria-label="Insert a variable into the command" title="Insert a variable at the cursor">
                        <option value="">Insert…</option>
                        <option value="input">Ask when clicked</option>
                        <option value="file">Current file (full path)</option>
                        <option value="relativeFile">Current file (relative)</option>
                        <option value="fileBasename">Current file name</option>
                        <option value="fileDirname">Current file folder</option>
                        <option value="workspaceFolder">Workspace folder</option>
                        <option value="selectedText">Selected text</option>
                        <option value="lineNumber">Line number</option>
                    </select>
                </div>
            </div>
            <div class="field field-full" id="questionsField" hidden>
                <label>Questions</label>
                <div class="questions" id="questions"></div>
                <div class="field-hint">Asked each time you click the button. Your last answer is suggested next time.</div>
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
            <div class="field">
                <label for="group">Group</label>
                <input id="group" list="groupList" placeholder="e.g. Git, Build" autocomplete="off">
            </div>
            <div class="field field-full" id="scopeField">
                <label class="checkbox">
                    <input type="checkbox" id="workspaceOnly">
                    Only in this workspace
                </label>
                <div class="field-hint" id="scopeHint"></div>
            </div>
            <div class="field field-full checkbox-row">
                <label class="checkbox">
                    <input type="checkbox" id="confirm">
                    Ask before running
                </label>
                <label class="checkbox">
                    <input type="checkbox" id="pinned">
                    Show in status bar
                </label>
            </div>
        </div>
        <details class="advanced" id="advanced">
            <summary>Advanced</summary>
            <div class="fields">
                <div class="field">
                    <label for="terminal">Terminal</label>
                    <input id="terminal" placeholder="Active terminal" autocomplete="off" spellcheck="false">
                    <div class="field-hint">A name gives the button its own terminal, e.g. dev.</div>
                </div>
            </div>
        </details>
        <datalist id="iconList"></datalist>
        <datalist id="groupList"></datalist>
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

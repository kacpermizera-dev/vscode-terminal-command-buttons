import * as vscode from "vscode";

// Interfejs dla przycisku komendy
interface CommandButton {
  id: string;
  name: string;
  command: string;
  color: string;
  icon?: string;
}

// Kontekst prawego kliknięcia na przycisku (data-vscode-context w webview)
interface ButtonContext {
  buttonId: string;
  viewType: string;
}

type Layout = "icons" | "list";

const CONFIG_SECTION = "terminalCommandButtons";

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

// Czeka na Shell Integration nowego terminala, po timeoucie zwraca undefined
function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeoutMs: number
): Promise<vscode.TerminalShellIntegration | undefined> {
  if (terminal.shellIntegration) {
    return Promise.resolve(terminal.shellIntegration);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      listener.dispose();
      resolve(undefined);
    }, timeoutMs);

    const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
      if (e.terminal === terminal) {
        clearTimeout(timeout);
        listener.dispose();
        resolve(e.shellIntegration);
      }
    });
  });
}

// Wykonanie komendy w aktywnym terminalu
async function runInTerminal(command: string) {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  // Obejście błędu VS Code + Git Bash na Windows (microsoft/vscode#275625):
  // przed tekstem trafia do shella zbłąkany ESC i readline łączy go z pierwszym
  // znakiem w skrót Meta (ESC g -> "it status"). ESC + spacja jest nieszkodliwe.
  const text =
    process.platform === "win32" &&
    config.get<boolean>("windowsLeadingSpace", true)
      ? ` ${command}`
      : command;

  let terminal = vscode.window.activeTerminal;

  if (!terminal) {
    // Stwórz nowy terminal jeśli żaden nie jest aktywny i poczekaj, aż shell będzie gotowy
    terminal = vscode.window.createTerminal("Command Terminal");
    await waitForShellIntegration(terminal, 3000);
  }

  // preserveFocus: fokus zostaje w widoku przycisków
  terminal.show(true);

  // Zwykły sendText zamiast shellIntegration.executeCommand: executeCommand
  // opakowuje tekst w bracketed paste (ESC[200~), a zbłąkany ESC przed nim daje
  // w bashu ESC ESC = dopełnianie i komenda zostaje niewykonana
  terminal.sendText(text, true);
}

function getButtons(): CommandButton[] {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<CommandButton[]>("buttons", []);
}

// Zapis listy tam, skąd faktycznie pochodzi. Wcześniej usunięcie przycisku zawsze
// pisało do workspace, przez co globalna lista kopiowała się do ustawień projektu.
async function saveButtons(buttons: CommandButton[]) {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const inspected = config.inspect<CommandButton[]>("buttons");
  const hasWorkspace =
    !!vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0;

  const useWorkspace =
    inspected?.workspaceValue !== undefined ||
    (inspected?.globalValue === undefined && hasWorkspace);

  await config.update(
    "buttons",
    buttons,
    useWorkspace
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global
  );
}

// Dodanie nowego lub aktualizacja istniejącego przycisku
async function saveButton(button: Partial<CommandButton>) {
  const name = typeof button.name === "string" ? button.name.trim() : "";
  const command =
    typeof button.command === "string" ? button.command.trim() : "";
  if (!name || !command) {
    vscode.window.showErrorMessage("Button name and command are required.");
    return;
  }

  const icon = typeof button.icon === "string" ? button.icon.trim() : "";
  const saved: CommandButton = {
    id: button.id || Date.now().toString(),
    name,
    command,
    color: typeof button.color === "string" ? button.color : "#007acc",
    ...(icon ? { icon } : {}),
  };

  try {
    const buttons = getButtons();
    const index = buttons.findIndex((b) => b.id === saved.id);
    if (index >= 0) {
      buttons[index] = saved;
    } else {
      buttons.push(saved);
    }
    await saveButtons(buttons);
  } catch (error) {
    console.error("Error saving button:", error);
    vscode.window.showErrorMessage(`Failed to save button: ${error}`);
  }
}

// Usunięcie przycisku po potwierdzeniu
async function deleteButton(buttonId: string) {
  const button = getButtons().find((b) => b.id === buttonId);
  if (!button) {
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Delete button "${button.name}"?`,
    { modal: true },
    "Delete"
  );
  if (answer !== "Delete") {
    return;
  }

  try {
    await saveButtons(getButtons().filter((b) => b.id !== buttonId));
  } catch (error) {
    console.error("Error deleting button:", error);
    vscode.window.showErrorMessage(`Failed to delete button: ${error}`);
  }
}

// Nowa kolejność z przeciągania w webview
async function reorderButtons(ids: string[]) {
  try {
    const buttons = getButtons();
    const byId = new Map(buttons.map((b) => [b.id, b]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((b): b is CommandButton => b !== undefined);
    // Przyciski, których webview nie znał (np. dodane w międzyczasie), zostają na końcu
    const rest = buttons.filter((b) => !ids.includes(b.id));
    await saveButtons([...ordered, ...rest]);
  } catch (error) {
    console.error("Error reordering buttons:", error);
    vscode.window.showErrorMessage(`Failed to reorder buttons: ${error}`);
  }
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
    private readonly _context: vscode.ExtensionContext
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

    // Obsługa wiadomości z webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "executeCommand":
            runInTerminal(message.command);
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
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      this._view.webview.postMessage({
        type: "buttonsUpdate",
        buttons: getButtons(),
        layout: config.get<Layout>("layout", "icons"),
      });
    }
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

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${codiconsUri}">
    <title>Terminal Command Buttons</title>
    <style nonce="${nonce}">
        /* Natywne kontrolki (np. lista podpowiedzi ikon) w kolorach motywu */
        body.vscode-light,
        body.vscode-high-contrast-light {
            color-scheme: light;
        }

        body.vscode-dark,
        body.vscode-high-contrast:not(.vscode-high-contrast-light) {
            color-scheme: dark;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            margin: 0;
            padding: 6px 8px;
        }

        .buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .buttons.list {
            flex-direction: column;
            flex-wrap: nowrap;
            gap: 2px;
        }

        /* Tryb ikon: kwadratowy przycisk, kolor przycisku na ikonie i pasku pod nią */
        .cmd {
            --btn-color: var(--vscode-foreground);
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            padding: 0 0 3px;
            border: 1px solid var(--vscode-widget-border, transparent);
            border-radius: 4px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--btn-color);
            font: inherit;
            cursor: pointer;
            box-sizing: border-box;
            user-select: none;
        }

        .cmd:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .cmd:focus-visible {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }

        .cmd::after {
            content: "";
            position: absolute;
            left: 7px;
            right: 7px;
            bottom: 3px;
            height: 2px;
            border-radius: 1px;
            background: var(--btn-color);
        }

        .cmd .icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .cmd .initials {
            font-size: 11px;
            font-weight: 600;
        }

        .cmd .label,
        .cmd .command,
        .cmd .text {
            display: none;
        }

        .cmd.add {
            border-style: dashed;
            border-color: var(--vscode-descriptionForeground);
            background: transparent;
            color: var(--vscode-descriptionForeground);
        }

        .cmd.add::after {
            display: none;
        }

        /* Tryb listy: wiersz z ikoną, nazwą i komendą */
        .list .cmd {
            width: 100%;
            height: auto;
            min-height: 26px;
            justify-content: flex-start;
            gap: 8px;
            padding: 3px 8px;
            border-color: transparent;
            background: transparent;
            color: var(--vscode-foreground);
            text-align: left;
        }

        .list .cmd:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .list .cmd::after {
            left: 0;
            right: auto;
            top: 4px;
            bottom: 4px;
            width: 3px;
            height: auto;
        }

        .list .cmd .icon {
            flex: none;
            width: 16px;
            color: var(--btn-color);
        }

        /* Nazwa i komenda na wspólnej linii bazowej, cały blok wyśrodkowany w wierszu */
        .list .cmd .text {
            display: flex;
            align-items: baseline;
            gap: 8px;
            min-width: 0;
        }

        .list .cmd .label {
            display: inline;
            font-weight: 600;
            white-space: nowrap;
        }

        .list .cmd .command {
            display: inline;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .list .cmd.add {
            border-color: transparent;
            color: var(--vscode-descriptionForeground);
        }

        .list .cmd.add .label {
            font-weight: normal;
        }

        /* Uchwyt do przeciągania przy lewym pasku, tylko w liście */
        .cmd .grip {
            display: none;
        }

        .list .cmd .grip {
            display: inline-flex;
            flex: none;
            width: 12px;
            margin: 0 -6px 0 -4px;
            visibility: hidden;
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            cursor: grab;
        }

        .list .cmd:hover .grip,
        .list .cmd:focus-visible .grip {
            visibility: visible;
        }

        /* Akcje edit / delete w wierszu listy */
        .row-actions {
            display: none;
        }

        .list .cmd:hover .row-actions,
        .list .cmd:focus-within .row-actions {
            display: flex;
            flex: none;
            gap: 2px;
            margin-left: auto;
        }

        .row-actions .icon-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            padding: 0;
            border: none;
            border-radius: 3px;
            background: transparent;
            color: var(--vscode-icon-foreground, var(--vscode-foreground));
            cursor: pointer;
        }

        .row-actions .icon-action:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .row-actions .icon-action:focus-visible {
            outline: 1px solid var(--vscode-focusBorder);
        }

        /* Przeciąganie: wyszarzony element i linia w miejscu upuszczenia */
        .cmd.dragging {
            opacity: 0.4;
        }

        .cmd.drop-before::before,
        .cmd.drop-after::before {
            content: "";
            position: absolute;
            background: var(--vscode-focusBorder);
        }

        .icons .cmd.drop-before::before,
        .icons .cmd.drop-after::before {
            top: 2px;
            bottom: 2px;
            width: 2px;
        }

        .icons .cmd.drop-before::before {
            left: -5px;
        }

        .icons .cmd.drop-after::before {
            right: -5px;
        }

        .list .cmd.drop-before::before,
        .list .cmd.drop-after::before {
            left: 0;
            right: 0;
            height: 2px;
        }

        .list .cmd.drop-before::before {
            top: -2px;
        }

        .list .cmd.drop-after::before {
            bottom: -2px;
        }

        .tooltip {
            position: fixed;
            z-index: 10;
            display: none;
            max-width: min(360px, calc(100vw - 16px));
            padding: 4px 8px;
            border: 1px solid var(--vscode-editorHoverWidget-border);
            border-radius: 3px;
            background: var(--vscode-editorHoverWidget-background);
            color: var(--vscode-editorHoverWidget-foreground);
            box-shadow: 0 2px 8px var(--vscode-widget-shadow);
            pointer-events: none;
        }

        .tooltip-name,
        .tooltip-command,
        .tooltip-hint {
            display: block;
        }

        .tooltip-name {
            font-weight: 600;
        }

        .tooltip-command {
            margin-top: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-textPreformat-foreground);
            white-space: pre-wrap;
            word-break: break-all;
        }

        .tooltip-hint {
            margin-top: 5px;
            padding-top: 4px;
            border-top: 1px solid var(--vscode-editorHoverWidget-border);
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        /* Formularz zastępuje przyciski, bo panel obok terminala jest niski */
        .form {
            display: none;
        }

        body.editing .buttons {
            display: none;
        }

        body.editing .form {
            display: block;
        }

        .fields {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 12px;
        }

        .field {
            flex: 1 1 140px;
            min-width: 0;
        }

        .field-command {
            flex: 2 1 220px;
        }

        .field-color {
            flex-basis: 100%;
        }

        .field label {
            display: block;
            margin-bottom: 2px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .field input {
            width: 100%;
            height: 24px;
            box-sizing: border-box;
            padding: 2px 6px;
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 2px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font: inherit;
        }

        .field input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        /* Pole z kwadratowym podglądem (ikona / kolor) wyrównanym do wysokości inputa */
        .input-with-preview {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .input-with-preview input {
            flex: 1;
            min-width: 0;
        }

        .preview-box {
            display: flex;
            flex: none;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            box-sizing: border-box;
            border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
            border-radius: 2px;
            background: var(--vscode-input-background);
            font-size: 16px;
        }

        .color-preview {
            width: 14px;
            height: 14px;
            border-radius: 2px;
        }

        /* Własny wybór koloru - natywny picker na Windows otwiera jasne okno systemowe */
        .color-row {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px 12px;
        }

        .swatches {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .swatch {
            width: 20px;
            height: 20px;
            padding: 0;
            border: 1px solid var(--vscode-widget-border, transparent);
            border-radius: 3px;
            cursor: pointer;
        }

        .swatch[aria-pressed="true"] {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }

        .swatch:focus-visible {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }

        .hex-field {
            flex: none;
            width: 120px;
        }

        .swatch.custom {
            background: conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
        }

        /* Własny picker: pole nasycenie / jasność + pionowy pasek odcienia */
        .picker {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .picker[hidden] {
            display: none;
        }

        .sv {
            position: relative;
            width: 180px;
            height: 100px;
            border-radius: 3px;
            background-image:
                linear-gradient(to top, #000, rgba(0, 0, 0, 0)),
                linear-gradient(to right, #fff, rgba(255, 255, 255, 0));
            cursor: crosshair;
            touch-action: none;
        }

        .hue {
            position: relative;
            width: 14px;
            height: 100px;
            border-radius: 3px;
            background: linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%);
            cursor: pointer;
            touch-action: none;
        }

        .sv-thumb,
        .hue-thumb {
            position: absolute;
            box-sizing: border-box;
            border: 2px solid #fff;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
            pointer-events: none;
        }

        .sv-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        }

        .hue-thumb {
            left: -3px;
            right: -3px;
            height: 6px;
            border-radius: 2px;
            transform: translateY(-50%);
        }

        .error {
            margin-top: 4px;
            font-size: 11px;
            color: var(--vscode-errorForeground);
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 6px;
            margin-top: 6px;
        }

        .actions button {
            padding: 4px 12px;
            border: none;
            border-radius: 2px;
            font: inherit;
            cursor: pointer;
        }

        .primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .primary:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
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

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const viewType = document.body.dataset.view;

        // Podpowiedzi w polu ikony, można wpisać dowolną nazwę codicon
        const ICONS = [
            'terminal', 'play', 'debug-start', 'debug-restart', 'run-all', 'stop-circle',
            'git-branch', 'git-commit', 'git-merge', 'git-pull-request', 'repo-pull', 'repo-push',
            'sync', 'refresh', 'cloud-upload', 'cloud-download', 'rocket', 'package',
            'beaker', 'bug', 'check', 'tools', 'gear', 'database', 'server', 'trash',
            'folder', 'file-code', 'search', 'zap', 'flame', 'history'
        ];

        // Kolory czytelne na ciemnym i jasnym motywie
        const COLORS = [
            '#3794ff', '#52baff', '#4ec9b0', '#89d185', '#cca700', '#d18616',
            '#f14c4c', '#f48771', '#c586c0', '#b180d7', '#cccccc', '#808080'
        ];

        let buttons = [];
        let layout = 'icons';
        let editingId = null;
        let tooltipTimer;

        const buttonsEl = document.getElementById('buttons');
        const formEl = document.getElementById('form');
        const tooltipEl = document.getElementById('tooltip');
        const nameInput = document.getElementById('name');
        const commandInput = document.getElementById('command');
        const iconInput = document.getElementById('icon');
        const colorInput = document.getElementById('color');
        const colorPreview = document.getElementById('colorPreview');
        const swatchesEl = document.getElementById('swatches');
        const pickerEl = document.getElementById('picker');
        const svEl = document.getElementById('sv');
        const svThumb = document.getElementById('svThumb');
        const hueEl = document.getElementById('hue');
        const hueThumb = document.getElementById('hueThumb');
        const iconPreview = document.getElementById('iconPreview');
        const errorEl = document.getElementById('error');
        const saveBtn = document.getElementById('save');

        ICONS.forEach(icon => {
            const option = document.createElement('option');
            option.value = icon;
            document.getElementById('iconList').append(option);
        });

        COLORS.forEach(color => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'swatch';
            swatch.dataset.color = color;
            swatch.title = color;
            swatch.setAttribute('aria-label', color);
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => setColor(color));
            swatchesEl.append(swatch);
        });

        // Ostatnie pole palety rozwija własny picker
        const customSwatch = document.createElement('button');
        customSwatch.type = 'button';
        customSwatch.className = 'swatch custom';
        customSwatch.title = 'Custom color';
        customSwatch.setAttribute('aria-label', 'Custom color');
        customSwatch.setAttribute('aria-expanded', 'false');
        customSwatch.addEventListener('click', () => {
            const show = pickerEl.hidden;
            pickerEl.hidden = !show;
            customSwatch.setAttribute('aria-expanded', String(show));
        });
        swatchesEl.append(customSwatch);

        let hsv = { h: 210, s: 0.8, v: 1 };

        function hsvToHex(h, s, v) {
            const f = (n) => {
                const k = (n + h / 60) % 6;
                return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
            };
            return '#' + [f(5), f(3), f(1)]
                .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
                .join('');
        }

        function hexToHsv(hex) {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;
            const max = Math.max(r, g, b);
            const d = max - Math.min(r, g, b);
            let h = 0;
            if (d) {
                if (max === r) {
                    h = ((g - b) / d + 6) % 6;
                } else if (max === g) {
                    h = (b - r) / d + 2;
                } else {
                    h = (r - g) / d + 4;
                }
                h *= 60;
            }
            return { h: h, s: max ? d / max : 0, v: max };
        }

        function updatePicker() {
            svEl.style.backgroundColor = 'hsl(' + hsv.h + ', 100%, 50%)';
            svThumb.style.left = hsv.s * 100 + '%';
            svThumb.style.top = (1 - hsv.v) * 100 + '%';
            hueThumb.style.top = hsv.h / 360 * 100 + '%';
        }

        function clamp01(value) {
            return Math.max(0, Math.min(1, value));
        }

        // Przeciąganie myszą po polu / pasku z przechwyceniem wskaźnika
        function trackPointer(el, onMove) {
            el.addEventListener('pointerdown', (e) => {
                el.setPointerCapture(e.pointerId);
                onMove(e);
            });
            el.addEventListener('pointermove', (e) => {
                if (el.hasPointerCapture(e.pointerId)) {
                    onMove(e);
                }
            });
        }

        trackPointer(svEl, (e) => {
            const r = svEl.getBoundingClientRect();
            hsv.s = clamp01((e.clientX - r.left) / r.width);
            hsv.v = 1 - clamp01((e.clientY - r.top) / r.height);
            setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true);
        });

        trackPointer(hueEl, (e) => {
            const r = hueEl.getBoundingClientRect();
            hsv.h = Math.min(359.9, clamp01((e.clientY - r.top) / r.height) * 360);
            setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true);
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'buttonsUpdate':
                    buttons = message.buttons;
                    layout = message.layout === 'list' ? 'list' : 'icons';
                    render();
                    break;
                case 'editButton':
                    openForm(buttons.find(b => b.id === message.buttonId));
                    break;
            }
        });

        function isIconName(value) {
            return /^[a-z0-9-]+$/.test(value);
        }

        function getInitials(name) {
            const words = name.split(' ').filter(Boolean);
            const initials = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
            return initials.toUpperCase();
        }

        // Tylko textContent i style przez DOM - dane z ustawień nie trafiają do HTML
        function createIcon(icon, name) {
            const span = document.createElement('span');
            span.className = 'icon';
            if (icon && isIconName(icon)) {
                span.classList.add('codicon', 'codicon-' + icon);
            } else {
                const initials = document.createElement('span');
                initials.className = 'initials';
                initials.textContent = getInitials(name);
                span.append(initials);
            }
            return span;
        }

        function createText(className, text) {
            const span = document.createElement('span');
            span.className = className;
            span.textContent = text;
            return span;
        }

        function render() {
            hideTooltip();
            buttonsEl.className = 'buttons ' + layout;
            buttonsEl.replaceChildren();

            buttons.forEach(button => {
                // div zamiast <button>, bo w wierszu listy są zagnieżdżone akcje edit / delete
                const el = document.createElement('div');
                el.className = 'cmd';
                el.tabIndex = 0;
                el.dataset.id = button.id;
                el.setAttribute('role', 'button');
                el.style.setProperty('--btn-color', button.color || '');
                el.setAttribute('aria-label', button.name + ': ' + button.command);
                // Prawy klik: menu Run / Edit / Delete z package.json (webview/context)
                el.dataset.vscodeContext = JSON.stringify({
                    webviewSection: 'terminalCommandButtons.button',
                    buttonId: button.id,
                    viewType: viewType,
                    preventDefaultContextMenuItems: true
                });

                const grip = document.createElement('span');
                grip.className = 'grip codicon codicon-gripper';
                grip.setAttribute('aria-hidden', 'true');

                const text = document.createElement('span');
                text.className = 'text';
                text.append(
                    createText('label', button.name),
                    createText('command', button.command)
                );

                el.append(
                    grip,
                    createIcon(button.icon, button.name),
                    text,
                    createRowActions(button)
                );
                el.addEventListener('click', () => runButton(button));
                el.addEventListener('keydown', (e) => {
                    if (e.target !== el) {
                        return;
                    }
                    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
                        e.preventDefault();
                        moveBy(button.id, -1);
                    } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                        e.preventDefault();
                        moveBy(button.id, 1);
                    } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        runButton(button);
                    }
                });
                attachTooltip(el, button.name, button.command);
                attachDrag(el, button);
                buttonsEl.append(el);
            });

            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'cmd add';
            add.setAttribute('aria-label', 'Add button');
            const addIcon = document.createElement('span');
            addIcon.className = 'icon codicon codicon-add';
            add.append(addIcon, createText('label', 'Add button'));
            add.addEventListener('click', () => openForm());
            attachTooltip(add, 'Add button');
            buttonsEl.append(add);
        }

        function runButton(button) {
            hideTooltip();
            vscode.postMessage({ type: 'executeCommand', command: button.command });
        }

        // Akcje widoczne po najechaniu na wiersz w trybie listy
        function createRowActions(button) {
            const wrap = document.createElement('span');
            wrap.className = 'row-actions';
            [
                ['edit', 'Edit', () => openForm(button)],
                ['trash', 'Delete', () => vscode.postMessage({ type: 'deleteButton', buttonId: button.id })]
            ].forEach(([icon, label, action]) => {
                const actionBtn = document.createElement('button');
                actionBtn.type = 'button';
                actionBtn.className = 'icon-action codicon codicon-' + icon;
                actionBtn.title = label;
                actionBtn.setAttribute('aria-label', label + ' ' + button.name);
                actionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    action();
                });
                wrap.append(actionBtn);
            });
            return wrap;
        }

        // Zmiana kolejności przeciąganiem: w liście góra / dół wiersza, w ikonach lewa / prawa
        let dragId = null;

        function isAfter(el, e) {
            const r = el.getBoundingClientRect();
            return layout === 'list' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
        }

        function clearDropMarkers() {
            buttonsEl.querySelectorAll('.drop-before, .drop-after').forEach(el => {
                el.classList.remove('drop-before', 'drop-after');
            });
        }

        function attachDrag(el, button) {
            el.draggable = true;
            el.addEventListener('dragstart', (e) => {
                dragId = button.id;
                hideTooltip();
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', button.id);
            });
            el.addEventListener('dragend', () => {
                dragId = null;
                el.classList.remove('dragging');
                clearDropMarkers();
            });
            el.addEventListener('dragover', (e) => {
                if (!dragId || dragId === button.id) {
                    return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const after = isAfter(el, e);
                if (!el.classList.contains(after ? 'drop-after' : 'drop-before')) {
                    clearDropMarkers();
                    el.classList.add(after ? 'drop-after' : 'drop-before');
                }
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromId = dragId;
                clearDropMarkers();
                moveButton(fromId, button.id, isAfter(el, e));
            });
        }

        function moveButton(fromId, toId, after) {
            if (!fromId || fromId === toId) {
                return;
            }
            const moved = buttons.find(b => b.id === fromId);
            const rest = buttons.filter(b => b.id !== fromId);
            const index = rest.findIndex(b => b.id === toId);
            if (!moved || index < 0) {
                return;
            }
            rest.splice(after ? index + 1 : index, 0, moved);
            buttons = rest;
            render();
            vscode.postMessage({ type: 'reorderButtons', ids: buttons.map(b => b.id) });
        }

        function moveBy(id, delta) {
            const index = buttons.findIndex(b => b.id === id);
            const target = buttons[index + delta];
            if (!target) {
                return;
            }
            moveButton(id, target.id, delta > 0);
            const moved = Array.from(buttonsEl.children).find(c => c.dataset.id === id);
            if (moved) {
                moved.focus();
            }
        }

        // Tooltip tylko w trybie ikon - w liście nazwa i komenda są widoczne
        function attachTooltip(el, name, command) {
            const show = () => {
                if (layout !== 'icons') {
                    return;
                }
                clearTimeout(tooltipTimer);
                tooltipTimer = setTimeout(() => showTooltip(el, name, command), 200);
            };
            el.addEventListener('mouseenter', show);
            el.addEventListener('focus', show);
            el.addEventListener('mouseleave', hideTooltip);
            el.addEventListener('blur', hideTooltip);
        }

        function showTooltip(anchor, name, command) {
            tooltipEl.replaceChildren(createText('tooltip-name', name));
            if (command) {
                tooltipEl.append(
                    createText('tooltip-command', command),
                    createText('tooltip-hint', 'Click to run · Right-click to edit · Drag to reorder')
                );
            }
            tooltipEl.style.display = 'block';

            const a = anchor.getBoundingClientRect();
            const t = tooltipEl.getBoundingClientRect();
            let top = a.bottom + 6;
            if (top + t.height > window.innerHeight - 4) {
                top = Math.max(4, a.top - t.height - 6);
            }
            let left = a.left + a.width / 2 - t.width / 2;
            left = Math.max(4, Math.min(left, window.innerWidth - t.width - 4));

            tooltipEl.style.top = top + 'px';
            tooltipEl.style.left = left + 'px';
        }

        function hideTooltip() {
            clearTimeout(tooltipTimer);
            tooltipEl.style.display = 'none';
        }

        function updateIconPreview() {
            const icon = iconInput.value.trim();
            iconPreview.className = isIconName(icon) ? 'codicon codicon-' + icon : '';
        }

        function isHexColor(value) {
            return /^#[0-9a-fA-F]{6}$/.test(value);
        }

        function updateColorPreview() {
            const color = colorInput.value.trim().toLowerCase();
            colorPreview.style.backgroundColor = isHexColor(color) ? color : 'transparent';
            swatchesEl.querySelectorAll('.swatch').forEach(swatch => {
                // Pole "custom" zaznaczone, gdy kolor spoza palety
                const pressed = swatch.dataset.color
                    ? swatch.dataset.color === color
                    : isHexColor(color) && !COLORS.includes(color);
                swatch.setAttribute('aria-pressed', String(pressed));
            });
        }

        // fromPicker: kolor z pickera - nie przeliczaj HSV z hex, żeby nie gubić odcienia przy szarościach
        function setColor(color, fromPicker) {
            colorInput.value = color;
            updateColorPreview();
            if (!fromPicker && isHexColor(color)) {
                hsv = hexToHsv(color.toLowerCase());
            }
            updatePicker();
        }

        function openForm(button) {
            hideTooltip();
            editingId = button ? button.id : null;
            nameInput.value = button ? button.name : '';
            commandInput.value = button ? button.command : '';
            iconInput.value = button && button.icon ? button.icon : '';
            setColor(button && isHexColor(button.color) ? button.color.toLowerCase() : COLORS[0]);
            pickerEl.hidden = true;
            customSwatch.setAttribute('aria-expanded', 'false');
            saveBtn.textContent = button ? 'Save' : 'Add';
            errorEl.textContent = '';
            updateIconPreview();
            document.body.classList.add('editing');
            nameInput.focus();
        }

        function closeForm() {
            editingId = null;
            document.body.classList.remove('editing');
        }

        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const command = commandInput.value.trim();
            const icon = iconInput.value.trim();
            const color = colorInput.value.trim().toLowerCase();

            if (!name || !command) {
                errorEl.textContent = 'Name and command are required.';
                return;
            }
            if (icon && !isIconName(icon)) {
                errorEl.textContent = 'Icon must be a codicon name, e.g. git-branch.';
                return;
            }
            if (!isHexColor(color)) {
                errorEl.textContent = 'Color must be a hex value, e.g. #3794ff.';
                return;
            }

            vscode.postMessage({
                type: 'saveButton',
                button: { id: editingId, name: name, command: command, color: color, icon: icon }
            });
            closeForm();
        });

        document.getElementById('cancel').addEventListener('click', closeForm);
        iconInput.addEventListener('input', updateIconPreview);
        colorInput.addEventListener('input', () => {
            const color = colorInput.value.trim().toLowerCase();
            updateColorPreview();
            if (isHexColor(color)) {
                hsv = hexToHsv(color);
                updatePicker();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.body.classList.contains('editing')) {
                closeForm();
            }
        });

        window.addEventListener('scroll', hideTooltip, true);

        // Request initial buttons
        vscode.postMessage({ type: 'getButtons' });
    </script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Terminal Command Buttons extension is now active!");

  // Rejestracja providerów webview: Activity Bar i panel dolny
  const providers = new Map<string, TerminalButtonsProvider>();
  for (const viewType of [
    TerminalButtonsProvider.viewType,
    TerminalButtonsProvider.panelViewType,
  ]) {
    const provider = new TerminalButtonsProvider(
      viewType,
      context.extensionUri,
      context
    );
    providers.set(viewType, provider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(viewType, provider)
    );
  }

  // Odśwież oba widoki po każdej zmianie przycisków lub układu
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        providers.forEach((provider) => provider.sendButtonsToWebview());
      }
    })
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

      if (!name) {
        return;
      }

      const command = await vscode.window.showInputBox({
        prompt: "Enter command",
        placeHolder: "e.g., ls -la",
      });

      if (!command) {
        return;
      }

      await saveButton({ name, command, color: "#007acc" });
    }
  );

  // Przełączenie układu ikony / lista
  const toggleLayout = vscode.commands.registerCommand(
    "terminalCommandButtons.toggleLayout",
    async () => {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const next: Layout =
        config.get<Layout>("layout", "icons") === "icons" ? "list" : "icons";
      await config.update("layout", next, vscode.ConfigurationTarget.Global);
    }
  );

  // Komendy z menu prawego kliknięcia na przycisku
  const runButton = vscode.commands.registerCommand(
    "terminalCommandButtons.runButton",
    (ctx: ButtonContext) => {
      const button = getButtons().find((b) => b.id === ctx?.buttonId);
      if (button) {
        runInTerminal(button.command);
      }
    }
  );

  const editButton = vscode.commands.registerCommand(
    "terminalCommandButtons.editButton",
    (ctx: ButtonContext) => {
      providers.get(ctx?.viewType)?.showEditForm(ctx.buttonId);
    }
  );

  const deleteButtonCommand = vscode.commands.registerCommand(
    "terminalCommandButtons.deleteButton",
    async (ctx: ButtonContext) => {
      if (ctx?.buttonId) {
        await deleteButton(ctx.buttonId);
      }
    }
  );

  // Komenda do przeniesienia widoku z panelu obok terminala.
  // vscode.moveViews to komenda wewnętrzna VS Code - przy błędzie instrukcja ręczna.
  const dockToTerminal = vscode.commands.registerCommand(
    "terminalCommandButtons.dockToTerminal",
    async () => {
      try {
        await vscode.commands.executeCommand("vscode.moveViews", {
          viewIds: [TerminalButtonsProvider.panelViewType],
          destinationId: "terminal",
        });
        await vscode.commands.executeCommand(
          `${TerminalButtonsProvider.panelViewType}.focus`
        );
      } catch (error) {
        console.error("Failed to move view next to terminal:", error);
        vscode.window.showInformationMessage(
          'Drag the "Command Buttons" tab onto the Terminal panel to keep the buttons next to it.'
        );
      }
    }
  );

  context.subscriptions.push(
    openButtonsPanel,
    addButton,
    toggleLayout,
    runButton,
    editButton,
    deleteButtonCommand,
    dockToTerminal
  );
}

export function deactivate() {}

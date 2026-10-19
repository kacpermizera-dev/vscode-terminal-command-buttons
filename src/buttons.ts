import * as vscode from "vscode";
import { ButtonInput, sanitizeInputs } from "./variables";

// Interfejs dla przycisku komendy
export interface CommandButton {
  id: string;
  name: string;
  command: string;
  color: string;
  icon?: string;
  // Nazwany terminal tylko dla tego przycisku; brak = aktywny terminal
  terminal?: string;
  inputs?: ButtonInput[];
  // Nazwa grupy w widoku, np. Git, Build
  group?: string;
  // Pytanie "Run …?" przed uruchomieniem
  confirm?: boolean;
  // Przycisk także na pasku stanu
  pinned?: boolean;
}

// global: ustawienia użytkownika, workspace: tylko w tym workspace
export type ButtonScope = "global" | "workspace";

export interface ScopedButton extends CommandButton {
  scope: ButtonScope;
  // Zapis w .vscode/settings.json projektu sprzed 0.3.0
  legacy?: boolean;
}

export type Layout = "icons" | "list";

export const CONFIG_SECTION = "terminalCommandButtons";

// Miejsca zapisu. Przyciski workspace trzymamy w workspaceState (profil VS Code),
// żeby nic nie lądowało w repozytorium.
type Store = "global" | "workspace" | "legacy";

const WORKSPACE_KEY = "buttons";
const MIGRATION_DISMISSED_KEY = "legacyMigrationDismissed";

export function getLayout(): Layout {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<Layout>("layout", "icons");
}

function hasWorkspaceFolder(): boolean {
  return (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
}

// Tylko pola przycisku, bez scope / legacy dokładanych w pamięci
function toStored(button: CommandButton): CommandButton {
  return {
    id: button.id,
    name: button.name,
    command: button.command,
    color: button.color,
    ...(button.icon ? { icon: button.icon } : {}),
    ...(button.terminal ? { terminal: button.terminal } : {}),
    ...(button.inputs && button.inputs.length > 0 ? { inputs: button.inputs } : {}),
    ...(button.group ? { group: button.group } : {}),
    ...(button.confirm ? { confirm: true } : {}),
    ...(button.pinned ? { pinned: true } : {}),
  };
}

// Istniejące nazwy grup, do podpowiedzi w formularzu
export function groupNames(buttons: CommandButton[]): string[] {
  const names: string[] = [];
  buttons.forEach((b) => {
    if (b.group && !names.includes(b.group)) {
      names.push(b.group);
    }
  });
  return names.sort((a, b) => a.localeCompare(b));
}

export class ButtonStore implements vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _disposables: vscode.Disposable[] = [this._onDidChange];

  constructor(private readonly _state: vscode.Memento) {
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(`${CONFIG_SECTION}.buttons`)) {
          this._onDidChange.fire();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this._onDidChange.fire())
    );
  }

  // Bez otwartego folderu nie ma sensu "tylko ten workspace"
  public get hasWorkspace(): boolean {
    return hasWorkspaceFolder();
  }

  public get legacyCount(): number {
    return this._read("legacy").length;
  }

  // Najpierw przyciski tego workspace, potem globalne
  public getAll(): ScopedButton[] {
    return [
      ...this._read("legacy").map((b) => ({ ...b, scope: "workspace" as const, legacy: true })),
      ...this._read("workspace").map((b) => ({ ...b, scope: "workspace" as const })),
      ...this._read("global").map((b) => ({ ...b, scope: "global" as const })),
    ];
  }

  public find(id: string): ScopedButton | undefined {
    return this.getAll().find((b) => b.id === id);
  }

  // Dodanie nowego lub aktualizacja istniejącego przycisku, także zmiana zakresu
  public async save(
    button: Partial<CommandButton> & { scope?: ButtonScope }
  ): Promise<boolean> {
    const name = typeof button.name === "string" ? button.name.trim() : "";
    const command =
      typeof button.command === "string" ? button.command.trim() : "";
    if (!name || !command) {
      vscode.window.showErrorMessage("Button name and command are required.");
      return false;
    }

    const inputs = sanitizeInputs(button.inputs);
    if (!inputs) {
      vscode.window.showErrorMessage(
        'Inputs must be a list like [{ "id": "branch", "type": "pickString", "options": ["main"] }].'
      );
      return false;
    }

    const icon = typeof button.icon === "string" ? button.icon.trim() : "";
    const terminal =
      typeof button.terminal === "string" ? button.terminal.trim() : "";
    const group = typeof button.group === "string" ? button.group.trim() : "";
    const saved: CommandButton = toStored({
      id: button.id || Date.now().toString(),
      name,
      command,
      color: typeof button.color === "string" ? button.color : "#3794ff",
      icon,
      terminal,
      inputs,
      group,
      confirm: button.confirm === true,
      pinned: button.pinned === true,
    });

    const existing = button.id ? this.find(button.id) : undefined;
    const wantsWorkspace = button.scope === "workspace" && this.hasWorkspace;
    // Edytowany stary przycisk z settings.json zostaje tam, dopóki nie zmieni zakresu
    const target: Store = !wantsWorkspace
      ? "global"
      : existing?.legacy
        ? "legacy"
        : "workspace";
    const source = existing ? this._storeOf(existing) : undefined;

    try {
      if (source && source !== target) {
        await this._write(
          source,
          this._read(source).filter((b) => b.id !== saved.id)
        );
      }
      const buttons = this._read(target);
      const index = buttons.findIndex((b) => b.id === saved.id);
      if (index >= 0) {
        buttons[index] = saved;
      } else {
        buttons.push(saved);
      }
      await this._write(target, buttons);
      return true;
    } catch (error) {
      console.error("Error saving button:", error);
      vscode.window.showErrorMessage(`Failed to save button: ${error}`);
      return false;
    }
  }

  // Usunięcie przycisku po potwierdzeniu
  public async delete(buttonId: string) {
    const button = this.find(buttonId);
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
      const store = this._storeOf(button);
      await this._write(
        store,
        this._read(store).filter((b) => b.id !== buttonId)
      );
    } catch (error) {
      console.error("Error deleting button:", error);
      vscode.window.showErrorMessage(`Failed to delete button: ${error}`);
    }
  }

  // Nowa kolejność z przeciągania w webview, w obrębie każdego miejsca zapisu
  public async reorder(ids: string[]) {
    try {
      for (const store of ["legacy", "workspace", "global"] as const) {
        const buttons = this._read(store);
        if (!buttons.some((b) => ids.includes(b.id))) {
          continue;
        }
        const byId = new Map(buttons.map((b) => [b.id, b]));
        const ordered = ids
          .map((id) => byId.get(id))
          .filter((b): b is CommandButton => b !== undefined);
        // Przyciski, których webview nie znał (np. dodane w międzyczasie), zostają na końcu
        const rest = buttons.filter((b) => !ids.includes(b.id));
        await this._write(store, [...ordered, ...rest]);
      }
    } catch (error) {
      console.error("Error reordering buttons:", error);
      vscode.window.showErrorMessage(`Failed to reorder buttons: ${error}`);
    }
  }

  // Belka w widoku: stare przyciski w settings.json, a użytkownik nie wybrał "Keep"
  public get showLegacyNotice(): boolean {
    return this.legacyCount > 0 && !this._state.get(MIGRATION_DISMISSED_KEY);
  }

  // Przeniesienie przycisków z .vscode/settings.json do VS Code (tylko ten workspace)
  public async migrateLegacy() {
    const legacy = this._read("legacy");
    if (legacy.length === 0) {
      vscode.window.showInformationMessage(
        "This workspace has no command buttons in .vscode/settings.json."
      );
      return;
    }
    try {
      await this._write("workspace", [...legacy, ...this._read("workspace")]);
      await this._write("legacy", []);
      vscode.window.showInformationMessage(
        `Moved ${legacy.length} button(s) from .vscode/settings.json into VS Code.`
      );
    } catch (error) {
      console.error("Error moving buttons:", error);
      vscode.window.showErrorMessage(`Failed to move buttons: ${error}`);
    }
  }

  // "Keep in settings.json" - nie pytamy więcej w tym workspace
  public async dismissLegacy() {
    await this._state.update(MIGRATION_DISMISSED_KEY, true);
    this._onDidChange.fire();
  }

  // Jednorazowe powiadomienie; ta sama decyzja jest też na belce w widoku
  public async offerLegacyMigration() {
    if (!this.showLegacyNotice) {
      return;
    }
    const answer = await vscode.window.showInformationMessage(
      `${this.legacyCount} command button(s) are saved in this project's .vscode/settings.json, so they can end up in commits. Move them into VS Code, for this workspace only?`,
      "Move",
      "Keep in settings.json"
    );
    if (answer === "Move") {
      await this.migrateLegacy();
    } else if (answer) {
      await this.dismissLegacy();
    }
  }

  public dispose() {
    this._disposables.forEach((d) => d.dispose());
  }

  private _storeOf(button: ScopedButton): Store {
    return button.legacy ? "legacy" : button.scope;
  }

  private _read(store: Store): CommandButton[] {
    if (store === "workspace") {
      return this.hasWorkspace
        ? [...this._state.get<CommandButton[]>(WORKSPACE_KEY, [])]
        : [];
    }
    const inspected = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .inspect<CommandButton[]>("buttons");
    if (store === "global") {
      return [...(inspected?.globalValue ?? [])];
    }
    // Przyciski z ustawień workspace pochodzą z repo - w nieufnym workspace ich nie ma
    return vscode.workspace.isTrusted ? [...(inspected?.workspaceValue ?? [])] : [];
  }

  private async _write(store: Store, buttons: CommandButton[]) {
    const stored = buttons.map(toStored);
    if (store === "workspace") {
      await this._state.update(WORKSPACE_KEY, stored);
      this._onDidChange.fire();
      return;
    }
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    if (store === "global") {
      await config.update("buttons", stored, vscode.ConfigurationTarget.Global);
    } else {
      // Pusta lista = usunięcie klucza z .vscode/settings.json
      await config.update(
        "buttons",
        stored.length > 0 ? stored : undefined,
        vscode.ConfigurationTarget.Workspace
      );
    }
  }
}

import * as vscode from "vscode";
import {
  DEFAULT_COLOR,
  NormalizedButtons,
  normalizeButtons,
  reorderStore,
} from "./buttonData";
import { ButtonInput, sanitizeInputs } from "./variables";

export interface CommandButton {
  id: string;
  name: string;
  command: string;
  color: string;
  icon?: string;
  terminal?: string;
  inputs?: ButtonInput[];
  rawInputs?: unknown;
  group?: string;
  confirm?: boolean;
  pinned?: boolean;
}

export type ButtonScope = "global" | "workspace";

export interface ScopedButton extends CommandButton {
  scope: ButtonScope;
  legacy?: boolean;
}

export type Layout = "icons" | "list";

export const CONFIG_SECTION = "terminalCommandButtons";

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

function toStored(button: CommandButton): CommandButton {
  return {
    id: button.id,
    name: button.name,
    command: button.command,
    color: button.color,
    ...(button.icon ? { icon: button.icon } : {}),
    ...(button.terminal ? { terminal: button.terminal } : {}),
    ...(button.rawInputs !== undefined
      ? { inputs: button.rawInputs as ButtonInput[] }
      : button.inputs && button.inputs.length > 0
        ? { inputs: button.inputs }
        : {}),
    ...(button.group ? { group: button.group } : {}),
    ...(button.confirm ? { confirm: true } : {}),
    ...(button.pinned ? { pinned: true } : {}),
  };
}

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

  public get hasWorkspace(): boolean {
    return hasWorkspaceFolder();
  }

  public get legacyCount(): number {
    return this._read("legacy").length;
  }

  public getAll(): ScopedButton[] {
    const all = this._readAll();
    return [
      ...all.legacy.buttons.map((b) => ({ ...b, scope: "workspace" as const, legacy: true })),
      ...all.workspace.buttons.map((b) => ({ ...b, scope: "workspace" as const })),
      ...all.global.buttons.map((b) => ({ ...b, scope: "global" as const })),
    ];
  }

  public find(id: string): ScopedButton | undefined {
    return this.getAll().find((b) => b.id === id);
  }

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
      color: typeof button.color === "string" ? button.color : DEFAULT_COLOR,
      icon,
      terminal,
      inputs,
      group,
      confirm: button.confirm === true,
      pinned: button.pinned === true,
    });

    const existing = button.id ? this.find(button.id) : undefined;
    const wantsWorkspace = button.scope === "workspace" && this.hasWorkspace;
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

  public async reorder(ids: string[]) {
    try {
      for (const store of ["legacy", "workspace", "global"] as const) {
        const next = reorderStore(this._read(store), ids);
        if (next) {
          await this._write(store, next);
        }
      }
    } catch (error) {
      console.error("Error reordering buttons:", error);
      vscode.window.showErrorMessage(`Failed to reorder buttons: ${error}`);
    }
  }

  public get showLegacyNotice(): boolean {
    return this.legacyCount > 0 && !this._state.get(MIGRATION_DISMISSED_KEY);
  }

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

  public async dismissLegacy() {
    await this._state.update(MIGRATION_DISMISSED_KEY, true);
    this._onDidChange.fire();
  }

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

  private _readAll(): Record<Store, NormalizedButtons> {
    const ids = new Set<string>();
    const legacy = normalizeButtons(this._readRaw("legacy"), "legacy", ids);
    const workspace = normalizeButtons(this._readRaw("workspace"), "workspace", ids);
    const global = normalizeButtons(this._readRaw("global"), "global", ids);
    return { legacy, workspace, global };
  }

  private _read(store: Store): CommandButton[] {
    return this._readAll()[store].buttons;
  }

  private _readRaw(store: Store): unknown {
    if (store === "workspace") {
      return this.hasWorkspace ? this._state.get<unknown>(WORKSPACE_KEY, []) : [];
    }
    const inspected = vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .inspect<unknown>("buttons");
    if (store === "global") {
      return inspected?.globalValue;
    }
    return vscode.workspace.isTrusted ? inspected?.workspaceValue : [];
  }

  private async _write(store: Store, buttons: CommandButton[]) {
    const invalid = this._readAll()[store].invalid;
    const stored = [...buttons.map(toStored), ...(invalid as CommandButton[])];
    if (store === "workspace") {
      await this._state.update(WORKSPACE_KEY, stored);
      this._onDidChange.fire();
      return;
    }
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    if (store === "global") {
      await config.update("buttons", stored, vscode.ConfigurationTarget.Global);
    } else {
      await config.update(
        "buttons",
        stored.length > 0 ? stored : undefined,
        vscode.ConfigurationTarget.Workspace
      );
    }
  }
}

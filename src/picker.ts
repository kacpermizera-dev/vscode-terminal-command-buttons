import * as vscode from "vscode";
import { ButtonStore, ScopedButton } from "./buttons";
import { runButton } from "./inputs";
import { Runner } from "./runner";
import { formatStatus } from "./runStatus";

interface RunItem extends vscode.QuickPickItem {
  button?: ScopedButton;
}

function isIconName(value: string | undefined): value is string {
  return !!value && /^[a-z0-9-]+$/.test(value);
}

function toItem(button: ScopedButton, runner: Runner, now: number): RunItem {
  const status = runner.getStatus(button.id);
  return {
    label: `$(${isIconName(button.icon) ? button.icon : "terminal"}) ${button.name}`,
    description: button.command,
    detail: status ? formatStatus(status, now) : undefined,
    button,
  };
}

// Quick Pick "Uruchom…": przyciski tego workspace i globalne, z ostatnim statusem
export async function showRunPicker(
  runner: Runner,
  store: ButtonStore,
  memory: vscode.Memento
) {
  const now = Date.now();
  const buttons = store.getAll();
  if (buttons.length === 0) {
    vscode.window.showInformationMessage(
      "No command buttons yet. Add one in the Command Buttons view."
    );
    return;
  }

  const workspace = buttons.filter((b) => b.scope === "workspace");
  const global = buttons.filter((b) => b.scope === "global");
  const items: RunItem[] = [];
  // Separatory tylko, gdy są obie grupy
  const grouped = workspace.length > 0 && global.length > 0;
  if (grouped) {
    items.push({ label: "This workspace", kind: vscode.QuickPickItemKind.Separator });
  }
  items.push(...workspace.map((b) => toItem(b, runner, now)));
  if (grouped) {
    items.push({ label: "All workspaces", kind: vscode.QuickPickItemKind.Separator });
  }
  items.push(...global.map((b) => toItem(b, runner, now)));

  const picked = await vscode.window.showQuickPick(items, {
    title: "Run Command Button",
    placeHolder: "Type to filter buttons",
    matchOnDescription: true,
  });
  if (picked?.button) {
    await runButton(runner, picked.button, memory);
  }
}

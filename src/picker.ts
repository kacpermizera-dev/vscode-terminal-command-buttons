import * as vscode from "vscode";
import { ButtonStore, ScopedButton } from "./buttons";
import { runButton } from "./inputs";
import { Runner } from "./runner";
import { formatStatus } from "./runStatus";
import { arrangeButtons } from "./sections";

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

  // Te same sekcje co w widoku, spłaszczone do separatorów "Zakres · Grupa"
  const arranged = arrangeButtons(buttons);
  const bothScopes = new Set(arranged.map((a) => a.button.scope)).size > 1;
  const items: RunItem[] = [];
  let section: string | undefined;
  arranged.forEach(({ button, section: buttonSection, scopeLabel, group }) => {
    if (buttonSection !== section) {
      section = buttonSection;
      const label = [bothScopes ? scopeLabel : "", group].filter(Boolean).join(" · ");
      if (label) {
        items.push({ label, kind: vscode.QuickPickItemKind.Separator });
      }
    }
    items.push(toItem(button, runner, now));
  });

  const picked = await vscode.window.showQuickPick(items, {
    title: "Run Command Button",
    placeHolder: "Type to filter buttons",
    matchOnDescription: true,
  });
  if (picked?.button) {
    await runButton(runner, picked.button, memory);
  }
}

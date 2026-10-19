import * as vscode from "vscode";
import { getButtons } from "./buttons";
import { Runner } from "./runner";
import { formatStatus } from "./runStatus";

interface RunItem extends vscode.QuickPickItem {
  command: string;
}

function isIconName(value: string | undefined): value is string {
  return !!value && /^[a-z0-9-]+$/.test(value);
}

// Quick Pick "Uruchom…": wszystkie przyciski z ostatnim statusem
export async function showRunPicker(runner: Runner) {
  const now = Date.now();
  const items: RunItem[] = getButtons().map((button) => {
    const status = runner.getStatus(button.command);
    return {
      label: `$(${isIconName(button.icon) ? button.icon : "terminal"}) ${button.name}`,
      description: button.command,
      detail: status ? formatStatus(status, now) : undefined,
      command: button.command,
    };
  });

  if (items.length === 0) {
    vscode.window.showInformationMessage(
      "No command buttons yet. Add one in the Command Buttons view."
    );
    return;
  }

  const picked = await vscode.window.showQuickPick(items, {
    title: "Run Command Button",
    placeHolder: "Type to filter buttons",
    matchOnDescription: true,
  });
  if (picked) {
    runner.run(picked.command);
  }
}

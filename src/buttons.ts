import * as vscode from "vscode";

// Interfejs dla przycisku komendy
export interface CommandButton {
  id: string;
  name: string;
  command: string;
  color: string;
  icon?: string;
}

export type Layout = "icons" | "list";

export const CONFIG_SECTION = "terminalCommandButtons";

export function getButtons(): CommandButton[] {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<CommandButton[]>("buttons", []);
}

export function getLayout(): Layout {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<Layout>("layout", "icons");
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
export async function saveButton(
  button: Partial<CommandButton>
): Promise<boolean> {
  const name = typeof button.name === "string" ? button.name.trim() : "";
  const command =
    typeof button.command === "string" ? button.command.trim() : "";
  if (!name || !command) {
    vscode.window.showErrorMessage("Button name and command are required.");
    return false;
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
    return true;
  } catch (error) {
    console.error("Error saving button:", error);
    vscode.window.showErrorMessage(`Failed to save button: ${error}`);
    return false;
  }
}

// Usunięcie przycisku po potwierdzeniu
export async function deleteButton(buttonId: string) {
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
export async function reorderButtons(ids: string[]) {
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

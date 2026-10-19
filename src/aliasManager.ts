import * as vscode from "vscode";
import {
  EditableScope,
  GitAlias,
  GitAliases,
  isEditableScope,
  isValidAliasName,
} from "./gitAliases";

interface AliasItem extends vscode.QuickPickItem {
  alias?: GitAlias;
  add?: boolean;
}

const editButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon("edit"),
  tooltip: "Edit alias",
};

const deleteButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon("trash"),
  tooltip: "Delete alias",
};

const openFileButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon("go-to-file"),
  tooltip: "Open config file",
};

const SCOPE_LABELS: Record<string, string> = {
  local: "Repository (.git/config)",
  worktree: "Worktree",
  global: "Global (~/.gitconfig)",
  system: "System",
  command: "Command line",
};

// Kolejność grup: najpierw to, co nadpisuje resztę
const SCOPE_ORDER = ["local", "worktree", "global", "system", "command"];

function scopeRank(scope: string): number {
  const index = SCOPE_ORDER.indexOf(scope);
  return index < 0 ? SCOPE_ORDER.length : index;
}

function buildItems(aliases: GitAlias[]): AliasItem[] {
  const items: AliasItem[] = [{ label: "$(add) Add alias…", add: true, alwaysShow: true }];

  const sorted = [...aliases].sort(
    (a, b) => scopeRank(a.scope) - scopeRank(b.scope) || a.name.localeCompare(b.name)
  );
  let scope: string | undefined;
  sorted.forEach((alias) => {
    if (alias.scope !== scope) {
      scope = alias.scope;
      items.push({
        label: SCOPE_LABELS[scope] ?? scope,
        kind: vscode.QuickPickItemKind.Separator,
      });
    }
    const editable = isEditableScope(alias.scope);
    items.push({
      label: alias.name,
      description: alias.expansion,
      detail: alias.shell ? "$(terminal) Runs a shell command" : undefined,
      alias,
      buttons: [
        ...(editable ? [editButton, deleteButton] : []),
        ...(alias.file ? [openFileButton] : []),
      ],
    });
  });

  return items;
}

// Inny alias o tej nazwie (git nie rozróżnia wielkości liter w nazwach)
function findOther(
  gitAliases: GitAliases,
  name: string,
  current?: GitAlias
): GitAlias | undefined {
  return gitAliases.all.find(
    (a) =>
      a.name.toLowerCase() === name.toLowerCase() &&
      !(current && a.name === current.name && a.scope === current.scope)
  );
}

async function askName(
  gitAliases: GitAliases,
  title: string,
  value: string,
  current?: GitAlias
): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title,
    prompt: "Alias name, used as git <name>",
    value,
    placeHolder: "e.g. lg",
    validateInput: (input) => {
      const name = input.trim();
      if (!isValidAliasName(name)) {
        return "Use letters, digits and dashes, starting with a letter.";
      }
      const existing = findOther(gitAliases, name, current);
      // Ostrzeżenie, nie błąd - nadpisanie potwierdzamy przy zapisie
      return existing
        ? {
            message: `Alias "${existing.name}" already exists: ${existing.expansion}`,
            severity: vscode.InputBoxValidationSeverity.Warning,
          }
        : undefined;
    },
  });
}

async function askExpansion(title: string, value: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title,
    prompt: "What the alias runs, e.g. log --oneline --graph, or !command for a shell command",
    value,
    placeHolder: "log --oneline --graph",
    validateInput: (input) => (input.trim() ? undefined : "The alias needs a value."),
  });
}

async function askScope(gitAliases: GitAliases): Promise<EditableScope | undefined> {
  if (!gitAliases.canEditLocal) {
    return "global";
  }
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Global", description: "~/.gitconfig, every repository", scope: "global" as const },
      { label: "This repository", description: ".git/config", scope: "local" as const },
    ],
    { title: "Where to save the alias" }
  );
  return picked?.scope;
}

async function confirmReplace(gitAliases: GitAliases, name: string, current?: GitAlias) {
  const existing = findOther(gitAliases, name, current);
  if (!existing) {
    return true;
  }
  const answer = await vscode.window.showWarningMessage(
    `Replace alias "${existing.name}" (${existing.expansion})?`,
    { modal: true },
    "Replace"
  );
  return answer === "Replace";
}

async function addAlias(gitAliases: GitAliases) {
  const name = (await askName(gitAliases, "Add Git Alias (1/2)", ""))?.trim();
  if (!name) {
    return;
  }
  const expansion = (await askExpansion(`Add Git Alias (2/2): git ${name}`, ""))?.trim();
  if (!expansion) {
    return;
  }
  const scope = await askScope(gitAliases);
  if (!scope || !(await confirmReplace(gitAliases, name))) {
    return;
  }
  await gitAliases.set(scope, name, expansion);
}

// Edycja nazwy i wartości; zmiana nazwy = zapis pod nową i usunięcie starej
async function editAlias(gitAliases: GitAliases, alias: GitAlias) {
  if (!isEditableScope(alias.scope)) {
    return;
  }
  const name = (await askName(gitAliases, `Edit Git Alias: ${alias.name}`, alias.name, alias))?.trim();
  if (!name) {
    return;
  }
  const expansion = (await askExpansion(`Edit Git Alias: git ${name}`, alias.expansion))?.trim();
  if (!expansion) {
    return;
  }
  // Sama zmiana wielkości liter to ten sam klucz - bez usuwania starego
  const renamed = name.toLowerCase() !== alias.name.toLowerCase();
  if (renamed && !(await confirmReplace(gitAliases, name, alias))) {
    return;
  }
  if (name === alias.name && expansion === alias.expansion) {
    return;
  }
  await gitAliases.set(alias.scope, name, expansion);
  if (renamed) {
    await gitAliases.unset(alias.scope, alias.name);
  }
}

async function deleteAlias(gitAliases: GitAliases, alias: GitAlias) {
  if (!isEditableScope(alias.scope)) {
    return;
  }
  const answer = await vscode.window.showWarningMessage(
    `Delete alias "${alias.name}" (${alias.expansion})?`,
    { modal: true },
    "Delete"
  );
  if (answer === "Delete") {
    await gitAliases.unset(alias.scope, alias.name);
  }
}

async function openConfigFile(alias: GitAlias) {
  if (alias.file) {
    await vscode.window.showTextDocument(vscode.Uri.file(alias.file));
  }
}

// Wykonuje akcję i wraca do listy, żeby było widać efekt
async function runAndReturn(gitAliases: GitAliases, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    vscode.window.showErrorMessage(
      `Git alias: ${error instanceof Error ? error.message : error}`
    );
  }
  showGitAliases(gitAliases);
}

// Lista aliasów gita: podgląd, dodawanie, edycja i usuwanie
export function showGitAliases(gitAliases: GitAliases) {
  const picker = vscode.window.createQuickPick<AliasItem>();
  picker.title = "Git Aliases";
  picker.placeholder = "Select an alias to edit it, or type to filter";
  picker.matchOnDescription = true;
  picker.items = buildItems(gitAliases.all);
  picker.busy = true;

  let open = true;
  gitAliases.refresh().then(() => {
    if (!open) {
      return;
    }
    picker.items = buildItems(gitAliases.all);
    picker.busy = false;
  });

  picker.onDidAccept(() => {
    const item = picker.selectedItems[0];
    if (!item) {
      return;
    }
    picker.hide();
    if (item.add) {
      runAndReturn(gitAliases, () => addAlias(gitAliases));
    } else if (item.alias && isEditableScope(item.alias.scope)) {
      const alias = item.alias;
      runAndReturn(gitAliases, () => editAlias(gitAliases, alias));
    } else if (item.alias) {
      openConfigFile(item.alias);
    }
  });

  picker.onDidTriggerItemButton((e) => {
    const alias = e.item.alias;
    if (!alias) {
      return;
    }
    picker.hide();
    if (e.button === editButton) {
      runAndReturn(gitAliases, () => editAlias(gitAliases, alias));
    } else if (e.button === deleteButton) {
      runAndReturn(gitAliases, () => deleteAlias(gitAliases, alias));
    } else if (e.button === openFileButton) {
      openConfigFile(alias);
    }
  });

  picker.onDidHide(() => {
    open = false;
    picker.dispose();
  });

  picker.show();
}

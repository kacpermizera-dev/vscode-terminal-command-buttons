import * as path from "path";
import * as vscode from "vscode";
import { CommandButton } from "./buttons";
import { Runner } from "./runner";
import { ButtonInput, listVariables, substitute } from "./variables";

// Ostatnie wartości pytań: "<id przycisku>:<id inputu>" -> wartość
const LAST_VALUES_KEY = "inputValues";

function activeFileUri(): vscode.Uri | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri;
  return uri?.scheme === "file" ? uri : undefined;
}

function activeFolder(): vscode.WorkspaceFolder | undefined {
  const uri = activeFileUri();
  return (
    (uri && vscode.workspace.getWorkspaceFolder(uri)) ??
    vscode.workspace.workspaceFolders?.[0]
  );
}

// undefined = zmienna nie ma teraz wartości (np. ${file} bez otwartego pliku)
function resolveBuiltin(name: string): string | undefined {
  if (name.startsWith("env:")) {
    return process.env[name.slice("env:".length)] ?? "";
  }
  const editor = vscode.window.activeTextEditor;
  const file = activeFileUri()?.fsPath;
  switch (name) {
    case "workspaceFolder":
      return activeFolder()?.uri.fsPath;
    case "workspaceFolderBasename":
      return activeFolder()?.name;
    case "file":
      return file;
    case "fileBasename":
      return file && path.basename(file);
    case "fileBasenameNoExtension":
      return file && path.parse(file).name;
    case "fileExtname":
      return file && path.extname(file);
    case "fileDirname":
      return file && path.dirname(file);
    case "relativeFile":
      return file && vscode.workspace.asRelativePath(file, false);
    case "selectedText":
      return editor ? editor.document.getText(editor.selection) : undefined;
    case "lineNumber":
      return editor ? String(editor.selection.active.line + 1) : undefined;
  }
  return undefined;
}

function needs(name: string): string {
  return name === "workspaceFolder" || name === "workspaceFolderBasename"
    ? "an open folder"
    : "an open file";
}

async function askInput(
  button: CommandButton,
  input: ButtonInput,
  last: string | undefined
): Promise<string | undefined> {
  const title = `${button.name}: ${input.description ?? input.id}`;
  const preferred = last ?? input.default;

  if (input.type === "pickString" && input.options && input.options.length > 0) {
    // Ostatnio wybrana (albo domyślna) opcja na górze listy
    const options = preferred && input.options.includes(preferred)
      ? [preferred, ...input.options.filter((o) => o !== preferred)]
      : input.options;
    const picked = await vscode.window.showQuickPick(
      options.map((option) => ({
        label: option,
        description:
          option === last ? "last used" : option === input.default ? "default" : undefined,
      })),
      { title, placeHolder: `Pick ${input.id}`, ignoreFocusOut: true }
    );
    return picked?.label;
  }

  return vscode.window.showInputBox({
    title,
    prompt: `Value for \${input:${input.id}}`,
    value: input.password ? input.default : preferred,
    password: input.password,
    ignoreFocusOut: true,
  });
}

// Komenda z podstawionymi zmiennymi; undefined = użytkownik anulował albo brak wartości
export async function resolveCommand(
  button: CommandButton,
  memory: vscode.Memento
): Promise<string | undefined> {
  const names = listVariables(button.command);
  if (names.length === 0) {
    return button.command;
  }

  const lastValues = { ...memory.get<Record<string, string>>(LAST_VALUES_KEY, {}) };
  const values: Record<string, string> = {};

  for (const name of names) {
    if (name.startsWith("input:")) {
      const id = name.slice("input:".length);
      const input = button.inputs?.find((i) => i.id === id) ?? { id };
      const key = `${button.id}:${id}`;
      const value = await askInput(button, input, lastValues[key]);
      if (value === undefined) {
        return undefined;
      }
      values[name] = value;
      if (!input.password) {
        lastValues[key] = value;
      }
    } else {
      const value = resolveBuiltin(name);
      if (value === undefined) {
        vscode.window.showErrorMessage(
          `${button.name}: \${${name}} needs ${needs(name)}.`
        );
        return undefined;
      }
      values[name] = value;
    }
  }

  await memory.update(LAST_VALUES_KEY, lastValues);
  return substitute(button.command, values);
}

// Uruchomienie przycisku: pytania o zmienne, potem terminal przycisku albo aktywny
export async function runButton(
  runner: Runner,
  button: CommandButton,
  memory: vscode.Memento
) {
  const command = await resolveCommand(button, memory);
  if (command !== undefined) {
    await runner.run(command, { key: button.id, terminal: button.terminal });
  }
}

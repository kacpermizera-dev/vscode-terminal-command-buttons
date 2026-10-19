import { exec } from "child_process";
import * as path from "path";
import * as vscode from "vscode";
import { CommandButton } from "./buttons";
import { Runner, confirmRun } from "./runner";
import {
  ButtonInput,
  listVariables,
  parseOptionLines,
  substitute,
} from "./variables";

// Limit czasu dla komendy, która podaje opcje listy
const OPTIONS_TIMEOUT_MS = 5000;

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

// Opcje listy z wyniku komendy shella, uruchomionej w folderze workspace
function optionsFromCommand(command: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: activeFolder()?.uri.fsPath,
        timeout: OPTIONS_TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
        } else {
          resolve(parseOptionLines(stdout));
        }
      }
    );
  });
}

async function pickOption(
  title: string,
  input: ButtonInput,
  last: string | undefined,
  loadOptions: Promise<string[]> | string[]
): Promise<string | undefined> {
  const preferred = last ?? input.default;
  const picker = vscode.window.createQuickPick();
  picker.title = title;
  picker.placeholder = `Pick ${input.id}`;
  picker.ignoreFocusOut = true;
  picker.busy = true;
  picker.show();

  let options: string[];
  try {
    options = await loadOptions;
  } catch (error) {
    picker.dispose();
    vscode.window.showErrorMessage(
      `${title}: the command for the options failed: ${error instanceof Error ? error.message : error}`
    );
    return undefined;
  }
  if (options.length === 0) {
    picker.dispose();
    vscode.window.showWarningMessage(`${title}: no options to pick from.`);
    return undefined;
  }

  // Ostatnio wybrana (albo domyślna) opcja na górze listy
  const ordered = preferred && options.includes(preferred)
    ? [preferred, ...options.filter((o) => o !== preferred)]
    : options;
  picker.items = ordered.map((option) => ({
    label: option,
    description:
      option === last ? "last used" : option === input.default ? "default" : undefined,
  }));
  picker.busy = false;

  return new Promise((resolve) => {
    picker.onDidAccept(() => {
      resolve(picker.selectedItems[0]?.label);
      picker.hide();
    });
    picker.onDidHide(() => {
      resolve(undefined);
      picker.dispose();
    });
  });
}

async function askInput(
  button: CommandButton,
  input: ButtonInput,
  last: string | undefined
): Promise<string | undefined> {
  const title = `${button.name}: ${input.description ?? input.id}`;
  const preferred = last ?? input.default;

  if (input.type === "pickString" && input.optionsFrom) {
    return pickOption(title, input, last, optionsFromCommand(input.optionsFrom));
  }
  if (input.type === "pickString" && input.options && input.options.length > 0) {
    return pickOption(title, input, last, input.options);
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

// Uruchomienie przycisku: pytania o zmienne, potwierdzenie, potem terminal przycisku albo aktywny
export async function runButton(
  runner: Runner,
  button: CommandButton,
  memory: vscode.Memento
) {
  const command = await resolveCommand(button, memory);
  if (command === undefined) {
    return;
  }
  if (button.confirm && !(await confirmRun(button.name, command))) {
    return;
  }
  await runner.run(command, {
    key: button.id,
    terminal: button.terminal,
    ...(button.confirm ? { confirm: button.name } : {}),
  });
}

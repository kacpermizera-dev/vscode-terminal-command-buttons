import { exec } from "child_process";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { CommandButton } from "./buttons";
import { PreparedCommand, Runner } from "./runner";
import { ShellKind, quoteForShell } from "./shellQuote";
import {
  ButtonInput,
  listVariables,
  parseOptionLines,
  substitute,
} from "./variables";

const OPTIONS_TIMEOUT_MS = 5000;

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

function optionsFromCommand(command: string, signal: AbortSignal): Promise<string[]> {
  const trusted = vscode.workspace.isTrusted;
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd: trusted ? activeFolder()?.uri.fsPath : os.homedir(),
        env: trusted ? process.env : { ...process.env, NoDefaultCurrentDirectoryInExePath: "1" },
        timeout: OPTIONS_TIMEOUT_MS,
        windowsHide: true,
        signal,
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

function pickOption(
  title: string,
  input: ButtonInput,
  last: string | undefined,
  loadOptions: (signal: AbortSignal) => Promise<string[]> | string[]
): Promise<string | undefined> {
  const preferred = last ?? input.default;
  const picker = vscode.window.createQuickPick();
  picker.title = title;
  picker.placeholder = `Pick ${input.id}`;
  picker.ignoreFocusOut = true;
  picker.busy = true;

  const abort = new AbortController();
  let hidden = false;

  return new Promise((resolve) => {
    picker.onDidAccept(() => {
      const picked = picker.selectedItems[0]?.label;
      if (picked !== undefined) {
        resolve(picked);
        picker.hide();
      }
    });
    picker.onDidHide(() => {
      hidden = true;
      abort.abort();
      resolve(undefined);
      picker.dispose();
    });
    picker.show();

    Promise.resolve()
      .then(() => loadOptions(abort.signal))
      .then(
        (options) => {
          if (hidden) {
            return;
          }
          if (options.length === 0) {
            vscode.window.showWarningMessage(`${title}: no options to pick from.`);
            picker.hide();
            return;
          }
          const ordered = preferred && options.includes(preferred)
            ? [preferred, ...options.filter((o) => o !== preferred)]
            : options;
          picker.items = ordered.map((option) => ({
            label: option,
            description:
              option === last ? "last used" : option === input.default ? "default" : undefined,
          }));
          picker.busy = false;
        },
        (error) => {
          if (hidden) {
            return;
          }
          vscode.window.showErrorMessage(
            `${title}: the command for the options failed: ${error instanceof Error ? error.message : error}`
          );
          picker.hide();
        }
      );
  });
}

async function askInput(
  button: CommandButton,
  input: ButtonInput,
  last: string | undefined
): Promise<string | undefined> {
  const title = `${button.name}: ${input.description ?? input.id}`;
  const preferred = last ?? input.default;

  const optionsFrom = input.optionsFrom;
  if (input.type === "pickString" && optionsFrom) {
    return pickOption(title, input, last, (signal) => optionsFromCommand(optionsFrom, signal));
  }
  const options = input.options;
  if (input.type === "pickString" && options && options.length > 0) {
    return pickOption(title, input, last, () => options);
  }

  return vscode.window.showInputBox({
    title,
    prompt: `Value for \${input:${input.id}}`,
    value: input.password ? input.default : preferred,
    password: input.password,
    ignoreFocusOut: true,
  });
}

function isTypedInput(button: CommandButton, name: string): boolean {
  if (!name.startsWith("input:")) {
    return false;
  }
  const id = name.slice("input:".length);
  const input = button.inputs?.find((i) => i.id === id);
  return !(input?.type === "pickString" && input.optionsFrom);
}

export async function resolveCommand(
  button: CommandButton,
  memory: vscode.Memento
): Promise<PreparedCommand | undefined> {
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

  return (shell: ShellKind) => {
    let unsafe: string | undefined;
    const command = substitute(button.command, values, (name, value, offset) => {
      if (isTypedInput(button, name)) {
        return value;
      }
      const quoted = quoteForShell(button.command, offset, value, shell);
      if (quoted === undefined) {
        unsafe ??= name;
        return value;
      }
      return quoted;
    });
    if (unsafe) {
      vscode.window.showErrorMessage(
        `${button.name}: the value of \${${unsafe}} cannot be passed safely to this terminal's shell here (in cmd.exe: ", % or a line break; elsewhere: inside backticks, $'…' or \${…}, or an unknown shell). Run it in bash, PowerShell or Git Bash, or move the variable out of that construct.`
      );
      return undefined;
    }
    return command;
  };
}

export async function runButton(
  runner: Runner,
  button: CommandButton,
  memory: vscode.Memento
) {
  const command = await resolveCommand(button, memory);
  if (command === undefined) {
    return;
  }
  await runner.run(command, {
    key: button.id,
    terminal: button.terminal,
    ...(button.confirm ? { confirm: button.name } : {}),
  });
}

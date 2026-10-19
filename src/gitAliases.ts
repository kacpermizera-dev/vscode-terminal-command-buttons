import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";

// Zakresy, do których zapisujemy; pozostałe (system, worktree, command) tylko do podglądu
export type EditableScope = "global" | "local";

export interface GitAlias {
  name: string;
  expansion: string;
  // Alias zaczynający się od "!" uruchamia komendę shella, nie podkomendę gita
  shell: boolean;
  // Zakres z --show-scope: global, local, system, worktree, command
  scope: string;
  // Plik konfiguracji z --show-origin, jeśli alias pochodzi z pliku
  file?: string;
}

export function isEditableScope(scope: string): scope is EditableScope {
  return scope === "global" || scope === "local";
}

// Nazwa zmiennej w git config: litera, potem litery, cyfry i myślniki
export function isValidAliasName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9-]*$/.test(name);
}

// Wyjście `git config -z --show-scope --show-origin --get-regexp`:
// trójki zakres NUL źródło NUL klucz\nwartość NUL
export function parseGitAliases(output: string): GitAlias[] {
  const byName = new Map<string, GitAlias>();
  const tokens = output.split("\0");
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    const [scope, origin, entry] = tokens.slice(i, i + 3);
    const newline = entry.indexOf("\n");
    if (newline < 0) {
      continue;
    }
    const key = entry.slice(0, newline);
    if (!key.toLowerCase().startsWith("alias.")) {
      continue;
    }
    const name = key.slice("alias.".length);
    const expansion = entry.slice(newline + 1).trim();
    if (!name || !expansion) {
      continue;
    }
    // Późniejszy wpis (np. z .git/config repo) wygrywa z globalnym, tak jak w gicie
    byName.set(name.toLowerCase(), {
      name,
      expansion,
      shell: expansion.startsWith("!"),
      scope,
      ...(origin.startsWith("file:") ? { file: origin.slice("file:".length) } : {}),
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Alias wywoływany przez komendę przycisku, np. "git lg -5" -> lg
export function findAliasForCommand(
  command: string,
  aliases: GitAlias[]
): GitAlias | undefined {
  const match = /^\s*git\s+([^\s-]\S*)/.exec(command);
  if (!match) {
    return undefined;
  }
  const name = match[1].toLowerCase();
  return aliases.find((a) => a.name.toLowerCase() === name);
}

interface GitResult {
  stdout: string;
  // undefined = sukces
  code?: number | string;
  stderr: string;
}

function git(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      { cwd, timeout: 3000, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({ stdout, stderr: stderr.trim(), code: error?.code ?? undefined });
      }
    );
  });
}

// undefined = git się nie uruchomił (brak w PATH, zły katalog), [] = brak aliasów
async function readGitAliases(cwd: string): Promise<GitAlias[] | undefined> {
  const result = await git(
    ["config", "-z", "--show-scope", "--show-origin", "--get-regexp", "^alias\\."],
    cwd
  );
  if (result.code === undefined) {
    return parseGitAliases(result.stdout);
  }
  // Kod 1 = żaden klucz nie pasuje
  if (result.code === 1) {
    return [];
  }
  console.error(`Failed to read git aliases in ${cwd}:`, result.stderr || result.code);
  return undefined;
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

// Katalogi do odczytu aliasów, od najlepszego. Git Bash potrafi zgłosić cwd
// w formie /c/Users/..., które nie jest ścieżką Windows - takie pomijamy.
// W nieufnym workspace tylko aliasy globalne: lokalny .git/config pochodzi z repo.
function lookupDirs(): string[] {
  const dirs: string[] = [];
  if (vscode.workspace.isTrusted) {
    const cwd = vscode.window.activeTerminal?.shellIntegration?.cwd;
    if (cwd?.scheme === "file") {
      dirs.push(cwd.fsPath);
    }
    vscode.workspace.workspaceFolders?.forEach((folder) => {
      if (folder.uri.scheme === "file") {
        dirs.push(folder.uri.fsPath);
      }
    });
  }
  dirs.push(os.homedir());
  return dirs.filter(isDirectory);
}

// Lista aliasów odświeżana na żądanie (otwarcie listy, pokazanie widoku) i zapis zmian
export class GitAliases implements vscode.Disposable {
  private _aliases: GitAlias[] = [];
  // Katalog, z którego przeczytano aliasy - w nim zapisujemy aliasy repozytorium
  private _dir = os.homedir();
  private _inRepo = false;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  public get all(): GitAlias[] {
    return this._aliases;
  }

  // Czy można zapisać alias do .git/config (zaufany workspace wewnątrz repozytorium)
  public get canEditLocal(): boolean {
    return this._inRepo;
  }

  public async refresh() {
    let next: GitAlias[] = [];
    for (const dir of lookupDirs()) {
      const aliases = await readGitAliases(dir);
      if (aliases) {
        next = aliases;
        this._dir = dir;
        break;
      }
    }

    this._inRepo =
      vscode.workspace.isTrusted &&
      (await git(["rev-parse", "--is-inside-work-tree"], this._dir)).stdout.trim() === "true";

    if (JSON.stringify(next) !== JSON.stringify(this._aliases)) {
      this._aliases = next;
      this._onDidChange.fire();
    }
  }

  public async set(scope: EditableScope, name: string, expansion: string) {
    await this._write(scope, ["--replace-all", `alias.${name}`, expansion]);
  }

  public async unset(scope: EditableScope, name: string) {
    await this._write(scope, ["--unset-all", `alias.${name}`]);
  }

  public dispose() {
    this._onDidChange.dispose();
  }

  private async _write(scope: EditableScope, args: string[]) {
    if (scope === "local" && !this._inRepo) {
      throw new Error("Not inside a trusted git repository.");
    }
    const result = await git(["config", `--${scope}`, ...args], this._dir);
    if (result.code !== undefined) {
      throw new Error(result.stderr || `git config exited with ${result.code}`);
    }
    await this.refresh();
  }
}

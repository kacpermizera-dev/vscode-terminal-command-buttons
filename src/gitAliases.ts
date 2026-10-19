import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export type EditableScope = "global" | "local";

export interface GitAlias {
  name: string;
  expansion: string;
  shell: boolean;
  scope: string;
  file?: string;
}

export function isEditableScope(scope: string): scope is EditableScope {
  return scope === "global" || scope === "local";
}

export function isValidAliasName(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9-]*$/.test(name);
}

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
  code?: number | string;
  stderr: string;
}

interface GitExtensionApi {
  getAPI(version: 1): { git: { path: string } };
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(file)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

function gitFromExtension(): string | undefined {
  try {
    const extension = vscode.extensions.getExtension<GitExtensionApi>("vscode.git");
    const gitPath = extension?.isActive ? extension.exports.getAPI(1).git.path : undefined;
    return gitPath && path.isAbsolute(gitPath) ? gitPath : undefined;
  } catch {
    return undefined;
  }
}

async function findGitInPath(): Promise<string | undefined> {
  const name = process.platform === "win32" ? "git.exe" : "git";
  for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
    const dir = entry.replace(/^"(.*)"$/, "$1");
    if (!dir || !path.isAbsolute(dir)) {
      continue;
    }
    const candidate = path.join(dir, name);
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

let pathGit: Promise<string | undefined> | undefined;

function findGit(): Promise<string | undefined> {
  const fromExtension = gitFromExtension();
  if (fromExtension) {
    return Promise.resolve(fromExtension);
  }
  pathGit ??= findGitInPath().then((found) => {
    if (!found) {
      pathGit = undefined;
    }
    return found;
  });
  return pathGit;
}

function git(args: string[], cwd: string): Promise<GitResult> {
  return findGit().then(
    (file) =>
      new Promise((resolve) => {
        if (!file) {
          resolve({ stdout: "", stderr: "Git was not found in PATH.", code: "ENOENT" });
          return;
        }
        execFile(
          file,
          args,
          { cwd, timeout: 3000, windowsHide: true },
          (error, stdout, stderr) => {
            resolve({ stdout, stderr: stderr.trim(), code: error?.code ?? undefined });
          }
        );
      })
  );
}

async function readGitAliases(cwd: string): Promise<GitAlias[] | undefined> {
  const result = await git(
    ["config", "-z", "--show-scope", "--show-origin", "--get-regexp", "^alias\\."],
    cwd
  );
  if (result.code === undefined) {
    return parseGitAliases(result.stdout);
  }
  if (result.code === 1) {
    return [];
  }
  console.error(`Failed to read git aliases in ${cwd}:`, result.stderr || result.code);
  return undefined;
}

async function lookupDirs(): Promise<string[]> {
  const dirs: string[] = [];
  if (vscode.workspace.isTrusted) {
    const cwd = vscode.window.activeTerminal?.shellIntegration?.cwd;
    if (cwd?.scheme === "file" && vscode.workspace.getWorkspaceFolder(cwd)) {
      dirs.push(cwd.fsPath);
    }
    vscode.workspace.workspaceFolders?.forEach((folder) => {
      if (folder.uri.scheme === "file") {
        dirs.push(folder.uri.fsPath);
      }
    });
  }
  dirs.push(os.homedir());
  const exists = await Promise.all(dirs.map(isDirectory));
  return dirs.filter((_dir, i) => exists[i]);
}

interface Snapshot {
  aliases: GitAlias[];
  dir: string;
  inRepo: boolean;
}

async function load(): Promise<Snapshot> {
  let aliases: GitAlias[] = [];
  let dir = os.homedir();
  for (const candidate of await lookupDirs()) {
    const found = await readGitAliases(candidate);
    if (found) {
      aliases = found;
      dir = candidate;
      break;
    }
  }

  let inRepo = false;
  let toplevel: string | undefined;
  if (vscode.workspace.isTrusted) {
    const lines = (await git(["rev-parse", "--is-inside-work-tree", "--show-toplevel"], dir))
      .stdout.split(/\r?\n/);
    inRepo = lines[0]?.trim() === "true";
    toplevel = inRepo ? lines[1]?.trim() || undefined : undefined;
  }

  const base = toplevel ?? dir;
  aliases = aliases.map((alias) =>
    alias.file && !path.isAbsolute(alias.file)
      ? { ...alias, file: path.resolve(base, alias.file) }
      : alias
  );
  return { aliases, dir, inRepo };
}

export class GitAliases implements vscode.Disposable {
  private _aliases: GitAlias[] = [];
  private _dir = os.homedir();
  private _inRepo = false;
  private _running?: Promise<void>;
  private _queued?: Promise<void>;

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  public get all(): GitAlias[] {
    return this._aliases;
  }

  public get canEditLocal(): boolean {
    return this._inRepo;
  }

  public refresh(): Promise<void> {
    if (this._running) {
      this._queued ??= this._running.then(() => {
        this._queued = undefined;
        return this.refresh();
      });
      return this._queued;
    }
    this._running = this._refresh().finally(() => {
      this._running = undefined;
    });
    return this._running;
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

  private async _refresh() {
    try {
      const snapshot = await load();
      this._dir = snapshot.dir;
      this._inRepo = snapshot.inRepo;
      if (JSON.stringify(snapshot.aliases) !== JSON.stringify(this._aliases)) {
        this._aliases = snapshot.aliases;
        this._onDidChange.fire();
      }
    } catch (error) {
      console.error("Failed to refresh git aliases:", error);
    }
  }

  private async _write(scope: EditableScope, args: string[]) {
    await (this._queued ?? this._running);
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

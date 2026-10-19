import * as vscode from "vscode";
import { CONFIG_SECTION } from "./buttons";
import { RunStatus, isSameCommand } from "./runStatus";
import { ShellKind, shellKindOf } from "./shellQuote";

const START_TIMEOUT_MS = 10000;
const STOP_TIMEOUT_MS = 3000;

export type PreparedCommand = string | ((shell: ShellKind) => string | undefined);

export interface RunOptions {
  key?: string;
  terminal?: string;
  confirm?: string;
}

async function confirmRun(name: string, command: string): Promise<boolean> {
  const answer = await vscode.window.showWarningMessage(
    `Run "${name}"?`,
    { modal: true, detail: command },
    "Run"
  );
  return answer === "Run";
}

interface LastRun {
  command: PreparedCommand;
  options: RunOptions;
}

interface PendingRun {
  terminal: vscode.Terminal;
  key: string;
  command: string;
  status: RunStatus;
  timer: ReturnType<typeof setTimeout>;
}

interface TrackedExecution {
  terminal: vscode.Terminal;
  key: string;
  status: RunStatus;
}

function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeoutMs: number
): Promise<vscode.TerminalShellIntegration | undefined> {
  if (terminal.shellIntegration) {
    return Promise.resolve(terminal.shellIntegration);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      listener.dispose();
      resolve(undefined);
    }, timeoutMs);

    const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
      if (e.terminal === terminal) {
        clearTimeout(timeout);
        listener.dispose();
        resolve(e.shellIntegration);
      }
    });
  });
}

export class Runner implements vscode.Disposable {
  private readonly _statuses = new Map<string, RunStatus>();
  private readonly _executions = new Map<
    vscode.TerminalShellExecution,
    TrackedExecution
  >();
  private _pending: PendingRun[] = [];
  private _last?: LastRun;
  private readonly _lastByKey = new Map<string, LastRun>();
  private readonly _terminalByKey = new Map<string, vscode.Terminal>();

  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  private readonly _disposables: vscode.Disposable[] = [this._onDidChange];

  constructor() {
    this._disposables.push(
      vscode.window.onDidStartTerminalShellExecution((e) => this._onStart(e)),
      vscode.window.onDidEndTerminalShellExecution((e) => this._onEnd(e)),
      vscode.window.onDidCloseTerminal((t) => this._onClose(t))
    );
  }

  public getStatus(key: string): RunStatus | undefined {
    return this._statuses.get(key);
  }

  public getStatuses(): Record<string, RunStatus> {
    return Object.fromEntries(this._statuses);
  }

  public isRunning(key: string): boolean {
    return this._statuses.get(key)?.state === "running";
  }

  public run(prepared: PreparedCommand, options: RunOptions = {}): Promise<void> {
    return this._run(prepared, options, false);
  }

  private async _run(prepared: PreparedCommand, options: RunOptions, confirmed: boolean) {
    const existing = this._findTerminal(options.terminal);
    const command =
      typeof prepared === "string" ? prepared : prepared(this._shellKindOf(existing));
    if (command === undefined) {
      return;
    }
    if (options.confirm && !confirmed && !(await confirmRun(options.confirm, command))) {
      return;
    }

    const key = options.key ?? command;
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const text =
      process.platform === "win32" &&
      config.get<boolean>("windowsLeadingSpace", true)
        ? ` ${command}`
        : command;

    const terminal =
      existing && existing.exitStatus === undefined
        ? existing
        : await this._getTerminal(options.terminal);

    terminal.show(true);

    terminal.sendText(text, true);

    this._last = { command: prepared, options };
    this._lastByKey.set(key, this._last);
    vscode.commands.executeCommand(
      "setContext",
      "terminalCommandButtons.hasLast",
      true
    );

    if (terminal.shellIntegration) {
      const status: RunStatus = { state: "running", startedAt: Date.now() };
      const pending: PendingRun = {
        terminal,
        key,
        command,
        status,
        timer: setTimeout(() => {
          this._pending = this._pending.filter((p) => p !== pending);
          this._finish(key, status, "unknown");
        }, START_TIMEOUT_MS),
      };
      this._pending.push(pending);
      this._terminalByKey.set(key, terminal);
      this._setStatus(key, status);
    } else {
      const now = Date.now();
      this._setStatus(key, {
        state: "unknown",
        startedAt: now,
        endedAt: now,
      });
    }
  }

  public async rerunLast() {
    const last = this._last;
    if (last) {
      await this.run(last.command, last.options);
    }
  }

  public stop(key: string) {
    const terminal = this._terminalByKey.get(key);
    if (terminal && this.isRunning(key)) {
      terminal.sendText("\x03", false);
    }
  }

  public async restart(key: string) {
    const last = this._lastByKey.get(key);
    if (!last) {
      return;
    }
    if (last.options.confirm) {
      const command =
        typeof last.command === "string"
          ? last.command
          : last.command(this._shellKindOf(this._findTerminal(last.options.terminal)));
      if (command === undefined || !(await confirmRun(last.options.confirm, command))) {
        return;
      }
    }
    if (this.isRunning(key)) {
      this.stop(key);
      await this._waitUntilStopped(key);
    }
    await this._run(last.command, last.options, true);
  }

  public dispose() {
    this._pending.forEach((p) => clearTimeout(p.timer));
    this._disposables.forEach((d) => d.dispose());
  }

  private _shellKindOf(terminal: vscode.Terminal | undefined): ShellKind {
    const options = terminal?.creationOptions;
    const shellPath = options && "shellPath" in options ? options.shellPath : undefined;
    return shellKindOf(terminal?.state.shell, shellPath ?? vscode.env.shell);
  }

  private _findTerminal(name: string | undefined): vscode.Terminal | undefined {
    if (name) {
      return vscode.window.terminals.find(
        (t) => t.name === name && t.exitStatus === undefined
      );
    }
    return vscode.window.activeTerminal;
  }

  private async _getTerminal(name: string | undefined): Promise<vscode.Terminal> {
    const existing = this._findTerminal(name);
    if (existing) {
      return existing;
    }
    if (name) {
      const created = vscode.window.createTerminal({
        name,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri,
      });
      await waitForShellIntegration(created, 3000);
      return created;
    }

    const created = vscode.window.createTerminal("Command Terminal");
    await waitForShellIntegration(created, 3000);
    return created;
  }

  private _waitUntilStopped(key: string): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        listener.dispose();
        resolve();
      };
      const timer = setTimeout(done, STOP_TIMEOUT_MS);
      const listener = this.onDidChange(() => {
        if (!this.isRunning(key)) {
          done();
        }
      });
    });
  }

  private _onStart(e: vscode.TerminalShellExecutionStartEvent) {
    const { value, confidence } = e.execution.commandLine;
    const pending = this._pending.find(
      (p) =>
        p.terminal === e.terminal &&
        (!value ||
          confidence === vscode.TerminalShellExecutionCommandLineConfidence.Low ||
          isSameCommand(value, p.command))
    );
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this._pending = this._pending.filter((p) => p !== pending);
    this._executions.set(e.execution, pending);
    pending.status.startedAt = Date.now();
    this._onDidChange.fire();
  }

  private _onEnd(e: vscode.TerminalShellExecutionEndEvent) {
    const tracked = this._executions.get(e.execution);
    if (!tracked) {
      return;
    }
    this._executions.delete(e.execution);

    if (e.exitCode === undefined) {
      this._finish(tracked.key, tracked.status, "unknown");
    } else {
      this._finish(
        tracked.key,
        tracked.status,
        e.exitCode === 0 ? "success" : "error",
        e.exitCode
      );
    }
  }

  private _onClose(terminal: vscode.Terminal) {
    this._pending
      .filter((p) => p.terminal === terminal)
      .forEach((p) => {
        clearTimeout(p.timer);
        this._finish(p.key, p.status, "unknown");
      });
    this._pending = this._pending.filter((p) => p.terminal !== terminal);

    this._executions.forEach((tracked, execution) => {
      if (tracked.terminal === terminal) {
        this._executions.delete(execution);
        this._finish(tracked.key, tracked.status, "unknown");
      }
    });

    this._terminalByKey.forEach((t, key) => {
      if (t === terminal) {
        this._terminalByKey.delete(key);
      }
    });
  }

  private _finish(
    key: string,
    status: RunStatus,
    state: RunStatus["state"],
    exitCode?: number
  ) {
    if (this._statuses.get(key) !== status) {
      return;
    }
    this._setStatus(key, {
      state,
      startedAt: status.startedAt,
      endedAt: Date.now(),
      ...(exitCode !== undefined ? { exitCode } : {}),
    });
  }

  private _setStatus(key: string, status: RunStatus) {
    this._statuses.set(key, status);
    this._onDidChange.fire();
  }
}

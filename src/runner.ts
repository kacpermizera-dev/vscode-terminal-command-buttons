import * as vscode from "vscode";
import { CONFIG_SECTION } from "./buttons";
import { RunStatus, isSameCommand } from "./runStatus";

// Ile czekamy, aż Shell Integration zgłosi start wysłanej komendy
const START_TIMEOUT_MS = 10000;
// Ile restart czeka na zakończenie komendy po Ctrl+C
const STOP_TIMEOUT_MS = 3000;

export interface RunOptions {
  // Klucz statusu: id przycisku; domyślnie tekst komendy
  key?: string;
  // Nazwany terminal tylko dla tego przycisku; brak = aktywny terminal
  terminal?: string;
}

interface LastRun {
  command: string;
  options: RunOptions;
}

// Komenda wysłana do terminala, na którą czekamy w onDidStartTerminalShellExecution
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

// Czeka na Shell Integration nowego terminala, po timeoucie zwraca undefined
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

// Uruchamia komendy w terminalu i śledzi ich status
export class Runner implements vscode.Disposable {
  private readonly _statuses = new Map<string, RunStatus>();
  private readonly _executions = new Map<
    vscode.TerminalShellExecution,
    TrackedExecution
  >();
  private _pending: PendingRun[] = [];
  // Ostatnie uruchomienie w ogóle i per klucz (do "Powtórz" i restartu)
  private _last?: LastRun;
  private readonly _lastByKey = new Map<string, LastRun>();
  // Terminal, w którym działa komenda danego klucza (do Stop)
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

  // Wykonanie komendy w terminalu przycisku albo w aktywnym
  public async run(command: string, options: RunOptions = {}) {
    const key = options.key ?? command;
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    // Obejście błędu VS Code + Git Bash na Windows (microsoft/vscode#275625):
    // przed tekstem trafia do shella zbłąkany ESC i readline łączy go z pierwszym
    // znakiem w skrót Meta (ESC g -> "it status"). ESC + spacja jest nieszkodliwe.
    const text =
      process.platform === "win32" &&
      config.get<boolean>("windowsLeadingSpace", true)
        ? ` ${command}`
        : command;

    const terminal = await this._getTerminal(options.terminal);

    // preserveFocus: fokus zostaje w widoku przycisków
    terminal.show(true);

    // Zwykły sendText zamiast shellIntegration.executeCommand: executeCommand
    // opakowuje tekst w bracketed paste (ESC[200~), a zbłąkany ESC przed nim daje
    // w bashu ESC ESC = dopełnianie i komenda zostaje niewykonana.
    // Status i kod wyjścia bierzemy więc ze zdarzeń Shell Integration.
    terminal.sendText(text, true);

    this._last = { command, options };
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
          // Start nie przyszedł (np. terminal zajęty inną komendą) - wyniku nie poznamy
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

  // "Powtórz" uruchamia dokładnie tę samą komendę, z już podstawionymi zmiennymi
  public async rerunLast() {
    if (this._last) {
      await this.run(this._last.command, this._last.options);
    }
  }

  // Ctrl+C w terminalu, w którym działa komenda
  public stop(key: string) {
    const terminal = this._terminalByKey.get(key);
    if (terminal && this.isRunning(key)) {
      terminal.sendText("\x03", false);
    }
  }

  // Stop, poczekaj na koniec komendy (albo timeout), uruchom ponownie
  public async restart(key: string) {
    const last = this._lastByKey.get(key);
    if (!last) {
      return;
    }
    if (this.isRunning(key)) {
      this.stop(key);
      await this._waitUntilStopped(key);
    }
    await this.run(last.command, last.options);
  }

  public dispose() {
    this._pending.forEach((p) => clearTimeout(p.timer));
    this._disposables.forEach((d) => d.dispose());
  }

  private async _getTerminal(name: string | undefined): Promise<vscode.Terminal> {
    if (name) {
      const existing = vscode.window.terminals.find(
        (t) => t.name === name && t.exitStatus === undefined
      );
      if (existing) {
        return existing;
      }
      const created = vscode.window.createTerminal({
        name,
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri,
      });
      await waitForShellIntegration(created, 3000);
      return created;
    }

    const active = vscode.window.activeTerminal;
    if (active) {
      return active;
    }
    // Stwórz nowy terminal jeśli żaden nie jest aktywny i poczekaj, aż shell będzie gotowy
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
    // Przy niskiej pewności tekst linii bywa niepełny - wtedy wystarczy ten sam terminal
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

  // Aktualizuje status tylko, jeśli w międzyczasie nie wystartowało nowsze uruchomienie
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

import * as vscode from "vscode";
import { CONFIG_SECTION } from "./buttons";
import { RunStatus, isSameCommand } from "./runStatus";

// Ile czekamy, aż Shell Integration zgłosi start wysłanej komendy
const START_TIMEOUT_MS = 10000;

// Komenda wysłana do terminala, na którą czekamy w onDidStartTerminalShellExecution
interface PendingRun {
  terminal: vscode.Terminal;
  command: string;
  status: RunStatus;
  timer: ReturnType<typeof setTimeout>;
}

interface TrackedExecution {
  terminal: vscode.Terminal;
  command: string;
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

// Uruchamia komendy w terminalu i śledzi ich status (klucz: tekst komendy)
export class Runner implements vscode.Disposable {
  private readonly _statuses = new Map<string, RunStatus>();
  private readonly _executions = new Map<
    vscode.TerminalShellExecution,
    TrackedExecution
  >();
  private _pending: PendingRun[] = [];
  private _lastCommand?: string;

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

  public get lastCommand(): string | undefined {
    return this._lastCommand;
  }

  public getStatus(command: string): RunStatus | undefined {
    return this._statuses.get(command);
  }

  public getStatuses(): Record<string, RunStatus> {
    return Object.fromEntries(this._statuses);
  }

  // Wykonanie komendy w aktywnym terminalu
  public async run(command: string) {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

    // Obejście błędu VS Code + Git Bash na Windows (microsoft/vscode#275625):
    // przed tekstem trafia do shella zbłąkany ESC i readline łączy go z pierwszym
    // znakiem w skrót Meta (ESC g -> "it status"). ESC + spacja jest nieszkodliwe.
    const text =
      process.platform === "win32" &&
      config.get<boolean>("windowsLeadingSpace", true)
        ? ` ${command}`
        : command;

    let terminal = vscode.window.activeTerminal;

    if (!terminal) {
      // Stwórz nowy terminal jeśli żaden nie jest aktywny i poczekaj, aż shell będzie gotowy
      terminal = vscode.window.createTerminal("Command Terminal");
      await waitForShellIntegration(terminal, 3000);
    }

    // preserveFocus: fokus zostaje w widoku przycisków
    terminal.show(true);

    // Zwykły sendText zamiast shellIntegration.executeCommand: executeCommand
    // opakowuje tekst w bracketed paste (ESC[200~), a zbłąkany ESC przed nim daje
    // w bashu ESC ESC = dopełnianie i komenda zostaje niewykonana.
    // Status i kod wyjścia bierzemy więc ze zdarzeń Shell Integration.
    terminal.sendText(text, true);

    this._lastCommand = command;
    vscode.commands.executeCommand(
      "setContext",
      "terminalCommandButtons.hasLast",
      true
    );

    if (terminal.shellIntegration) {
      const status: RunStatus = { state: "running", startedAt: Date.now() };
      const pending: PendingRun = {
        terminal,
        command,
        status,
        timer: setTimeout(() => {
          // Start nie przyszedł (np. terminal zajęty inną komendą) - wyniku nie poznamy
          this._pending = this._pending.filter((p) => p !== pending);
          this._finish(command, status, "unknown");
        }, START_TIMEOUT_MS),
      };
      this._pending.push(pending);
      this._setStatus(command, status);
    } else {
      const now = Date.now();
      this._setStatus(command, {
        state: "unknown",
        startedAt: now,
        endedAt: now,
      });
    }
  }

  public async rerunLast() {
    if (this._lastCommand) {
      await this.run(this._lastCommand);
    }
  }

  public dispose() {
    this._pending.forEach((p) => clearTimeout(p.timer));
    this._disposables.forEach((d) => d.dispose());
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
      this._finish(tracked.command, tracked.status, "unknown");
    } else {
      this._finish(
        tracked.command,
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
        this._finish(p.command, p.status, "unknown");
      });
    this._pending = this._pending.filter((p) => p.terminal !== terminal);

    this._executions.forEach((tracked, execution) => {
      if (tracked.terminal === terminal) {
        this._executions.delete(execution);
        this._finish(tracked.command, tracked.status, "unknown");
      }
    });
  }

  // Aktualizuje status tylko, jeśli w międzyczasie nie wystartowało nowsze uruchomienie
  private _finish(
    command: string,
    status: RunStatus,
    state: RunStatus["state"],
    exitCode?: number
  ) {
    if (this._statuses.get(command) !== status) {
      return;
    }
    this._setStatus(command, {
      state,
      startedAt: status.startedAt,
      endedAt: Date.now(),
      ...(exitCode !== undefined ? { exitCode } : {}),
    });
  }

  private _setStatus(command: string, status: RunStatus) {
    this._statuses.set(command, status);
    this._onDidChange.fire();
  }
}

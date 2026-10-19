// Status ostatniego uruchomienia komendy. Bez importu vscode, żeby dało się testować.

// unknown: komenda wysłana, ale wyniku nie znamy (brak Shell Integration, np. cmd.exe)
export type RunState = "running" | "success" | "error" | "unknown";

export interface RunStatus {
  state: RunState;
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
}

// Linia z Shell Integration bywa poprzedzona spacją z obejścia Git Bash
// albo zbłąkanym znakiem sterującym, więc porównujemy wersje oczyszczone
export function normalizeCommandLine(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isSameCommand(commandLine: string, command: string): boolean {
  return normalizeCommandLine(commandLine) === normalizeCommandLine(command);
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
  }
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function formatAgo(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  if (seconds < 10) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}

// Jedna linia do dymka i Quick Picka, np. "Last run: failed (exit 1) · 0.4s · 2 min ago"
export function formatStatus(status: RunStatus, now: number): string {
  if (status.state === "running") {
    return `Running… ${formatDuration(now - status.startedAt)}`;
  }
  const ended = status.endedAt ?? status.startedAt;
  const ago = formatAgo(now - ended);
  if (status.state === "unknown") {
    return `Last run: sent, result unknown · ${ago}`;
  }
  const result =
    status.state === "success" ? "succeeded" : `failed (exit ${status.exitCode})`;
  return `Last run: ${result} · ${formatDuration(ended - status.startedAt)} · ${ago}`;
}

import * as vscode from "vscode";
import { ButtonStore } from "./buttons";
import { Runner } from "./runner";
import { formatStatus } from "./runStatus";

interface PinnedItem {
  item: vscode.StatusBarItem;
  priority: number;
}

function isIconName(value: string | undefined): value is string {
  return !!value && /^[a-z0-9-]+$/.test(value);
}

// Przyciski z "Show in status bar": ikona, nazwa i status ostatniego uruchomienia
export class PinnedButtons implements vscode.Disposable {
  private readonly _items = new Map<string, PinnedItem>();
  private readonly _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _store: ButtonStore,
    private readonly _runner: Runner
  ) {
    this._disposables.push(
      _store.onDidChange(() => this.update()),
      _runner.onDidChange(() => this.update())
    );
    this.update();
  }

  public update() {
    const pinned = this._store.getAll().filter((b) => b.pinned);
    const now = Date.now();

    this._items.forEach((pinnedItem, id) => {
      if (!pinned.some((b) => b.id === id)) {
        pinnedItem.item.dispose();
        this._items.delete(id);
      }
    });

    pinned.forEach((button, index) => {
      // Priorytetu nie da się zmienić po utworzeniu - przy zmianie kolejności tworzymy na nowo
      const priority = 100 - index;
      let pinnedItem = this._items.get(button.id);
      if (pinnedItem && pinnedItem.priority !== priority) {
        pinnedItem.item.dispose();
        pinnedItem = undefined;
      }
      if (!pinnedItem) {
        pinnedItem = {
          item: vscode.window.createStatusBarItem(
            `terminalCommandButtons.pinned.${button.id}`,
            vscode.StatusBarAlignment.Left,
            priority
          ),
          priority,
        };
        this._items.set(button.id, pinnedItem);
      }

      const { item } = pinnedItem;
      const status = this._runner.getStatus(button.id);
      const icon =
        status?.state === "running"
          ? "sync~spin"
          : isIconName(button.icon)
            ? button.icon
            : "play";
      item.name = `Command Button: ${button.name}`;
      item.text = `$(${icon}) ${button.name}`;
      item.tooltip = [button.command, status ? formatStatus(status, now) : undefined]
        .filter(Boolean)
        .join("\n");
      item.backgroundColor =
        status?.state === "error"
          ? new vscode.ThemeColor("statusBarItem.errorBackground")
          : undefined;
      item.command = {
        title: `Run ${button.name}`,
        command: "terminalCommandButtons.runButton",
        arguments: [{ buttonId: button.id }],
      };
      item.show();
    });
  }

  public dispose() {
    this._items.forEach((pinnedItem) => pinnedItem.item.dispose());
    this._items.clear();
    this._disposables.forEach((d) => d.dispose());
  }
}

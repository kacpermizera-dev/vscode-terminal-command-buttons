import * as vscode from "vscode";
import { showGitAliases } from "./aliasManager";
import { ButtonStore, CONFIG_SECTION, Layout } from "./buttons";
import { GitAliases } from "./gitAliases";
import { runButton } from "./inputs";
import { showRunPicker } from "./picker";
import { Runner } from "./runner";
import { TerminalButtonsProvider } from "./view";

// Kontekst prawego kliknięcia na przycisku (data-vscode-context w webview)
interface ButtonContext {
  buttonId: string;
  viewType: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Terminal Command Buttons extension is now active!");

  const store = new ButtonStore(context.workspaceState);
  const runner = new Runner();
  const gitAliases = new GitAliases();
  // Ostatnie wartości ${input:…} pamiętamy niezależnie od workspace
  const memory = context.globalState;
  context.subscriptions.push(store, runner, gitAliases);

  // Rejestracja providerów webview: Activity Bar i panel dolny
  const providers = new Map<string, TerminalButtonsProvider>();
  for (const viewType of [
    TerminalButtonsProvider.viewType,
    TerminalButtonsProvider.panelViewType,
  ]) {
    const provider = new TerminalButtonsProvider(
      viewType,
      context.extensionUri,
      context,
      store,
      runner,
      gitAliases
    );
    providers.set(viewType, provider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(viewType, provider)
    );
  }

  const refreshViews = () =>
    providers.forEach((provider) => provider.sendButtonsToWebview());

  context.subscriptions.push(
    // Odśwież oba widoki po każdej zmianie przycisków lub układu
    store.onDidChange(refreshViews),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.layout`)) {
        refreshViews();
      }
    }),
    // Nowe aliasy zmieniają dymki przycisków
    gitAliases.onDidChange(refreshViews),
    runner.onDidChange(() =>
      providers.forEach((provider) => provider.sendStatusesToWebview())
    ),
    // Po zaufaniu workspace dochodzą aliasy z .git/config repo i stare przyciski z settings.json
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      gitAliases.refresh();
      refreshViews();
      store.offerLegacyMigration();
    })
  );

  store.offerLegacyMigration();

  // Komenda do otwierania panelu przycisków
  const openButtonsPanel = vscode.commands.registerCommand(
    "terminalCommandButtons.openButtonsPanel",
    () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.terminalCommandButtons"
      );
    }
  );

  // Komenda do dodania nowego przycisku
  const addButton = vscode.commands.registerCommand(
    "terminalCommandButtons.addButton",
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: "Enter button name",
        placeHolder: "e.g., List Files",
      });

      if (!name) {
        return;
      }

      const command = await vscode.window.showInputBox({
        prompt: "Enter command",
        placeHolder: "e.g., ls -la",
      });

      if (!command) {
        return;
      }

      await store.save({ name, command });
    }
  );

  // Przełączenie układu ikony / lista
  const toggleLayout = vscode.commands.registerCommand(
    "terminalCommandButtons.toggleLayout",
    async () => {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const next: Layout =
        config.get<Layout>("layout", "icons") === "icons" ? "list" : "icons";
      await config.update("layout", next, vscode.ConfigurationTarget.Global);
    }
  );

  // Komendy z paska terminala: "Uruchom…" i "Powtórz"
  const runPicker = vscode.commands.registerCommand(
    "terminalCommandButtons.runPicker",
    () => showRunPicker(runner, store, memory)
  );

  // Podgląd i edycja aliasów gita
  const manageGitAliases = vscode.commands.registerCommand(
    "terminalCommandButtons.manageGitAliases",
    () => showGitAliases(gitAliases)
  );

  // Przeniesienie starych przycisków z .vscode/settings.json, też z palety
  const moveWorkspaceButtons = vscode.commands.registerCommand(
    "terminalCommandButtons.moveWorkspaceButtons",
    () => store.migrateLegacy()
  );

  const rerunLast = vscode.commands.registerCommand(
    "terminalCommandButtons.rerunLast",
    () => runner.rerunLast()
  );

  // Komendy z menu prawego kliknięcia na przycisku
  const runButtonCommand = vscode.commands.registerCommand(
    "terminalCommandButtons.runButton",
    (ctx: ButtonContext) => {
      const button = ctx?.buttonId ? store.find(ctx.buttonId) : undefined;
      if (button) {
        runButton(runner, button, memory);
      }
    }
  );

  const stopButton = vscode.commands.registerCommand(
    "terminalCommandButtons.stopButton",
    (ctx: ButtonContext) => {
      if (ctx?.buttonId) {
        runner.stop(ctx.buttonId);
      }
    }
  );

  const restartButton = vscode.commands.registerCommand(
    "terminalCommandButtons.restartButton",
    (ctx: ButtonContext) => {
      if (ctx?.buttonId) {
        runner.restart(ctx.buttonId);
      }
    }
  );

  const editButton = vscode.commands.registerCommand(
    "terminalCommandButtons.editButton",
    (ctx: ButtonContext) => {
      providers.get(ctx?.viewType)?.showEditForm(ctx.buttonId);
    }
  );

  const deleteButtonCommand = vscode.commands.registerCommand(
    "terminalCommandButtons.deleteButton",
    async (ctx: ButtonContext) => {
      if (ctx?.buttonId) {
        await store.delete(ctx.buttonId);
      }
    }
  );

  // Komenda do przeniesienia widoku z panelu obok terminala.
  // vscode.moveViews to komenda wewnętrzna VS Code - przy błędzie instrukcja ręczna.
  const dockToTerminal = vscode.commands.registerCommand(
    "terminalCommandButtons.dockToTerminal",
    async () => {
      try {
        await vscode.commands.executeCommand("vscode.moveViews", {
          viewIds: [TerminalButtonsProvider.panelViewType],
          destinationId: "terminal",
        });
        await vscode.commands.executeCommand(
          `${TerminalButtonsProvider.panelViewType}.focus`
        );
      } catch (error) {
        console.error("Failed to move view next to terminal:", error);
        vscode.window.showInformationMessage(
          'Drag the "Command Buttons" tab onto the Terminal panel to keep the buttons next to it.'
        );
      }
    }
  );

  context.subscriptions.push(
    openButtonsPanel,
    addButton,
    toggleLayout,
    runPicker,
    manageGitAliases,
    moveWorkspaceButtons,
    rerunLast,
    runButtonCommand,
    stopButton,
    restartButton,
    editButton,
    deleteButtonCommand,
    dockToTerminal
  );
}

export function deactivate() {}

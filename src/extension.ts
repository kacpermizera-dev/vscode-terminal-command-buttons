import * as vscode from "vscode";
import { showGitAliases } from "./aliasManager";
import { CONFIG_SECTION, Layout, deleteButton, getButtons, saveButton } from "./buttons";
import { GitAliases } from "./gitAliases";
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

  const runner = new Runner();
  const gitAliases = new GitAliases();
  context.subscriptions.push(runner, gitAliases);

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
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        refreshViews();
      }
    }),
    // Nowe aliasy zmieniają dymki przycisków
    gitAliases.onDidChange(refreshViews),
    runner.onDidChange(() =>
      providers.forEach((provider) => provider.sendStatusesToWebview())
    ),
    // Po zaufaniu workspace dochodzą aliasy z .git/config repo
    vscode.workspace.onDidGrantWorkspaceTrust(() => gitAliases.refresh())
  );

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

      await saveButton({ name, command, color: "#007acc" });
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
    () => showRunPicker(runner)
  );

  // Podgląd i edycja aliasów gita
  const manageGitAliases = vscode.commands.registerCommand(
    "terminalCommandButtons.manageGitAliases",
    () => showGitAliases(gitAliases)
  );

  const rerunLast = vscode.commands.registerCommand(
    "terminalCommandButtons.rerunLast",
    () => runner.rerunLast()
  );

  // Komendy z menu prawego kliknięcia na przycisku
  const runButton = vscode.commands.registerCommand(
    "terminalCommandButtons.runButton",
    (ctx: ButtonContext) => {
      const button = getButtons().find((b) => b.id === ctx?.buttonId);
      if (button) {
        runner.run(button.command);
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
        await deleteButton(ctx.buttonId);
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
    rerunLast,
    runButton,
    editButton,
    deleteButtonCommand,
    dockToTerminal
  );
}

export function deactivate() {}

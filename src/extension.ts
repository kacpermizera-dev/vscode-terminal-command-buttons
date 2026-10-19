import * as vscode from "vscode";
import { showGitAliases } from "./aliasManager";
import { ButtonStore, CONFIG_SECTION, Layout } from "./buttons";
import { GitAliases } from "./gitAliases";
import { runButton } from "./inputs";
import { showRunPicker } from "./picker";
import { Runner } from "./runner";
import { PinnedButtons } from "./statusBar";
import { TerminalButtonsProvider } from "./view";

const WELCOME_SHOWN_KEY = "welcomeShown";

async function offerDockToTerminal(memory: vscode.Memento) {
  if (memory.get(WELCOME_SHOWN_KEY)) {
    return;
  }
  await memory.update(WELCOME_SHOWN_KEY, true);
  const answer = await vscode.window.showInformationMessage(
    "Show Command Buttons next to the terminal?",
    "Show next to terminal",
    "Not now"
  );
  if (answer === "Show next to terminal") {
    await vscode.commands.executeCommand("terminalCommandButtons.dockToTerminal");
  }
}

interface ButtonContext {
  buttonId: string;
  viewType: string;
}

export function activate(context: vscode.ExtensionContext) {
  console.log("Terminal Command Buttons extension is now active!");

  const store = new ButtonStore(context.workspaceState);
  const runner = new Runner();
  const gitAliases = new GitAliases();
  const memory = context.globalState;
  context.subscriptions.push(
    store,
    runner,
    gitAliases,
    new PinnedButtons(store, runner)
  );

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
    store.onDidChange(refreshViews),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.layout`)) {
        refreshViews();
      }
    }),
    gitAliases.onDidChange(refreshViews),
    runner.onDidChange(() =>
      providers.forEach((provider) => provider.sendStatusesToWebview())
    ),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      gitAliases.refresh();
      refreshViews();
      store.offerLegacyMigration();
    })
  );

  store.offerLegacyMigration();

  const openButtonsPanel = vscode.commands.registerCommand(
    "terminalCommandButtons.openButtonsPanel",
    () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.terminalCommandButtons"
      );
    }
  );

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

  const toggleCollapseAll = vscode.commands.registerCommand(
    "terminalCommandButtons.toggleCollapseAll",
    () => providers.forEach((provider) => provider.toggleCollapseAll())
  );

  const toggleLayout = vscode.commands.registerCommand(
    "terminalCommandButtons.toggleLayout",
    async () => {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
      const next: Layout =
        config.get<Layout>("layout", "icons") === "icons" ? "list" : "icons";
      await config.update("layout", next, vscode.ConfigurationTarget.Global);
    }
  );

  const runPicker = vscode.commands.registerCommand(
    "terminalCommandButtons.runPicker",
    () => showRunPicker(runner, store, memory)
  );

  const manageGitAliases = vscode.commands.registerCommand(
    "terminalCommandButtons.manageGitAliases",
    () => showGitAliases(gitAliases)
  );

  const moveWorkspaceButtons = vscode.commands.registerCommand(
    "terminalCommandButtons.moveWorkspaceButtons",
    () => store.migrateLegacy()
  );

  const rerunLast = vscode.commands.registerCommand(
    "terminalCommandButtons.rerunLast",
    () => runner.rerunLast()
  );

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
    toggleCollapseAll,
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

  offerDockToTerminal(memory);
}

export function deactivate() {}

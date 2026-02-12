import * as vscode from "vscode";
import { AICodeCompletionProvider } from "./providers/completionProvider";
import { ChatParticipantProvider } from "./providers/chatParticipant";
import { FileContextProvider } from "./providers/fileContextProvider";
import { ConfigurationManager } from "./config/configurationManager";
import { APIClient } from "./api/client";
import { CacheManager } from "./utils/cacheManager";
import { Logger } from "./utils/logger";
import { SECRET_KEY } from "./constants";

export async function activate(context: vscode.ExtensionContext) {
  const logger = new Logger();
  logger.info("🔌 MyAICopilot activating...");

  // Initialize core services
  const config = new ConfigurationManager();
  const cache = new CacheManager(context);
  const api = new APIClient(config, context.secrets);
  const fileContext = new FileContextProvider();

  // Register completion provider for all supported schemes
  const completionProvider = new AICodeCompletionProvider(
    config,
    api,
    cache,
    logger
  );
  const schemes = [
    "file",
    "vscode-remote",
    "vscode-local",
    "vscode-vfs",
    "vscode-test-web",
  ];

  schemes.forEach((scheme) => {
    const provider = vscode.languages.registerInlineCompletionItemProvider(
      { scheme, pattern: "**/*" },
      completionProvider
    );
    context.subscriptions.push(provider);
  });

  // Register chat participant (if API is available)
  if (vscode.chat) {
    const chatProvider = new ChatParticipantProvider(
      config,
      api,
      fileContext,
      logger
    );
    context.subscriptions.push(chatProvider.disposable);
  } else {
    logger.warn("Chat API not available. Chat features disabled.");
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("myaicopilot.showApiKeyInput", async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Enter OpenAI-compatible API Key",
        password: true,
        placeHolder: "sk-...",
        ignoreFocusOut: true,
        title: "MyAICopilot API Key",
      });

      if (key?.trim()) {
        await context.secrets.store(SECRET_KEY, key.trim());
        vscode.window.showInformationMessage(
          "✅ API key saved securely in VS Code secrets"
        );
        logger.info("API key updated");
      }
    }),

    vscode.commands.registerCommand("myaicopilot.resetApiKey", async () => {
      await context.secrets.delete(SECRET_KEY);
      vscode.window.showInformationMessage("🗑️ API key removed");
      logger.info("API key removed");
    }),

    vscode.commands.registerCommand("myaicopilot.diagnostic", async () => {
      await runDiagnostic(api, logger);
    }),

    // Hidden command for completion acceptance tracking
    vscode.commands.registerCommand(
      "myaicopilot.completionAccepted",
      (cacheKey: string) => {
        logger.debug("Completion accepted", { cacheKey });
        // Future: Add telemetry/analytics here
      }
    )
  );

  // Status bar indicator
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBar.text = "$(hubot) MyAICopilot";
  statusBar.tooltip = "Click to run diagnostic";
  statusBar.command = "myaicopilot.diagnostic";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Validate config after startup
  setTimeout(() => validateConfig(config, logger), 2000);

  logger.info("✅ MyAICopilot activated successfully");
}

async function validateConfig(config: ConfigurationManager, logger: Logger) {
  const baseUrl = config.get<string>("api.baseUrl");
  const model = config.get<string>("api.model");

  if (!baseUrl || !model) {
    logger.warn("Configuration incomplete");
    vscode.window.showWarningMessage(
      "⚠️ MyAICopilot: Check settings (baseUrl, model)"
    );
  }
}

async function runDiagnostic(api: APIClient, logger: Logger) {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "MyAICopilot diagnostic...",
        cancellable: false,
      },
      async () => {
        await api.testConnection();
        vscode.window.showInformationMessage("✅ Connected successfully");
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    logger.error("Diagnostic failed:", err);
    vscode.window.showErrorMessage(`❌ MyAICopilot: ${message}`);
  }
}

export function deactivate() {}

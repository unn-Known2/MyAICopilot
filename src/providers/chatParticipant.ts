import * as vscode from "vscode";
import { ConfigurationManager } from "../config/configurationManager";
import { APIClient } from "../api/client";
import { FileContextProvider } from "./fileContextProvider";
import { Logger } from "../utils/logger";
import { ChatRequest, ChatMessage } from "../types";

/**
 * Chat participant for AI-powered code assistance
 */
export class ChatParticipantProvider {
  private participant: vscode.ChatParticipant;

  constructor(
    private config: ConfigurationManager,
    private api: APIClient,
    private fileContext: FileContextProvider,
    private logger: Logger
  ) {
    this.participant = vscode.chat.createChatParticipant(
      "myaicopilot.chat",
      this.handleChat.bind(this)
    );

    // Set up participant properties
    this.participant.iconPath = new vscode.ThemeIcon("hubot");
  }

  /**
   * Returns the disposable for registration
   */
  public get disposable(): vscode.Disposable {
    return this.participant;
  }

  private async handleChat(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    progress: vscode.Progress<vscode.ChatResponseStream>,
    token: vscode.CancellationToken
  ): Promise<void> {
    const command = request.command || "general";
    this.logger.info(`Chat request: ${command}`);

    try {
      const messages = await this.buildMessages(request, context);

      // Stream response
      const stream = this.api.createChatCompletion(
        {
          messages,
          stream: true,
          maxTokens: this.config.get("api.maxTokens"),
          temperature: this.config.get("api.temperature"),
        } as ChatRequest,
        token
      );

      for await (const chunk of stream) {
        if (token.isCancellationRequested) {
          break;
        }
        progress.report({ content: chunk });
      }

      this.logger.info(`Chat response completed for: ${command}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      progress.report({ content: `❌ Error: ${message}` });
      this.logger.error("Chat error:", err);
    }
  }

  private async buildMessages(
    request: vscode.ChatRequest,
    context: vscode.ChatContext
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are MyAICopilot, a code assistant in VS Code.
- Be concise and accurate
- Use markdown code blocks with language tags
- When suggesting code, make it ready to insert
- Command: ${request.command || "general chat"}`,
      },
    ];

    // Add recent history (last 5 messages)
    const maxHistory = this.config.get<number>("chat.maxHistoryMessages");
    const recentHistory = context.history.slice(-maxHistory);

    for (const turn of recentHistory) {
      if ("prompt" in turn) {
        messages.push({ role: "user", content: String(turn.prompt) });
      } else {
        messages.push({ role: "assistant", content: String(turn.response) });
      }
    }

    // Build context
    let contextPrompt = "";

    // Add selected code context
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      const code = editor.document.getText(editor.selection);
      const lang = editor.document.languageId;
      contextPrompt += `## Selected Code (${lang}):
\`\`\`${lang}
${code}
\`\`\`

`;
    }

    // Add @file context
    if (request.variables["file"]?.length) {
      const fileContent = await this.fileContext.getFileContext(
        request.variables["file"][0].value
      );
      contextPrompt += `## File Context:
${fileContent}

`;
    }

    // Add @workspace context
    if (request.variables["workspace"]?.length) {
      const wsTree = await this.fileContext.getWorkspaceTree();
      contextPrompt += `## Workspace Structure:
${wsTree}

`;
    }

    // Add user prompt
    messages.push({
      role: "user",
      content: `${contextPrompt}User: ${request.prompt}`,
    });

    return messages;
  }
}

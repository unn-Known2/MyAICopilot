import * as vscode from "vscode";
import { ConfigurationManager } from "../config/configurationManager";
import { APIClient } from "../api/client";
import { CacheManager } from "../utils/cacheManager";
import { getLanguagePrompt } from "../config/prompts";
import { computeHash } from "../utils/crypto";
import { Logger } from "../utils/logger";
import { CompletionRequest } from "../types";

/**
 * AI-powered inline completion provider with intelligent caching and debouncing
 */
export class AICodeCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private debounceTimer: NodeJS.Timeout | undefined;
  private abortController: AbortController | undefined;

  constructor(
    private config: ConfigurationManager,
    private api: APIClient,
    private cache: CacheManager,
    private logger: Logger
  ) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    // Early exit: language not supported
    if (!this.isLanguageSupported(document.languageId)) {
      return [];
    }

    // Manual invocation (Alt+Backslash)
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke) {
      return this.fetchCompletion(document, position, token);
    }

    // Automatic trigger with debouncing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve([]);
          return;
        }
        const result = await this.fetchCompletion(document, position, token);
        resolve(result);
      }, this.config.get<number>("autocomplete.debounceMs"));
    });
  }

  private async fetchCompletion(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    // Check cache first
    const cacheKey = await this.generateCacheKey(document, position);
    const cached = this.cache.getCompletion(cacheKey);
    if (cached) {
      this.logger.debug("Cache hit for completion");
      return [cached];
    }

    // Build intelligent prompt
    const prompt = await this.buildPrompt(document, position);

    // Abort previous request
    this.abortController?.abort();
    this.abortController = new AbortController();

    // Link tokens
    token.onCancellationRequested(() => this.abortController?.abort());

    try {
      const completion = await this.api.createCompletion({
        prompt,
        maxTokens: this.config.get("api.maxTokens"),
        temperature: this.config.get("api.temperature"),
        signal: this.abortController.signal,
      } as CompletionRequest);

      const suggestion = completion.choices?.[0]?.text || "";
      const cleaned = this.cleanResponse(suggestion);

      if (!cleaned.trim()) {
        return [];
      }

      // Create completion item with proper range
      const item = new vscode.InlineCompletionItem(
        cleaned,
        new vscode.Range(position, position)
      );

      // Add command for acceptance tracking
      item.command = {
        title: "Completion Accepted",
        command: "myaicopilot.completionAccepted",
        arguments: [cacheKey],
      };

      // Cache the result
      this.cache.setCompletion(
        cacheKey,
        item,
        this.config.get("cache.ttlSeconds")
      );

      this.logger.debug("Completion generated successfully");
      return [item];
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError" || err.message.includes("cancelled")) {
          return []; // User cancelled
        }
        this.logger.error("Completion failed:", err);
      }
      return [];
    }
  }

  private async generateCacheKey(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    // Hash based on language, file path, and preceding context (last 30 lines)
    const startLine = Math.max(0, position.line - 30);
    const precedingText = document.getText(
      new vscode.Range(startLine, 0, position.line, position.character)
    );
    const contentHash = await computeHash(
      `${document.languageId}:${document.uri.toString()}:${precedingText}`
    );
    return `completion:${contentHash}`;
  }

  private async buildPrompt(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    // Get context: 50 lines before, 5 lines after
    const beforeLines = 50;
    const afterLines = 5;

    const beforeCursor = document.getText(
      new vscode.Range(
        Math.max(0, position.line - beforeLines),
        0,
        position.line,
        position.character
      )
    );

    const afterCursor = document.getText(
      new vscode.Range(
        position.line,
        position.character,
        Math.min(document.lineCount, position.line + afterLines),
        0
      )
    );

    const lang = document.languageId;
    const langPrompt = getLanguagePrompt(lang);

    return `${langPrompt}

## Current Code Context:
\`\`\`${lang}
${beforeCursor}[CURSOR]${afterCursor}
\`\`\`

## Instructions:
1. Complete the code at [CURSOR]
2. Respond with ONLY code, no explanations
3. Ensure the code is syntactically correct
4. Match the existing code style and indentation`;
  }

  private cleanResponse(text: string): string {
    return text
      .replace(/```[a-z]*\n?([\s\S]*?)```/g, "$1") // Extract code from fences
      .replace(/```/g, "") // Remove any remaining fences
      .replace(/^\s*\n/, "") // Remove leading newlines
      .replace(/\n\s*$/, "") // Remove trailing newlines
      .trim();
  }

  private isLanguageSupported(languageId: string): boolean {
    const supported =
      this.config.get<string[]>("autocomplete.supportedLanguages") || [];
    return supported.includes(languageId);
  }
}

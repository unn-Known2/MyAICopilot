import * as vscode from "vscode";
import { ConfigurationManager } from "../config/configurationManager";
import { CompletionRequest, ChatRequest, ModelResponse } from "../types";
import { SECRET_KEY } from "../constants";

/**
 * Universal API Client for OpenAI-compatible endpoints
 * Works in both Node.js and browser environments
 */
export class APIClient {
  private circuitBreaker = {
    failures: 0,
    cooldownUntil: 0,
    maxFailures: 5,
    cooldownMs: 60000, // 1 minute cooldown
  };

  constructor(
    private config: ConfigurationManager,
    private secretStorage: vscode.SecretStorage
  ) {}

  async testConnection(): Promise<void> {
    const apiKey = await this.getApiKey();
    const baseUrl = this.config.get<string>("api.baseUrl");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Parse JSON to ensure valid response
      await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createCompletion(req: CompletionRequest): Promise<ModelResponse> {
    await this.checkCircuitBreaker();

    const apiKey = await this.getApiKey();
    const baseUrl = this.config.get<string>("api.baseUrl");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Merge signals
    const signal = req.signal
      ? this.mergeSignals(controller.signal, req.signal)
      : controller.signal;

    try {
      const response = await fetch(`${baseUrl}/completions`, {
        method: "POST",
        headers: this.getHeaders(apiKey),
        signal,
        body: JSON.stringify({
          model: this.config.get("api.model"),
          prompt: req.prompt,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          stream: false,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleFailure(response.status);
        throw new Error(`API Error ${response.status}: ${response.statusText}`);
      }

      this.circuitBreaker.failures = 0;
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === "AbortError")
          throw new Error("Request timeout or cancelled");
      }
      throw err;
    }
  }

  async *createChatCompletion(
    req: ChatRequest,
    token?: vscode.CancellationToken
  ): AsyncGenerator<string> {
    await this.checkCircuitBreaker();

    const apiKey = await this.getApiKey();
    const baseUrl = this.config.get<string>("api.baseUrl");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    token?.onCancellationRequested(() => controller.abort());

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(apiKey),
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.get("api.model"),
          messages: req.messages,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        await this.handleFailure(response.status);
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      this.circuitBreaker.failures = 0;
      yield* this.parseSSE(response, token);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async *parseSSE(
    response: Response,
    token?: vscode.CancellationToken
  ): AsyncGenerator<string> {
    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (token?.isCancellationRequested) {
          await reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) yield content;
            } catch (e) {
              console.warn("Malformed SSE data:", data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getHeaders(apiKey: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "MyAICopilot/0.1.0",
    };
  }

  private async getApiKey(): Promise<string> {
    const key = await this.secretStorage.get(SECRET_KEY);
    if (!key) {
      throw new Error(
        'API key not configured. Run "MyAICopilot: Set API Key" command.'
      );
    }
    return key;
  }

  private async handleFailure(status: number) {
    // Trigger circuit breaker on server errors or rate limits
    if (status >= 500 || status === 429) {
      this.circuitBreaker.failures++;
      if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
        this.circuitBreaker.cooldownUntil =
          Date.now() + this.circuitBreaker.cooldownMs;
        vscode.window.showWarningMessage(
          `MyAICopilot: Too many errors, cooling down for ${
            this.circuitBreaker.cooldownMs / 1000
          }s`
        );
      }
    }
  }

  private async checkCircuitBreaker() {
    if (Date.now() < this.circuitBreaker.cooldownUntil) {
      throw new Error("Service is cooling down due to repeated failures");
    }
  }

  private mergeSignals(
    signal1: AbortSignal,
    signal2: AbortSignal
  ): AbortSignal {
    const controller = new AbortController();

    const onAbort = () => controller.abort();
    signal1.addEventListener("abort", onAbort, { once: true });
    signal2.addEventListener("abort", onAbort, { once: true });

    return controller.signal;
  }
}

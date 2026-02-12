import * as vscode from "vscode";

export interface APIConfig {
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface CompletionRequest {
  prompt: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  stream: boolean;
  maxTokens: number;
  temperature: number;
}

export interface CompletionCacheEntry {
  item: vscode.InlineCompletionItem;
  expiry: number;
}

export interface ChatCacheEntry {
  response: string;
  expiry: number;
}

export interface ModelResponse {
  choices: Array<{
    text?: string;
    delta?: {
      content?: string;
    };
  }>;
}

export interface FileInfo {
  name: string;
  type: vscode.FileType;
  uri: vscode.Uri;
}

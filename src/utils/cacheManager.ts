import * as vscode from "vscode";
import { CompletionCacheEntry } from "../types";
import { CACHE_PREFIX, CHAT_CACHE_PREFIX } from "../constants";

/**
 * Cache manager for completions and chat using workspace state
 * Web-safe: No Node.js dependencies
 */
export class CacheManager {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Get cached completion
   */
  getCompletion(key: string): vscode.InlineCompletionItem | undefined {
    const entry = this.context.workspaceState.get<CompletionCacheEntry>(
      CACHE_PREFIX + key
    );

    if (!entry) return undefined;

    // Check expiry
    if (Date.now() > entry.expiry) {
      this.delete(CACHE_PREFIX + key);
      return undefined;
    }

    return entry.item;
  }

  /**
   * Cache a completion item
   */
  setCompletion(
    key: string,
    item: vscode.InlineCompletionItem,
    ttlSeconds: number
  ): void {
    const entry: CompletionCacheEntry = {
      item,
      expiry: Date.now() + ttlSeconds * 1000,
    };
    this.context.workspaceState.update(CACHE_PREFIX + key, entry).then(
      () => {},
      (err) => console.error("Cache write failed:", err)
    );
  }

  /**
   * Delete a cache entry
   */
  private delete(fullKey: string): void {
    this.context.workspaceState.update(fullKey, undefined).then(
      () => {},
      (err) => console.error("Cache delete failed:", err)
    );
  }

  /**
   * Clear all cached completions
   */
  clear(): void {
    const keys = this.context.workspaceState
      .keys()
      .filter(
        (k) => k.startsWith(CACHE_PREFIX) || k.startsWith(CHAT_CACHE_PREFIX)
      );
    const updates = keys.map((k) =>
      this.context.workspaceState.update(k, undefined)
    );
    Promise.allSettled(updates).then(
      () => console.log("Cache cleared"),
      (err) => console.error("Cache clear failed:", err)
    );
  }
}

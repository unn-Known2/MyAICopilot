import * as vscode from "vscode";

/**
 * Centralized configuration management with caching
 */
export class ConfigurationManager {
  private config = vscode.workspace.getConfiguration("myaicopilot");
  private cache = new Map<string, any>();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Clear cache on config change
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("myaicopilot")) {
          this.config = vscode.workspace.getConfiguration("myaicopilot");
          this.cache.clear();
        }
      })
    );
  }

  get<T>(key: string): T {
    const cacheKey = key;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const value = this.config.get<T>(key);
    this.cache.set(cacheKey, value);
    return value as T;
  }

  /**
   * Listen for configuration changes
   */
  onDidChange(key: string, listener: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`myaicopilot.${key}`)) {
        this.cache.clear();
        listener();
      }
    });
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

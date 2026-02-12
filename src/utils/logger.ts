import * as vscode from "vscode";

/**
 * Configurable logger with output channel and timestamps
 */
export class Logger {
  private outputChannel: vscode.OutputChannel;
  private config = vscode.workspace.getConfiguration("myaicopilot");

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("MyAICopilot");
  }

  private shouldLog(level: string): boolean {
    const configLevel = this.config.get("logging.level", "info");
    const levels = ["error", "warn", "info", "debug"];
    return levels.indexOf(level) <= levels.indexOf(configLevel);
  }

  private format(message: string, level: string): string {
    const timestamp = new Date().toISOString();
    return `[${level.toUpperCase()}] ${timestamp} - ${message}`;
  }

  error(message: string, error?: any): void {
    if (this.shouldLog("error")) {
      this.outputChannel.appendLine(this.format(message, "error"));
      if (error) {
        const errorMessage =
          error instanceof Error ? error.stack || error.message : String(error);
        this.outputChannel.appendLine(this.format(errorMessage, "error"));
      }
    }
  }

  warn(message: string): void {
    if (this.shouldLog("warn")) {
      this.outputChannel.appendLine(this.format(message, "warn"));
    }
  }

  info(message: string): void {
    if (this.shouldLog("info")) {
      this.outputChannel.appendLine(this.format(message, "info"));
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog("debug")) {
      this.outputChannel.appendLine(this.format(message, "debug"));
      if (data !== undefined) {
        try {
          const debugData = JSON.stringify(data, null, 2);
          this.outputChannel.appendLine(this.format(debugData, "debug"));
        } catch (e) {
          this.outputChannel.appendLine(this.format(String(data), "debug"));
        }
      }
    }
  }

  show(): void {
    this.outputChannel.show();
  }
}

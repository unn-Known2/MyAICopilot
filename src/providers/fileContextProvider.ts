import * as vscode from "vscode";

/**
 * Provides file and workspace context for chat
 * 100% web-compatible using vscode.workspace.fs
 */
export class FileContextProvider {
  private readonly MAX_FILE_SIZE = 30 * 1024; // 30KB limit
  private readonly MAX_TREE_DEPTH = 4;
  private ignorePatterns: string[] | null = null;

  async getFileContext(filePath: string): Promise<string> {
    try {
      const uri = this.resolveUri(filePath);
      if (!uri) return `// Invalid workspace or file path: ${filePath}`;

      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > this.MAX_FILE_SIZE) {
        return `// File too large: ${filePath} (${(stat.size / 1024).toFixed(
          1
        )}KB)`;
      }

      const content = await vscode.workspace.fs.readFile(uri);
      const decoded = new TextDecoder().decode(content);

      // Return first 50 lines to avoid context overflow
      const lines = decoded.split(/\r?\n/).slice(0, 50).join("\n");
      return lines;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return `// File not found or inaccessible: ${filePath}
// Error: ${message}`;
    }
  }

  async getWorkspaceTree(): Promise<string> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return "// No workspace open";
    }

    const root = vscode.workspace.workspaceFolders[0].uri;
    const tree: string[] = ["📁 Workspace:"];
    await this.walkDirectory(root, tree, 0);
    return tree.join("\n");
  }

  private resolveUri(filePath: string): vscode.Uri | null {
    if (!vscode.workspace.workspaceFolders?.length) return null;

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;

    // Handle absolute paths
    if (filePath.startsWith("/")) {
      return vscode.Uri.file(filePath);
    }

    // Handle relative paths
    return vscode.Uri.joinPath(workspaceRoot, filePath);
  }

  private async walkDirectory(
    dir: vscode.Uri,
    tree: string[],
    depth: number
  ): Promise<void> {
    if (depth > this.MAX_TREE_DEPTH) {
      tree.push("  ".repeat(depth) + "... (depth limit)");
      return;
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(dir);
      const ignorePatterns = await this.getIgnorePatterns();

      // Sort: directories first, then files alphabetically
      const sorted = entries.sort((a, b) => {
        if (a[1] === b[1]) return a[0].localeCompare(b[0]);
        return b[1] - a[1]; // Directories (1) before files (2)
      });

      for (const [name, type] of sorted) {
        if (this.shouldIgnore(name, ignorePatterns)) continue;

        const prefix =
          "  ".repeat(depth + 1) +
          (type === vscode.FileType.Directory ? "📁 " : "📄 ");
        tree.push(prefix + name);

        if (type === vscode.FileType.Directory) {
          await this.walkDirectory(
            vscode.Uri.joinPath(dir, name),
            tree,
            depth + 1
          );
        }
      }
    } catch (err) {
      // Ignore inaccessible directories
      tree.push("  ".repeat(depth + 1) + "⚠️ (inaccessible)");
    }
  }

  private async getIgnorePatterns(): Promise<string[]> {
    if (this.ignorePatterns) return this.ignorePatterns;

    try {
      const ignoreUri = vscode.Uri.joinPath(
        vscode.workspace.workspaceFolders![0].uri,
        ".gitignore"
      );
      const content = await vscode.workspace.fs.readFile(ignoreUri);
      this.ignorePatterns = new TextDecoder()
        .decode(content)
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith("#"))
        .map((l) => l.trim());
    } catch {
      // Default ignore patterns
      this.ignorePatterns = [
        "node_modules",
        ".git",
        "*.log",
        "dist",
        "build",
        ".vscode",
        ".idea",
        ".next",
        ".cache",
        "*.lock",
      ];
    }

    return this.ignorePatterns;
  }

  private shouldIgnore(name: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      // Skip empty patterns
      if (!pattern || pattern.startsWith("#")) return false;

      // Convert glob to regex
      const regex = new RegExp(
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")
      );
      return regex.test(name);
    });
  }
}

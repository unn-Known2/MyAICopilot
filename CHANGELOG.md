```markdown
# Contributing to MyAICopilot

## Development Setup

1. Clone the repository
2. Run `npm install`
3. Open in VS Code
4. Press F5 to launch Extension Development Host

## Architecture

- `src/api/` - API client for OpenAI-compatible endpoints
- `src/providers/` - VS Code providers (completion, chat)
- `src/config/` - Configuration and prompts
- `src/utils/` - Utilities (cache, crypto, logger)
- `src/constants.ts` - Shared constants

## Testing in Web

```bash
npm run compile
# Test in GitHub Codespaces or use "Run in Web" profile
Guidelines
Use vscode.workspace.fs for all file operations
No Node.js fs or crypto modules
Add proper error handling
Use async/await over callbacks
Follow TypeScript strict mode

---

## 📁 **CHANGELOG.md** - **NEW: Essential Missing File**
```markdown
# Changelog

## [0.1.0] - 2024-01-01

### Added
- Inline code completion with caching
- AI chat sidebar with streaming
- Support for @workspace and @file context
- Circuit breaker pattern for error handling
- Web VS Code compatibility (Codespaces, etc.)
- Multi-language support (JS/TS/Python)
- Secure API key storage using vscode.SecretStorage

### Fixed
- Proper TypeScript types throughout
- Web Crypto API compatibility
- Cancellation token handling
- Debouncing implementation
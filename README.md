# MyAICopilot

AI-powered code completion and chat for VS Code, compatible with any OpenAI API endpoint. Works seamlessly in both desktop and web environments (GitHub Codespaces, StackBlitz, CodeSandbox).

## Features

- **Inline Code Completion**: Tab-complete single lines to full functions
- **AI Chat**: Context-aware chat with @workspace and @file support
- **Universal API**: Works with any OpenAI-compatible endpoint
- **Web Compatible**: Runs in VS Code for Web (no Node.js dependencies)
- **Privacy First**: 100% local configuration, no telemetry
- **Multi-Language**: First-class support for JS/TS/Python/React

## Quick Start

1. Install the extension from VS Marketplace or `.vsix`
2. Run command: `MyAICopilot: Set API Key`
3. Enter your API key (OpenAI, Azure, etc.)
4. Start coding or open chat!

## Configuration

```json
{
  "myaicopilot.api.baseUrl": "https://api.openai.com/v1",
  "myaicopilot.api.model": "gpt-4",
  "myaicopilot.api.maxTokens": 256,
  "myaicopilot.api.temperature": 0.1,
  "myaicopilot.autocomplete.debounceMs": 150,
  "myaicopilot.chat.maxHistoryMessages": 20
}
Usage
Autocomplete
Automatic: Triggered on typing (configurable characters)
Manual: Press Alt+Backslash to invoke
Accept: Press Tab to accept suggestion
Chat
explain: Explain selected code
refactor: Get refactoring suggestions
generate: Create new code from description
Context Variables
@file:path - Include specific file content
@workspace - Include workspace structure
Supported APIs
OpenAI
Azure OpenAI
Any OpenAI-compatible endpoint (ollama, etc.)
Privacy
API keys are stored securely in VS Code SecretStorage. No telemetry or data collection.

License
MIT


---

## 📁 **CONTRIBUTING.md** (Added)
```markdown
# Contributing to MyAICopilot

## Development Setup

1. Clone repository: `git clone https://github.com/your-username/myaicopilot`
2. Install dependencies: `npm install`
3. Open in VS Code
4. Run `npm run compile`
5. Press F5 to launch Extension Development Host

## Architecture

src/
├── api/ # API client for OpenAI-compatible endpoints
├── providers/ # VS Code providers (completion, chat)
├── config/ # Configuration and prompts
├── utils/ # Utilities (cache, crypto, logger)
├── constants.ts # Shared constants
├── types/ # TypeScript type definitions
└── extension.ts # Main entry point


## Key Principles

- **Web-first**: No Node.js APIs (`fs`, `crypto`, etc.)
- **Use `vscode.workspace.fs`** for all file operations
- **Async/await** over callbacks
- **Strict TypeScript** with no `any`
- **Graceful degradation** for missing APIs
- **Circuit breaker** pattern for resilience

## Testing in Web

```bash
# Build for web
npm run compile

# Test in:
# 1. GitHub Codespaces
# 2. VS Code Web (vscode.dev)
# 3. StackBlitz/CodeSandbox
Commands
npm run compile - Build for desktop & web
npm run package - Create .vsix package
npm run lint - TypeScript type check
code --install-extension myaicopilot-0.1.0.vsix - Install locally
Guidelines
Add tests for new features
Update README.md for user-facing changes
Update this file for architecture changes
Use the Logger utility for logging
Handle errors gracefully with user-friendly messages

---

## 📁 **CHANGELOG.md** (Added)
```markdown
# Changelog

## [0.1.0] - Initial Release

### Added
- Inline AI code completion with streaming support
- Chat sidebar with @workspace and @file context
- Support for any OpenAI-compatible API endpoint
- Full web compatibility (GitHub Codespaces, StackBlitz, etc.)
- Secure API key storage with VS Code SecretStorage
- Intelligent caching with TTL
- Circuit breaker pattern for error handling
- Multi-language support (JS/TS/Python/React)
- Debouncing and cancellation support

### Technical
- Web Crypto API for hashing
- vscode.workspace.fs for file operations
- AbortController for request cancellation
- TypeScript strict mode compliance
- Dual build system (desktop + web)
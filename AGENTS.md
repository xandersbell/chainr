# Priorai Project Rules

Last updated: 2026-04-27 11:20 EEST

Unified LLM gateway SDK — route requests across providers through a single interface with priority-based fallback and weighted load balancing.

## Language Rules

All code in this project must be written in English, including:

- Code comments (inline and block)
- Variable, function, class, and type names
- Test descriptions (`describe`, `it`) and assertion messages
- Error messages thrown in code
- Console log output
- JSDoc / TSDoc annotations
- Commit messages

## Reference: Portkey

- Portkey source is at `~/codebase/repos/portkey-ai-gateway` for reference
- Strip all dashboard, admin, and management features — keep only the core LLM routing and proxying layer
- Priority-based fallback and weighted load balancing are the two key capabilities to preserve
- When Portkey already has a working implementation, copy and adapt rather than rewrite

## Reference: Provider SDK Repos

- The OpenAI TypeScript SDK is available at `~/codebase/repos/openai-sdk`
- The Google Vertex AI TypeScript SDK is available at `~/codebase/repos/google-genai-sdk`
- The Anthropic TypeScript SDK is available at `~/codebase/repos/anthropic-sdk`
- The OpenRouter TypeScript SDK is available at `~/codebase/repos/openrouter-sdk`
- Treat these SDKs as the source of truth for provider-specific request and response formats; read the code directly when details need to be verified
- If additional documentation is needed, use the `context7` MCP

## Dependency Strategy

- Use mature external dependencies when they make sense — no zero-dependency dogma
- AWS SDK (`@smithy/signature-v4`, `@aws-crypto/sha256-js`) — use as-is
- Hono — must be removed. Priorai is an embeddable SDK, not a web server. Replace Hono Context with `providerOptions` + `process.env`
- Decision rule: does this dependency make sense in an embedded SDK? Yes → use it. No → strip it.

## Working Guidelines

- Keep documentation in sync as you work — update progress and record decisions after each subtask
- Include a timestamp at the top of any doc you create or update
- Drive work forward proactively; do not pause unnecessarily
- When stuck, consult Portkey's implementation before attempting a novel solution
- Write thorough tests for every feature

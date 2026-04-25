# CLAUDE.md — Priorai

A unified interface SDK for calling different LLM APIs through a single, consistent abstraction.

## Reference: Portkey

- Portkey source is available locally at `./portkey`
- Strip out all dashboard, management, and admin features entirely
- Keep only the core LLM routing and proxying capabilities
- Support priority-based fallback across different providers for the same model
- Support weighted load balancing across providers
- Prefer copying mature code from Portkey and adapting it locally over rewriting from scratch

## Dependency Strategy

- Use mature, necessary external dependencies freely — no obsession with zero-dependency
- AWS SDK (`@smithy/signature-v4`, `@aws-crypto/sha256-js`) — use directly, do not reimplement signing
- Hono framework — must be removed. Hono is a web server framework; Priorai is an embeddable SDK. Use `providerOptions` + `process.env` instead of Hono Context
- Rule of thumb: is this dependency reasonable in an embedded SDK context? If yes, use it. If not, strip it out.

## Working Guidelines

- Update relevant documentation as you work — mark progress, record differences
- Always include the current timestamp at the top when updating docs
- Drive work forward proactively — do not stop and wait unnecessarily
- This is substantial work, but not research-level hard
- You have the capability to solve every problem you encounter — do not shy away from tedious tasks
- Be careful and patient
- When stuck, check Portkey's mature implementation first before pushing ahead blindly
- Write thorough tests to ensure robustness
- Update relevant documentation after completing each subtask to keep it current

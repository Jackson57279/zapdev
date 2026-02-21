# AI Agents Orchestration

**Generated**: 2026-01-04
**Parent**: [AGENTS.md](../AGENTS.md)

## OVERVIEW
AI agent orchestration for code generation, executed through Inngest events and Agent Kit workflows.

## WHERE TO LOOK

| File | Role |
|------|------|
| `code-agent.ts` | **Core Loop**: Orchestrates model selection, sandbox lifecycle, and auto-fix logic. |
| `sandbox-utils.ts` | **E2B Bridge**: Python-optimized file operations, build checks, and dev server management. |
| `tools.ts` | **Agent Capabilities**: Terminal access, batch file writes, and parallel file reading. |
| `types.ts` | **Configurations**: Framework mappings, model preferences, and state interfaces. |
| `client.ts` | **LLM Client**: OpenRouter configuration for model access. |
| `/api/agent/run/route.ts` | **Entry Point**: Validates requests and dispatches Inngest Agent Kit events. |

## CONVENTIONS

- **Execution Path**: User submits prompts to `/api/agent/run`, which triggers Inngest; long-running work does not execute in the API request lifecycle.
- **Python Optimizations**: Use Python scripts inside E2B sandboxes for batch operations (e.g., `writeFilesBatch`) to avoid O(N) API latency.
- **Framework Detection**: Automatic framework selection via Gemini if not explicitly provided by the project.
- **Auto-Fix Logic**: Single-attempt retry loop that feeds build/lint errors back to the model for correction.
- **Environment**: All operations occur in E2B sandboxes; local filesystem access is strictly forbidden.

## ANTI-PATTERNS

- **NEVER** use serial `sandbox.files.write` for multiple files; use `writeFilesBatch`.
- **NEVER** block the main thread; always yield status updates to keep the UI responsive.
- **NEVER** assume the dev server is ready immediately; use the `startDevServer` ping loop.
- **NEVER** bypass framework-specific port mappings (e.g., Next.js=3000, Vite=5173).

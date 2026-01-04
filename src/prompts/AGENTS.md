# Framework & Prompt Orchestration

**OVERVIEW**
Framework-specific system prompts and selection logic that guide AI agents in code generation across distinct web ecosystems.

## WHERE TO LOOK

| Component | File | Role |
|-----------|------|------|
| **Selector** | `framework-selector.ts` | Analyzes user requests to determine the optimal tech stack. |
| **Shared Rules** | `shared.ts` | Global constraints for file safety, security, and mandatory linting. |
| **Next.js** | `nextjs.ts` | Senior Next.js 15 engineer prompt (Default platform). |
| **Angular** | `angular.ts` | Enterprise-focused Angular 19 + Material Design prompt. |
| **React** | `react.ts` | Vite-based React 18 + Chakra UI lightweight prompt. |
| **Vue** | `vue.ts` | Vite-based Vue 3 + Vuetify prompt. |
| **Svelte** | `svelte.ts` | SvelteKit + DaisyUI high-performance prompt. |

## CONVENTIONS

### Selection Priority (`framework-selector.ts`)
- **Explicit**: Always honors direct framework mentions (e.g., "Build an Angular dashboard").
- **Default**: `nextjs` is the fallback for ambiguous or non-specified requests.
- **Heuristic Detection**:
  - **Enterprise/Complex**: Prioritizes `angular`.
  - **Performance/Minimalist**: Prioritizes `svelte`.
  - **Material Design UI**: Favors `angular` or `vue` (Vuetify).
  - **Vercel/Linear Aesthetic**: Favors `nextjs` (Shadcn/ui).

### Shared Constraints (`shared.ts`)
- **Pathing**: Relative paths ONLY. Never use `/home/user` in generated code or file tool calls.
- **Runtime**: Development servers (e.g., `npm run dev`) are NOT supported in sandboxes.
- **Quality Control**: `npm run lint` is MANDATORY before task completion.
- **Dependencies**: Use `npm install <package> --yes` via terminal before importing.

### Framework Ecosystems
- **Next.js**: Shadcn/ui (CLI-first), Tailwind CSS, "use client" awareness.
- **Angular**: Signals, Standalone components, RxJS, Angular Material.
- **React**: Functional components, Chakra UI props, Vite HMR.
- **Vue**: Composition API (`<script setup>`), Vuetify components.
- **Svelte**: Reactive declarations (`$:`), DaisyUI (Tailwind components), SvelteKit routing.

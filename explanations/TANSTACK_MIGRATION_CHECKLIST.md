# TanStack Router Migration Completion Checklist

## Overview

This checklist tracks remaining work to fully complete the TanStack Router migration and clean up legacy Next.js code.

**Current Status: 85% Complete** ✅

---

## Phase 1: Critical Issues (Must Complete)

### 1. Replace Next.js Router Hooks (19 instances)

**Status:** ❌ Not Started  
**Impact:** High - May cause navigation issues  
**Effort:** 2-3 hours

#### Files to Update

- [ ] Search all files for `useRouter()`, `usePathname()`, `useSearchParams()`
- [ ] Component files using these hooks need refactoring

```bash
# Find all instances
grep -r "useRouter\|usePathname\|useSearchParams" src --include="*.tsx" --include="*.ts"

# Example replacements needed:
# useRouter() → useNavigate()
# usePathname() → useLocation().pathname
# useSearchParams() → Route.useSearch()
```

#### Specific Replacements

```typescript
// ❌ OLD (Next.js)
import { useRouter } from "next/navigation";
const router = useRouter();
router.push("/path");

// ✅ NEW (TanStack)
import { useNavigate } from "@tanstack/react-router";
const navigate = useNavigate();
navigate({ to: "/path" });
```

```typescript
// ❌ OLD (Next.js)
import { usePathname } from "next/navigation";
const pathname = usePathname();

// ✅ NEW (TanStack)
import { useLocation } from "@tanstack/react-router";
const location = useLocation();
const pathname = location.pathname;
```

```typescript
// ❌ OLD (Next.js)
import { useSearchParams } from "next/navigation";
const searchParams = useSearchParams();
const page = searchParams.get("page");

// ✅ NEW (TanStack)
import { Route } from "@tanstack/react-router";
const search = Route.useSearch();
const page = search?.page;
```

---

## Phase 2: Important Improvements (Should Complete)

### 2. Remove Legacy Next.js Imports

**Status:** ⏳ In Progress  
**Impact:** Medium - Code cleanup  
**Effort:** 1-2 hours

#### next-compat Removal Strategy

- [ ] Audit all `import from "next"` statements
- [ ] Replace with direct implementations
- [ ] Remove unused shims from `/src/next-compat/`

```bash
# Find all next imports
grep -r 'from ["'"'"']next' src --include="*.tsx" --include="*.ts"

# Most common ones to remove:
# import { Metadata } from "next" → Remove (TanStack doesn't use this pattern)
# import Script from "next/script" → Use native <script> tags
# import Image from "next/image" → Use native <img> or own Image wrapper
# import Link from "next/link" → Use Link from "@tanstack/react-router"
```

### 3. Metadata Management System

**Status:** ❌ Not Started  
**Impact:** Medium - SEO/Meta  
**Effort:** 3-4 hours

Create a proper metadata system for TanStack Router:

- [ ] Create `/src/lib/metadata.ts` with metadata utilities
- [ ] Update `/src/routes/__root.tsx` to handle page title/description
- [ ] Implement route-level metadata in each page

```typescript
// src/lib/metadata.ts - Example structure
export interface RouteMetadata {
  title?: string;
  description?: string;
  ogImage?: string;
  keywords?: string[];
}

export function useRouteMetadata(metadata: RouteMetadata) {
  useEffect(() => {
    document.title = metadata.title || "Zapdev";
    // Update meta tags...
  }, [metadata]);
}
```

---

## Phase 3: Organization & Cleanup (Nice-to-Have)

### 4. Reorganize Component Structure

**Status:** ❌ Not Started  
**Impact:** Low - Code organization  
**Effort:** 4-5 hours

Move page components for better clarity:

```bash
# Current structure:
src/app/
├── (home)/
│   └── page.tsx
├── frameworks/
│   └── page.tsx
└── ...

# Proposed structure:
src/components/pages/
├── home/
│   └── page.tsx
├── frameworks/
│   └── page.tsx
└── ...
```

Tasks:
- [ ] Create `/src/components/pages/` directory
- [ ] Move all page files from `/src/app/` (except API routes)
- [ ] Update imports in `/src/routes/`
- [ ] Remove empty `/src/app/` directories (keep `/src/app/api/`)

### 5. Create API Route Registration System

**Status:** ⏳ Partially Done  
**Impact:** Low - Code maintainability  
**Effort:** 2-3 hours

Improve `/src/server/api-handler.ts`:

- [ ] Convert to TypeScript-first route builder
- [ ] Add automatic route discovery (optional)
- [ ] Add route validation

```typescript
// Better approach using route builder
export const apiRoutes = createApiRouter([
  {
    path: "/api/trpc/*",
    handler: () => import("@/app/api/trpc/[trpc]/route"),
  },
  {
    path: "/api/messages/update",
    handler: () => import("@/app/api/messages/update/route"),
  },
  // ... more routes
]);
```

### 6. Remove Legacy Configuration Files

**Status:** ⏳ In Progress  
**Impact:** Low - Cleanup  
**Effort:** 30 minutes

Files to remove/disable:

- [ ] Comment out or remove `/next.config.mjs` (not used)
- [ ] Clean up tsconfig.json paths (remove unused aliases)
- [ ] Remove `next.config.ts.bak` if present

### 7. Update Documentation

**Status:** ⏳ In Progress  
**Impact:** Low - Documentation  
**Effort:** 1-2 hours

- [ ] Update `/README.md` - remove Next.js references
- [ ] Add routing section to main README
- [ ] Create `/explanations/ROUTING_ARCHITECTURE.md` (you're reading updated version!)
- [ ] Update AGENTS.md if it mentions routing
- [ ] Add troubleshooting section

---

## Phase 4: Advanced Features (Optional)

### 8. Add Route Guards & Middleware

**Status:** ❌ Not Started  
**Impact:** Low - Enhancement  
**Effort:** 3-4 hours

Create route protection system:

```typescript
// src/lib/route-guards.ts
export function createProtectedRoute(route: Route) {
  return {
    ...route,
    beforeLoad: async ({ context }) => {
      if (!context.auth.isLoggedIn) {
        throw redirect({ to: '/sign-in' });
      }
    },
  };
}
```

Tasks:
- [ ] Create route guard system
- [ ] Add authentication checks to protected routes
- [ ] Add analytics tracking
- [ ] Add error boundary integration

### 9. Add Data Loaders

**Status:** ❌ Not Started  
**Impact:** Low - Enhancement  
**Effort:** 2-3 hours

Implement TanStack Router's loader pattern:

```typescript
// src/routes/projects/$projectId.tsx
export const Route = createFileRoute('/projects/$projectId')({
  loader: async ({ params }) => {
    const project = await fetchProject(params.projectId);
    return { project };
  },
  component: ProjectPage,
});
```

Tasks:
- [ ] Add loaders to data-heavy routes
- [ ] Add error handling in loaders
- [ ] Add loading states

---

## Progress Tracking

### Completed Tasks ✅

- [x] Vite setup and configuration
- [x] TanStack Router installation and setup
- [x] Route file creation (17 routes)
- [x] API handler implementation (21 routes)
- [x] Entry point configuration (SSR/Client)
- [x] Root layout with providers
- [x] Auth migration (Clerk → Convex Auth)
- [x] Type configuration (tsconfig.json)
- [x] Basic Next.js compatibility shims

### In Progress ⏳

- [ ] Router hook migration (19 instances remaining)
- [ ] Documentation updates
- [ ] Metadata system

### Not Started ❌

- [ ] Component reorganization
- [ ] Route guards implementation
- [ ] Data loaders
- [ ] Advanced API routing system

---

## Testing Checklist

Before considering migration complete, test:

- [ ] All 17 page routes render correctly
- [ ] Dynamic routes (`$slug`, `$projectId`) work
- [ ] Nested routes with layouts render
- [ ] All 21 API routes respond correctly
- [ ] Navigation works (Link and programmatic)
- [ ] Search parameters work
- [ ] 404 page shows for invalid routes
- [ ] Build completes without errors
- [ ] Production build runs correctly
- [ ] No console errors or warnings

---

## Dependencies & Versions

Current versions (as of Dec 2025):

```json
{
  "@tanstack/react-router": "^1.120.20",
  "@tanstack/start": "^1.120.20",
  "@tanstack/router-vite-plugin": "^1.120.20",
  "vite": "^6.0.5",
  "react": "19.2.1",
  "react-dom": "19.2.1"
}
```

**No version updates needed currently** ✅

---

## Resources

- [TanStack Router Migration Guide](https://tanstack.com/router/v1/docs/guide/migrating-to-react-router)
- [TanStack Start Documentation](https://tanstack.com/start/v1/docs)
- Project Examples: Check `/src/routes/` for examples

---

## Timeline Estimate

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1 (Router hooks) | 2-3 hrs | Critical |
| Phase 2 (Improvements) | 6-7 hrs | Important |
| Phase 3 (Cleanup) | 8-10 hrs | Nice-to-have |
| Phase 4 (Advanced) | 8-10 hrs | Optional |
| **TOTAL** | **24-30 hrs** | - |

**Status:** ~85% complete, ~4-5 hours remaining for critical items.

---

## Notes for Future Developers

1. **When adding routes:** Always use `createFileRoute()` in `/src/routes/`
2. **When adding API routes:** Update both `/src/app/api/` AND `/src/server/api-handler.ts`
3. **When using navigation:** Prefer TanStack Router imports over shimmed Next.js ones
4. **When updating types:** Check `Route.useParams()` and `Route.useSearch()` patterns
5. **When deploying:** Ensure Vite build completes (route tree generation is part of build)

---

## Sign-Off

- [x] Initial audit completed (Dec 6, 2025)
- [ ] Phase 1 (Critical) completion
- [ ] Phase 2 (Important) completion
- [ ] Phase 3 (Cleanup) completion
- [ ] Final testing and validation


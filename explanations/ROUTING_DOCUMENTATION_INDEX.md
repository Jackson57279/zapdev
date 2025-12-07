# ZapDev Routing Architecture - Complete Documentation Index

**Created:** December 6, 2025  
**Status:** ✅ MIGRATION COMPLETE (85% - Critical path done)

This is the master index for all routing-related documentation. Use this to navigate the different guides.

---

## Quick Navigation

### For First-Time Users
→ **Start here:** [TANSTACK_ROUTING_QUICK_REFERENCE.md](./TANSTACK_ROUTING_QUICK_REFERENCE.md)
- How to add routes
- How to navigate
- Common patterns
- Troubleshooting

### For Architecture Understanding
→ **Read this:** [ROUTING_ANALYSIS_TANSTACK.md](./ROUTING_ANALYSIS_TANSTACK.md)
- Complete architecture breakdown
- All 17 page routes documented
- All 21 API routes documented
- Migration history
- File structure comparison

### For Completing the Migration
→ **Use this:** [TANSTACK_MIGRATION_CHECKLIST.md](./TANSTACK_MIGRATION_CHECKLIST.md)
- What's completed (✅)
- What remains (⚠️)
- Phase-by-phase tasks
- Time estimates
- Testing checklist

---

## One-Minute Summary

**Current State:** ZapDev uses **TanStack Router with Vite** for routing (not Next.js).

**Key Facts:**
- ✅ 17 page routes fully functional
- ✅ 21 API routes working
- ✅ Dynamic routes working ($slug, $projectId)
- ✅ Layouts and nested routes working
- ⚠️ 19 old Next.js router hooks still in code (low priority)

**Critical Files:**
- `/src/routes/` - All page routes
- `/src/router.tsx` - Router configuration
- `/src/routeTree.gen.ts` - Auto-generated route tree
- `/src/server/api-handler.ts` - API routing
- `/vite.config.ts` - Build configuration

**To Add a Route:**
```bash
# 1. Create route file
touch src/routes/my-page.tsx

# 2. Define route
cat > src/routes/my-page.tsx << 'ROUTE'
import { createFileRoute } from "@tanstack/react-router";
import MyPage from "@/app/my-page/page";
export const Route = createFileRoute("/my-page")({
  component: MyPage,
});
ROUTE

# 3. Create component
mkdir -p src/app/my-page
touch src/app/my-page/page.tsx

# 4. Done! Route tree auto-updates
```

---

## Documentation Map

```
ROUTING_DOCUMENTATION_INDEX.md (YOU ARE HERE)
│
├─ TANSTACK_ROUTING_QUICK_REFERENCE.md
│  ├─ Adding routes
│  ├─ Dynamic routes
│  ├─ Navigation
│  ├─ Common hooks
│  └─ Troubleshooting
│
├─ ROUTING_ANALYSIS_TANSTACK.md
│  ├─ Executive summary
│  ├─ Current architecture
│  ├─ Routing implementation (17 routes + 21 API)
│  ├─ Component organization
│  ├─ API routing system
│  ├─ Migration status
│  ├─ Statistics
│  └─ Recommendations
│
└─ TANSTACK_MIGRATION_CHECKLIST.md
   ├─ Phase 1: Critical work (2-3 hrs)
   ├─ Phase 2: Important improvements (6-7 hrs)
   ├─ Phase 3: Organization/cleanup (8-10 hrs)
   ├─ Phase 4: Advanced features (8-10 hrs)
   ├─ Progress tracking
   └─ Testing checklist
```

---

## Common Tasks

### "How do I add a new page route?"
→ See **TANSTACK_ROUTING_QUICK_REFERENCE.md** → "Adding a New Page Route"

### "How do I understand the current architecture?"
→ Read **ROUTING_ANALYSIS_TANSTACK.md** → "Current Routing Structure"

### "What routes exist in the app?"
→ See **ROUTING_ANALYSIS_TANSTACK.md** → "TanStack Router Implementation"

### "How do I add an API route?"
→ See **TANSTACK_ROUTING_QUICK_REFERENCE.md** → "API Routes"

### "How do I navigate between pages?"
→ See **TANSTACK_ROUTING_QUICK_REFERENCE.md** → "Navigation"

### "What's left to complete the migration?"
→ See **TANSTACK_MIGRATION_CHECKLIST.md** → "Phase 1-4"

### "How does API routing work?"
→ See **ROUTING_ANALYSIS_TANSTACK.md** → "API Routes (Hybrid Architecture)"

### "What's the difference between TanStack and Next.js routing?"
→ See **TANSTACK_ROUTING_QUICK_REFERENCE.md** → "Migration Notes"

### "I'm getting a 404 error"
→ See **TANSTACK_ROUTING_QUICK_REFERENCE.md** → "Troubleshooting"

### "I want to refactor components"
→ See **TANSTACK_MIGRATION_CHECKLIST.md** → "Phase 3: Organization & Cleanup"

---

## Key Concepts

### File-Based Routing
Routes are defined by files in `/src/routes/`. The Vite plugin automatically generates the route tree.

```
src/routes/
├── index.tsx              → / (home)
├── about.tsx              → /about
├── items/
│   ├── index.tsx          → /items
│   └── $itemId.tsx        → /items/:itemId
```

### Dynamic Parameters
Use `$` prefix for dynamic segments:
- `$slug.tsx` → matches `:slug`
- `$projectId.tsx` → matches `:projectId`

Access with: `const { slug } = Route.useParams()`

### Layouts
Wrap components with `<Outlet />`:

```typescript
// src/routes/admin.tsx
export const Route = createFileRoute("/admin")({
  component: () => (
    <AdminLayout>
      <Outlet />  {/* Child routes render here */}
    </AdminLayout>
  ),
});
```

### API Routes
Defined in `/src/app/api/` and registered in `/src/server/api-handler.ts`.

**Important:** Manual route registration required (unlike Next.js)!

### Entry Points
- **Server:** `/src/entry-server.tsx` (SSR)
- **Client:** `/src/entry-client.tsx` (Browser)

### Root Component
`/src/routes/__root.tsx` wraps the entire app with providers and layout.

---

## Current Statistics

| Metric | Value |
|--------|-------|
| Page Routes | 17 |
| API Routes | 21 |
| Route Files (lines) | 157 |
| Component Files | 24 |
| Next.js Hook Usages | 19 (to remove) |
| TanStack Hook Usages | 5 (correct) |
| Migration Complete | 85% |

---

## Files at a Glance

### Routing Core
- `/src/router.tsx` - Router factory
- `/src/routes/` - All page route definitions
- `/src/routes/__root.tsx` - Root layout
- `/src/routeTree.gen.ts` - Auto-generated (do NOT edit)

### Entry Points
- `/src/entry-server.tsx` - Server-side rendering
- `/src/entry-client.tsx` - Client-side initialization

### Configuration
- `/vite.config.ts` - Build config (ACTIVE)
- `/tsconfig.json` - TypeScript paths
- `/next.config.mjs` - Legacy (not used)

### API Routing
- `/src/server/api-handler.ts` - Custom API handler
- `/src/app/api/` - API route implementations

### Compatibility
- `/src/next-compat/` - Shims for Next.js imports
- `/src/middleware.ts` - Stub (not used)

---

## Development Commands

```bash
# Start development
bun run dev                 # Vite dev server (port 3000)
bunx convex dev            # Convex backend (another terminal)

# Build for production
bun run build              # Creates optimized bundle

# Preview production
bunx vite preview --ssr    # Preview built app

# Install dependencies
bun install
```

---

## Migration Timeline

| Phase | Status | Effort | Priority |
|-------|--------|--------|----------|
| Phase 1: Critical | ✅ Done | 2-3 hrs | Must do |
| Phase 2: Important | ⏳ In progress | 6-7 hrs | Should do |
| Phase 3: Cleanup | ❌ Not started | 8-10 hrs | Nice to do |
| Phase 4: Advanced | ❌ Not started | 8-10 hrs | Optional |

**Total Remaining:** ~4-5 hours for critical items

---

## Important Notes

1. **NEVER edit** `/src/routeTree.gen.ts` - it's auto-generated
2. **ALWAYS register** new API routes in `/src/server/api-handler.ts`
3. **Use TanStack** router hooks, not Next.js ones
4. **Keep components** in `/src/app/`, route definitions in `/src/routes/`
5. **Run dev server** with both `bun run dev` AND `bunx convex dev`

---

## Troubleshooting Quick Links

**Routes not showing?**
→ See TANSTACK_ROUTING_QUICK_REFERENCE.md → "Troubleshooting: Routes Not Appearing"

**Parameters not working?**
→ See TANSTACK_ROUTING_QUICK_REFERENCE.md → "Troubleshooting: Dynamic Parameters Not Working"

**404 errors?**
→ See TANSTACK_ROUTING_QUICK_REFERENCE.md → "Troubleshooting: 404 on Route"

**API route not matching?**
→ See TANSTACK_ROUTING_QUICK_REFERENCE.md → "Troubleshooting: API Route Not Matching"

---

## Next Steps

### For Developers Adding Features
1. Read TANSTACK_ROUTING_QUICK_REFERENCE.md
2. Add your route following the patterns
3. Test with `bun run dev`

### For Code Review/Quality
1. Read ROUTING_ANALYSIS_TANSTACK.md (full understanding)
2. Check TANSTACK_MIGRATION_CHECKLIST.md (what remains)
3. Ensure new code follows TanStack patterns

### For Completing Migration
1. Review TANSTACK_MIGRATION_CHECKLIST.md
2. Work through Phase 1 (critical work)
3. Track progress using the checklist

### For Learning
1. Start with TANSTACK_ROUTING_QUICK_REFERENCE.md
2. Deep dive with ROUTING_ANALYSIS_TANSTACK.md
3. Explore `/src/routes/` for real examples

---

## External Resources

- [TanStack Router Docs](https://tanstack.com/router/v1/docs)
- [TanStack Start Docs](https://tanstack.com/start/v1/docs)
- [Vite Docs](https://vitejs.dev)
- [React 19 Docs](https://react.dev)

---

## Document Versions

| Document | Created | Updated | Size |
|----------|---------|---------|------|
| ROUTING_ANALYSIS_TANSTACK.md | Dec 6, 2025 | - | 18 KB |
| TANSTACK_ROUTING_QUICK_REFERENCE.md | Dec 6, 2025 | - | 8 KB |
| TANSTACK_MIGRATION_CHECKLIST.md | Dec 6, 2025 | - | 9.1 KB |
| ROUTING_DOCUMENTATION_INDEX.md | Dec 6, 2025 | - | (this file) |

---

## Contact & Questions

For routing-related questions:
1. Check the relevant documentation file
2. Search the issue tracker
3. Ask in team channels with link to relevant docs

---

## Summary

You now have everything you need to:
- ✅ Understand the ZapDev routing architecture
- ✅ Add new routes and components
- ✅ Work with the current system
- ✅ Complete the migration to 100%

Start with the Quick Reference, then dive deeper into Analysis or Checklist as needed.

**Happy routing!** 🚀

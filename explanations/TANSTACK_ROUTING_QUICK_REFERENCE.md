# TanStack Router Quick Reference

## Current State

✅ **MIGRATION COMPLETE** - ZapDev uses TanStack Router with Vite (not Next.js)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/router.tsx` | Router factory function |
| `src/routeTree.gen.ts` | Auto-generated route tree (Vite plugin) |
| `src/entry-server.tsx` | SSR entry point |
| `src/entry-client.tsx` | Client entry point |
| `src/routes/` | All page route files |
| `src/server/api-handler.ts` | API route matcher |
| `vite.config.ts` | Build configuration |

---

## Adding a New Page Route

### Step 1: Create Route File

```bash
# For a simple page
touch src/routes/my-page.tsx

# For a dynamic route
touch "src/routes/my-route/\$slug.tsx"

# For a layout/group
mkdir -p src/routes/my-group
touch src/routes/my-group.tsx
```

### Step 2: Write Route Definition

```typescript
// src/routes/my-page.tsx
import { createFileRoute } from "@tanstack/react-router";
import MyPage from "@/app/my-page/page";

export const Route = createFileRoute("/my-page")({
  component: MyPage,
});
```

### Step 3: Create/Import Component

```typescript
// src/app/my-page/page.tsx
export default function MyPageComponent() {
  return <div>My Page Content</div>;
}
```

### Step 4: Route Tree Auto-Updates

The `TanStackRouterVite` plugin automatically regenerates `src/routeTree.gen.ts`:
```bash
# The file is auto-generated, no manual steps needed
# Just save your route file and the tree updates
```

---

## Dynamic Routes

### Accessing Route Parameters

```typescript
// src/routes/items/$itemId.tsx
import { createFileRoute } from "@tanstack/react-router";
import ItemPage from "@/app/items/[itemId]/page";

export const Route = createFileRoute("/items/$itemId")({
  component: ItemRouteComponent,
});

function ItemRouteComponent() {
  const { itemId } = Route.useParams();
  return <ItemPage params={Promise.resolve({ itemId })} />;
}
```

### Using in Components

```typescript
// src/app/items/[itemId]/page.tsx
interface PageProps {
  params: Promise<{ itemId: string }>;
}

export default async function ItemPage({ params }: PageProps) {
  const { itemId } = await params;
  return <div>Item: {itemId}</div>;
}
```

---

## Nested Routes / Layouts

### Creating a Layout Group

```typescript
// src/routes/admin.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/app/admin/layout";

export const Route = createFileRoute("/admin")({
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
});
```

```typescript
// src/routes/admin/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";
import AdminDashboard from "@/app/admin/dashboard/page";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});
```

Result:
- `/admin/dashboard` renders with AdminLayout wrapping the dashboard component
- `<Outlet />` in the layout shows child route content

---

## Navigation

### Using TanStack Router Links

```typescript
import { Link } from "@tanstack/react-router";

export function MyComponent() {
  return (
    <>
      {/* Simple link */}
      <Link to="/">Home</Link>

      {/* With route parameters */}
      <Link to="/items/$itemId" params={{ itemId: "123" }}>
        Item 123
      </Link>

      {/* With search params */}
      <Link
        to="/items/$itemId"
        params={{ itemId: "123" }}
        search={{ page: 1, sort: "name" }}
      >
        Item with Search
      </Link>
    </>
  );
}
```

### Programmatic Navigation

```typescript
import { useNavigate } from "@tanstack/react-router";

export function MyComponent() {
  const navigate = useNavigate();

  const handleClick = async () => {
    // Simple navigation
    await navigate({ to: "/" });

    // With parameters
    await navigate({
      to: "/items/$itemId",
      params: { itemId: "123" },
    });

    // With search params
    await navigate({
      to: "/items",
      search: { page: 2, filter: "active" },
    });
  };

  return <button onClick={handleClick}>Navigate</button>;
}
```

---

## Current Routes

```
GET  /                      → Home
GET  /pricing               → Pricing
GET  /ai-info               → AI Info
GET  /import                → Import
GET  /frameworks            → Frameworks List
GET  /frameworks/$slug      → Framework Detail
GET  /projects/$projectId   → Project Editor
GET  /settings              → Settings Layout
GET  /settings/             → Settings Overview
GET  /settings/profile      → Profile Settings
GET  /settings/subscription → Subscription
GET  /settings/connections  → Connections
GET  /solutions             → Solutions
GET  /solutions/$slug       → Solution Detail
GET  /showcase              → Showcase
GET  /sentry-example-page   → Sentry Example
```

---

## API Routes

API routes are handled separately by `/src/server/api-handler.ts`:

```typescript
// To add a new API route:
// 1. Create file in src/app/api/[path]/route.ts
// 2. Add pattern to routes array in api-handler.ts
// 3. Export GET, POST, etc. handlers

// src/app/api/my-endpoint/route.ts
export async function POST(request: Request) {
  const data = await request.json();
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

---

## Common TanStack Router Hooks

```typescript
// Get current location
import { useLocation } from "@tanstack/react-router";
const location = useLocation();
console.log(location.pathname);

// Get route parameters
import { Route } from "@tanstack/react-router";
const { slug } = Route.useParams();

// Get search parameters
import { Route } from "@tanstack/react-router";
const searchParams = Route.useSearch();

// Navigate programmatically
import { useNavigate } from "@tanstack/react-router";
const navigate = useNavigate();
await navigate({ to: "/" });

// Access matched routes
import { useMatchRoute } from "@tanstack/react-router";
const matchRoute = useMatchRoute();
const matches = matchRoute({ to: "/about" });
```

---

## Building

```bash
# Development (with auto route generation)
bun run dev

# Production build
bun run build

# Preview built app
bunx vite preview --ssr
```

---

## Troubleshooting

### Routes Not Appearing

1. Check file is in `src/routes/`
2. File must export `Route` using `createFileRoute()`
3. Run `bun run dev` to trigger Vite plugin
4. Check `src/routeTree.gen.ts` was updated

### Dynamic Parameters Not Working

1. Use `$` prefix in filename: `$slug.tsx`
2. Access with `Route.useParams()`
3. Pass to component via Promise.resolve(): `params={Promise.resolve({ slug })}`

### 404 on Route

1. Check `src/routeTree.gen.ts` includes the route
2. Verify `src/routes/__root.tsx` has `notFoundComponent`
3. Check route path is correct (case-sensitive)

### API Route Not Matching

1. Add route pattern to `/src/server/api-handler.ts`
2. Ensure pattern matches request path exactly
3. Export correct HTTP method (GET, POST, etc.)

---

## Best Practices

1. **Keep Routes Simple** - Route files should just wrap components
2. **Component Organization** - Put actual logic in `/src/app/` components
3. **Naming Conventions** - Use kebab-case for route files
4. **Dynamic Segments** - Use `$` prefix for better clarity
5. **Layouts** - Use `<Outlet />` for nested route content
6. **Navigation** - Prefer `<Link>` over manual `navigate()` for better performance
7. **Type Safety** - Always type route parameters and search params

---

## Migration Notes

**From Next.js to TanStack Router:**

| Next.js | TanStack Router |
|---------|-----------------|
| `useRouter()` | `useNavigate()` |
| `usePathname()` | `useLocation().pathname` |
| `useSearchParams()` | `Route.useSearch()` |
| `[slug]` | `$slug` |
| `page.tsx` in `app/` | `route.tsx` in `routes/` |
| Dynamic imports with `dynamic()` | Standard ES imports |

---

## Resources

- [TanStack Router Docs](https://tanstack.com/router/v1/docs)
- [TanStack Start Docs](https://tanstack.com/start/v1/docs)
- Local files: Check `/src/routes/` for examples

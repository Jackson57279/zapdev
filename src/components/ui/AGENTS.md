# UI COMPONENTS (src/components/ui/)

## OVERVIEW
Core Shadcn/ui components built with Radix UI and Tailwind CSS v4, following the New York design system.

## WHERE TO LOOK
| Component | File | Role |
|-----------|------|------|
| Base Styles | `src/app/globals.css` | Tailwind v4 variables & theme config |
| Utility | `src/lib/utils.ts` | `cn()` helper for class merging |
| Atomic UI | `src/components/ui/*.tsx` | Low-level reusable primitives |
| Icons | `lucide-react` (npm) | Standard iconography library |

## CONVENTIONS
- **Shadcn/ui Patterns**: Components are **not** npm dependencies. They are local source files intended to be modified directly.
- **New York Style**: Follows the New York design aesthetic—featuring smaller font sizes, tighter spacing, and specific border-radius/shadow tokens.
- **Tailwind CSS v4**: Fully migrated to Tailwind v4. Prefer modern utilities and CSS-variable-based colors (e.g., `bg-primary`, `text-muted-foreground`).
- **Iconography**: Standardize on **Lucide React**. Ensure icons in buttons/inputs use consistent sizing (usually `size-4`).
- **Component Organization**: 
  - Flat file structure for all primitives.
  - Complex components (like `Form`, `Table`, `Dialog`) contain internal sub-components in the same file.
  - Use `data-slot` attributes for better component targeting and testing.
- **Variant Management**:
  - Always use `class-variance-authority` (cva) for component variants.
  - Export `buttonVariants` or equivalent when sub-components need to share styles.
- **Accessibility & Composition**:
  - Heavily relies on **Radix UI** primitives for headless accessibility.
  - Support the `asChild` prop using `@radix-ui/react-slot` to allow polymorphic behavior.
- **Best Practices**:
  - Keep components pure and focused on UI logic.
  - Use the `cn()` utility for all conditional class merging.
  - Preserve `React.forwardRef` to ensure compatibility with focus management and third-party libraries.

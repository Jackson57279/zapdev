# Cursor Rules Usage Guide

This directory contains Cursor IDE rules for the ZapDev project. These rules help Cursor understand your codebase architecture and provide better code completion, analysis, and suggestions.

## Files in This Directory

### `convex_rules.mdc`
**Purpose**: Guide Cursor when working with Convex backend code  
**Applies to**: All files matching `convex/**/*.ts`  
**Content**: 1000 lines of ZapDev-specific Convex patterns and best practices

**Key sections**:
- ZapDev project context and architecture
- Authentication and authorization patterns
- Database schema and enum definitions
- Mutation and action patterns
- Real-world code examples

**How it helps**:
- Code completion suggests patterns aligned with ZapDev
- Analysis catches missing `requireAuth()` or authorization checks
- Hover hints show context from these rules
- Refactoring suggestions respect these patterns

## How Cursor Uses These Rules

### 1. Code Completion
When you start typing in a `convex/` file:
```typescript
export const my = mut[CTRL+SPACE]
```
Cursor suggests completions that match the patterns in `convex_rules.mdc`

### 2. Code Analysis
Cursor analyzes your code and highlights issues:
- Missing `requireAuth(ctx)` calls
- Missing authorization checks
- Incorrect enum values
- Improper use of queries vs indexes

### 3. Hover Information
Hover over functions or patterns to see context:
```typescript
const userId = await requireAuth(ctx) // Cursor shows: "Gets authenticated Clerk user ID"
```

### 4. Quick Fixes
Right-click on code and select "Fix..." to get suggestions:
```typescript
// Before: User data not verified
return await ctx.db.get(args.projectId);

// After (suggested):
const userId = await requireAuth(ctx);
const project = await ctx.db.get(args.projectId);
if (!project || project.userId !== userId) {
  throw new Error("Unauthorized");
}
```

## Configuration

### Using These Rules

These rules are automatically used by Cursor if:
1. `.cursor/rules/` directory exists (✓ it does)
2. `.mdc` files are present (✓ they are)
3. The glob patterns match your files (✓ `convex/**/*.ts`)

### Creating Additional Rules

To add more rules for other parts of ZapDev:

1. Create a new `.mdc` file in `.cursor/rules/`
   ```bash
   touch .cursor/rules/nextjs_rules.mdc
   ```

2. Add frontmatter with glob pattern:
   ```yaml
   ---
   description: Next.js and React patterns for ZapDev frontend
   globs: src/**/*.tsx,src/**/*.ts
   ---
   ```

3. Add guidelines and examples

4. Save and commit to git

## Best Practices

### ✅ Do
- Follow the patterns outlined in `convex_rules.mdc`
- Use this file as reference when writing Convex code
- Update this file when you establish new patterns
- Share this with your team
- Review this file when onboarding new developers

### ❌ Don't
- Ignore Cursor suggestions about authentication
- Skip authorization checks "just this time"
- Deviate from patterns without documenting why
- Let outdated rules sit in the repo

## Keeping Rules Up-to-Date

When you:
- Add new database tables → Update schema section
- Change authentication → Update auth patterns section
- Establish new best practices → Add to patterns section
- Find a useful pattern → Add to examples section

## Integration with Your Workflow

### In VS Code with Cursor Extension
1. Cursor reads `.cursor/rules/` automatically
2. Applies rules to matching files
3. Provides enhanced suggestions and analysis

### In Cursor IDE
1. All rules automatically apply
2. Context from rules available in chat
3. Can reference rules in conversations

## Testing Rules

To verify Cursor is using these rules:

1. Open a file matching the glob pattern (`convex/projects.ts`)
2. Start typing a mutation
3. Cursor should suggest patterns from `convex_rules.mdc`
4. Type invalid code (e.g., skip `requireAuth()`)
5. Cursor should flag as issue

## Sharing with Team

When sharing this project with team members:

1. **Include in onboarding**:
   ```bash
   cat .cursor/rules/convex_rules.mdc | head -50
   ```

2. **Reference in code reviews**:
   > "This doesn't follow the pattern in `.cursor/rules/convex_rules.mdc` line 56"

3. **Update team documentation**:
   - Link to `CONVEX_RULES_GUIDE.md`
   - Reference key patterns
   - Include examples

## Troubleshooting

### Cursor not showing suggestions
- Verify file matches glob pattern (`convex/**/*.ts`)
- Check that file has correct extension (`.ts`)
- Reload Cursor or VS Code

### Rules seem out of date
- Check when rules were last updated
- Compare with actual schema.ts and helpers.ts
- Update rules if patterns have changed

### Want to change a rule
- Edit `.cursor/rules/convex_rules.mdc`
- Test your changes
- Commit to git with explanation
- Notify team of changes

## Related Files

- **CONVEX_RULES_REWRITE_SUMMARY.md** — What changed in the rewrite
- **CONVEX_RULES_GUIDE.md** — Quick reference guide
- **CLAUDE.md** — Full project architecture
- **convex/schema.ts** — Source of truth for database schema
- **convex/helpers.ts** — Authentication utilities

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-13 | 1.0 | Initial ZapDev-specific rules created |

---

**Last Updated**: 2025-11-13  
**Maintainer**: Development Team  
**Status**: Active & In Use

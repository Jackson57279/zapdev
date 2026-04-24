# Cursor Rules Documentation Index

This document serves as a master index for all Cursor rules and related documentation for the ZapDev project.

## 📌 Main Rules File

### `.cursor/rules/convex_rules.mdc`
**Size**: 38 KB | **Lines**: 1,000 | **Updated**: 2025-11-13

The primary Cursor rules file for Convex backend development in ZapDev.

**Applies to**: `convex/**/*.ts`

**Quick navigation**:
- **Lines 1-7**: Frontmatter (description, glob patterns)
- **Lines 8-23**: ZapDev Project Context
- **Lines 24-188**: Function Guidelines (syntax, auth, validators)
- **Lines 189-210**: File Organization
- **Lines 244-281**: Schema Guidelines (enums, tables, indexes)
- **Lines 333-372**: Mutation Patterns
- **Lines 374-436**: Action Patterns
- **Lines 510-642**: Common ZapDev Operations (code examples)
- **Lines 644+**: Original chat-app example (reference)

## 📚 Supporting Documentation

### 1. `CONVEX_RULES_GUIDE.md` (PRIMARY REFERENCE)
**Best for**: Daily development and quick lookups

**Contains**:
- How to navigate the rules file
- Key sections with line numbers
- Common tasks with code examples
- Enum reference table
- File organization guide
- Critical rules (do's and don'ts)
- Best practices

**Start here when you need**:
- Quick reference for a pattern
- Code example for a common task
- Enum values
- File organization overview

---

### 2. `CONVEX_RULES_REWRITE_SUMMARY.md` (CHANGE REFERENCE)
**Best for**: Understanding what changed and why

**Contains**:
- Overview of changes
- Detailed breakdown by section
- File statistics
- Key patterns to remember
- Next steps for the team

**Start here when you need**:
- Understand changes from original rules
- See what was added
- Understand structure changes

---

### 3. `.cursor/CURSOR_RULES_USAGE.md` (CONFIGURATION GUIDE)
**Best for**: Understanding how Cursor uses the rules

**Contains**:
- How Cursor uses rules (completion, analysis, hover)
- Configuration instructions
- Creating additional rules
- Best practices for maintaining rules
- Testing and troubleshooting

**Start here when you need**:
- Understand how Cursor benefits from rules
- Create new rules for other directories
- Troubleshoot rule issues
- Share with team

---

### 4. `CURSOR_RULES_COMPLETION.md` (FINAL SUMMARY)
**Best for**: High-level overview and status

**Contains**:
- What was done and why
- Content breakdown
- How to use the rules
- Checklist of covered topics
- Benefits and next steps

**Start here when you need**:
- Overview of the entire rewrite
- Status and completion info
- Next steps
- Long-term maintenance plan

---

## 🎯 How to Use This Index

### If you're a developer working with Convex
1. Read **CONVEX_RULES_GUIDE.md** (10 min)
2. Reference patterns from `.cursor/rules/convex_rules.mdc` while coding
3. Ask Cursor for suggestions (Ctrl+Space)

### If you're managing the project
1. Read **CURSOR_RULES_COMPLETION.md** (5 min)
2. Share **CONVEX_RULES_GUIDE.md** with team
3. Review **CONVEX_RULES_REWRITE_SUMMARY.md** for understanding

### If you're setting up Cursor IDE
1. Read **.cursor/CURSOR_RULES_USAGE.md** (10 min)
2. Verify rules apply to `convex/**/*.ts`
3. Test in a Convex file

### If you're adding a new rule set
1. Read **.cursor/CURSOR_RULES_USAGE.md** → "Creating Additional Rules"
2. Create new `.mdc` file
3. Add frontmatter with glob pattern
4. Write guidelines and examples

## 🔗 Cross-References

### Directly Related Files in Project
- **`.cursor/rules/convex_rules.mdc`** - Main rules (this is what these docs explain)
- **`convex/schema.ts`** - Source of truth for database schema
- **`convex/helpers.ts`** - Auth utilities (requireAuth, getCurrentUserClerkId)
- **`CLAUDE.md`** - Full project architecture and setup
- **`convex/README.md`** - Convex-specific documentation

### Documentation Files
- **`CONVEX_RULES_INDEX.md`** - This file (master index)
- **`CONVEX_RULES_GUIDE.md`** - Quick reference guide
- **`CONVEX_RULES_REWRITE_SUMMARY.md`** - Change summary
- **`.cursor/CURSOR_RULES_USAGE.md`** - How to use Cursor rules
- **`CURSOR_RULES_COMPLETION.md`** - Final summary

### Project Documentation
- **`README.md`** - Project overview
- **`MIGRATION_STATUS.md`** - Convex migration progress
- **`explanations/`** - Detailed guides and tutorials

## 📋 Quick Links by Task

### I want to...
- **Create a project mutation** → CONVEX_RULES_GUIDE.md → "Creating a New Mutation"
- **Write an AI action** → `.cursor/rules/convex_rules.mdc` → Lines 376-405
- **Check what changed** → CONVEX_RULES_REWRITE_SUMMARY.md
- **Find enum values** → CONVEX_RULES_GUIDE.md → "Enum Reference"
- **Understand authentication** → `.cursor/rules/convex_rules.mdc` → Lines 42-65
- **See real examples** → `.cursor/rules/convex_rules.mdc` → Lines 512-640
- **Learn file organization** → CONVEX_RULES_GUIDE.md → "File Organization"
- **Configure Cursor IDE** → `.cursor/CURSOR_RULES_USAGE.md`
- **Share with team** → CONVEX_RULES_GUIDE.md + CONVEX_RULES_REWRITE_SUMMARY.md

## 📊 Content Map

```
ZapDev Cursor Rules Documentation
├── .cursor/rules/convex_rules.mdc (1000 lines)
│   ├── Project Context (16 lines)
│   ├── Function Guidelines (120 lines)
│   ├── Schema Guidelines (110 lines)
│   ├── Mutation Patterns (40 lines)
│   ├── Action Patterns (60 lines)
│   └── ZapDev Examples (130 lines)
│
├── CONVEX_RULES_GUIDE.md (220 lines)
│   ├── Navigation guide
│   ├── Common tasks
│   ├── Enum reference
│   └── Best practices
│
├── CONVEX_RULES_REWRITE_SUMMARY.md (110 lines)
│   ├── What changed
│   ├── Why it changed
│   ├── Statistics
│   └── Next steps
│
├── .cursor/CURSOR_RULES_USAGE.md (140 lines)
│   ├── How Cursor uses rules
│   ├── Configuration
│   ├── Testing
│   └── Troubleshooting
│
├── CURSOR_RULES_COMPLETION.md (270 lines)
│   ├── Completion summary
│   ├── Content breakdown
│   ├── Benefits
│   └── Maintenance plan
│
└── CURSOR_RULES_INDEX.md (THIS FILE) (180 lines)
    ├── File directory
    ├── Usage guide
    ├── Quick links
    └── Maintenance checklist
```

## ✅ Maintenance Checklist

### When to Update Rules
- [ ] Add new database table → Update schema section
- [ ] Change authentication → Update auth section
- [ ] Establish new pattern → Add to patterns section
- [ ] Find common mistake → Add to examples section
- [ ] Team learns new practice → Document and add

### Quarterly Review (Every 3 months)
- [ ] Compare rules with actual code
- [ ] Check if patterns have changed
- [ ] Verify enum values match schema.ts
- [ ] Ensure examples still work
- [ ] Get team feedback

### When Files Change
- [ ] Schema changes → Update lines 244-281
- [ ] New helpers.ts functions → Update auth patterns
- [ ] New message types → Update enum reference
- [ ] New file organization → Update file list

## 🎓 Learning Path

### For New Developers (2-3 hours)
1. Read CONVEX_RULES_GUIDE.md (20 min)
2. Review .cursor/rules/convex_rules.mdc (40 min)
3. Study CLAUDE.md (40 min)
4. Read convex/schema.ts and helpers.ts (20 min)

### For Code Reviews (15 min per review)
1. Reference relevant section in CONVEX_RULES_GUIDE.md
2. Check pattern against .cursor/rules/convex_rules.mdc
3. Link specific line numbers in review comments

### For Architecture Discussions (1 hour)
1. Read CURSOR_RULES_COMPLETION.md (15 min)
2. Reference CONVEX_RULES_REWRITE_SUMMARY.md (20 min)
3. Review CLAUDE.md for full context (25 min)

## 🚀 Next Steps

### Immediate (Today)
- [ ] Review .cursor/rules/convex_rules.mdc
- [ ] Read CONVEX_RULES_GUIDE.md
- [ ] Test in Cursor IDE

### Short Term (This Week)
- [ ] Share CONVEX_RULES_GUIDE.md with team
- [ ] Update code review guidelines
- [ ] Test Cursor suggestions in a real file

### Medium Term (This Month)
- [ ] Collect team feedback
- [ ] Create similar rules for src/ directory
- [ ] Document any deviations

### Long Term (This Quarter)
- [ ] Quarterly rules review
- [ ] Update based on learnings
- [ ] Expand to test files
- [ ] Create team best practices guide

---

## 📞 Questions?

**File organization confused?** → See CONVEX_RULES_GUIDE.md: "File Organization"  
**Need a code example?** → See .cursor/rules/convex_rules.mdc lines 512-640  
**Want to know what changed?** → See CONVEX_RULES_REWRITE_SUMMARY.md  
**How does Cursor use rules?** → See .cursor/CURSOR_RULES_USAGE.md  
**Need full architecture?** → See CLAUDE.md  

---

**Last Updated**: 2025-11-13  
**Status**: Active & In Use  
**Maintainer**: Development Team  
**Next Review**: 2026-02-13 (quarterly)

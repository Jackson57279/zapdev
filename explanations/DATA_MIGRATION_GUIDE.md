# Data Migration Guide: PostgreSQL → Convex

This guide walks you through migrating your existing PostgreSQL data to Convex.

## 📋 Overview

Your PostgreSQL data has been exported to CSV files in the `/neon-thing/` directory:

- **Project.csv** - 26 projects
- **Message.csv** - 73 messages
- **Fragment.csv** - 10 code fragments
- **FragmentDraft.csv** - 0 drafts
- **Attachment.csv** - 0 attachments
- **Usage.csv** - 2 usage records

**Total: 111 records** to migrate

## ✅ Prerequisites

Before running the migration:

1. **Convex must be running**
   ```bash
   bunx convex dev
   ```
   Make sure this is running in a separate terminal

2. **Environment variables set**
   - `NEXT_PUBLIC_CONVEX_URL` must be configured in `.env`
   - Get this from running `bunx convex dev`

3. **Dependencies installed**
   ```bash
   bun install
   ```

## 🚀 Running the Migration

### Step 1: Start Convex Dev Server

In a terminal, start Convex:
```bash
bunx convex dev
```

Keep this running! The migration script needs it.

### Step 2: Run the Migration Script

In another terminal:
```bash
bun run scripts/migrate-to-convex.ts
```

The script will:
1. ✅ Read all CSV files from `/neon-thing/`
2. ✅ Create ID mappings (PostgreSQL UUIDs → Convex IDs)
3. ✅ Import data in the correct order:
   - Projects first
   - Messages second (linked to projects)
   - Fragments third (linked to messages)
   - Fragment drafts (linked to projects)
   - Attachments (linked to messages)
   - Usage records last

### Step 3: Verify the Migration

Check the Convex dashboard:
```bash
bunx convex dashboard
```

Or visit: https://dashboard.convex.dev

Navigate to **Data** tab and verify:
- ✅ 26 projects in `projects` table
- ✅ 73 messages in `messages` table
- ✅ 10 fragments in `fragments` table
- ✅ 2 usage records in `usage` table

## 🔍 What the Migration Does

### 1. Projects Migration
```typescript
{
  oldId: "c9ab5590-2177-4e13-a1dd-094b48055110", // PostgreSQL UUID
  newId: "j97h2k4n8...",                          // New Convex ID
  name: "hundreds-raincoat",
  userId: "user_30xqHm23FRYopIgyfPPYsnMGqAq",
  framework: "NEXTJS",
  createdAt: 1697698804165,  // Converted to timestamp
  updatedAt: 1697698804165
}
```

### 2. Messages Migration
- Links messages to projects using new Convex IDs
- Preserves all conversation history
- Maintains role (USER/ASSISTANT) and status

### 3. Fragments Migration
- Parses JSON file content
- Links to messages correctly
- Preserves sandbox URLs and metadata

### 4. Usage Migration
- Extracts userId from `rlflx:user_XXX` format
- Converts to clean userId
- Preserves credit points and expiration

## 🔄 Re-running the Migration

If you need to re-run the migration:

### Option 1: Clear Data First
```bash
# In Convex dashboard, run this mutation:
importData.clearAllData()

# Then re-run migration:
bun run scripts/migrate-to-convex.ts
```

### Option 2: Start Fresh
```bash
# Delete the deployment and create new one
bunx convex dev --configure=new
```

## ⚠️ Important Notes

### ID Mapping
The migration creates a mapping from PostgreSQL UUIDs to Convex IDs:

**PostgreSQL:**
```
Project: c9ab5590-2177-4e13-a1dd-094b48055110
Message: 2b2bafb9-f534-463f-be49-c94acb4c00b1
```

**Convex:**
```
Project: j97h2k4n8m2pqrs5xvw7t3yz1abc
Message: k48j3m5p9r2tuw6yx8za0bcd2efg
```

The script maintains these relationships automatically.

### Usage Keys
PostgreSQL stores usage with keys like `rlflx:user_30xqHm23...`

The migration extracts the userId: `user_30xqHm23...`

### JSON Fields
Fragment `files` field contains escaped JSON:
```json
{
  "app/page.tsx": "\"use client\"\n\nimport..."
}
```

The script automatically parses this into proper JSON objects.

### Timestamps
- PostgreSQL: ISO strings (`"2025-10-19T07:20:04.165Z"`)
- Convex: Millisecond timestamps (`1697698804165`)

The migration handles this conversion automatically.

## 📊 Migration Output

You'll see output like this:

```
🚀 Starting PostgreSQL to Convex migration...

📁 Importing Projects...
   Found 26 projects
   ✓ Imported project: hundreds-raincoat
   ✓ Imported project: apprehensive-teenager
   ...
✅ Imported 26 projects

💬 Importing Messages...
   Found 73 messages
✅ Imported 73 messages

📝 Importing Fragments...
   Found 10 fragments
   ✓ Imported fragment: Admin Dashboard
   ✓ Imported fragment: Admin Dashboard Pages
   ...
✅ Imported 10 fragments

📑 Importing Fragment Drafts...
   Found 0 fragment drafts
✅ Imported 0 fragment drafts

📎 Importing Attachments...
   Found 0 attachments
✅ Imported 0 attachments

📊 Importing Usage data...
   Found 2 usage records
   ✓ Imported usage for user: user_32HoFkJr7jxlm4HUyKIKIea0xPp
   ✓ Imported usage for user: user_33tobvNrdDuIsgEwgdq2cDMAbLi
✅ Imported 2 usage records

🎉 Migration completed successfully!

Summary:
  Projects: 26
  Messages: 73
  Fragments: 10
  Fragment Drafts: 0
  Attachments: 0
  Usage Records: 2
  Total: 111 records

✅ All data has been successfully migrated to Convex!
```

## 🔧 Troubleshooting

### Error: "NEXT_PUBLIC_CONVEX_URL is not set"
**Solution:** Make sure you've run `bunx convex dev` and copied the URL to `.env`

### Error: "Cannot find module 'csv-parse'"
**Solution:** Run `bun install` to install all dependencies

### Error: "File not found: neon-thing/Project.csv"
**Solution:** Ensure CSV files are in `/neon-thing/` directory at project root

### Error: "Project not found for message..."
**Solution:** This means a message references a project that doesn't exist in the CSV. The script will skip these messages.

### Error: "Invalid date format"
**Solution:** Ensure CSV dates are in ISO format: `2025-10-19T07:20:04.165Z`

## 📁 File Structure

```
/
├── neon-thing/              # CSV exports (gitignored)
│   ├── Project.csv
│   ├── Message.csv
│   ├── Fragment.csv
│   ├── FragmentDraft.csv
│   ├── Attachment.csv
│   └── Usage.csv
├── convex/
│   └── importData.ts        # Convex import mutations
└── scripts/
    └── migrate-to-convex.ts # Migration script
```

## ✅ Post-Migration Checklist

After successful migration:

- [ ] Verify record counts in Convex dashboard
- [ ] Test authentication and user access
- [ ] Check that projects display correctly
- [ ] Verify message history is intact
- [ ] Test code fragments load properly
- [ ] Confirm usage credits are correct
- [ ] Test creating new projects/messages
- [ ] Verify all relationships are maintained

## 🎯 Next Steps

After migration is complete:

1. **Test thoroughly** - Create new projects, messages, etc.
2. **Update application code** - Replace tRPC with Convex hooks
3. **Deploy to production** - Run migration on production data
4. **Remove PostgreSQL** - Once fully migrated and tested
5. **Update documentation** - Reflect Convex as the database

## 🔐 Data Safety

The migration script:
- ✅ Does NOT modify original CSV files
- ✅ Does NOT delete PostgreSQL data
- ✅ Creates new Convex records (doesn't update existing)
- ✅ Can be safely re-run (use `clearAllData` first)

**Original PostgreSQL data remains untouched!**

## 📞 Support

If you encounter issues:

1. Check [CONVEX_SETUP.md](./CONVEX_SETUP.md) for configuration
2. Review [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) for progress
3. Check Convex logs: `bunx convex logs`
4. Verify data in Convex dashboard
5. Check this repository's issues

## 🎉 Success!

Once migration completes successfully:
- All your PostgreSQL data is now in Convex
- Relationships between tables are preserved
- Timestamps and JSON fields are correctly formatted
- Usage records are linked to users
- You're ready to start using Convex in your app!

**Ready to migrate? Run:** `bun run scripts/migrate-to-convex.ts`

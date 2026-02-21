/**
 * PostgreSQL to Convex Data Migration Script
 *
 * This script reads CSV exports from PostgreSQL and imports them into Convex.
 * It maintains relationships between tables by creating ID mappings.
 *
 * Usage:
 *   bun run scripts/migrate-to-convex.ts
 *
 * Prerequisites:
 *   - Convex deployment must be running (bunx convex dev)
 *   - CSV files must be in /neon-thing/ directory
 *   - Environment variables must be set
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import path from "path";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("Error: NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

// ID mappings from old PostgreSQL UUIDs to new Convex IDs
const projectIdMap = new Map<string, string>();
const messageIdMap = new Map<string, string>();

/**
 * Read and parse a CSV file
 */
function readCSV<T>(filename: string): T[] {
  const csvPath = path.join(process.cwd(), "neon-thing", filename);
  try {
    const fileContent = readFileSync(csvPath, "utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
      cast_date: false, // Keep dates as strings for now
    });
    return records as T[];
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      console.log(`⚠️  ${filename} not found or empty, skipping...`);
      return [];
    }
    throw error;
  }
}

/**
 * Extract userId from rate limiter key format: "rlflx:user_XXX"
 */
function extractUserIdFromKey(key: string): string {
  const match = key.match(/rlflx:(.+)/);
  return match ? match[1] : key;
}

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(jsonString: string | null | undefined, fallback: any = {}) {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log("🚀 Starting PostgreSQL to Convex migration...\n");

  try {
    // Step 1: Import Projects
    console.log("📁 Importing Projects...");
    const projects = readCSV<any>("Project.csv");
    console.log(`   Found ${projects.length} projects`);

    for (const project of projects) {
      const result = await convex.action(api.importData.importProjectAction, {
        oldId: project.id,
        name: project.name,
        userId: project.userId,
        framework: project.framework,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
      projectIdMap.set(result.oldId, result.newId);
      console.log(`   ✓ Imported project: ${project.name}`);
    }
    console.log(`✅ Imported ${projects.length} projects\n`);

    // Step 2: Import Messages
    console.log("💬 Importing Messages...");
    const messages = readCSV<any>("Message.csv");
    console.log(`   Found ${messages.length} messages`);

    for (const message of messages) {
      const newProjectId = projectIdMap.get(message.projectId);
      if (!newProjectId) {
        console.error(`   ❌ Project not found for message ${message.id}, skipping...`);
        continue;
      }

      const result = await convex.action(api.importData.importMessageAction, {
        oldId: message.id,
        content: message.content,
        role: message.role,
        type: message.type,
        status: message.status || "COMPLETE",
        oldProjectId: message.projectId,
        newProjectId: newProjectId as any,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      });
      messageIdMap.set(result.oldId, result.newId);
    }
    console.log(`✅ Imported ${messages.length} messages\n`);

    // Step 3: Import Fragments
    console.log("📝 Importing Fragments...");
    const fragments = readCSV<any>("Fragment.csv");
    console.log(`   Found ${fragments.length} fragments`);

    for (const fragment of fragments) {
      const newMessageId = messageIdMap.get(fragment.messageId);
      if (!newMessageId) {
        console.error(`   ❌ Message not found for fragment ${fragment.id}, skipping...`);
        continue;
      }

      // Parse the files JSON field
      const files = safeJsonParse(fragment.files, {});
      const metadata = safeJsonParse(fragment.metadata);

      await convex.action(api.importData.importFragmentAction, {
        oldId: fragment.id,
        oldMessageId: fragment.messageId,
        newMessageId: newMessageId as any,
        sandboxUrl: fragment.sandboxUrl,
        title: fragment.title,
        files,
        metadata,
        framework: fragment.framework,
        createdAt: fragment.createdAt,
        updatedAt: fragment.updatedAt,
      });
      console.log(`   ✓ Imported fragment: ${fragment.title}`);
    }
    console.log(`✅ Imported ${fragments.length} fragments\n`);

    // Step 4: Import Fragment Drafts
    console.log("📑 Importing Fragment Drafts...");
    const fragmentDrafts = readCSV<any>("FragmentDraft.csv");
    console.log(`   Found ${fragmentDrafts.length} fragment drafts`);

    for (const draft of fragmentDrafts) {
      const newProjectId = projectIdMap.get(draft.projectId);
      if (!newProjectId) {
        console.error(`   ❌ Project not found for draft ${draft.id}, skipping...`);
        continue;
      }

      const files = safeJsonParse(draft.files, {});

      await convex.action(api.importData.importFragmentDraftAction, {
        oldId: draft.id,
        oldProjectId: draft.projectId,
        newProjectId: newProjectId as any,
        files,
        framework: draft.framework,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      });
      console.log(`   ✓ Imported fragment draft`);
    }
    console.log(`✅ Imported ${fragmentDrafts.length} fragment drafts\n`);

    // Step 5: Import Attachments
    console.log("📎 Importing Attachments...");
    const attachments = readCSV<any>("Attachment.csv");
    console.log(`   Found ${attachments.length} attachments`);

    for (const attachment of attachments) {
      const newMessageId = messageIdMap.get(attachment.messageId);
      if (!newMessageId) {
        console.error(`   ❌ Message not found for attachment ${attachment.id}, skipping...`);
        continue;
      }

      await convex.action(api.importData.importAttachmentAction, {
        oldId: attachment.id,
        type: attachment.type,
        url: attachment.url,
        width: attachment.width || undefined,
        height: attachment.height || undefined,
        size: attachment.size,
        oldMessageId: attachment.messageId,
        newMessageId: newMessageId as any,
        createdAt: attachment.createdAt,
        updatedAt: attachment.updatedAt,
      });
      console.log(`   ✓ Imported attachment`);
    }
    console.log(`✅ Imported ${attachments.length} attachments\n`);

    // Step 6: Import Usage
    console.log("📊 Importing Usage data...");
    const usage = readCSV<any>("Usage.csv");
    console.log(`   Found ${usage.length} usage records`);

    for (const record of usage) {
      const userId = extractUserIdFromKey(record.key);
      await convex.action(api.importData.importUsageAction, {
        key: record.key,
        userId,
        points: parseInt(record.points, 10),
        expire: record.expire || undefined,
      });
      console.log(`   ✓ Imported usage for user: ${userId}`);
    }
    console.log(`✅ Imported ${usage.length} usage records\n`);

    // Summary
    console.log("🎉 Migration completed successfully!\n");
    console.log("Summary:");
    console.log(`  Projects: ${projects.length}`);
    console.log(`  Messages: ${messages.length}`);
    console.log(`  Fragments: ${fragments.length}`);
    console.log(`  Fragment Drafts: ${fragmentDrafts.length}`);
    console.log(`  Attachments: ${attachments.length}`);
    console.log(`  Usage Records: ${usage.length}`);
    console.log(`  Total: ${projects.length + messages.length + fragments.length + fragmentDrafts.length + attachments.length + usage.length} records\n`);

    console.log("✅ All data has been successfully migrated to Convex!");

  } catch (error) {
    console.error("\n❌ Migration failed with error:");
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate();

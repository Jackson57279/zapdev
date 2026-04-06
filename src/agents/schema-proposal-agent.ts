import { generateText } from "ai";
import { openrouter } from "./client";
import { SCHEMA_PROPOSAL_PROMPT } from "@/prompts/backend/schema-proposal";

const SCHEMA_PROPOSAL_MODEL = "moonshotai/kimi-k2.5:nitro";

export interface SchemaProposalResult {
  schemaProposal: string;
  success: boolean;
  error?: string;
}

export async function runSchemaProposalAgent(
  userPrompt: string,
  plan?: string,
  research?: string
): Promise<SchemaProposalResult> {
  console.log("[SCHEMA PROPOSAL] Starting analysis...");

  try {
    const contextBlocks: string[] = [];
    
    if (plan) {
      contextBlocks.push(`## Implementation Plan\n${plan}\n`);
    }
    
    if (research) {
      contextBlocks.push(`## Research Findings\n${research}\n`);
    }

    const augmentedPrompt = [
      "## User Request",
      userPrompt,
      "",
      ...contextBlocks,
      "## Your Task",
      "Based on the above requirements, design a complete Convex database schema.",
      "Focus on the data model - what tables are needed, their fields, relationships, and indexes.",
      "Output ONLY the schema_proposal block in the format specified in your instructions.",
    ].join("\n");

    const { text } = await generateText({
      model: openrouter(SCHEMA_PROPOSAL_MODEL),
      system: SCHEMA_PROPOSAL_PROMPT,
      prompt: augmentedPrompt,
      temperature: 0.3,
      maxOutputTokens: 4096,
    });

    if (!text.includes("<schema_proposal>")) {
      console.error("[SCHEMA PROPOSAL] Invalid response - missing schema_proposal tag");
      return {
        schemaProposal: text,
        success: false,
        error: "Invalid schema proposal format",
      };
    }

    console.log("[SCHEMA PROPOSAL] Completed successfully");

    return {
      schemaProposal: text,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SCHEMA PROPOSAL] Error:", errorMessage);
    
    return {
      schemaProposal: "",
      success: false,
      error: errorMessage,
    };
  }
}

export function parseSchemaProposal(proposal: string): {
  overview: string;
  tables: Array<{
    name: string;
    purpose: string;
    fields: string[];
    indexes: string[];
  }>;
  relationships: string[];
} {
  const result = {
    overview: "",
    tables: [] as Array<{
      name: string;
      purpose: string;
      fields: string[];
      indexes: string[];
    }>,
    relationships: [] as string[],
  };

  const match = proposal.match(/<schema_proposal>([\s\S]*?)<\/schema_proposal>/);
  if (!match) {
    return result;
  }

  const content = match[1];

  const overviewMatch = content.match(/## Overview\n([\s\S]*?)(?=##|$)/);
  if (overviewMatch) {
    result.overview = overviewMatch[1].trim();
  }

  const tableMatches = content.matchAll(
    /### (\w+)\nPurpose: ([\s\S]*?)Fields:([\s\S]*?)Indexes:([\s\S]*?)(?=###|##|$)/g
  );

  for (const tableMatch of tableMatches) {
    const tableName = tableMatch[1];
    const purpose = tableMatch[2].trim();
    const fieldsSection = tableMatch[3];
    const indexesSection = tableMatch[4];

    const fields: string[] = [];
    const fieldMatches = fieldsSection.matchAll(/- `([^`]+)`: (\w+)/g);
    for (const fieldMatch of fieldMatches) {
      fields.push(`${fieldMatch[1]}: ${fieldMatch[2]}`);
    }

    const indexes: string[] = [];
    const indexMatches = indexesSection.matchAll(/- `([^`]+)`: \[([^\]]+)\]/g);
    for (const indexMatch of indexMatches) {
      indexes.push(`${indexMatch[1]} (${indexMatch[2]})`);
    }

    result.tables.push({
      name: tableName,
      purpose,
      fields,
      indexes,
    });
  }

  const relationshipsMatch = content.match(/## Relationships\n([\s\S]*?)(?=##|$)/);
  if (relationshipsMatch) {
    const relationshipsContent = relationshipsMatch[1];
    const relMatches = relationshipsContent.matchAll(/- ([^\n]+)/g);
    for (const relMatch of relMatches) {
      result.relationships.push(relMatch[1].trim());
    }
  }

  return result;
}

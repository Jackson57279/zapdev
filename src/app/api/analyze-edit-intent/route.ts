/**
 * Analyze Edit Intent API Route
 * 
 * Uses AI to analyze user requests and create a search plan for finding
 * the exact code that needs to be edited. Returns a search strategy with
 * terms, patterns, and edit type classification.
 * 
 * Based on open-lovable's analyze-edit-intent implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
  getProviderAndModel,
  type FileManifest,
  type SearchPlan,
} from '@/lib/streaming';

// Force dynamic route
export const dynamic = 'force-dynamic';

// ============================================================================
// Zod Schema for Search Plan
// ============================================================================

const searchPlanSchema = z.object({
  editType: z.enum([
    'UPDATE_COMPONENT',
    'ADD_FEATURE',
    'FIX_BUG',
    'REFACTOR',
    'STYLING',
    'DELETE',
    'CREATE_COMPONENT',
    'UNKNOWN',
  ]).describe('The type of edit being requested'),

  reasoning: z.string().describe('Explanation of the search strategy and why these terms were chosen'),

  searchTerms: z.array(z.string()).describe(
    'Specific text to search for (case-insensitive). Be VERY specific - exact button text, class names, component names, etc.'
  ),

  regexPatterns: z.array(z.string()).optional().describe(
    'Regex patterns for finding code structures (e.g., "className=[\\"\\\'"].*header.*[\\"\\\'"]")'
  ),

  fileTypesToSearch: z.array(z.string()).default(['.jsx', '.tsx', '.js', '.ts']).describe(
    'File extensions to search in'
  ),

  expectedMatches: z.number().min(1).max(10).default(1).describe(
    'Expected number of matches (helps validate search worked)'
  ),

  fallbackSearch: z.object({
    terms: z.array(z.string()),
    patterns: z.array(z.string()).optional(),
  }).optional().describe('Backup search strategy if primary fails'),

  confidence: z.number().min(0).max(1).describe(
    'Confidence score (0-1) that this search plan will find the right code'
  ),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a summary of available files for the AI.
 */
function createFileSummary(manifest: FileManifest): string {
  const validFiles = Object.entries(manifest.files)
    .filter(([path]) => {
      // Filter out invalid paths
      return path.includes('.') && !path.match(/\/\d+$/);
    });

  if (validFiles.length === 0) {
    return 'No files available in manifest';
  }

  const summary = validFiles
    .map(([path, info]) => {
      const fileName = path.split('/').pop() || path;
      const fileType = info.type || 'unknown';
      const description = info.description ? ` - ${info.description}` : '';
      return `- ${path} (${fileType})${description}`;
    })
    .join('\n');

  return summary;
}

/**
 * Build the system prompt for edit intent analysis.
 */
function buildSystemPrompt(fileSummary: string): string {
  return `You are an expert at planning code searches. Your job is to create a search strategy to find the exact code that needs to be edited.

DO NOT GUESS which files to edit. Instead, provide specific search terms that will locate the code.

SEARCH STRATEGY RULES:

1. **For text changes** (e.g., "change 'Start Deploying' to 'Go Now'"):
   - Search for the EXACT text: "Start Deploying"
   - Include variations if the text might be split across lines
   - Search for the component that likely contains this text

2. **For style changes** (e.g., "make header black"):
   - Search for component names: "Header", "<header"
   - Search for class names: "header", "navbar"
   - Search for className attributes containing relevant words
   - Look for Tailwind classes related to the style (e.g., "bg-", "text-")

3. **For removing elements** (e.g., "remove the deploy button"):
   - Search for the button text or aria-label
   - Search for relevant IDs or data-testids
   - Look for the component name if mentioned

4. **For navigation/header issues**:
   - Search for: "navigation", "nav", "Header", "navbar"
   - Look for Link components or href attributes
   - Search for menu-related terms

5. **For adding features**:
   - Identify where the feature should be added
   - Search for parent components or sections
   - Look for similar existing features

6. **Be SPECIFIC**:
   - Use exact capitalization for user-visible text
   - Include multiple search terms for redundancy
   - Add regex patterns for structural searches
   - Consider component hierarchy

7. **Confidence scoring**:
   - High confidence (0.8-1.0): Exact text match or unique component name
   - Medium confidence (0.5-0.8): General component or style change
   - Low confidence (0.0-0.5): Vague request or unclear target

Current project structure for context:
${fileSummary}

Remember: Your goal is to create a search plan that will find the code, not to select the files yourself.`;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, manifest, model = 'anthropic/claude-sonnet-4' } = body;

    console.log('[analyze-edit-intent] Request received:', {
      prompt: prompt?.substring(0, 100),
      model,
      manifestFiles: manifest?.files ? Object.keys(manifest.files).length : 0,
    });

    // Validate inputs
    if (!prompt || !manifest) {
      return NextResponse.json(
        { success: false, error: 'prompt and manifest are required' },
        { status: 400 }
      );
    }

    // Create file summary
    const fileSummary = createFileSummary(manifest);
    
    if (fileSummary === 'No files available in manifest') {
      console.error('[analyze-edit-intent] No valid files found in manifest');
      return NextResponse.json({
        success: false,
        error: 'No valid files found in manifest',
      }, { status: 400 });
    }

    console.log('[analyze-edit-intent] File summary created:', {
      totalFiles: Object.keys(manifest.files).length,
      summaryLength: fileSummary.length,
    });

    // Get AI provider and model
    const { provider, modelName } = getProviderAndModel(model);
    console.log('[analyze-edit-intent] Using AI model:', modelName);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(fileSummary);

    // Use AI to create search plan
    console.log('[analyze-edit-intent] Generating search plan...');
    const result = await generateObject({
      model: provider(modelName),
      schema: searchPlanSchema,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `User request: "${prompt}"

Create a detailed search plan to find the exact code that needs to be modified. Include specific search terms, patterns, and reasoning.`,
        },
      ],
      temperature: 0.3, // Lower temperature for more focused results
    });

    console.log('[analyze-edit-intent] Search plan created:', {
      editType: result.object.editType,
      searchTerms: result.object.searchTerms,
      patterns: result.object.regexPatterns?.length || 0,
      confidence: result.object.confidence,
    });

    // Convert to SearchPlan type
    const searchPlan: SearchPlan = {
      searchTerms: result.object.searchTerms,
      editType: result.object.editType,
      reasoning: result.object.reasoning,
      confidence: result.object.confidence,
      suggestedFiles: [], // Will be populated by context-selector
    };

    // Return the search plan
    return NextResponse.json({
      success: true,
      searchPlan,
      details: {
        editType: result.object.editType,
        reasoning: result.object.reasoning,
        searchTerms: result.object.searchTerms,
        regexPatterns: result.object.regexPatterns,
        fileTypesToSearch: result.object.fileTypesToSearch,
        expectedMatches: result.object.expectedMatches,
        fallbackSearch: result.object.fallbackSearch,
        confidence: result.object.confidence,
      },
    });

  } catch (error) {
    console.error('[analyze-edit-intent] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze edit intent',
    }, { status: 500 });
  }
}

/**
 * Context Selector
 * 
 * Smart file targeting for edit operations:
 * - Executes search plans from analyze-edit-intent
 * - Searches codebase using regex and text matching
 * - Ranks results by confidence
 * - Selects primary files (to edit) vs context files (reference)
 * - Builds enhanced system prompts with context
 * 
 * Based on open-lovable's context selection system.
 */

import type {
  SearchPlan,
  SearchResult,
  EditContext,
  FileManifest,
  EditType,
} from './types';

// ============================================================================
// Search Execution
// ============================================================================

/**
 * Search for a term in file content (case-insensitive).
 */
export function searchInFile(
  term: string,
  content: string,
  filePath: string
): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = content.split('\n');
  const searchTerm = term.toLowerCase();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes(searchTerm)) {
      // Get context (3 lines before and after)
      const contextStart = Math.max(0, i - 3);
      const contextEnd = Math.min(lines.length, i + 4);
      const contextLines = lines.slice(contextStart, contextEnd);
      
      results.push({
        filePath,
        lineNumber: i + 1,
        matchedText: line.trim(),
        context: contextLines.join('\n'),
        confidence: calculateMatchConfidence(term, line, filePath),
        reason: `Found "${term}" in line ${i + 1}`,
      });
    }
  }
  
  return results;
}

/**
 * Search using regex pattern.
 */
export function searchWithRegex(
  pattern: string,
  content: string,
  filePath: string
): SearchResult[] {
  const results: SearchResult[] = [];
  
  try {
    const regex = new RegExp(pattern, 'gi');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(regex);
      
      if (matches) {
        const contextStart = Math.max(0, i - 3);
        const contextEnd = Math.min(lines.length, i + 4);
        const contextLines = lines.slice(contextStart, contextEnd);
        
        results.push({
          filePath,
          lineNumber: i + 1,
          matchedText: line.trim(),
          context: contextLines.join('\n'),
          confidence: 0.8, // Regex matches are generally high confidence
          reason: `Matched pattern "${pattern}" in line ${i + 1}`,
        });
      }
    }
  } catch (error) {
    console.error(`[context-selector] Invalid regex pattern: ${pattern}`, error);
  }
  
  return results;
}

/**
 * Calculate confidence score for a match.
 */
function calculateMatchConfidence(
  searchTerm: string,
  matchedLine: string,
  filePath: string
): number {
  let confidence = 0.5; // Base confidence
  
  // Exact match (case-insensitive) increases confidence
  if (matchedLine.toLowerCase().includes(searchTerm.toLowerCase())) {
    confidence += 0.2;
  }
  
  // Match in component file increases confidence
  if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
    confidence += 0.1;
  }
  
  // Match in component name increases confidence
  const fileName = filePath.split('/').pop() || '';
  if (fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
    confidence += 0.2;
  }
  
  // Exact word match (not substring) increases confidence
  const wordBoundaryRegex = new RegExp(`\\b${searchTerm}\\b`, 'i');
  if (wordBoundaryRegex.test(matchedLine)) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

/**
 * Execute a search plan across all files.
 */
export function executeSearchPlan(
  plan: SearchPlan,
  files: Record<string, string>
): SearchResult[] {
  const allResults: SearchResult[] = [];
  
  console.log('[context-selector] Executing search plan:', {
    searchTerms: plan.searchTerms,
    editType: plan.editType,
  });
  
  // Search with each term
  for (const term of plan.searchTerms) {
    for (const [path, content] of Object.entries(files)) {
      // Skip non-code files
      if (!path.match(/\.(jsx?|tsx?|css)$/)) {
        continue;
      }
      
      const results = searchInFile(term, content, path);
      allResults.push(...results);
    }
  }
  
  // Search with regex patterns if provided
  if (plan.suggestedFiles && plan.suggestedFiles.length > 0) {
    for (const pattern of plan.suggestedFiles) {
      for (const [path, content] of Object.entries(files)) {
        if (!path.match(/\.(jsx?|tsx?|css)$/)) {
          continue;
        }
        
        const results = searchWithRegex(pattern, content, path);
        allResults.push(...results);
      }
    }
  }
  
  console.log('[context-selector] Search complete:', {
    totalResults: allResults.length,
    uniqueFiles: new Set(allResults.map(r => r.filePath)).size,
  });
  
  return allResults;
}

// ============================================================================
// Result Ranking
// ============================================================================

/**
 * Rank search results by confidence and relevance.
 */
export function rankResults(results: SearchResult[]): SearchResult[] {
  // Group by file
  const fileGroups = new Map<string, SearchResult[]>();
  
  for (const result of results) {
    const existing = fileGroups.get(result.filePath) || [];
    existing.push(result);
    fileGroups.set(result.filePath, existing);
  }
  
  // Calculate aggregate confidence per file
  const fileScores = new Map<string, number>();
  
  for (const [filePath, fileResults] of fileGroups.entries()) {
    // Average confidence + bonus for multiple matches
    const avgConfidence = fileResults.reduce((sum, r) => sum + r.confidence, 0) / fileResults.length;
    const matchBonus = Math.min(fileResults.length * 0.1, 0.3);
    const totalScore = avgConfidence + matchBonus;
    
    fileScores.set(filePath, totalScore);
  }
  
  // Sort results by file score, then by confidence
  return results.sort((a, b) => {
    const scoreA = fileScores.get(a.filePath) || 0;
    const scoreB = fileScores.get(b.filePath) || 0;
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Higher score first
    }
    
    return b.confidence - a.confidence; // Higher confidence first
  });
}

/**
 * Select top N unique files from ranked results.
 */
export function selectTargetFiles(
  results: SearchResult[],
  maxFiles: number = 3
): string[] {
  const rankedResults = rankResults(results);
  const selectedFiles = new Set<string>();
  
  for (const result of rankedResults) {
    selectedFiles.add(result.filePath);
    if (selectedFiles.size >= maxFiles) {
      break;
    }
  }
  
  return Array.from(selectedFiles);
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build edit context with primary and context files.
 */
export function buildEditContext(
  primaryFiles: string[],
  contextFiles: string[],
  allFiles: Record<string, string>,
  manifest: FileManifest,
  editType: EditType,
  searchPlan: SearchPlan
): EditContext {
  // Build enhanced system prompt
  const systemPrompt = buildEnhancedSystemPrompt(
    primaryFiles,
    contextFiles,
    manifest,
    editType,
    searchPlan
  );
  
  return {
    primaryFiles,
    contextFiles,
    systemPrompt,
    editIntent: {
      type: editType,
      description: searchPlan.reasoning,
      targetFiles: primaryFiles,
      confidence: searchPlan.confidence,
      searchTerms: searchPlan.searchTerms,
      suggestedContext: contextFiles,
    },
  };
}

/**
 * Build enhanced system prompt with context.
 */
function buildEnhancedSystemPrompt(
  primaryFiles: string[],
  contextFiles: string[],
  manifest: FileManifest,
  editType: EditType,
  searchPlan: SearchPlan
): string {
  let prompt = `EDIT MODE - SURGICAL PRECISION REQUIRED

Edit Type: ${editType}
Confidence: ${(searchPlan.confidence * 100).toFixed(0)}%
Reasoning: ${searchPlan.reasoning}

FILES TO EDIT (${primaryFiles.length}):
${primaryFiles.map(f => `- ${f}`).join('\n')}

🚨 CRITICAL RULES:
1. ONLY modify the files listed above
2. Make MINIMAL changes - only what's needed for the request
3. Preserve ALL existing functionality
4. Do NOT add features not requested
5. Do NOT fix unrelated issues

`;

  if (contextFiles.length > 0) {
    prompt += `\nCONTEXT FILES (for reference only, DO NOT modify):
${contextFiles.map(f => `- ${f}`).join('\n')}

`;
  }

  // Add file structure for context
  if (manifest.structure) {
    prompt += `\nProject Structure:
${manifest.structure}

`;
  }

  return prompt;
}

// ============================================================================
// Smart Context Selection
// ============================================================================

/**
 * Automatically select context files based on imports and relationships.
 */
export function selectContextFiles(
  primaryFiles: string[],
  allFiles: Record<string, string>,
  manifest: FileManifest,
  maxContext: number = 5
): string[] {
  const contextFiles = new Set<string>();
  
  // For each primary file, find related files
  for (const primaryFile of primaryFiles) {
    const fileInfo = manifest.files[primaryFile];
    if (!fileInfo) continue;
    
    // Get imports from this file
    const imports = (fileInfo as any).imports || [];
    
    for (const imp of imports) {
      // Convert import path to file path
      if (imp.startsWith('.') || imp.startsWith('@/')) {
        const resolvedPath = resolveImportPath(imp, primaryFile);
        if (resolvedPath && allFiles[resolvedPath] && !primaryFiles.includes(resolvedPath)) {
          contextFiles.add(resolvedPath);
        }
      }
    }
    
    // Add parent component if this is a child
    const parentPath = findParentComponent(primaryFile, allFiles, manifest);
    if (parentPath && !primaryFiles.includes(parentPath)) {
      contextFiles.add(parentPath);
    }
  }
  
  // Limit to maxContext files
  return Array.from(contextFiles).slice(0, maxContext);
}

/**
 * Resolve import path to actual file path.
 */
function resolveImportPath(importPath: string, fromFile: string): string | null {
  // Handle @/ alias
  if (importPath.startsWith('@/')) {
    return importPath.replace('@/', 'src/');
  }
  
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const resolved = `${fromDir}/${importPath}`;
    
    // Try common extensions
    for (const ext of ['.jsx', '.tsx', '.js', '.ts']) {
      if (resolved.endsWith(ext)) {
        return resolved;
      }
    }
    
    // Try adding extensions
    for (const ext of ['.jsx', '.tsx', '.js', '.ts']) {
      return resolved + ext;
    }
  }
  
  return null;
}

/**
 * Find parent component that imports this file.
 */
function findParentComponent(
  filePath: string,
  allFiles: Record<string, string>,
  manifest: FileManifest
): string | null {
  const fileName = filePath.split('/').pop()?.replace(/\.(jsx|tsx)$/, '');
  if (!fileName) return null;
  
  // Search for files that import this component
  for (const [path, info] of Object.entries(manifest.files)) {
    if (path === filePath) continue;
    
    const imports = (info as any).imports || [];
    for (const imp of imports) {
      if (imp.includes(fileName)) {
        return path;
      }
    }
  }
  
  return null;
}

/**
 * Execute full context selection workflow.
 */
export function selectEditContext(
  searchPlan: SearchPlan,
  files: Record<string, string>,
  manifest: FileManifest,
  maxPrimaryFiles: number = 3,
  maxContextFiles: number = 5
): EditContext {
  // Execute search
  const searchResults = executeSearchPlan(searchPlan, files);
  
  // Select primary files
  const primaryFiles = selectTargetFiles(searchResults, maxPrimaryFiles);
  
  // Select context files
  const contextFiles = selectContextFiles(primaryFiles, files, manifest, maxContextFiles);
  
  // Build edit context
  return buildEditContext(
    primaryFiles,
    contextFiles,
    files,
    manifest,
    searchPlan.editType,
    searchPlan
  );
}

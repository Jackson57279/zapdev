/**
 * File Manifest Generator
 * 
 * Generates structured file manifests for AI context, including:
 * - File structure tree
 * - Component information extraction
 * - Import/dependency analysis
 * - File type classification
 * - Metadata calculation
 * 
 * Based on open-lovable's file manifest system.
 */

import type { FileManifest, FileInfo } from './types';

// ============================================================================
// File Type Detection
// ============================================================================

/**
 * Determine file type from path.
 */
export function getFileType(path: string): FileInfo['type'] {
  const ext = path.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'jsx':
      return 'jsx';
    case 'tsx':
      return 'tsx';
    case 'js':
      return 'js';
    case 'ts':
      return 'ts';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'md':
      return 'md';
    default:
      return 'other';
  }
}

/**
 * Check if file is a component file.
 */
export function isComponentFile(path: string): boolean {
  const fileName = path.split('/').pop() || '';
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // Component files are JSX/TSX files with capitalized names
  if (ext === 'jsx' || ext === 'tsx') {
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    return /^[A-Z]/.test(nameWithoutExt);
  }
  
  return false;
}

// ============================================================================
// Component Information Extraction
// ============================================================================

/**
 * Extract component name from file content.
 */
export function extractComponentName(content: string, path: string): string | null {
  // Try to find export default function/const ComponentName
  const defaultExportMatch = content.match(
    /export\s+default\s+(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/
  );
  if (defaultExportMatch) {
    return defaultExportMatch[1];
  }

  // Try to find function ComponentName() or const ComponentName = 
  const functionMatch = content.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]*)\s*[=(]/);
  if (functionMatch) {
    return functionMatch[1];
  }

  // Fallback to filename
  const fileName = path.split('/').pop() || '';
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  if (/^[A-Z]/.test(nameWithoutExt)) {
    return nameWithoutExt;
  }

  return null;
}

/**
 * Extract child components rendered by this component.
 */
export function extractChildComponents(content: string): string[] {
  const children: string[] = [];
  
  // Match JSX component tags: <ComponentName
  const componentRegex = /<([A-Z][a-zA-Z0-9]*)/g;
  let match;
  
  while ((match = componentRegex.exec(content)) !== null) {
    const componentName = match[1];
    if (!children.includes(componentName)) {
      children.push(componentName);
    }
  }
  
  return children;
}

/**
 * Extract component information from file content.
 */
export function extractComponentInfo(content: string, path: string) {
  if (!isComponentFile(path)) {
    return null;
  }

  const name = extractComponentName(content, path);
  const childComponents = extractChildComponents(content);

  return {
    name: name || 'Unknown',
    childComponents,
    isPage: path.includes('/pages/') || path.includes('/app/'),
    isLayout: path.toLowerCase().includes('layout'),
  };
}

// ============================================================================
// Import Analysis
// ============================================================================

/**
 * Extract all imports from file content.
 */
export function analyzeImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match ES6 imports
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!imports.includes(importPath)) {
      imports.push(importPath);
    }
  }
  
  return imports;
}

/**
 * Categorize imports into internal and external.
 */
export function categorizeImports(imports: string[]) {
  const internal: string[] = [];
  const external: string[] = [];
  
  for (const imp of imports) {
    if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('@/')) {
      internal.push(imp);
    } else {
      external.push(imp);
    }
  }
  
  return { internal, external };
}

// ============================================================================
// File Tree Generation
// ============================================================================

/**
 * Build a tree structure from file paths.
 */
export function buildFileTree(files: string[]): string {
  const tree: Record<string, any> = {};
  
  // Build tree structure
  for (const file of files) {
    const parts = file.split('/');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      
      if (isLast) {
        current[part] = null; // File
      } else {
        if (!current[part]) {
          current[part] = {}; // Directory
        }
        current = current[part];
      }
    }
  }
  
  // Convert tree to string
  function treeToString(node: Record<string, any>, indent = ''): string {
    let result = '';
    const entries = Object.entries(node).sort(([a], [b]) => {
      // Directories first, then files
      const aIsDir = node[a] !== null;
      const bIsDir = node[b] !== null;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });
    
    for (let i = 0; i < entries.length; i++) {
      const [name, children] = entries[i];
      const isLast = i === entries.length - 1;
      const prefix = isLast ? '└── ' : '├── ';
      const childIndent = indent + (isLast ? '    ' : '│   ');
      
      result += indent + prefix + name;
      
      if (children !== null) {
        result += '/\n';
        result += treeToString(children, childIndent);
      } else {
        result += '\n';
      }
    }
    
    return result;
  }
  
  return treeToString(tree);
}

// ============================================================================
// Manifest Generation
// ============================================================================

/**
 * Generate a complete file manifest from a collection of files.
 */
export function generateFileManifest(
  files: Record<string, string>
): FileManifest {
  const fileInfos: Record<string, FileInfo> = {};
  let totalSize = 0;
  
  // Process each file
  for (const [path, content] of Object.entries(files)) {
    const type = getFileType(path);
    const size = content.length;
    totalSize += size;
    
    const info: FileInfo = {
      path,
      type,
      size,
      lastModified: Date.now(),
      isDirectory: false,
    };
    
    // Extract component info for JSX/TSX files
    if (type === 'jsx' || type === 'tsx') {
      const componentInfo = extractComponentInfo(content, path);
      if (componentInfo) {
        info.description = `${componentInfo.name} component`;
        // Store component info in a way that's accessible
        (info as any).componentInfo = componentInfo;
      }
    }
    
    // Analyze imports
    const imports = analyzeImports(content);
    if (imports.length > 0) {
      (info as any).imports = imports;
    }
    
    fileInfos[path] = info;
  }
  
  // Build file tree
  const structure = buildFileTree(Object.keys(files));
  
  return {
    files: fileInfos,
    structure,
    totalFiles: Object.keys(files).length,
    totalSize,
    lastUpdated: Date.now(),
  };
}

/**
 * Update an existing manifest with new or modified files.
 */
export function updateFileManifest(
  manifest: FileManifest,
  updates: Record<string, string>
): FileManifest {
  const updatedFiles = { ...manifest.files };
  let totalSize = manifest.totalSize;
  
  for (const [path, content] of Object.entries(updates)) {
    const existingFile = updatedFiles[path];
    
    // Subtract old size if file existed
    if (existingFile) {
      totalSize -= existingFile.size;
    }
    
    // Add new file info
    const type = getFileType(path);
    const size = content.length;
    totalSize += size;
    
    const info: FileInfo = {
      path,
      type,
      size,
      lastModified: Date.now(),
      isDirectory: false,
    };
    
    // Extract component info
    if (type === 'jsx' || type === 'tsx') {
      const componentInfo = extractComponentInfo(content, path);
      if (componentInfo) {
        info.description = `${componentInfo.name} component`;
        (info as any).componentInfo = componentInfo;
      }
    }
    
    // Analyze imports
    const imports = analyzeImports(content);
    if (imports.length > 0) {
      (info as any).imports = imports;
    }
    
    updatedFiles[path] = info;
  }
  
  // Rebuild file tree
  const structure = buildFileTree(Object.keys(updatedFiles));
  
  return {
    files: updatedFiles,
    structure,
    totalFiles: Object.keys(updatedFiles).length,
    totalSize,
    lastUpdated: Date.now(),
  };
}

/**
 * Remove files from manifest.
 */
export function removeFromManifest(
  manifest: FileManifest,
  pathsToRemove: string[]
): FileManifest {
  const updatedFiles = { ...manifest.files };
  let totalSize = manifest.totalSize;
  
  for (const path of pathsToRemove) {
    const file = updatedFiles[path];
    if (file) {
      totalSize -= file.size;
      delete updatedFiles[path];
    }
  }
  
  // Rebuild file tree
  const structure = buildFileTree(Object.keys(updatedFiles));
  
  return {
    files: updatedFiles,
    structure,
    totalFiles: Object.keys(updatedFiles).length,
    totalSize,
    lastUpdated: Date.now(),
  };
}

/**
 * Get a summary of the manifest for AI context.
 */
export function getManifestSummary(manifest: FileManifest): string {
  const componentFiles = Object.values(manifest.files).filter(
    f => f.type === 'jsx' || f.type === 'tsx'
  );
  
  const styleFiles = Object.values(manifest.files).filter(
    f => f.type === 'css'
  );
  
  const summary = [
    `Total files: ${manifest.totalFiles}`,
    `Components: ${componentFiles.length}`,
    `Styles: ${styleFiles.length}`,
    `Total size: ${(manifest.totalSize / 1024).toFixed(2)} KB`,
    '',
    'File structure:',
    manifest.structure,
  ].join('\n');
  
  return summary;
}

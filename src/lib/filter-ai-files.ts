export function filterAIGeneratedFiles(
  files: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {};

  const excludePatterns = [
    /^package\.json$/,
    /^package-lock\.json$/,
    /^bun\.lockb$/,
    /^yarn\.lock$/,
    /^pnpm-lock\.yaml$/,
    /^tsconfig.*\.json$/,
    /^jsconfig.*\.json$/,
    /\.config\.(js|ts|mjs|cjs)$/,
    /^next-env\.d\.ts$/,
    /^\.eslintrc/,
    /^\.prettierrc/,
    /^\.gitignore$/,
    /^\.dockerignore$/,
    /^Dockerfile$/,
    /^docker-compose/,
    /^README\.md$/,
    /^LICENSE$/,
    /^CHANGELOG\.md$/,
    /^\.env/,
    /\.lock$/,
    /\.cache$/,
    /^jest\.config/,
    /^vitest\.config/,
    /^playwright\.config/,
  ];

  const includePatterns = [
    /^app\//,
    /^pages\//,
    /^src\//,
    /^components\//,
    /^lib\//,
    /^utils\//,
    /^hooks\//,
    /^styles\//,
    /^public\//,
    /^api\//,
    /^server\//,
    /^client\//,
    /^views\//,
    /^controllers\//,
    /^models\//,
    /^services\//,
    /^store\//,
    /^routes\//,
    /^middleware\//,
    /^assets\//,
    /^static\//,
    /^scss\//,
    /^css\//,
    /^theme\//,
    /^layouts\//,
    /^types\//,
    /^interfaces\//,
    /^constants\//,
    /^config\//,
    /^helpers\//,
    /^contexts\//,
    /^providers\//,
    /^tests?\//,
    /^__tests__\//,
  ];

  for (const [path, content] of Object.entries(files)) {
    const shouldExclude = excludePatterns.some(pattern => pattern.test(path));
    if (shouldExclude) {
      continue;
    }

    const shouldInclude = includePatterns.some(pattern => pattern.test(path));
    if (shouldInclude) {
      filtered[path] = content;
      continue;
    }

    if (
      /\.(tsx?|jsx?|vue|svelte|css|scss|sass|less|html|htm|md|markdown|json)$/.test(path) &&
      !path.includes('/')
    ) {
      filtered[path] = content;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const totalFiles = Object.keys(files).length;
    const filteredFiles = Object.keys(filtered).length;
    const removedFiles = totalFiles - filteredFiles;
    
    if (removedFiles > 0) {
      console.debug(`[filterAIGeneratedFiles] Filtered ${removedFiles} files (${totalFiles} → ${filteredFiles})`);
      
      const filteredOutPaths = Object.keys(files).filter((path) => !(path in filtered));
      if (filteredOutPaths.length > 0) {
        console.debug(`[filterAIGeneratedFiles] Sample filtered files:`, filteredOutPaths.slice(0, 5));
      }
    }
  }

  return filtered;
}

export function filterFilesForDownload(
  files: Record<string, string>
): Record<string, string> {
  const filtered: Record<string, string> = {};

  const excludePatterns = [
    /^package-lock\.json$/,
    /^bun\.lockb$/,
    /^yarn\.lock$/,
    /^pnpm-lock\.yaml$/,
    /\.lock$/,
    /^\.env/,
    /^node_modules\//,
    /^\.next\//,
    /^\.cache\//,
    /^dist\//,
    /^build\//,
    /^\.git\//,
    /^\.idea\//,
    /^\.vscode\//,
    /^\.DS_Store$/,
    /^Thumbs\.db$/,
  ];

  for (const [path, content] of Object.entries(files)) {
    const shouldExclude = excludePatterns.some(pattern => pattern.test(path));
    if (shouldExclude) {
      continue;
    }

    filtered[path] = content;
  }

  return filtered;
}

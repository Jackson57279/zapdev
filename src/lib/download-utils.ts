import JSZip from "jszip";
import { toast } from "sonner";
import { filterAIGeneratedFiles } from "./filter-ai-files";

interface DownloadResult {
  success: boolean;
  fileCount?: number;
  error?: string;
}

/**
 * Downloads AI-generated files from a fragment as a ZIP archive
 * @param files - The raw files object from the fragment
 * @param fragmentId - The fragment ID for naming the download
 * @param includeAllFiles - If true, skip filtering and download all files (for debugging)
 * @returns Promise with download result
 */
export async function downloadFragmentFiles(
  files: Record<string, unknown>,
  fragmentId: string,
  includeAllFiles = false
): Promise<DownloadResult> {
  console.log('[downloadFragmentFiles] Starting download', {
    fragmentId,
    rawFileCount: Object.keys(files).length,
    includeAllFiles
  });

  // Normalize files to Record<string, string>
  const normalizedFiles = Object.entries(files).reduce<Record<string, string>>(
    (acc, [path, content]) => {
      if (typeof content === "string") {
        acc[path] = content;
      } else if (content !== null && content !== undefined) {
        // Attempt to convert non-string content to string
        try {
          const stringified = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
          acc[path] = stringified;
          console.warn(`[downloadFragmentFiles] Converted non-string content for: ${path}`);
        } catch (err) {
          console.error(`[downloadFragmentFiles] Failed to convert content for: ${path}`, err);
        }
      }
      return acc;
    },
    {}
  );

  const normalizedCount = Object.keys(normalizedFiles).length;
  console.log(`[downloadFragmentFiles] Normalized ${normalizedCount} files`);

  // Check if there are any files
  if (normalizedCount === 0) {
    console.error('[downloadFragmentFiles] No files available after normalization');
    // If we have raw files but normalization failed, we should try to download raw files
    if (Object.keys(files).length > 0) {
      console.warn('[downloadFragmentFiles] Normalization failed but raw files exist. Attempting to download raw files.');
      // Fallback logic could go here, but for now let's just return error with more info
      toast.error("Unable to process files for download. Please try again.");
      return { success: false, error: "File normalization failed" };
    }

    toast.error("No files available to download. The files may still be generating.");
    return { success: false, error: "No files available" };
  }

  // Filter to only AI-generated files (unless includeAllFiles is true)
  const filesToDownload = includeAllFiles
    ? normalizedFiles
    : filterAIGeneratedFiles(normalizedFiles);

  const fileEntries = Object.entries(filesToDownload);
  const filteredCount = fileEntries.length;

  console.log(`[downloadFragmentFiles] Files to download: ${filteredCount}`, {
    filtered: !includeAllFiles,
    removedByFilter: normalizedCount - filteredCount
  });

  // Log directory breakdown for transparency
  const directoryBreakdown = fileEntries.reduce<Record<string, number>>((acc, [path]) => {
    const parts = path.split('/');
    const topDir = parts.length > 1 ? parts[0] : 'root';
    acc[topDir] = (acc[topDir] || 0) + 1;
    return acc;
  }, {});

  console.log('[downloadFragmentFiles] Directory breakdown:', directoryBreakdown);

  if (filteredCount === 0) {
    console.error('[downloadFragmentFiles] No files remain after filtering', {
      fragmentId,
      normalizedCount,
      samplePaths: Object.keys(normalizedFiles).slice(0, 5)
    });

    // Offer to download all files as fallback
    toast.error(
      "No AI-generated files found. This might be a filtering issue.",
      {
        action: {
          label: "Download All Files",
          onClick: () => downloadFragmentFiles(files, fragmentId, true)
        },
        duration: 10000
      }
    );

    return { success: false, error: "No AI-generated files after filtering" };
  }

  let objectUrl: string | null = null;
  let downloadLink: HTMLAnchorElement | null = null;

  try {
    console.log('[downloadFragmentFiles] Creating ZIP archive...');
    const zip = new JSZip();

    // Add each file to the ZIP
    fileEntries.forEach(([filename, content]) => {
      zip.file(filename, content);
    });

    // Generate manifest showing file structure
    const manifest = [
      '# ZapDev Code Export',
      `Fragment ID: ${fragmentId}`,
      `Export Date: ${new Date().toISOString()}`,
      `Total Files: ${filteredCount}`,
      '',
      '## Directory Structure:',
      ...Object.entries(directoryBreakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dir, count]) => `  ${dir}/: ${count} file${count === 1 ? '' : 's'}`),
      '',
      '## Files:',
      ...fileEntries.map(([path]) => `  - ${path}`).sort()
    ].join('\n');

    zip.file('MANIFEST.txt', manifest);

    // Generate ZIP blob with progress
    toast.loading(`Preparing ${filteredCount} file${filteredCount === 1 ? "" : "s"}...`, {
      id: `download-${fragmentId}`
    });

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    console.log(`[downloadFragmentFiles] ZIP created: ${(zipBlob.size / 1024).toFixed(2)} KB`);

    // Dismiss loading toast
    toast.dismiss(`download-${fragmentId}`);

    objectUrl = URL.createObjectURL(zipBlob);

    // Create and trigger download
    downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    const filename = includeAllFiles
      ? `all-files-${fragmentId}.zip`
      : `ai-generated-code-${fragmentId}.zip`;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();

    const successMessage = includeAllFiles
      ? `Downloaded all ${filteredCount} files`
      : `Downloaded ${filteredCount} AI-generated file${filteredCount === 1 ? "" : "s"}`;

    toast.success(successMessage);
    console.log('[downloadFragmentFiles] Download completed successfully');

    return { success: true, fileCount: filteredCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[downloadFragmentFiles] Download failed:', error);

    // Dismiss any loading toasts
    toast.dismiss(`download-${fragmentId}`);

    toast.error(`Download failed: ${errorMessage}. Please try again.`);
    return { success: false, error: `Download failed: ${errorMessage}` };
  } finally {
    // Cleanup
    if (downloadLink) {
      downloadLink.remove();
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

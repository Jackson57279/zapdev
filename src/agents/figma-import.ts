import { runCodeAgent } from "./code-agent";
import {
  extractDesignSystem,
  generateFigmaCodePrompt,
} from "@/lib/figma-processor";

export interface FigmaImportInput {
  importId: string;
  projectId: string;
  fileKey: string;
  accessToken: string;
}

export interface FigmaDirectImportInput {
  importId: string;
  projectId: string;
  figmaUrl?: string;
  fileBase64?: string;
  fileName?: string;
}

async function fetchFigmaFile(
  fileKey: string,
  accessToken: string
): Promise<any> {
  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Figma file: ${response.statusText}`);
  }

  return response.json();
}

export async function processFigmaImport(
  input: FigmaImportInput
): Promise<void> {
  const { projectId, fileKey, accessToken } = input;

  console.log("[DEBUG] Processing Figma import for project:", projectId);

  try {
    const figmaFile = await fetchFigmaFile(fileKey, accessToken);
    const designSystem = extractDesignSystem(figmaFile);
    const prompt = generateFigmaCodePrompt(figmaFile, designSystem);

    for await (const event of runCodeAgent({
      projectId,
      value: prompt,
      model: "auto",
    })) {
      if (event.type === "error") {
        throw new Error(String(event.data));
      }
      if (event.type === "status") {
        console.log("[DEBUG] Agent status:", event.data);
      }
    }

    console.log("[DEBUG] Figma import completed for project:", projectId);
  } catch (error) {
    console.error("[ERROR] Figma import failed:", error);
    throw error;
  }
}

export async function processFigmaDirectImport(
  input: FigmaDirectImportInput
): Promise<void> {
  const { projectId, figmaUrl, fileName } = input;

  console.log("[DEBUG] Processing direct Figma import for project:", projectId);

  try {
    let prompt: string;

    if (figmaUrl) {
      prompt = `Import and recreate this Figma design from URL: ${figmaUrl}

Please analyze the design and create a complete implementation with:
1. Accurate layout and spacing matching the original design
2. Proper color scheme extracted from the design
3. Responsive design that works on mobile and desktop
4. All interactive elements with proper hover/focus states
5. Use Shadcn UI components from @/components/ui/
6. Follow the project's existing code patterns`;
    } else if (fileName) {
      prompt = `Import and recreate the Figma design from the uploaded file: ${fileName}

Please analyze the design and create a complete implementation with:
1. Accurate layout and spacing matching the original design
2. Proper color scheme extracted from the design
3. Responsive design that works on mobile and desktop
4. All interactive elements with proper hover/focus states
5. Use Shadcn UI components from @/components/ui/
6. Follow the project's existing code patterns`;
    } else {
      throw new Error("No Figma URL or file provided");
    }

    for await (const event of runCodeAgent({
      projectId,
      value: prompt,
      model: "auto",
    })) {
      if (event.type === "error") {
        throw new Error(String(event.data));
      }
      if (event.type === "status") {
        console.log("[DEBUG] Agent status:", event.data);
      }
    }

    console.log(
      "[DEBUG] Direct Figma import completed for project:",
      projectId
    );
  } catch (error) {
    console.error("[ERROR] Direct Figma import failed:", error);
    throw error;
  }
}

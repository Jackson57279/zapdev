import JSZip from "jszip";
import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getUser, getToken } from "@/lib/auth-server";
import { filterFilesForDownload } from "@/lib/filter-ai-files";
import { getNetlifyToml, getNetlifyBuildSettings } from "@/lib/netlify-config";
import { z } from "zod";

const cliDeployRequestSchema = z.object({
  projectId: z.string(),
});

type MessageWithFragment = {
  _id: Id<"messages">;
  _creationTime: number;
  Fragment: {
    _id: Id<"fragments">;
    files?: unknown;
    framework: "NEXTJS" | "REACT" | "VUE" | "ANGULAR" | "SVELTE";
  } | null;
};

const normalizeFiles = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (typeof content === "string") {
      files[path] = content;
    }
  }
  return files;
};

const getLatestFragmentFiles = async (projectId: Id<"projects">, token?: string) => {
  const messages = await fetchQuery(api.messages.list, { projectId }, { token }) as MessageWithFragment[];
  const latestWithFragment = [...messages].reverse().find((message) => message.Fragment);
  const fragment = latestWithFragment?.Fragment;

  if (!fragment) {
    throw new Error("No AI-generated files are ready to deploy.");
  }

  const normalized = normalizeFiles(fragment.files);
  const filtered = filterFilesForDownload(normalized);

  if (Object.keys(filtered).length === 0) {
    throw new Error("No AI-generated files are ready to deploy.");
  }

  return { files: filtered, framework: fragment.framework };
};

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = (await getToken()) ?? undefined;
    const bodyUnknown = await request.json();
    const parseResult = cliDeployRequestSchema.safeParse(bodyUnknown);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 }
      );
    }
    const body = parseResult.data;

    const projectId = body.projectId as Id<"projects">;
    const project = await fetchQuery(api.projects.get, { projectId }, { token });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { files, framework } = await getLatestFragmentFiles(projectId, token);
    const netlifyToml = getNetlifyToml(framework);
    const buildSettings = getNetlifyBuildSettings(framework);

    // Create CLI instructions README
    const cliInstructions = generateCLIInstructions(project.name, framework, buildSettings);

    const zip = new JSZip();
    
    // Add all project files
    for (const [filename, content] of Object.entries(files)) {
      zip.file(filename, content);
    }
    
    // Add netlify.toml
    zip.file("netlify.toml", netlifyToml);
    
    // Add CLI instructions
    zip.file("NETLIFY_DEPLOY.md", cliInstructions);

    const archive = await zip.generateAsync({ type: "arraybuffer" });
    
    // Return the zip as a downloadable file
    return new NextResponse(archive, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name.replace(/["\\\r\n]/g, "_")}-netlify-ready.zip"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare deployment";

    if (message.includes("No AI-generated files are ready to deploy")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateCLIInstructions(
  projectName: string, 
  framework: string,
  buildSettings: { buildCommand: string; publishDir: string; plugins: string[] }
): string {
  const frameworkDisplay = framework.charAt(0) + framework.slice(1).toLowerCase();
  
  return `# Deploy ${projectName} to Netlify

This project is ready to deploy to Netlify using the Netlify CLI.

## Prerequisites

1. Install the Netlify CLI globally:
   \`\`\`bash
   npm install -g netlify-cli
   # or
   yarn global add netlify-cli
   # or
   bun add -g netlify-cli
   \`\`\`

2. Login to your Netlify account:
   \`\`\`bash
   netlify login
   \`\`\`

## Quick Deploy

### Option 1: Deploy to an existing site

If you already have a Netlify site:

\`\`\`bash
# Link to existing site
netlify link

# Deploy (draft)
netlify deploy

# Deploy to production
netlify deploy --prod
\`\`\`

### Option 2: Deploy to a new site

\`\`\`bash
# Initialize a new site
netlify init

# Or deploy directly without initialization
netlify deploy --prod --dir=${buildSettings.publishDir}
\`\`\`

## Project Configuration

- **Framework**: ${frameworkDisplay}
- **Build Command**: \`${buildSettings.buildCommand}\`
- **Publish Directory**: \`${buildSettings.publishDir}\`

These settings are already configured in \`netlify.toml\`.

## Manual Build + Deploy

If you want to build locally first:

\`\`\`bash
# Install dependencies
bun install

# Build the project
${buildSettings.buildCommand}

# Deploy the build directory
netlify deploy --prod --dir=${buildSettings.publishDir}
\`\`\`

## Environment Variables

If your project requires environment variables:

\`\`\`bash
# Set environment variables
netlify env:set KEY value

# Or import from a .env file
netlify env:import .env
\`\`\`

## Useful Commands

\`\`\`bash
# Open the site in browser
netlify open

# View site dashboard
netlify open:admin

# View deploy logs
netlify deploy --prod --debug

# List all sites
netlify sites:list

# Get site info
netlify status
\`\`\`

## Additional Resources

- [Netlify CLI Documentation](https://docs.netlify.com/cli/get-started/)
- [Netlify Build Configuration](https://docs.netlify.com/configure-builds/file-based-configuration/)
- [Deploy Previews](https://docs.netlify.com/site-deploys/deploy-previews/)

---
Generated by ZapDev
`;
}

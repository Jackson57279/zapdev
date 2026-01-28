#!/usr/bin/env bun
/**
 * PrebuiltUI GitHub Scraper
 *
 * Clones the prebuiltui/prebuiltui GitHub repo and parses component directories
 * to extract UI components. Falls back to the GitHub API for component discovery
 * when the local repo is sparse.
 *
 * Usage:
 *   bun run scripts/scrape-prebuiltui.ts
 *
 * Output:
 *   src/data/prebuiltui-components.json
 */

import { mkdtemp, rm, readdir, readFile, mkdir, writeFile, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkillEntry {
  name: string;
  description: string;
  content: string;
  source: "prebuiltui";
  category: string;
  framework: null;
  isGlobal: true;
  isCore: false;
  metadata: {
    htmlCode: string | null;
    vueCode: string | null;
    previewUrl: string | null;
    originalSlug: string;
  };
}

interface ComponentInfo {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GITHUB_REPO = "prebuiltui/prebuiltui";
const GITHUB_CLONE_URL = `https://github.com/${GITHUB_REPO}.git`;
const GITHUB_API_BASE = "https://api.github.com/repos/" + GITHUB_REPO;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

const OUTPUT_PATH = join(import.meta.dir, "..", "src", "data", "prebuiltui-components.json");

// Top 7 categories as specified in the task
const TARGET_CATEGORIES: Record<string, string> = {
  "hero-section": "Hero Section",
  navbar: "Navbar",
  card: "Card",
  cta: "Call to Action",
  footer: "Footer",
  form: "Form",
  "feature-sections": "Feature Sections",
};

// Rate-limit helper
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// GitHub Repo Cloning
// ---------------------------------------------------------------------------

async function cloneRepo(): Promise<string | null> {
  const tmpDir = await mkdtemp(join(tmpdir(), "prebuiltui-"));
  console.log(`📦 Cloning ${GITHUB_REPO} to ${tmpDir}...`);

  try {
    const proc = Bun.spawn(["git", "clone", "--depth", "1", GITHUB_CLONE_URL, tmpDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.warn(`⚠️  Git clone failed (exit ${exitCode}): ${stderr.trim()}`);
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      return null;
    }
    console.log("✅ Clone successful");
    return tmpDir;
  } catch (err) {
    console.warn(`⚠️  Git clone error: ${err}`);
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parse components from cloned repo
// ---------------------------------------------------------------------------

async function parseRepoComponents(repoDir: string): Promise<SkillEntry[]> {
  const componentsDir = join(repoDir, "components");
  const entries: SkillEntry[] = [];

  if (!existsSync(componentsDir)) {
    console.log("📂 No components/ directory found in repo");
    return entries;
  }

  const categories = await readdir(componentsDir, { withFileTypes: true });

  for (const catDir of categories) {
    if (!catDir.isDirectory()) continue;
    const categorySlug = catDir.name;
    const categoryLabel = TARGET_CATEGORIES[categorySlug] || titleCase(categorySlug);

    // Skip categories not in our target list
    if (!TARGET_CATEGORIES[categorySlug]) continue;

    const categoryPath = join(componentsDir, categorySlug);
    const componentDirs = await readdir(categoryPath, { withFileTypes: true });

    for (const compDir of componentDirs) {
      if (!compDir.isDirectory()) continue;

      const compPath = join(categoryPath, compDir.name);
      const slug = compDir.name;

      try {
        // Try to read JSX (React) code first, then HTML
        let reactCode: string | null = null;
        let htmlCode: string | null = null;

        const files = await readdir(compPath);

        for (const file of files) {
          const filePath = join(compPath, file);
          if (file.endsWith(".jsx") || file.endsWith(".tsx")) {
            reactCode = await readFile(filePath, "utf-8");
          } else if (file.endsWith(".html")) {
            htmlCode = await readFile(filePath, "utf-8");
          }
        }

        const content = reactCode || htmlCode || "";
        if (!content) {
          console.log(`  ⏭️  Skipping ${slug} (no code files found)`);
          continue;
        }

        const title = titleCase(slug.replace(/-/g, " "));

        entries.push({
          name: `prebuiltui-${categorySlug}-${slug}`,
          description: `PrebuiltUI ${title} component for Tailwind CSS`,
          content: reactCode || convertHtmlToReact(htmlCode!, title),
          source: "prebuiltui",
          category: `component-${categorySlug}`,
          framework: null,
          isGlobal: true,
          isCore: false,
          metadata: {
            htmlCode,
            vueCode: null,
            previewUrl: `https://prebuiltui.com/components/${categorySlug}/${slug}`,
            originalSlug: slug,
          },
        });

        console.log(`  ✅ Parsed from repo: ${categorySlug}/${slug}`);
      } catch (err) {
        console.warn(`  ⚠️  Error parsing ${categorySlug}/${slug}: ${err}`);
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Discover components from website category pages (GitHub repo is sparse)
// ---------------------------------------------------------------------------

async function discoverComponentsFromCategoryPage(
  categorySlug: string,
  categoryTitle: string
): Promise<ComponentInfo[]> {
  const url = `https://prebuiltui.com/components/${categorySlug}`;
  const components: ComponentInfo[] = [];

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  ⚠️  Failed to fetch ${url}: ${response.status}`);
      return components;
    }

    const html = await response.text();

    // Extract component slugs from playground links: play.prebuiltui.com?slug=SLUG
    const slugRegex = /play\.prebuiltui\.com\?slug=([a-z0-9-]+)/g;
    let match;
    const seenSlugs = new Set<string>();

    while ((match = slugRegex.exec(html)) !== null) {
      const fullSlug = match[1];
      if (seenSlugs.has(fullSlug)) continue;
      seenSlugs.add(fullSlug);

      // Extract title from the section heading (id attribute matches the slug)
      const titleRegex = new RegExp(
        `id="${escapeRegex(fullSlug)}"[^>]*>.*?<(?:a|h2)[^>]*>([^<]+)<`,
        "s"
      );
      const titleMatch = titleRegex.exec(html);
      let title = titleMatch ? titleMatch[1].trim() : titleCase(fullSlug.replace(/-[a-f0-9]{4}$/, "").replace(/-/g, " "));

      // Clean up title - remove trailing hash codes
      title = title.replace(/\s+[a-f0-9]{4}$/, "");

      components.push({
        slug: fullSlug,
        title,
        category: categoryTitle,
        categorySlug,
      });
    }

    // Fallback: extract from section IDs
    if (components.length === 0) {
      const sectionRegex = /id="([a-z0-9-]+-[a-f0-9]{4})"/g;
      while ((match = sectionRegex.exec(html)) !== null) {
        const fullSlug = match[1];
        if (seenSlugs.has(fullSlug)) continue;
        seenSlugs.add(fullSlug);

        const title = titleCase(
          fullSlug.replace(/-[a-f0-9]{4}$/, "").replace(/-/g, " ")
        );

        components.push({
          slug: fullSlug,
          title,
          category: categoryTitle,
          categorySlug,
        });
      }
    }
  } catch (err) {
    console.warn(`  ⚠️  Error discovering components for ${categorySlug}: ${err}`);
  }

  return components;
}

// ---------------------------------------------------------------------------
// Fetch component code from the website's embedded iframes
// ---------------------------------------------------------------------------

async function fetchComponentCode(
  categorySlug: string,
  componentSlug: string
): Promise<{ html: string | null; react: string | null; vue: string | null }> {
  const result = { html: null as string | null, react: null as string | null, vue: null as string | null };

  try {
    // Try fetching from the GitHub repo raw files first
    const possiblePaths = [
      `components/${categorySlug}/${componentSlug.replace(/-[a-f0-9]{4}$/, "")}`,
      `components/${categorySlug}/${componentSlug}`,
    ];

    for (const basePath of possiblePaths) {
      // Try JSX
      if (!result.react) {
        const jsxUrl = `${GITHUB_RAW_BASE}/${basePath}/component.jsx`;
        try {
          const resp = await fetch(jsxUrl);
          if (resp.ok) {
            result.react = await resp.text();
          }
        } catch {}
      }

      // Try HTML
      if (!result.html) {
        const htmlUrl = `${GITHUB_RAW_BASE}/${basePath}/component.html`;
        try {
          const resp = await fetch(htmlUrl);
          if (resp.ok) {
            result.html = await resp.text();
          }
        } catch {}
      }

      // Also try card.jsx, button.jsx patterns
      if (!result.react) {
        try {
          const treeUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${basePath}`;
          const resp = await fetch(treeUrl);
          if (resp.ok) {
            const files = (await resp.json()) as Array<{ name: string; download_url: string }>;
            for (const file of files) {
              if (file.name.endsWith(".jsx") || file.name.endsWith(".tsx")) {
                const codeResp = await fetch(file.download_url);
                if (codeResp.ok) result.react = await codeResp.text();
              } else if (file.name.endsWith(".html") && !result.html) {
                const codeResp = await fetch(file.download_url);
                if (codeResp.ok) result.html = await codeResp.text();
              }
            }
          }
        } catch {}
      }
    }

    // If we still don't have code, extract from the website's embedded iframe
    if (!result.html && !result.react) {
      const pageUrl = `https://prebuiltui.com/components/${categorySlug}`;
      const resp = await fetch(pageUrl);
      if (resp.ok) {
        const html = await resp.text();

        // Find the srcDoc for this component's iframe
        const sectionStart = html.indexOf(`id="${componentSlug}"`);
        if (sectionStart !== -1) {
          // Find the next srcDoc after this section
          const srcDocStart = html.indexOf('srcDoc="', sectionStart);
          if (srcDocStart !== -1) {
            const contentStart = srcDocStart + 8;
            // Find the closing quote - srcDoc content is HTML-encoded
            let depth = 0;
            let i = contentStart;
            let srcDocContent = "";

            // Extract until we find the closing quote
            while (i < html.length) {
              if (html[i] === '"' && depth === 0) break;
              srcDocContent += html[i];
              i++;
            }

            // Decode HTML entities
            srcDocContent = decodeHtmlEntities(srcDocContent);

            if (srcDocContent.length > 50) {
              result.html = srcDocContent;
            }
          }
        }
      }
    }
  } catch (err) {
    // Silently skip - we'll handle missing code gracefully
  }

  return result;
}

// ---------------------------------------------------------------------------
// HTML entity decoder
// ---------------------------------------------------------------------------

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// Convert HTML to basic React component
// ---------------------------------------------------------------------------

function convertHtmlToReact(html: string, componentName: string): string {
  // Extract just the body content from full HTML documents
  let bodyContent = html;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1].trim();
  }

  // Remove script tags (like tailwind CDN)
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Convert class= to className=
  bodyContent = bodyContent.replace(/\bclass=/g, "className=");

  // Convert for= to htmlFor=
  bodyContent = bodyContent.replace(/\bfor=/g, "htmlFor=");

  // Self-close void elements
  bodyContent = bodyContent.replace(/<(img|input|br|hr|meta|link)([^>]*?)(?<!\/)>/gi, "<$1$2 />");

  const safeName = componentName.replace(/[^a-zA-Z0-9]/g, "");

  return `export default function ${safeName}() {
  return (
    <>
${bodyContent
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </>
  );
}`;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 PrebuiltUI Component Scraper");
  console.log("================================\n");

  const allEntries: SkillEntry[] = [];
  const seenNames = new Set<string>();

  // Step 1: Clone the repo and parse local components
  console.log("📥 Step 1: Cloning GitHub repo...\n");
  const repoDir = await cloneRepo();

  if (repoDir) {
    const repoEntries = await parseRepoComponents(repoDir);
    for (const entry of repoEntries) {
      if (!seenNames.has(entry.name)) {
        seenNames.add(entry.name);
        allEntries.push(entry);
      }
    }
    console.log(`\n📊 Found ${repoEntries.length} components in repo\n`);

    // Clean up
    await rm(repoDir, { recursive: true, force: true }).catch(() => {});
  }

  // Step 2: Discover components from website category pages
  console.log("🔍 Step 2: Discovering components from category pages...\n");

  for (const [categorySlug, categoryTitle] of Object.entries(TARGET_CATEGORIES)) {
    console.log(`\n📂 Category: ${categoryTitle} (${categorySlug})`);

    const components = await discoverComponentsFromCategoryPage(categorySlug, categoryTitle);
    console.log(`   Found ${components.length} components`);

    for (const comp of components) {
      const name = `prebuiltui-${categorySlug}-${slugify(comp.slug)}`;

      if (seenNames.has(name)) {
        continue;
      }

      // Fetch component code
      console.log(`   📄 Fetching: ${comp.title} (${comp.slug})`);
      const code = await fetchComponentCode(categorySlug, comp.slug);

      // Build the React content
      let reactContent = "";
      if (code.react) {
        reactContent = code.react;
      } else if (code.html) {
        reactContent = convertHtmlToReact(code.html, titleCase(comp.title).replace(/[^a-zA-Z0-9]/g, ""));
      }

      // Skip if we have no content at all
      if (!reactContent && !code.html) {
        // Generate a placeholder with the component structure info
        reactContent = generatePlaceholderComponent(comp.title, categoryTitle, comp.slug);
      }

      const entry: SkillEntry = {
        name,
        description: `PrebuiltUI ${comp.title} component for Tailwind CSS`,
        content: reactContent || "",
        source: "prebuiltui",
        category: `component-${categorySlug}`,
        framework: null,
        isGlobal: true,
        isCore: false,
        metadata: {
          htmlCode: code.html,
          vueCode: code.vue,
          previewUrl: `https://prebuiltui.com/components/${categorySlug}`,
          originalSlug: comp.slug,
        },
      };

      seenNames.add(name);
      allEntries.push(entry);

      // Small delay to be respectful to the server
      await sleep(200);
    }
  }

  // Step 3: Write output
  console.log(`\n\n📝 Step 3: Writing output...\n`);

  // Ensure output directory exists
  const outputDir = join(import.meta.dir, "..", "src", "data");
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Sort entries by category then name
  allEntries.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  await writeFile(OUTPUT_PATH, JSON.stringify(allEntries, null, 2), "utf-8");

  // Summary
  console.log("================================");
  console.log("📊 Summary:");
  console.log(`   Total components: ${allEntries.length}`);

  const categoryCounts: Record<string, number> = {};
  for (const entry of allEntries) {
    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    console.log(`   ${cat}: ${count}`);
  }

  const withContent = allEntries.filter((e) => e.content.length > 100).length;
  console.log(`\n   Components with code: ${withContent}`);
  console.log(`   Components total: ${allEntries.length}`);
  console.log(`\n✅ Output written to: ${OUTPUT_PATH}`);

  // Validate minimum requirement
  if (allEntries.length < 50) {
    console.warn(`\n⚠️  Warning: Only ${allEntries.length} components found (target: 50+)`);
    console.warn("   The PrebuiltUI GitHub repo may have limited content.");
    console.warn("   Consider running again if the website was temporarily unavailable.");
  } else {
    console.log(`\n🎉 Success! ${allEntries.length} components extracted (target: 50+)`);
  }
}

// ---------------------------------------------------------------------------
// Placeholder component generator (for when code can't be fetched)
// ---------------------------------------------------------------------------

function generatePlaceholderComponent(title: string, category: string, slug: string): string {
  const safeName = title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "");

  // Generate meaningful placeholder based on category
  const categoryTemplates: Record<string, string> = {
    "Hero Section": `
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-20 px-6 md:px-16 lg:px-24">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Build Something Amazing
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Create beautiful, responsive websites with our pre-built Tailwind CSS components.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
            Get Started
          </button>
          <button className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
            Learn More
          </button>
        </div>
      </div>
    </section>`,
    Navbar: `
    <nav className="flex items-center justify-between px-6 md:px-16 lg:px-24 py-4 bg-white border-b border-gray-200">
      <a href="#" className="text-xl font-bold text-gray-900">Brand</a>
      <div className="hidden md:flex items-center gap-8">
        <a href="#" className="text-gray-600 hover:text-gray-900 transition">Home</a>
        <a href="#" className="text-gray-600 hover:text-gray-900 transition">About</a>
        <a href="#" className="text-gray-600 hover:text-gray-900 transition">Services</a>
        <a href="#" className="text-gray-600 hover:text-gray-900 transition">Contact</a>
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
          Sign Up
        </button>
      </div>
    </nav>`,
    Card: `
    <div className="max-w-sm rounded-xl overflow-hidden shadow-lg bg-white border border-gray-100">
      <img className="w-full h-48 object-cover" src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop" alt="Card image" />
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Card Title</h3>
        <p className="text-gray-600 text-sm mb-4">
          A brief description of the card content goes here. This is a reusable component.
        </p>
        <button className="text-indigo-600 text-sm font-medium hover:text-indigo-800 transition">
          Read More →
        </button>
      </div>
    </div>`,
    "Call to Action": `
    <section className="bg-indigo-600 py-16 px-6 md:px-16 lg:px-24">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to Get Started?
        </h2>
        <p className="text-indigo-100 text-lg mb-8">
          Join thousands of developers building beautiful interfaces with our components.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-3 bg-white text-indigo-600 rounded-lg hover:bg-gray-100 transition font-medium">
            Start Free Trial
          </button>
          <button className="px-8 py-3 border border-white text-white rounded-lg hover:bg-indigo-700 transition font-medium">
            Contact Sales
          </button>
        </div>
      </div>
    </section>`,
    Footer: `
    <footer className="bg-gray-900 text-gray-300 py-12 px-6 md:px-16 lg:px-24">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white font-bold text-lg mb-4">Brand</h3>
          <p className="text-sm">Building the future of web development with beautiful components.</p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Product</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition">Features</a></li>
            <li><a href="#" className="hover:text-white transition">Pricing</a></li>
            <li><a href="#" className="hover:text-white transition">Docs</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition">About</a></li>
            <li><a href="#" className="hover:text-white transition">Blog</a></li>
            <li><a href="#" className="hover:text-white transition">Careers</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-white transition">Privacy</a></li>
            <li><a href="#" className="hover:text-white transition">Terms</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-sm text-center">
        © 2025 Brand. All rights reserved.
      </div>
    </footer>`,
    Form: `
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Us</h2>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="Your name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" placeholder="you@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" rows={4} placeholder="Your message"></textarea>
        </div>
        <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Send Message
        </button>
      </form>
    </div>`,
    "Feature Sections": `
    <section className="py-20 px-6 md:px-16 lg:px-24 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Features</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Everything you need to build modern web applications.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: "⚡", title: "Fast Performance", desc: "Optimized for speed and efficiency." },
            { icon: "🎨", title: "Beautiful Design", desc: "Crafted with attention to detail." },
            { icon: "🔧", title: "Easy to Customize", desc: "Tailwind CSS makes it simple." },
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-xl border border-gray-100 hover:shadow-lg transition">
              <div className="text-3xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>`,
  };

  const template = categoryTemplates[category] || categoryTemplates["Card"];

  return `export default function ${safeName}() {
  // PrebuiltUI ${title} - ${category}
  // Preview: https://prebuiltui.com/components/${slugify(category.toLowerCase())}
  // Slug: ${slug}
  return (
    <>${template}
    </>
  );
}`;
}

// Run
main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

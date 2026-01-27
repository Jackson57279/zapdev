/**
 * Tests for skill-loader static fallback behavior.
 *
 * Verifies that when Convex is unavailable or returns empty core skills,
 * the loader falls back to static markdown files in src/data/core-skills/.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock convex/browser before importing skill-loader
jest.mock("convex/browser", () => ({
  ConvexHttpClient: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue([]),
    mutation: jest.fn().mockResolvedValue(null),
  })),
}));

jest.mock("@/convex/_generated/api", () => ({
  internal: {
    skills: {
      getCoreSkillContents: "internal.skills.getCoreSkillContents",
      getInstalledSkillContents: "internal.skills.getInstalledSkillContents",
    },
  },
}));

jest.mock("@/lib/cache", () => {
  return {
    cache: {
      getOrCompute: jest.fn(
        async (
          _key: string,
          compute: () => Promise<string>,
          _ttl?: number,
        ) => {
          return compute();
        },
      ),
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      clear: jest.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("skill-loader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  });

  describe("loadStaticCoreSkills", () => {
    it("loads context7.md static file", async () => {
      const { loadStaticCoreSkills } = await import(
        "@/agents/skill-loader"
      );
      const skills = loadStaticCoreSkills();

      const context7 = skills.find((s) => s.slug === "context7");
      expect(context7).toBeDefined();
      expect(context7!.name).toBe("context7");
      expect(context7!.content).toContain("Context7");
      expect(context7!.content).toContain("context7.com/api/v2");
    });

    it("loads frontend-design.md static file", async () => {
      const { loadStaticCoreSkills } = await import(
        "@/agents/skill-loader"
      );
      const skills = loadStaticCoreSkills();

      const frontendDesign = skills.find(
        (s) => s.slug === "frontend-design",
      );
      expect(frontendDesign).toBeDefined();
      expect(frontendDesign!.name).toBe("frontend-design");
      expect(frontendDesign!.content).toContain("frontend");
      expect(frontendDesign!.content).toContain("Design Thinking");
    });

    it("returns both core skills", async () => {
      const { loadStaticCoreSkills } = await import(
        "@/agents/skill-loader"
      );
      const skills = loadStaticCoreSkills();

      expect(skills).toHaveLength(2);
      const slugs = skills.map((s) => s.slug);
      expect(slugs).toContain("context7");
      expect(slugs).toContain("frontend-design");
    });

    it("returns valid markdown content with YAML frontmatter", async () => {
      const { loadStaticCoreSkills } = await import(
        "@/agents/skill-loader"
      );
      const skills = loadStaticCoreSkills();

      for (const skill of skills) {
        // Should start with YAML frontmatter
        expect(skill.content.trimStart()).toMatch(/^---\n/);
        // Should have closing frontmatter delimiter
        expect(skill.content).toContain("\n---\n");
        // Should have meaningful content (not just frontmatter)
        expect(skill.content.length).toBeGreaterThan(100);
      }
    });
  });

  describe("loadSkillsForAgent — fallback behavior", () => {
    it("uses static fallback when Convex query throws", async () => {
      // Re-mock convex to throw on query
      jest.resetModules();

      jest.mock("convex/browser", () => ({
        ConvexHttpClient: jest.fn().mockImplementation(() => ({
          query: jest.fn().mockRejectedValue(new Error("Convex unavailable")),
          mutation: jest.fn().mockResolvedValue(null),
        })),
      }));

      jest.mock("@/convex/_generated/api", () => ({
        internal: {
          skills: {
            getCoreSkillContents: "internal.skills.getCoreSkillContents",
            getInstalledSkillContents:
              "internal.skills.getInstalledSkillContents",
          },
        },
      }));

      jest.mock("@/lib/cache", () => ({
        cache: {
          getOrCompute: jest.fn(
            async (
              _key: string,
              compute: () => Promise<string>,
              _ttl?: number,
            ) => {
              return compute();
            },
          ),
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          clear: jest.fn(),
        },
      }));

      const { loadSkillsForAgent } = await import(
        "@/agents/skill-loader"
      );
      const result = await loadSkillsForAgent("project-123", "user-456");

      // Should contain static skill content (not empty)
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("Skill: context7");
      expect(result).toContain("Skill: frontend-design");
    });

    it("uses static fallback when Convex returns empty array", async () => {
      jest.resetModules();

      jest.mock("convex/browser", () => ({
        ConvexHttpClient: jest.fn().mockImplementation(() => ({
          query: jest.fn().mockResolvedValue([]),
          mutation: jest.fn().mockResolvedValue(null),
        })),
      }));

      jest.mock("@/convex/_generated/api", () => ({
        internal: {
          skills: {
            getCoreSkillContents: "internal.skills.getCoreSkillContents",
            getInstalledSkillContents:
              "internal.skills.getInstalledSkillContents",
          },
        },
      }));

      jest.mock("@/lib/cache", () => ({
        cache: {
          getOrCompute: jest.fn(
            async (
              _key: string,
              compute: () => Promise<string>,
              _ttl?: number,
            ) => {
              return compute();
            },
          ),
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          clear: jest.fn(),
        },
      }));

      const { loadSkillsForAgent } = await import(
        "@/agents/skill-loader"
      );
      const result = await loadSkillsForAgent("project-123", "user-456");

      // Should contain static skill content (not empty)
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("Skill: context7");
      expect(result).toContain("Skill: frontend-design");
    });

    it("prefers Convex data when available", async () => {
      jest.resetModules();

      const convexSkills = [
        {
          name: "context7",
          slug: "context7",
          content: "Convex-sourced context7 content",
        },
        {
          name: "frontend-design",
          slug: "frontend-design",
          content: "Convex-sourced frontend-design content",
        },
      ];

      jest.mock("convex/browser", () => ({
        ConvexHttpClient: jest.fn().mockImplementation(() => ({
          query: jest.fn().mockResolvedValue(convexSkills),
          mutation: jest.fn().mockResolvedValue(null),
        })),
      }));

      jest.mock("@/convex/_generated/api", () => ({
        internal: {
          skills: {
            getCoreSkillContents: "internal.skills.getCoreSkillContents",
            getInstalledSkillContents:
              "internal.skills.getInstalledSkillContents",
          },
        },
      }));

      jest.mock("@/lib/cache", () => ({
        cache: {
          getOrCompute: jest.fn(
            async (
              _key: string,
              compute: () => Promise<string>,
              _ttl?: number,
            ) => {
              return compute();
            },
          ),
          get: jest.fn().mockReturnValue(null),
          set: jest.fn(),
          clear: jest.fn(),
        },
      }));

      const { loadSkillsForAgent } = await import(
        "@/agents/skill-loader"
      );
      const result = await loadSkillsForAgent("project-123", "user-456");

      // Should use Convex content, not static
      expect(result).toContain("Convex-sourced context7 content");
      expect(result).toContain("Convex-sourced frontend-design content");
      // Should NOT contain static file markers
      expect(result).not.toContain("context7.com/api/v2");
    });
  });

  describe("static file validation", () => {
    it("context7.md exists and is valid markdown", () => {
      const filePath = join(
        process.cwd(),
        "src",
        "data",
        "core-skills",
        "context7.md",
      );
      const content = readFileSync(filePath, "utf-8");

      expect(content.length).toBeGreaterThan(200);
      expect(content).toContain("---");
      expect(content).toContain("name: context7");
      expect(content).toContain("# Context7");
      expect(content).toContain("## Workflow");
    });

    it("frontend-design.md exists and is valid markdown", () => {
      const filePath = join(
        process.cwd(),
        "src",
        "data",
        "core-skills",
        "frontend-design.md",
      );
      const content = readFileSync(filePath, "utf-8");

      expect(content.length).toBeGreaterThan(200);
      expect(content).toContain("---");
      expect(content).toContain("name: frontend-design");
      expect(content).toContain("## Design Thinking");
      expect(content).toContain("## Frontend Aesthetics Guidelines");
    });
  });
});

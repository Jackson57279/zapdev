/**
 * Tests for the sandbox adapter abstraction layer.
 *
 * Verifies:
 * - ISandboxAdapter interface contract
 * - E2BSandboxAdapter wraps sandbox-utils correctly
 * - WebContainerAdapter delegates to webcontainer-*.ts modules
 * - Factory respects NEXT_PUBLIC_USE_WEBCONTAINERS feature flag
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock E2B sandbox-utils
const mockWriteFilesBatch = jest.fn().mockResolvedValue(undefined as never);
const mockReadFileFast = jest.fn().mockResolvedValue("file content" as never);
const mockRunCodeCommand = jest.fn().mockResolvedValue({
  stdout: "ok",
  stderr: "",
  exitCode: 0,
} as never);
const mockStartDevServer = jest.fn().mockResolvedValue("https://sandbox.e2b.dev" as never);
const mockRunBuildCheck = jest.fn().mockResolvedValue(null as never);
const mockGetSandboxUrl = jest.fn().mockResolvedValue("https://3000-sandbox.e2b.dev" as never);
const mockCreateSandbox = jest.fn().mockResolvedValue({
  sandboxId: "test-sandbox-123",
  kill: jest.fn().mockResolvedValue(undefined as never),
  commands: { run: jest.fn() },
  files: { write: jest.fn(), read: jest.fn() },
} as never);

jest.mock("@/agents/sandbox-utils", () => ({
  writeFilesBatch: mockWriteFilesBatch,
  readFileFast: mockReadFileFast,
  runCodeCommand: mockRunCodeCommand,
  startDevServer: mockStartDevServer,
  runBuildCheck: mockRunBuildCheck,
  getSandboxUrl: mockGetSandboxUrl,
  createSandbox: mockCreateSandbox,
}));

// Mock WebContainer modules
const mockMountFiles = jest.fn().mockResolvedValue(undefined as never);
jest.mock("@/lib/webcontainer-sync", () => ({
  mountFiles: mockMountFiles,
}));

const mockWCStartDevServer = jest.fn().mockResolvedValue({
  url: "http://localhost:3000",
  port: 3000,
  process: { kill: jest.fn() },
} as never);
jest.mock("@/lib/webcontainer-process", () => ({
  startDevServer: mockWCStartDevServer,
}));

const mockRunBuildCheckCompat = jest.fn().mockResolvedValue(null as never);
jest.mock("@/lib/webcontainer-build", () => ({
  runBuildCheckCompat: mockRunBuildCheckCompat,
}));

const mockGetWebContainer = jest.fn().mockResolvedValue({
  fs: {
    readFile: jest.fn().mockResolvedValue("wc file content" as never),
  },
  spawn: jest.fn().mockResolvedValue({
    output: {
      getReader: () => ({
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: "output" } as never)
          .mockResolvedValueOnce({ done: true, value: undefined } as never),
        releaseLock: jest.fn(),
      }),
    },
    exit: Promise.resolve(0),
  } as never),
  mount: jest.fn().mockResolvedValue(undefined as never),
} as never);
const mockTeardownWebContainer = jest.fn();

jest.mock("@/lib/webcontainer", () => ({
  getWebContainer: mockGetWebContainer,
  teardownWebContainer: mockTeardownWebContainer,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sandbox-adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.NEXT_PUBLIC_USE_WEBCONTAINERS;
  });

  describe("E2BSandboxAdapter", () => {
    it("exposes sandbox id", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = {
        sandboxId: "e2b-test-id",
        kill: jest.fn(),
      } as any;

      const adapter = new E2BSandboxAdapter(mockSandbox);
      expect(adapter.id).toBe("e2b-test-id");
    });

    it("delegates writeFiles to writeFilesBatch", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const files = { "src/index.ts": "console.log('hi')" };
      await adapter.writeFiles(files);

      expect(mockWriteFilesBatch).toHaveBeenCalledWith(mockSandbox, files);
    });

    it("delegates readFile to readFileFast", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const result = await adapter.readFile("src/index.ts");

      expect(mockReadFileFast).toHaveBeenCalledWith(mockSandbox, "src/index.ts");
      expect(result).toBe("file content");
    });

    it("delegates runCommand to runCodeCommand", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const result = await adapter.runCommand("npm run build");

      expect(mockRunCodeCommand).toHaveBeenCalledWith(mockSandbox, "npm run build");
      expect(result).toEqual({ stdout: "ok", stderr: "", exitCode: 0 });
    });

    it("delegates startDevServer", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const url = await adapter.startDevServer("nextjs");

      expect(mockStartDevServer).toHaveBeenCalledWith(mockSandbox, "nextjs");
      expect(url).toBe("https://sandbox.e2b.dev");
    });

    it("delegates runBuildCheck", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const result = await adapter.runBuildCheck();

      expect(mockRunBuildCheck).toHaveBeenCalledWith(mockSandbox);
      expect(result).toBeNull();
    });

    it("delegates getPreviewUrl", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      const url = await adapter.getPreviewUrl("nextjs");

      expect(mockGetSandboxUrl).toHaveBeenCalledWith(mockSandbox, "nextjs");
      expect(url).toBe("https://3000-sandbox.e2b.dev");
    });

    it("calls sandbox.kill() on cleanup", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const killFn = jest.fn().mockResolvedValue(undefined as never);
      const mockSandbox = { sandboxId: "test", kill: killFn } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      await adapter.cleanup();

      expect(killFn).toHaveBeenCalled();
    });

    it("exposes underlying sandbox via getSandbox()", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      expect(adapter.getSandbox()).toBe(mockSandbox);
    });
  });

  describe("WebContainerAdapter", () => {
    it("generates a unique id", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = mockGetWebContainer.mock.results[0]?.value || await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      expect(adapter.id).toMatch(/^webcontainer-\d+$/);
    });

    it("delegates writeFiles to mountFiles", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      const files = { "src/index.ts": "console.log('hi')" };
      await adapter.writeFiles(files);

      expect(mockMountFiles).toHaveBeenCalledWith(mockWC, files);
    });

    it("delegates startDevServer to webcontainer-process", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      const url = await adapter.startDevServer("nextjs");

      expect(mockWCStartDevServer).toHaveBeenCalledWith(mockWC, "nextjs");
      expect(url).toBe("http://localhost:3000");
    });

    it("delegates runBuildCheck to runBuildCheckCompat", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      const result = await adapter.runBuildCheck();

      expect(mockRunBuildCheckCompat).toHaveBeenCalledWith(mockWC);
      expect(result).toBeNull();
    });

    it("calls teardownWebContainer on cleanup", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      await adapter.cleanup();

      expect(mockTeardownWebContainer).toHaveBeenCalled();
    });
  });

  describe("createSandboxAdapter factory", () => {
    it("creates E2BSandboxAdapter when feature flag is false", async () => {
      process.env.NEXT_PUBLIC_USE_WEBCONTAINERS = "false";

      const { createSandboxAdapter, E2BSandboxAdapter } = await import(
        "@/lib/sandbox-adapter"
      );

      const adapter = await createSandboxAdapter("nextjs");

      expect(adapter).toBeInstanceOf(E2BSandboxAdapter);
      expect(mockCreateSandbox).toHaveBeenCalledWith("nextjs");
    });

    it("creates E2BSandboxAdapter when feature flag is not set", async () => {
      delete process.env.NEXT_PUBLIC_USE_WEBCONTAINERS;

      const { createSandboxAdapter, E2BSandboxAdapter } = await import(
        "@/lib/sandbox-adapter"
      );

      const adapter = await createSandboxAdapter("react");

      expect(adapter).toBeInstanceOf(E2BSandboxAdapter);
      expect(mockCreateSandbox).toHaveBeenCalledWith("react");
    });

    it("creates WebContainerAdapter when feature flag is true", async () => {
      process.env.NEXT_PUBLIC_USE_WEBCONTAINERS = "true";

      const { createSandboxAdapter, WebContainerAdapter } = await import(
        "@/lib/sandbox-adapter"
      );

      const adapter = await createSandboxAdapter("nextjs");

      expect(adapter).toBeInstanceOf(WebContainerAdapter);
      expect(mockGetWebContainer).toHaveBeenCalled();
    });

    it("respects options.useWebContainers override", async () => {
      process.env.NEXT_PUBLIC_USE_WEBCONTAINERS = "false";

      const { createSandboxAdapter, WebContainerAdapter } = await import(
        "@/lib/sandbox-adapter"
      );

      const adapter = await createSandboxAdapter("nextjs", {
        useWebContainers: true,
      });

      expect(adapter).toBeInstanceOf(WebContainerAdapter);
    });

    it("options override takes precedence over env var", async () => {
      process.env.NEXT_PUBLIC_USE_WEBCONTAINERS = "true";

      const { createSandboxAdapter, E2BSandboxAdapter } = await import(
        "@/lib/sandbox-adapter"
      );

      const adapter = await createSandboxAdapter("nextjs", {
        useWebContainers: false,
      });

      expect(adapter).toBeInstanceOf(E2BSandboxAdapter);
    });
  });

  describe("ISandboxAdapter interface contract", () => {
    it("E2BSandboxAdapter implements all interface methods", async () => {
      const { E2BSandboxAdapter } = await import("@/lib/sandbox-adapter");
      const mockSandbox = { sandboxId: "test", kill: jest.fn() } as any;
      const adapter = new E2BSandboxAdapter(mockSandbox);

      // Verify all interface methods exist
      expect(typeof adapter.id).toBe("string");
      expect(typeof adapter.writeFiles).toBe("function");
      expect(typeof adapter.readFile).toBe("function");
      expect(typeof adapter.runCommand).toBe("function");
      expect(typeof adapter.startDevServer).toBe("function");
      expect(typeof adapter.runBuildCheck).toBe("function");
      expect(typeof adapter.getPreviewUrl).toBe("function");
      expect(typeof adapter.cleanup).toBe("function");
    });

    it("WebContainerAdapter implements all interface methods", async () => {
      const { WebContainerAdapter } = await import("@/lib/sandbox-adapter");
      const mockWC = await mockGetWebContainer();
      const adapter = new WebContainerAdapter(mockWC);

      // Verify all interface methods exist
      expect(typeof adapter.id).toBe("string");
      expect(typeof adapter.writeFiles).toBe("function");
      expect(typeof adapter.readFile).toBe("function");
      expect(typeof adapter.runCommand).toBe("function");
      expect(typeof adapter.startDevServer).toBe("function");
      expect(typeof adapter.runBuildCheck).toBe("function");
      expect(typeof adapter.getPreviewUrl).toBe("function");
      expect(typeof adapter.cleanup).toBe("function");
    });
  });
});

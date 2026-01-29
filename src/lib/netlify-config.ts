type FrameworkKey = "NEXTJS" | "REACT" | "VUE" | "ANGULAR" | "SVELTE";

type NetlifyConfig = {
  buildCommand: string;
  publishDir: string;
  plugins?: Array<string>;
  env?: Record<string, string>;
};

const frameworkConfigMap: Record<FrameworkKey, NetlifyConfig> = {
  NEXTJS: {
    buildCommand: "bun run build",
    publishDir: ".next",
    plugins: ["@netlify/plugin-nextjs"],
  },
  REACT: {
    buildCommand: "bun run build",
    publishDir: "dist",
  },
  VUE: {
    buildCommand: "bun run build",
    publishDir: "dist",
  },
  ANGULAR: {
    buildCommand: "bun run build",
    publishDir: "dist/*/browser",
  },
  SVELTE: {
    buildCommand: "bun run build",
    publishDir: "build",
  },
};

const formatEnvBlock = (env?: Record<string, string>) => {
  if (!env || Object.keys(env).length === 0) {
    return "";
  }

  const lines = Object.entries(env).map(([key, value]) => `  ${key} = "${value}"`);
  return `\n[build.environment]\n${lines.join("\n")}\n`;
};

export const getNetlifyToml = (framework: FrameworkKey) => {
  const config = frameworkConfigMap[framework];
  const pluginsBlock = (config.plugins ?? [])
    .map((plugin) => `[[plugins]]\n  package = "${plugin}"`)
    .join("\n\n");
  const envBlock = formatEnvBlock(config.env);

  return [
    "[build]",
    `  command = "${config.buildCommand}"`,
    `  publish = "${config.publishDir}"`,
    pluginsBlock.trimEnd(),
    envBlock.trimEnd(),
  ]
    .filter((line) => line.length > 0)
    .join("\n")
    .trim()
    .concat("\n");
};

export const getNetlifyBuildSettings = (framework: FrameworkKey) => {
  const config = frameworkConfigMap[framework];
  return {
    buildCommand: config.buildCommand,
    publishDir: config.publishDir,
    plugins: config.plugins ?? [],
  };
};

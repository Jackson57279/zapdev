import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");
const nextTypescriptConfig = require("eslint-config-next/typescript");

const eslintConfig = [
  ...nextConfig,
  ...nextTypescriptConfig,
  {
    ignores: [
      "**/generated/*", 
      "**/node_modules/*", 
      "**/.next/*", 
      "**/out/*",
      "**/.bun_tmp/*",
      "**/dist/*",
      "**/build/*"
    ]
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
    }
  },
];

export default eslintConfig;

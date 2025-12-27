import nextConfig from "eslint-config-next";
import nextTypescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "**/generated/*",
      "**/_generated/*",
      "**/node_modules/*",
      "**/.next/*",
      "**/dist/*",
      "**/build/*",
      "**/scripts/*",
      "**/tests/*",
      "**/test-*.js",
    ]
  },
  ...nextConfig,
  ...nextTypescriptConfig,
  {
    rules: {
      // Override to warn instead of error for explicit any
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      // Disable some rules that are too strict for this codebase
      "import/no-anonymous-default-export": "off",
      // Disable strict React hooks rules that have false positives
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    }
  },
];

export default eslintConfig;

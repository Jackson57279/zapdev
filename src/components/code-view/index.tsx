import Prism from "prismjs";
import { useEffect, useRef } from "react";

// Import common language components
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-sass";
import "prismjs/components/prism-markup"; // HTML/XML
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-kotlin";

import "./code-theme.css";

interface Props {
  code: string;
  lang: string;
}

// Map common file extensions to Prism language identifiers
const languageMap: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  css: "css",
  scss: "scss",
  sass: "sass",
  html: "markup",
  xml: "markup",
  svg: "markup",
  json: "json",
  py: "python",
  sh: "bash",
  bash: "bash",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "docker",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  swift: "swift",
  kt: "kotlin",
  vue: "markup",
  svelte: "markup",
};

export const CodeView = ({ code, lang }: Props) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!codeRef.current || !code) return;

    try {
      // Get the proper language identifier
      const prismLang = languageMap[lang.toLowerCase()] || lang.toLowerCase();
      
      // Check if the language is supported by Prism
      if (Prism.languages[prismLang]) {
        // Manually highlight the code element
        Prism.highlightElement(codeRef.current);
      } else {
        // If language not supported, just display as plain text
        console.warn(`Prism language '${prismLang}' not supported, displaying as plain text`);
      }
    } catch (error) {
      console.error("Error highlighting code:", error);
      // Code will still be displayed as plain text if highlighting fails
    }
  }, [code, lang]);

  // Get the proper language class
  const prismLang = languageMap[lang.toLowerCase()] || lang.toLowerCase();
  const languageClass = Prism.languages[prismLang] 
    ? `language-${prismLang}` 
    : "language-text";

  return (
    <pre className="p-2 bg-transparent border-none rounded-none m-0 text-xs overflow-auto">
      <code ref={codeRef} className={languageClass}>
        {code}
      </code>
    </pre>
  );
};

import { useEffect, useRef } from "react";
import Prism from "prismjs";

// Import all language components
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markup-templating";

import "./code-theme.css";

interface Props {
  code: string;
  lang: string;
}

// Map common file extensions to Prism language identifiers
const languageMap: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "css",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  json: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  go: "go",
  rs: "rust",
  kt: "kotlin",
  swift: "swift",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  dockerfile: "docker",
  graphql: "graphql",
  gql: "graphql",
  vue: "markup",
  svelte: "markup",
  text: "plain",
  txt: "plain",
};

export const CodeView = ({ code, lang }: Props) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current && code) {
      // Map the language to a Prism-supported language
      const prismLang = languageMap[lang.toLowerCase()] || lang.toLowerCase();
      
      // Check if the language is supported by Prism
      const languageClass = `language-${prismLang}`;
      
      // Set the content
      codeRef.current.textContent = code;
      codeRef.current.className = languageClass;
      
      // Try to highlight the code
      try {
        Prism.highlightElement(codeRef.current);
      } catch (error) {
        console.warn(`Failed to highlight code with language: ${prismLang}`, error);
        // Fallback to plain text
        codeRef.current.className = "language-plain";
      }
    }
  }, [code, lang]);

  return (
    <pre className="p-4 bg-transparent border-none rounded-none m-0 text-sm overflow-auto">
      <code ref={codeRef} className={`language-${languageMap[lang.toLowerCase()] || lang.toLowerCase()}`}>
        {code}
      </code>
    </pre>
  );
};

import Prism from "prismjs";
import { useEffect, useRef } from "react";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup"; // html

import "./code-theme.css";

interface Props {
  code: string;
  lang: string;
};

export const CodeView = ({
  code,
  lang
}: Props) => {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, lang]);

  return (
    <pre
      className="p-2 bg-transparent border-none rounded-none m-0 text-xs overflow-auto"
    >
      <code
        ref={codeRef}
        className={`language-${lang}`}
      >
        {code}
      </code>
    </pre>
  );
};

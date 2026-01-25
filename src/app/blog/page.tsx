import type { Metadata } from "next";
import { blogContent } from "./content";
import { MarkdownContent } from "./markdown-content";

export const metadata: Metadata = {
  title: "Best Lovable Alternatives",
  description: "Discover the best alternatives to Lovable for AI-powered code generation. Compare ZapDev, Bolt, Orchid, and more.",
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      <article className="container mx-auto max-w-4xl px-4 py-16">
        <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:p-4 prose-table:border prose-th:border prose-th:p-2 prose-td:border prose-td:p-2">
          <MarkdownContent content={blogContent} />
        </div>
      </article>
    </div>
  );
}

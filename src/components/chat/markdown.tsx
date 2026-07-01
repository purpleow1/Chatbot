"use client";

import { memo, useRef, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CopyButton } from "./copy-button";

/**
 * Renders assistant message text as GitHub-flavoured Markdown with syntax
 * highlighting. Code blocks get a header bar with the language label and a
 * copy button. Styling lives in the `.markdown` scope in globals.css.
 */
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);

  // Try to surface the language from the inner <code class="language-xxx">.
  let language = "";
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    children.props
  ) {
    const className = (children.props as { className?: string }).className ?? "";
    const match = /language-(\w+)/.exec(className);
    if (match) language = match[1];
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {language || "code"}
        </span>
        <CopyButton
          value={() => preRef.current?.textContent ?? ""}
          label="Copy code"
        />
      </div>
      <pre
        ref={preRef}
        {...props}
        className="overflow-x-auto p-3 text-[0.85rem] leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: CodeBlock,
          // Open links safely in a new tab.
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Markdown: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {children as string}
    </ReactMarkdown>
  );
};

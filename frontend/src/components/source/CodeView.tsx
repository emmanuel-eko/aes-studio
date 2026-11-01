import { useEffect, useState } from "react";
import { highlightPython } from "../../lib/pythonHighlight";
import { downloadUrl } from "../../services/api";

export function CodeView({
  content,
  title,
  fileId,
}: {
  content: string;
  title: string;
  fileId: string;
}) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    setHtml(highlightPython(content));
  }, [content]);
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl">{title}</h3>
        <a href={downloadUrl(fileId)} className="font-mono text-[11px] tracking-[0.12em] uppercase">
          Télécharger
        </a>
      </div>
      <pre className="max-h-[70vh] overflow-auto bg-well p-4 text-[12px] leading-6 text-well-ink">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

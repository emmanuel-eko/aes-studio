const KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "break",
  "class",
  "continue",
  "def",
  "elif",
  "else",
  "except",
  "False",
  "for",
  "from",
  "if",
  "import",
  "in",
  "is",
  "None",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
]);

function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function highlightPython(source: string): string {
  return source.split("\n").map(highlightLine).join("\n");
}

function highlightLine(line: string): string {
  const commentAt = findComment(line);
  const code = commentAt === -1 ? line : line.slice(0, commentAt);
  const comment = commentAt === -1 ? "" : line.slice(commentAt);
  return paintCode(code) + (comment ? `<span class="tok-comment">${escape(comment)}</span>` : "");
}

function findComment(line: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble && line[i - 1] !== "\\") inSingle = !inSingle;
    if (ch === '"' && !inSingle && line[i - 1] !== "\\") inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) return i;
  }
  return -1;
}

function paintCode(code: string): string {
  const parts = code.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return `<span class="tok-string">${escape(part)}</span>`;
      return part.replace(
        /(#.*$)|(\b\d+\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g,
        (match, _c, num, ident) => {
          if (num) return `<span class="tok-number">${match}</span>`;
          if (ident && KEYWORDS.has(ident)) return `<span class="tok-kw">${match}</span>`;
          if (ident && match === match.toUpperCase() && match.length > 1) {
            return `<span class="tok-const">${match}</span>`;
          }
          return match;
        },
      );
    })
    .join("");
}

/**
 * A small RFC 4180 CSV reader: quoted fields with embedded commas, quotes and
 * line breaks, CRLF or LF line endings and a UTF-8 byte order mark. The
 * delimiter is whichever of comma, semicolon or tab the header row uses most,
 * since spreadsheets in some locales save with semicolons.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = sniffDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // blank lines, including the one many editors leave at the end
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function sniffDelimiter(text: string) {
  let header = "";
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    if (!quoted) header += ch;
  }
  const counts = [",", ";", "\t"].map((d) => [d, header.split(d).length] as const);
  return counts.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

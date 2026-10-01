import { crc32, deflateSync } from "node:zlib";

/** A small, valid one page PDF with a title and a few lines (for seeds and tests). */
export function samplePdf(title: string, lines: string[] = []) {
  const esc = (s: string) => s.replace(/[()\\]/g, (c) => `\\${c}`);
  const content = ["BT", "/F1 20 Tf", "72 770 Td", `(${esc(title)}) Tj`, "/F1 11 Tf", ...lines.flatMap((l) => ["0 -22 Td", `(${esc(l)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** A grayscale PNG with a pen-like flourish, different for every seed string. */
export function sampleSignaturePng(seed: string) {
  const w = 360;
  const h = 110;
  const px = new Uint8Array(w * h).fill(255);
  const k = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const plot = (x: number, y: number) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const xx = Math.round(x) + dx;
        const yy = Math.round(y) + dy;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h) px[yy * w + xx] = 24;
      }
  };
  for (let t = 0; t <= 1; t += 0.0005) {
    plot(24 + t * 300, 58 + 24 * Math.sin(t * (14 + (k % 6)) + (k % 5)) * Math.exp(-t) + 9 * Math.sin(t * (40 + (k % 9))));
  }
  for (let t = 0; t <= 1; t += 0.002) plot(60 + t * 250, 92 - 6 * t);

  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    Buffer.from(px.subarray(y * w, (y + 1) * w)).copy(raw, y * (w + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// Read width and height straight from the file bytes. No libraries, so it runs in the Worker.
// Returns null when the header cannot be read (the upload is still accepted; size is just unknown).
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const u16be = (o: number) => (b[o] << 8) | b[o + 1];
  const u32be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u16le = (o: number) => b[o] | (b[o + 1] << 8);
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const ok = (w: number, h: number) => (w > 0 && h > 0 && w <= 65535 && h <= 65535 ? { width: w, height: h } : null);

  // PNG: IHDR holds the size at bytes 16..23.
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50) return ok(u32be(16), u32be(20));

  // GIF: logical screen size at bytes 6..9, little endian.
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return ok(u16le(6), u16le(8));

  // JPEG: walk the segments until a start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xff) { o++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      const len = u16be(o + 2);
      const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (isSof) return ok(u16be(o + 7), u16be(o + 5));
      if (len < 2) return null;
      o += 2 + len;
    }
    return null;
  }

  // WebP: RIFF....WEBP then VP8 (lossy), VP8L (lossless), or VP8X (extended).
  if (b.length >= 30 && b[0] === 0x52 && b[8] === 0x57) {
    const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (tag === "VP8X") return ok(u24le(24) + 1, u24le(27) + 1);
    if (tag === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (tag === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return ok(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
  }
  return null;
}

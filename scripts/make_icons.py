#!/usr/bin/env python3
"""Generate the app icons (barcode-stripe motif) as PNGs. Stdlib only."""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
STRIPES = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1]


def make_png(size: int) -> bytes:
    bg, fg = (17, 17, 17), (245, 245, 245)
    margin = size // 5
    n = len(STRIPES)
    bar_w = (size - 2 * margin) / n
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0 per scanline
        for x in range(size):
            c = bg
            if margin <= y < size - margin and margin <= x < size - margin:
                idx = min(int((x - margin) / bar_w), n - 1)
                if STRIPES[idx]:
                    c = fg
            row += bytes(c)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolor
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        (OUT / f"icon-{size}.png").write_bytes(make_png(size))
        print(f"wrote icon-{size}.png")


if __name__ == "__main__":
    main()

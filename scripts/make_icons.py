import struct
import zlib
import math

BG = (15, 17, 21)       # #0f1115
ACCENT = (52, 211, 153)  # #34d399


def make_png(path, size):
    width = height = size
    cx, cy = width / 2, height / 2
    r = width * 0.32

    rows = []
    for y in range(height):
        row = bytearray()
        row.append(0)  # filter type: none
        for x in range(width):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= r:
                row.extend(ACCENT)
            else:
                row.extend(BG)
        rows.append(bytes(row))
    raw = b''.join(rows)

    def chunk(tag, data):
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    idat = zlib.compress(raw, 9)

    with open(path, 'wb') as f:
        f.write(sig)
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))


if __name__ == '__main__':
    make_png('public/pwa-192x192.png', 192)
    make_png('public/pwa-512x512.png', 512)
    make_png('public/apple-touch-icon.png', 180)
    make_png('public/favicon.png', 64)
    print('icons generated')

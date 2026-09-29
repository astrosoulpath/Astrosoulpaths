from PIL import Image
from collections import deque
import sys

path = sys.argv[1]

img = Image.open(path).convert("RGBA")
pixels = img.load()
w, h = img.size

# Only remove dark pixels CONNECTED TO THE OUTER BORDER.
# This protects dark details inside the actual sticker.
def is_background(r, g, b, a):
    if a == 0:
        return True

    maximum = max(r, g, b)
    minimum = min(r, g, b)

    # Near-black / dark neutral background.
    # Keep strongly colored dark purple/gold artwork.
    return maximum <= 58 and (maximum - minimum) <= 22

visited = bytearray(w * h)
queue = deque()

def add(x, y):
    idx = y * w + x

    if visited[idx]:
        return

    visited[idx] = 1

    if is_background(*pixels[x, y]):
        queue.append((x, y))

# Seed flood-fill ONLY from all four image edges.
for x in range(w):
    add(x, 0)
    add(x, h - 1)

for y in range(h):
    add(0, y)
    add(w - 1, y)

removed = 0

while queue:
    x, y = queue.popleft()

    r, g, b, a = pixels[x, y]
    pixels[x, y] = (r, g, b, 0)
    removed += 1

    if x > 0:
        add(x - 1, y)
    if x + 1 < w:
        add(x + 1, y)
    if y > 0:
        add(x, y - 1)
    if y + 1 < h:
        add(x, y + 1)

img.save(path, "PNG")

total = w * h
percent = (removed / total * 100.0) if total else 0

print(f"IMAGE_SIZE={w}x{h}")
print(f"EDGE_BG_PIXELS_REMOVED={removed}")
print(f"REMOVED_PERCENT={percent:.2f}")
print("OUTPUT_MODE=RGBA")

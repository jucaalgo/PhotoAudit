
from PIL import Image, ImageChops
import math

img1_path = r"C:/Users/JUAN CARLOS/.gemini/antigravity/brain/13f6a066-9e0f-47b9-b568-1955e670c3c9/uploaded_image_0_1766654648870.jpg"
img2_path = r"C:/Users/JUAN CARLOS/.gemini/antigravity/brain/13f6a066-9e0f-47b9-b568-1955e670c3c9/uploaded_image_1_1766654648870.jpg"

try:
    img1 = Image.open(img1_path).convert('RGB')
    img2 = Image.open(img2_path).convert('RGB')
except Exception as e:
    print(f"Error loading images: {e}")
    exit()

if img1.size != img2.size:
    print(f"Dimensions differ: {img1.size} vs {img2.size}")
    exit()

diff = ImageChops.difference(img1, img2)
stat = diff.getextrema()
is_diff = False
for min_val, max_val in stat:
    if max_val > 0:
        is_diff = True
        break

print(f"Differences detected: {'YES' if is_diff else 'NO'}")

# Check background purity on img2 (assuming it's the processed one)
# Sample top-left corner region (usually background)
w, h = img2.size
sample_roi = img2.crop((0, 0, 100, 100))
pixels = list(sample_roi.getdata())

min_val = 255
max_val = 0
total_val = 0
count = len(pixels)

for r, g, b in pixels:
    luminance = (r + g + b) / 3
    if luminance < min_val: min_val = luminance
    if luminance > max_val: max_val = luminance
    total_val += luminance

mean_val = total_val / count

print(f"Image 2 Top-Left ROI Mean Luminance: {mean_val:.2f}")
print(f"Image 2 Top-Left ROI Range: [{min_val}, {max_val}]")

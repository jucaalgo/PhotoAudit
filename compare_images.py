
import cv2
import numpy as np

img1_path = r"C:/Users/JUAN CARLOS/.gemini/antigravity/brain/13f6a066-9e0f-47b9-b568-1955e670c3c9/uploaded_image_0_1766654648870.jpg"
img2_path = r"C:/Users/JUAN CARLOS/.gemini/antigravity/brain/13f6a066-9e0f-47b9-b568-1955e670c3c9/uploaded_image_1_1766654648870.jpg"

img1 = cv2.imread(img1_path)
img2 = cv2.imread(img2_path)

if img1 is None or img2 is None:
    print("Error loading images")
    exit()

if img1.shape != img2.shape:
    print(f"Dimensions differ: {img1.shape} vs {img2.shape}")
    exit()

diff = cv2.absdiff(img1, img2)
non_zero = np.count_nonzero(diff)
mse = np.mean(diff ** 2)

print(f"Differences detected: {'YES' if non_zero > 0 else 'NO'}")
print(f"MSE: {mse}")
print(f"Non-zero diff pixels: {non_zero}")

# Check background purity on img2 (assuming it's the processed one)
# Sample top-left corner region (usually background)
sample_roi = img2[0:100, 0:100]
mean_val = np.mean(sample_roi)
min_val = np.min(sample_roi)
max_val = np.max(sample_roi)

print(f"Image 2 Top-Left ROI Mean: {mean_val}")
print(f"Image 2 Top-Left ROI Range: [{min_val}, {max_val}]")

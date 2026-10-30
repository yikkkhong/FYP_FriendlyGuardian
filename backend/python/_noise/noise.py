
from pathlib import Path

import cv2
import numpy as np
import pymupdf

SAMPLES = Path("samples")
RESULTS = Path("results")
RESULTS.mkdir(exist_ok=True)

DPI = 300


# ==========================================
# load image / turn pdf to png
# ==========================================

def load_image(filename):
    path = SAMPLES / filename
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if path.suffix.lower() == ".pdf":
        # Convert first PDF page into lossless PNG
        with pymupdf.open(str(path)) as doc:
            pix = doc[0].get_pixmap(
                dpi=DPI,
                colorspace=pymupdf.csRGB,
                alpha=False
            )

            png_path = RESULTS / f"{path.stem}_converted.png"
            pix.save(str(png_path))

        image = cv2.imread(str(png_path))
    else:
        image = cv2.imread(str(path))

    if image is None:
        raise ValueError("Unable to read image")

    print(f"Image resolution: {image.shape[1]} x {image.shape[0]}")
    return image


# ==========================================
# SELECT BACKGROUND REGION
# ==========================================

def select_background(image):
    height, width = image.shape[:2]

    # Resize preview only, original image is unchanged
    scale = min(1000 / width, 800 / height, 1.0)

    preview = cv2.resize(
        image, None, fx=scale, fy=scale,
        interpolation=cv2.INTER_AREA
    )

    print("\nSelect a clean background region.")
    print("Drag mouse to select, then press ENTER.")

    x, y, w, h = cv2.selectROI(
        "Select Background", preview, False, False
    )
    cv2.destroyAllWindows()

    if w == 0 or h == 0:
        raise ValueError("No region selected")

    # Convert preview coordinates to original coordinates
    x1 = round(x / scale)
    y1 = round(y / scale)
    x2 = min(round((x + w) / scale), width)
    y2 = min(round((y + h) / scale), height)

    return image[y1:y2, x1:x2]


# ==========================================
# ANALYZE BACKGROUND PIXELS
# ==========================================

def analyze_background(region, filename):
    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    pixels = rgb.reshape(-1, 3).astype(np.float32)

    mean = np.mean(pixels, axis=0)
    std = np.std(pixels, axis=0)
    median = np.median(pixels, axis=0)

    pure_white = np.all(pixels == 255, axis=1)
    white_ratio = np.mean(pure_white) * 100

    unique_colors = np.unique(
        rgb.reshape(-1, 3), axis=0
    ).shape[0]

    print("\n========== BACKGROUND ANALYSIS ==========")
    print(f"Sample: {filename}")
    print(f"Total pixels: {len(pixels)}")
    print(f"Average RGB: {mean.round(2)}")
    print(f"RGB standard deviation: {std.round(2)}")
    print(f"Pure white pixels: {white_ratio:.2f}%")
    print(f"Unique RGB colors: {unique_colors}")

    # Measure deviation from median background color
    difference = np.max(
        np.abs(pixels - median), axis=1
    )

    difference = difference.reshape(rgb.shape[:2])

    # Amplify small variations for visualization
    amplified = np.clip(
        difference * 20, 0, 255
    ).astype(np.uint8)

    heatmap = cv2.applyColorMap(
        amplified, cv2.COLORMAP_TURBO
    )

    name = Path(filename).stem

    # Display exact RGB colors and pixel counts
    colors, counts = np.unique(
        rgb.reshape(-1, 3),
        axis=0,
        return_counts=True
    )

    print("\n========== COLOR DISTRIBUTION ==========")

    for color, count in zip(colors, counts):
        print(f"RGB {color.tolist()}: {count} pixels")


    # highlight every pixel that is NOT pure white
    mask = np.any(rgb != 255, axis=2).astype(np.uint8) * 255

    cv2.imwrite(
        str(RESULTS / f"{name}_nonwhite_mask.png"),
        mask
    )

    cv2.imwrite(
        str(RESULTS / f"{name}_background.png"),
        region
    )

    cv2.imwrite(
        str(RESULTS / f"{name}_variation.png"),
        heatmap
    )

    print(f"\nResults saved to: {RESULTS.resolve()}")


# ======================================
# main
# ======================================

if __name__ == "__main__":
    filename = input("Enter filename: ").strip()

    image = load_image(filename)
    background = select_background(image)
    analyze_background(background, filename)

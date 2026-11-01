from pathlib import Path
import cv2
import numpy as np
import pymupdf

import json
import sys

SAMPLES = Path("samples")
RESULTS = Path("results")
RESULTS.mkdir(exist_ok=True)

DPI = 300

# pdf to png
def load_image(filename: str) -> np.ndarray:
    path = SAMPLES / filename
    if not path.exists():
        raise FileNotFoundError(f"File Not Found: {path.resolve()}")

    if path.suffix.lower() == ".pdf":
        with pymupdf.open(str(path)) as doc:
            page = doc[0]
            pix = page.get_pixmap(
                dpi=DPI,
                colorspace=pymupdf.csRGB,
                alpha=False
            )
            # PyMuPDF RGB -> NumPy -> OpenCV BGR
            img_rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
            image = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

            png_path = RESULTS / f"{path.stem}_converted.png"
            cv2.imwrite(str(png_path), image)
    else:
        img_data = np.fromfile(str(path), dtype=np.uint8)
        image = cv2.imdecode(img_data, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError(f"Cannot Read File: {filename}")

    print(f"Loaded: {filename} | Resolution: {image.shape[1]} x {image.shape[0]}")
    return image


def get_analysis_region(image: np.ndarray, auto_full: bool = True) -> np.ndarray:
    if auto_full:
        print("\n Checking entire image")
        return image

    height, width = image.shape[:2]
    scale = min(1000 / width, 800 / height, 1.0)
    preview = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    window_name = "Select Region"
    x, y, w, h = cv2.selectROI(window_name, preview, False, False)
    cv2.destroyWindow(window_name)
    cv2.waitKey(1)

    if w <= 0 or h <= 0:
        raise ValueError("No valid area selected")

    x1 = max(0, int(round(x / scale)))
    y1 = max(0, int(round(y / scale)))
    x2 = min(width, int(round((x + w) / scale)))
    y2 = min(height, int(round((y + h) / scale)))

    return image[y1:y2, x1:x2]


def analyze_plain_color(region: np.ndarray, filename: str) -> None:
    rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    h, w, _ = rgb.shape
    pixels = rgb.reshape(-1, 3).astype(np.float64)

    # 1. calculate
    mean = np.mean(pixels, axis=0)
    std = np.std(pixels, axis=0)
    median = np.median(pixels, axis=0).astype(np.uint8)

    colors, counts = np.unique(rgb.reshape(-1, 3), axis=0, return_counts=True)
    unique_colors = len(colors)

    # Dominant Color
    dominant_color_idx = np.argmax(counts)
    dominant_color = colors[dominant_color_idx]
    dominant_count = counts[dominant_color_idx]
    dominant_ratio = (dominant_count / len(pixels)) * 100


    difference = np.max(np.abs(pixels - dominant_color.astype(np.float32)), axis=1).reshape((h, w))


    amplified = np.clip(difference * 20, 0, 255).astype(np.uint8)
    heatmap = cv2.applyColorMap(amplified, cv2.COLORMAP_TURBO)


    noise_mask = np.any(rgb != dominant_color, axis=2).astype(np.uint8) * 255


    is_real = (unique_colors == 1 and dominant_ratio == 100.0) or \
              (np.all(std < 0.05) and unique_colors <= 2 and dominant_ratio >= 99.9)

    # report
    print("\n" + "=" * 50)
    print(f"File name: {filename}")
    print(f"resolution total: {len(pixels)}")
    print(f"mean RGB: [{mean[0]:.2f}, {mean[1]:.2f}, {mean[2]:.2f}]")
    print(f"Std Dev: [{std[0]:.2f}, {std[1]:.2f}, {std[2]:.2f}]")
    print(f"Main bg color: RGB {dominant_color.tolist()} (Proportion: {dominant_ratio:.2f}%)")
    print(f"unique color: {unique_colors}")

    print("\n---------- COLOR DISTRIBUTION ----------")
    sorted_indices = np.argsort(-counts)
    for i in sorted_indices[:10]:
        print(f"RGB {colors[i].tolist()}: {counts[i]} pixels ({(counts[i]/len(pixels))*100:.2f}%)")
    if len(colors) > 10:
        print(f"... {len(colors) - 10} additional minor noise colors omitted")

    print("\n" + "=" * 50)
    if is_real:
        print("Result = REAL")
    else:
        print("Result = AI generated")
    print("=" * 50)

    # 6. Save evidence images
    name = Path(filename).stem
    cv2.imwrite(str(RESULTS / f"{name}_crop.png"), region)
    cv2.imwrite(str(RESULTS / f"{name}_noise_mask.png"), noise_mask)
    cv2.imwrite(str(RESULTS / f"{name}_heatmap.png"), heatmap)
    print(f"\nResults saved to: {RESULTS.resolve()}")

if __name__ == "__main__":
    filename = input("Enter the filename in the samples folder: ").strip()

    image = load_image(filename)
    
    # For a solid-color test, analyze the entire image (True). To select a region, change this to False.
    region = get_analysis_region(image, auto_full=True)
    
    analyze_plain_color(region, filename)
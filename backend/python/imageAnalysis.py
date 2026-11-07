from pathlib import Path
import cv2
import numpy as np
import pymupdf
import json
import sys

# Force UTF-8 stdout to prevent Windows terminal crashes
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# # keep 300 dpi as default for pdf to png convert
# DPI = 300

def load_image(filepath: str) -> np.ndarray:
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File Not Found: {path.resolve()}")

    # # detect pdf by file signature, even without a .pdf extension
    # with open(str(path), "rb") as f:
    #     header = f.read(4)
    # is_pdf = (header == b"%PDF") or (path.suffix.lower() == ".pdf")

    # if is_pdf:
    #     with pymupdf.open(str(path), filetype="pdf") as doc:
    #         page = doc[0]
    #         pix = page.get_pixmap(
    #             dpi=DPI,
    #             colorspace=pymupdf.csRGB,
    #             alpha=False
    #         )
    #         img_rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
    #         image = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    # else:
    #     img_data = np.fromfile(str(path), dtype=np.uint8)
    #     image = cv2.imdecode(img_data, cv2.IMREAD_COLOR)

    # Use IMREAD_UNCHANGED to read transparent PNGs with 4 channels (BGRA)
    img_data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(img_data, cv2.IMREAD_UNCHANGED)

    if image is None:
        raise ValueError(f"Cannot Read File: {filepath}")

    return image


def analyze_plain_color(image: np.ndarray) -> dict:
    # rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
    # h, w, _ = rgb.shape
    # total_pixels = h * w

    # If the image has an alpha channel (BGRA), only keep background pixels with Alpha > 0
    if len(image.shape) == 3 and image.shape[2] == 4:
        bgr = image[:, :, :3]
        alpha = image[:, :, 3]
        valid_bgr = bgr[alpha > 0]
        rgb = cv2.cvtColor(valid_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2RGB).reshape(-1, 3)
    else:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB).reshape(-1, 3)

    total_pixels = len(rgb)
    if total_pixels == 0:
        result_data = {"isReal": False, "dominantRatio": 0.0, "uniqueColors": 0}
        print(json.dumps(result_data))
        return result_data

    # calculate standard deviation
    pixels = rgb.reshape(-1, 3).astype(np.float64)
    std = np.std(pixels, axis=0)

    #lossless deduplication using 1D integer packing (same result as 2D np.unique)
    rgb_packed = (
        (rgb[:, 0].astype(np.uint32) << 16) |
        (rgb[:, 1].astype(np.uint32) << 8) |
        rgb[:, 2].astype(np.uint32)
    )

    unique_packed, counts = np.unique(rgb_packed, return_counts=True)
    unique_colors = len(unique_packed)

    dominant_color_idx = np.argmax(counts)
    dominant_count = counts[dominant_color_idx]
    dominant_ratio = (dominant_count / total_pixels) * 100.0

    # tell is it real
    # more strict version
    # is_real = (unique_colors == 1 and dominant_ratio == 100.0) or \
    #         (np.all(std < 0.05) and unique_colors <= 2 and dominant_ratio >= 99.9)

    # less strict version
    is_real = (dominant_ratio >= 99.8) or \
          (np.all(std < 0.1) and unique_colors <= 5 and dominant_ratio >= 99.5)

    result_data = {
        "isReal": bool(is_real),
        "dominantRatio": round(float(dominant_ratio), 2),
        "uniqueColors": int(unique_colors)
    }

    # print json to send to node.js
    print(json.dumps(result_data))
    return result_data


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    else:
        target_path = input("Enter the filename: ").strip()

    image = load_image(target_path)
    analyze_plain_color(image)
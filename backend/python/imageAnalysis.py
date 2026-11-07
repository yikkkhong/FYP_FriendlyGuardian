# from pathlib import Path
# import cv2
# import numpy as np
# import pymupdf
# import json
# import sys

# from ocr_service import extract_text_from_image

# # Force UTF-8 stdout to prevent Windows terminal crashes
# if hasattr(sys.stdout, "reconfigure"):
#     sys.stdout.reconfigure(encoding="utf-8")

# # keep 300 dpi as default for pdf to png convert
# DPI = 300
# DILATE_KERNEL_SIZE = 7

# def load_image(filepath: str) -> np.ndarray:
#     path = Path(filepath)
#     if not path.exists():
#         raise FileNotFoundError(f"File Not Found: {path.resolve()}")

#     # detect pdf by file signature, even without a .pdf extension
#     with open(str(path), "rb") as f:
#         header = f.read(4)
#     is_pdf = (header == b"%PDF") or (path.suffix.lower() == ".pdf")

#     if is_pdf:
#         with pymupdf.open(str(path), filetype="pdf") as doc:
#             page = doc[0]
#             pix = page.get_pixmap(
#                 dpi=DPI,
#                 colorspace=pymupdf.csRGB,
#                 alpha=False
#             )
#             img_rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
#             image = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
#     else:
#         img_data = np.fromfile(str(path), dtype=np.uint8)
#         image = cv2.imdecode(img_data, cv2.IMREAD_COLOR)

#     if image is None:
#         raise ValueError(f"Cannot Read File: {filepath}")

#     return image


# def analyze_plain_color(region: np.ndarray, text_boxes: list) -> dict:
#     h, w = image.shape[:2]
#     mask = np.ones((h, w), dtype=np.uint8) * 255

#     # 1. 直接用 ocr_service 传进来的 boxes 抠除文字
#     for box in text_boxes:
#         pts = np.array(box, dtype=np.int32).reshape((-1, 1, 2))
#         cv2.fillPoly(mask, [pts], 0)

#     # 2. 膨胀消除字体抗锯齿灰边
#     kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (DILATE_KERNEL_SIZE, DILATE_KERNEL_SIZE))
#     mask = cv2.erode(mask, kernel)

#     # get image background pixels
#     rgb = cv2.cvtColor(region, cv2.COLOR_BGR2RGB)
#     bg_pixels = rgb[mask == 255]
#     # h, w, _ = rgb.shape
#     total_pixels = h * w

#     if total_pixels < 1000:
#         result = {"isReal": False, "error": "Insufficient background pixels"}
#         print(json.dumps(result))
#         return result

#     # calculate standard deviation
#     pixels_f64 = bg_pixels.astype(np.float64)
#     std = np.std(pixels_f64, axis=0)

#     #lossless deduplication using 1D integer packing (same result as 2D np.unique)
#     rgb_packed = (
#         (rgb[:, :, 0].astype(np.uint32) << 16) |
#         (rgb[:, :, 1].astype(np.uint32) << 8) |
#         rgb[:, :, 2].astype(np.uint32)
#     ).reshape(-1)

#     unique_packed, counts = np.unique(rgb_packed, return_counts=True)
#     unique_colors = len(unique_packed)

#     dominant_color_idx = np.argmax(counts)
#     dominant_count = counts[dominant_color_idx]
#     dominant_ratio = (dominant_count / total_pixels) * 100.0

#     # tell is it real
#     is_real = (unique_colors == 1 and dominant_ratio == 100.0) or \
#               (np.all(std < 0.05) and unique_colors <= 2 and dominant_ratio >= 99.9)

#     result_data = {
#         "isReal": bool(is_real),
#         "dominantRatio": round(float(dominant_ratio), 2),
#         "uniqueColors": int(unique_colors),
#         "stdDev": [round(float(s), 2) for s in std],
#         "analyzedPixels": int(total_pixels)
#     }

#     # print json to send to node.js
#     print(json.dumps(result_data))
#     return result_data


# if __name__ == "__main__":
#     if len(sys.argv) > 2:
#         target_path = sys.argv[1]
#         boxes = json.loads(sys.argv[2])
#     elif len(sys.argv) > 1:
#         target_path = sys.argv[1]
#         boxes = []
#     else:
#         target_path = input("Enter the filename: ").strip()
#         boxes = []

#     image = load_image(target_path)
#     analyze_plain_color(image, boxes)



from pathlib import Path
import cv2
import numpy as np
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def analyze_transparent_background(filepath: str) -> dict:
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File Not Found: {path.resolve()}")

    # IMREAD_UNCHANGED: 保证读取到第 4 个通道（Alpha 通道）
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"Cannot read image: {filepath}")

    # 如果有透明通道，剔除透明文字区域；如果没有，则分析全图
    if len(image.shape) == 3 and image.shape[2] == 4:
        bgr = image[:, :, :3]
        alpha = image[:, :, 3]
        # 只提取 Alpha > 0 的不透明像素（文字区域 Alpha 为 0，全部被过滤）
        valid_pixels_bgr = bgr[alpha > 0]
    else:
        valid_pixels_bgr = image.reshape(-1, 3)

    total_pixels = len(valid_pixels_bgr)
    if total_pixels < 1000:
        result_data = {
            "isReal": False,
            "error": "Insufficient background pixels",
            "dominantRatio": 0.0,
            "uniqueColors": 0
        }
        print(json.dumps(result_data))
        return result_data

    # BGR -> RGB
    valid_pixels_rgb = cv2.cvtColor(valid_pixels_bgr.reshape(-1, 1, 3), cv2.COLOR_BGR2RGB).reshape(-1, 3)

    # 1. 使用 float64 统计标准差（防溢出）
    pixels_f64 = valid_pixels_rgb.astype(np.float64)
    std = np.std(pixels_f64, axis=0)

    # 2. 整数打包快速去重
    rgb_packed = (
        (valid_pixels_rgb[:, 0].astype(np.uint32) << 16) |
        (valid_pixels_rgb[:, 1].astype(np.uint32) << 8) |
        valid_pixels_rgb[:, 2].astype(np.uint32)
    )

    unique_packed, counts = np.unique(rgb_packed, return_counts=True)
    unique_colors = len(unique_packed)

    dominant_idx = np.argmax(counts)
    dominant_count = counts[dominant_idx]
    dominant_ratio = (dominant_count / total_pixels) * 100.0

    # 3. 判定逻辑：文字被透明化剥离后，真实发票背景纯度极高
    is_real = (unique_colors == 1 and dominant_ratio >= 99.9) or \
              (np.all(std < 0.08) and unique_colors <= 2 and dominant_ratio >= 99.8)

    result_data = {
        "isReal": bool(is_real),
        "dominantRatio": round(float(dominant_ratio), 2),
        "uniqueColors": int(unique_colors),
        "stdDev": [round(float(s), 2) for s in std],
        "analyzedPixels": int(total_pixels)
    }

    print(json.dumps(result_data))
    return result_data


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    else:
        target_path = input("Enter filename: ").strip()

    analyze_transparent_background(target_path)
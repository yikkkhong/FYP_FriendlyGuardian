# ------------------------------
# RUN LOCAL
# ------------------------------

# import json
# import os
# import sys

# # 1. Force stdout use UTF-8 encoding
# #  prevent the Windows console from crashing when transmitting Chinese characters
# if hasattr(sys.stdout, "reconfigure"):
#     sys.stdout.reconfigure(encoding="utf-8")

# from paddleocr import PaddleOCR

# # 2. use ch cause cann detect complex characters, can also detect engligh text
# ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)


# def extract_text_from_image(image_path):
#     if not os.path.exists(image_path):
#         return {"success": False, "text": "", "error": "Image file not found"}

#     try:
#         result = ocr.ocr(image_path, cls=False)
#         extracted_lines = []

#         if result and result[0]:
#             for line in result[0]:
#                 text = line[1][0].strip()
#                 if text:
#                     extracted_lines.append(text)

#         full_text = " ".join(extracted_lines)
#         return {"success": True, "text": full_text, "error": None}
#     except Exception as e:
#         return {"success": False, "text": "", "error": str(e)}


# if __name__ == "__main__":
#     if len(sys.argv) > 1:
#         target_image = sys.argv[1]
#         output = extract_text_from_image(target_image)
#         # 3. Output raw text to avoid conversion into Unicode escape sequences (\uXXXX).
#         print(json.dumps(output, ensure_ascii=False))
#     else:
#         print(
#             json.dumps(
#                 {
#                     "success": False,
#                     "text": "",
#                     "error": "No image path provided.",
#                 },
#                 ensure_ascii=False,
#             )
#         )


# ------------------------------
# FAST API
# ------------------------------

# import json
# import os
# import shutil
# import sys
# from fastapi import FastAPI, File, UploadFile
# from paddleocr import PaddleOCR
# import uvicorn

# ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)

# def extract_text_from_image(image_path):
#     if not os.path.exists(image_path):
#         return {"success": False, "text": "", "error": "Image file not found"}

#     try:
#         result = ocr.ocr(image_path, cls=True)
#         extracted_lines = []

#         if result and result[0]:
#             for line in result[0]:
#                 text = line[1][0].strip()
#                 if text:
#                     extracted_lines.append(text)

#         full_text = " ".join(extracted_lines)
#         return {"success": True, "text": full_text, "error": None}
#     except Exception as e:
#         return {"success": False, "text": "", "error": str(e)}

# app = FastAPI()
# TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp_ocr")
# os.makedirs(TEMP_DIR, exist_ok=True)

# @app.post("/ocr")
# async def ocr_api(image: UploadFile = File(...)):
#     temp_path = os.path.join(TEMP_DIR, image.filename)
#     with open(temp_path, "wb") as buffer:
#         shutil.copyfileobj(image.file, buffer)

#     try:
#         result = extract_text_from_image(temp_path)
#         return result
#     finally:
#         if os.path.exists(temp_path):
#             os.remove(temp_path)

# if __name__ == "__main__":
#     uvicorn.run(app, host="127.0.0.1", port=8001)


# ------------------------------
# IMPROVED LOCAL
# ------------------------------
import json
import os
import sys

from pathlib import Path
import cv2
import numpy as np

from paddleocr import PaddleOCR

# Suppress PaddlePaddle C++ INFO and WARNING logs
os.environ["GLOG_minloglevel"] = "2"
os.environ["FLAGS_allocator_strategy"] = "naive_best_fit"

# force stdout use UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# load memory once
ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)

# Temporary folder for images with text transparent layer
TEMP_TRANSPARENT_DIR = Path(os.path.dirname(__file__)) / "temp_transparent"
TEMP_TRANSPARENT_DIR.mkdir(exist_ok=True)
DILATE_KERNEL_SIZE = 12  #Expand the mask to cover anti-aliased edges of large text

def detect_table_lines(image: np.ndarray, text_mask: np.ndarray) -> np.ndarray:
    """Detect horizontal and vertical lines using morphological operations"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 1. Remove OCR-detected text to avoid false line detection
    clean = gray.copy()
    clean[text_mask > 0] = 255

    # 2. Convert dark pixels to white and the background to black
    _, binary = cv2.threshold(clean, 240, 255, cv2.THRESH_BINARY_INV)
    height, width = binary.shape

    # 3. Create horizontal and vertical kernels based on image size
    h_len = max(25, width // 40)
    v_len = max(25, height // 40)
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_len, 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_len))

    # 4. Extract horizontal and vertical lines
    horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)

    # 5. Combine both line masks
    table_mask = cv2.bitwise_or(horizontal, vertical)

    # 6. Expand the mask to cover anti-aliased line edges
    table_mask = cv2.dilate(
        table_mask, np.ones((7, 7), np.uint8), iterations=1
    )

    return table_mask


def extract_text_from_image(image_path):
    if not os.path.exists(image_path):
        return {"success": False, "text": "", "error": "Image file not found"}

    try:
        # Use imdecode to read images, including multer temp files without extensions
        img_data = np.fromfile(image_path, dtype=np.uint8)
        bgr_image = cv2.imdecode(img_data, cv2.IMREAD_COLOR)
        if bgr_image is None:
            return {"success": False, "text": "", "error": "Unable to decode image"}

        h, w = bgr_image.shape[:2]
        
        result = ocr.ocr(bgr_image, cls=False)
        extracted_lines = []
        text_boxes = []  # collect text bounding boxes

        if result and result[0]:
            for line in result[0]:
                text_boxes.append(line[0])
                text = line[1][0].strip()
                if text:
                    extracted_lines.append(text)

        text_mask = np.zeros((h, w), dtype=np.uint8)
        if text_boxes:
            for box in text_boxes:
                pts = np.array(box, dtype=np.int32).reshape((-1, 1, 2))
                cv2.fillPoly(text_mask, [pts], 255)

            kernel = cv2.getStructuringElement(
                cv2.MORPH_RECT, (DILATE_KERNEL_SIZE, DILATE_KERNEL_SIZE)
            )
            text_mask = cv2.dilate(text_mask, kernel)

        # detect table lines
        table_mask = detect_table_lines(bgr_image, text_mask)

        # combine text and table line masks
        full_mask = cv2.bitwise_or(text_mask, table_mask)

        # Make text areas transparent (Alpha = 0)
        # h, w = bgr_image.shape[:2]
        bgra_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2BGRA)
        bgra_image[full_mask > 0, 3] = 0

        if text_boxes:
            text_mask = np.zeros((h, w), dtype=np.uint8)
            for box in text_boxes:
                pts = np.array(box, dtype=np.int32).reshape((-1, 1, 2))
                cv2.fillPoly(text_mask, [pts], 255)

            kernel = cv2.getStructuringElement(
                cv2.MORPH_RECT, (DILATE_KERNEL_SIZE, DILATE_KERNEL_SIZE)
            )
            text_mask = cv2.dilate(text_mask, kernel)
            bgra_image[text_mask > 0, 3] = 0

        transparent_path = TEMP_TRANSPARENT_DIR / f"{Path(image_path).stem}_transparent.png"
        cv2.imwrite(str(transparent_path), bgra_image)

        full_text = " ".join(extracted_lines)
        return {"success": True, 
                "text": full_text,
                "transparent_image_path": str(transparent_path.resolve()), 
                "error": None}
    except Exception as e:
        return {"success": False, "text": "", "error": str(e)}

def extract_image(target_image):
    extract_text_from_image(target_image)
    detect_table_lines(target_image,)

if __name__ == "__main__":
    # send to node.js
    print(json.dumps({"status": "READY"}), flush=True)

    # Perform OCR each time Node.js writes a line containing an image path
    for line in sys.stdin:
        target_image = line.strip()
        if not target_image:
            continue

        output = extract_text_from_image(target_image)
        # output = extract_image(target_image)
        # ensure result immediately push to pipeline, so no stuck
        print(json.dumps(output, ensure_ascii=False), flush=True)
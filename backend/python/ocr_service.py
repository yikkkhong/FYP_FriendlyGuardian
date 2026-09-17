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

# force stdout use UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from paddleocr import PaddleOCR

# load memory once
ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)


def extract_text_from_image(image_path):
    if not os.path.exists(image_path):
        return {"success": False, "text": "", "error": "Image file not found"}

    try:
        result = ocr.ocr(image_path, cls=False)
        extracted_lines = []

        if result and result[0]:
            for line in result[0]:
                text = line[1][0].strip()
                if text:
                    extracted_lines.append(text)

        full_text = " ".join(extracted_lines)
        return {"success": True, "text": full_text, "error": None}
    except Exception as e:
        return {"success": False, "text": "", "error": str(e)}


if __name__ == "__main__":
    # send to node.js
    print(json.dumps({"status": "READY"}), flush=True)

    # Perform OCR each time Node.js writes a line containing an image path
    for line in sys.stdin:
        target_image = line.strip()
        if not target_image:
            continue

        output = extract_text_from_image(target_image)
        # ensure result immediately push to pipeline, so no stuck
        print(json.dumps(output, ensure_ascii=False), flush=True)
# ------------------------------
# first try, cannot use
# ------------------------------

# import os
# import sys
# from paddleocr import PaddleOCR

# ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)


# def run_ocr_test(image_path):
#   if not os.path.exists(image_path):
#     print(f"[ERROR] Cannot find image file: {image_path}")
#     return

#   print(f"--> analysing image: {image_path}")
#   try:
#     result = ocr.ocr(image_path, cls=True)

#     if not result or result[0] is None:
#       print("[WARN] no text detected")
#       return

#     print("\n--- detected successfully ---")
#     full_text_list = []
#     for idx, line in enumerate(result[0]):
#       box = line[0]
#       text, confidence = line[1]
#       full_text_list.append(text)
#       print(f"[{idx + 1}] Confidence level: {confidence:.2f} | TEXT: {text}")

#     print("\n--- Combined text ---")
#     print(" ".join(full_text_list))

#   except Exception as e:
#     print(f"[EXCEPTION] ERRORRR: {e}")


# if __name__ == "__main__":
#   img_file = sys.argv[1] if len(sys.argv) > 1 else "scamUntitled.png"
#   run_ocr_test(img_file)


# ------------------------------
# can useeeeeee, but this is 3.x, i install 2.x which is more stable
# ------------------------------

# import json
# import os
# import sys
# from paddleocr import PaddleOCR

# # # PaddleOCR 3.x 
# # use ch and not en, cause ch can detect complex character
# ocr = PaddleOCR(use_textline_orientation=True, lang="ch")


# def run_ocr_test(image_path):
#   if not os.path.exists(image_path):
#     print(f"[ERROR] Cannot find image file: {image_path}")
#     return

#   print(f"--> analysing image: {image_path}")
#   try:
#     # 3.x can simply pass the path directly
#     result = ocr.ocr(image_path)

#     print("\n--- (Raw Output) ---")
#     print(result)

#     if not result:
#       print("[WARN] OCR No data returned!")
#       return

#     extracted_lines = []

#     # Compatible with classic structures: [[ [box, (text, score)], ... ]]
#     if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list):
#       for idx, line in enumerate(result[0]):
#         text = line[1][0]
#         score = line[1][1]
#         extracted_lines.append(text)
#         print(f"[{idx + 1}] Confidence level: {score:.2f} | TEXT: {text}")

#     # Compatible with cases in some newer 3.x pipeline versions where a dictionary is returned.
#     elif isinstance(result, list) and isinstance(result[0], dict):
#       for idx, item in enumerate(result):
#         text = item.get("rec_text", "")
#         score = item.get("rec_score", 0.0)
#         extracted_lines.append(text)
#         print(f"[{idx + 1}] Confidence level: {score:.2f} | TEXT: {text}")

#     print("\n--- TEXT ---")
#     print(" ".join(extracted_lines))

#   except Exception as e:
#     print(f"[EXCEPTION] ERRORRR: {e}")
#     import traceback

#     traceback.print_exc()


# if __name__ == "__main__":
#   img_file = sys.argv[1] if len(sys.argv) > 1 else "scamUntitled.png"
#   run_ocr_test(img_file)

# ------------------------------
# can useeeeeee, and it's 2.x
# ------------------------------

import json
import os
import sys
from paddleocr import PaddleOCR

# 2.x, stable, use ch can detect complex character
ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)


def extract_text_from_image(image_path):
  if not os.path.exists(image_path):
    return {"success": False, "text": "", "error": "Image file not found"}

  try:
    result = ocr.ocr(image_path, cls=True)
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
  if len(sys.argv) > 1:
    target_image = sys.argv[1]
    output = extract_text_from_image(target_image)
    print(json.dumps(output))
  else:
    print(
        json.dumps({
            "success": False,
            "text": "",
            "error": "No image path provided.",
        })
    )


# ------------------------------
# can use but no detect number (2.x)
# ------------------------------

# import os
# import sys
# import cv2
# import numpy as np
# from paddleocr import PaddleOCR

# ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)


# def fill_bubble_holes(img_path):
#   img = cv2.imread(img_path)
#   gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

#   # Segment foreground text using adaptive or fixed thresholds.
#   _, binary = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)

#   # The closing operation fills in voids
#   kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
#   filled = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

#   # Restore the three-channel format (black text on a white background) for reading by PaddleOCR.
#   clean_gray = cv2.bitwise_not(filled)
#   return cv2.cvtColor(clean_gray, cv2.COLOR_GRAY2BGR)


# def run_ocr_test(image_path):
#   if not os.path.exists(image_path):
#     print(f"[ERROR] Cannot find file: {image_path}")
#     return

#   print("--> 1. Attempting to preprocess hole filling...")
#   processed_img = fill_bubble_holes(image_path)

#   print("--> 2. Analysing...")
#   result = ocr.ocr(processed_img, cls=True)

#   if result and result[0]:
#     for idx, line in enumerate(result[0]):
#       text, conf = line[1]
#       print(f"[{idx + 1}] Confidence level: {conf:.2f} | TEXT: {text}")
#   else:
#     print("[WARN] text not detected")


# if __name__ == "__main__":
#   img_file = sys.argv[1] if len(sys.argv) > 1 else "scamUntitled.png"
#   run_ocr_test(img_file)
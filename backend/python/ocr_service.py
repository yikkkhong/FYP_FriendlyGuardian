import sys
import json
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang="en")

def extract_text_from_image(image_path):
    try:
        result = ocr.ocr(image_path, cls=True)
        extracted_lines = []

        if result and result[0]:
            for line in result[0]:
                # line[1][0] contains the recognized text
                text = line[1][0].strip()
                if text:
                    extracted_lines.append(text)

        full_text = " ".join(extracted_lines)
        return {"text": full_text}
    except Exception as e:
        return {"text": "", "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_image = sys.argv[1]
        output = extract_text_from_image(target_image)
        # output json
        print(json.dumps(output))
    else:
        print(json.dumps({"text": "", "error": "No image path provided."}))
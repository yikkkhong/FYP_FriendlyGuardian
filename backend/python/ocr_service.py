import json
import os
import sys
from pathlib import Path
import cv2
import numpy as np
import pymupdf

# 屏蔽 Paddle C++ 杂音日志
os.environ["GLOG_minloglevel"] = "2"
os.environ["FLAGS_allocator_strategy"] = "naive_best_fit"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from paddleocr import PaddleOCR

# 常驻内存加载 OCR
ocr = PaddleOCR(use_angle_cls=False, lang="ch", show_log=False)

# 创建存放透明化图片的临时文件夹
TEMP_DIR = Path(os.path.dirname(__file__)) / "temp_processed"
TEMP_DIR.mkdir(exist_ok=True)
DPI = 300


# ========================================================
# 这就是咱们之前早就写好的 PDF 转换逻辑，我把它搬过来了！
# ========================================================
def load_as_bgr(filepath: str) -> np.ndarray:
    """支持 PDF 或普通图片的无损加载为 BGR 矩阵"""
    path = Path(filepath)
    if not path.exists():
        return None

    with open(str(path), "rb") as f:
        header = f.read(4)
    # 通过二进制魔数确保哪怕 Node.js 剥离了后缀名也能精准识别 PDF
    is_pdf = (header == b"%PDF") or (path.suffix.lower() == ".pdf")

    if is_pdf:
        with pymupdf.open(str(path), filetype="pdf") as doc:
            page = doc[0]
            pix = page.get_pixmap(dpi=DPI, colorspace=pymupdf.csRGB, alpha=False)
            img_rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
            return cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    else:
        img_data = np.fromfile(str(path), dtype=np.uint8)
        return cv2.imdecode(img_data, cv2.IMREAD_COLOR)


def process_and_transparent_text(image_path: str):
    if not os.path.exists(image_path):
        return {"success": False, "error": "Image file not found"}

    try:
        # 1. 无论上传的是 PDF 还是图片，统一在这里转成图片矩阵
        bgr_image = load_as_bgr(image_path)
        if bgr_image is None:
            return {"success": False, "error": "Failed to decode image"}

        h, w = bgr_image.shape[:2]
        # 转为 4 通道，为透明化做准备
        bgra_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2BGRA)

        # 2. 核心修复：直接把转好的图片矩阵喂给 OCR，绝不能传原来那个 PDF 路径！
        result = ocr.ocr(bgr_image, cls=False)
        
        extracted_lines = []
        text_boxes = []

        if result and result[0]:
            for line in result[0]:
                text_boxes.append(line[0])
                text = line[1][0].strip()
                if text:
                    extracted_lines.append(text)

        # 3. 创建透明掩膜：如果有文字，向外扩充 9 像素覆盖抗锯齿灰边
        text_mask = np.zeros((h, w), dtype=np.uint8)
        if text_boxes:
            for box in text_boxes:
                pts = np.array(box, dtype=np.int32).reshape((-1, 1, 2))
                cv2.fillPoly(text_mask, [pts], 255)

            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
            text_mask = cv2.dilate(text_mask, kernel)

            # 4. 执行“透明化”：把文字区域的 Alpha 通道设为 0（完全透明）
            bgra_image[text_mask > 0, 3] = 0

        # 5. 保存处理后的透明图（必须为 PNG 以保留透明通道）
        output_name = f"{Path(image_path).stem}_transparent.png"
        output_path = TEMP_DIR / output_name
        cv2.imwrite(str(output_path), bgra_image)

        full_text = " ".join(extracted_lines)

        return {
            "success": True,
            "text": full_text,
            "transparent_image_path": str(output_path.resolve()),
            "error": None
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    print(json.dumps({"status": "READY"}), flush=True)

    for line in sys.stdin:
        target_image = line.strip()
        if not target_image:
            continue

        output = process_and_transparent_text(target_image)
        print(json.dumps(output, ensure_ascii=False), flush=True)
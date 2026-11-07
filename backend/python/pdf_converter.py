from pathlib import Path
import os
import sys
import json
import pymupdf

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DPI = 300
TEMP_PDF_DIR = Path(os.path.dirname(__file__)) / "temp_pdf_png"
TEMP_PDF_DIR.mkdir(exist_ok=True)


def convert_pdf_if_needed(filepath: str) -> dict:
    path = Path(filepath)
    if not path.exists():
        return {"success": False, "error": f"File not found: {filepath}"}

    try:
        # Check the %PDF file header since multer temp files may not have a .pdf extension
        with open(str(path), "rb") as f:
            header = f.read(4)
        is_pdf = (header == b"%PDF") or (path.suffix.lower() == ".pdf")

        if not is_pdf:
            #  If it's not a PDF, return the original file path
            return {
                "success": True,
                "is_pdf": False,
                "image_path": str(path.resolve()),
            }

        # If it is a PDF, convert the first page to a 300 DPI lossless PNG
        with pymupdf.open(str(path), filetype="pdf") as doc:
            page = doc[0]
            pix = page.get_pixmap(
                dpi=DPI,
                colorspace=pymupdf.csRGB,
                alpha=False,
            )
            out_path = TEMP_PDF_DIR / f"{path.stem}_converted.png"
            pix.save(str(out_path))

        return {
            "success": True,
            "is_pdf": True,
            "image_path": str(out_path.resolve()),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        res = convert_pdf_if_needed(target)
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(json.dumps({"success": False, "error": "No file path provided"}))
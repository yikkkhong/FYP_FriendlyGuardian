from PIL import Image

for filename in ["AI.png", "ai_1.png", "ai_2.png", "ai_3.png"]:
    with Image.open("samples/" + filename) as img:
        print(filename, "Actual format:", img.format)
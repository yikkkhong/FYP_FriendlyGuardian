from PIL import Image

for filename in ["notPlainColor2.jfif"]:
    with Image.open("samples/" + filename) as img:
        print(filename, "Actual format:", img.format)
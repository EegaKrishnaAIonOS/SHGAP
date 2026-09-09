import io
import os

from PIL import Image


def get_image_info(path: str) -> dict:
    """Return width, height (px) and file size (bytes) for an image at `path`.

    SVGs are rasterized to PNG in memory (never written to disk) before
    their dimensions are read, since SVG has no fixed pixel size otherwise.
    """
    file_size = os.path.getsize(path)
    png_size = None

    if path.lower().endswith(".svg"):
        import cairosvg

        png_bytes = cairosvg.svg2png(url=path)
        png_size = len(png_bytes)
        with Image.open(io.BytesIO(png_bytes)) as img:
            width, height = img.size
    else:
        with Image.open(path) as img:
            width, height = img.size

    return {
        "path": path,
        "width": width,
        "height": height,
        "file_size_bytes": file_size,
        "png_size_bytes": png_size,
    }


if __name__ == "__main__":
    lst_img = ["./apps/web/public/guest-avatar.svg", "./apps/web/public/commodity-icon.svg", "./apps/web/public/catalog-icon.svg"]

    for p in lst_img:
        print(get_image_info(p))

"""
Self-hosted QR code generator. Replaces api.qrserver.com so that ticket
validation never depends on a third-party uptime.

Returns a PNG image directly so a plain <img src="/api/qr?data=…"> works
without any client-side JS.
"""
from io import BytesIO

import qrcode
from fastapi import APIRouter, Query, Response

router = APIRouter(prefix="/api/qr", tags=["qr"])


@router.get("")
async def generate_qr(
    data: str = Query(..., min_length=1, max_length=4096, description="String to encode"),
    size: int = Query(200, ge=64, le=1024, description="Pixel size of the output square"),
):
    """Produce a PNG QR code for the given `data` string.

    The image is generated on-the-fly with a 1-day public cache header so
    that repeat hits for the same payload are served from the browser /
    edge cache instead of regenerating.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    # Resize to the requested square size (NEAREST keeps the code crisp).
    if img.size[0] != size:
        from PIL import Image
        img = img.resize((size, size), Image.NEAREST)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )

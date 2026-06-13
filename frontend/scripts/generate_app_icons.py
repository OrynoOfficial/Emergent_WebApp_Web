#!/usr/bin/env python3
"""
Oryno — App icon + splash screen generator.

Reads the 1024×1024 master at `frontend/public/images/logo.png` and emits the
full icon matrix Apple and Google require, plus brand-colour splash screens.

Layout (matches what Capacitor expects):

    frontend/resources/icon.png             1024×1024 RGBA padded
    frontend/resources/splash.png           2732×2732 (will be downscaled
                                              per-density by `capacitor-assets`)
    frontend/public/icons/ios/AppIcon-*.png 16 explicit Apple sizes
    frontend/public/icons/android/
        mipmap-mdpi/ic_launcher*.png        48×48 + foreground/background
        mipmap-hdpi/ic_launcher*.png        72×72
        mipmap-xhdpi/ic_launcher*.png       96×96
        mipmap-xxhdpi/ic_launcher*.png      144×144
        mipmap-xxxhdpi/ic_launcher*.png     192×192
    frontend/public/icons/splash/
        ios-splash-2732.png                 universal iPad+iPhone splash
        android-splash-2160.png             Android 12+ splash

Re-run any time the logo changes:

    python3 scripts/generate_app_icons.py
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parents[1]
MASTER = REPO / "public" / "images" / "logo.png"

# Oryno brand background — same colour used in capacitor.config.ts and the
# mobile gate gradient.
BRAND_RGBA = (8, 44, 89, 255)

# Output paths (created lazily).
RESOURCES_DIR = REPO / "resources"
PUBLIC_ICONS = REPO / "public" / "icons"
IOS_DIR = PUBLIC_ICONS / "ios"
ANDROID_DIR = PUBLIC_ICONS / "android"
SPLASH_DIR = PUBLIC_ICONS / "splash"


# ──────────────────────────────────────────────────────────────────────────
# iOS — 16 explicit sizes, all square, RGBA. Sizes are taken from Apple's
# Human Interface Guidelines `AppIcon.appiconset` contents.json.
# ──────────────────────────────────────────────────────────────────────────
IOS_SIZES = [
    ("AppIcon-20@2x.png",     40),
    ("AppIcon-20@3x.png",     60),
    ("AppIcon-29@2x.png",     58),
    ("AppIcon-29@3x.png",     87),
    ("AppIcon-40@2x.png",     80),
    ("AppIcon-40@3x.png",    120),
    ("AppIcon-60@2x.png",    120),
    ("AppIcon-60@3x.png",    180),
    ("AppIcon-76.png",        76),
    ("AppIcon-76@2x.png",    152),
    ("AppIcon-83.5@2x.png",  167),
    ("AppIcon-1024.png",    1024),
]

# Android adaptive icon densities. Foreground layer is the logo, background
# layer is a flat brand colour — Android composes them at runtime.
ANDROID_DENSITIES = {
    "mipmap-mdpi":    48,
    "mipmap-hdpi":    72,
    "mipmap-xhdpi":   96,
    "mipmap-xxhdpi":  144,
    "mipmap-xxxhdpi": 192,
}


def ensure_dirs() -> None:
    for d in (RESOURCES_DIR, IOS_DIR, ANDROID_DIR, SPLASH_DIR):
        d.mkdir(parents=True, exist_ok=True)
    for density in ANDROID_DENSITIES:
        (ANDROID_DIR / density).mkdir(parents=True, exist_ok=True)


def load_master() -> Image.Image:
    """Open the master logo and make sure it's a 1024×1024 RGBA image."""
    if not MASTER.exists():
        raise SystemExit(f"❌  master logo not found: {MASTER}")
    im = Image.open(MASTER).convert("RGBA")
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    return im


def on_brand_bg(logo: Image.Image, size: int, padding_ratio: float = 0.18) -> Image.Image:
    """Render the logo centered on a brand-coloured square canvas with the
    given padding. Used for iOS (which doesn't support adaptive icons) and
    Android legacy launcher targets."""
    canvas = Image.new("RGBA", (size, size), BRAND_RGBA)
    pad = int(size * padding_ratio)
    target = size - 2 * pad
    fitted = logo.resize((target, target), Image.LANCZOS)
    canvas.paste(fitted, (pad, pad), fitted)
    return canvas


def transparent_logo(logo: Image.Image, size: int, padding_ratio: float = 0.25) -> Image.Image:
    """Foreground layer for Android adaptive icons — logo on a transparent
    canvas, leaving headroom so the OS mask doesn't clip it on circular or
    squircle launchers."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pad = int(size * padding_ratio)
    target = size - 2 * pad
    fitted = logo.resize((target, target), Image.LANCZOS)
    canvas.paste(fitted, (pad, pad), fitted)
    return canvas


def flat_bg(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BRAND_RGBA)


def write_ios(logo: Image.Image) -> int:
    count = 0
    for name, size in IOS_SIZES:
        im = on_brand_bg(logo, size)
        im.save(IOS_DIR / name, "PNG", optimize=True)
        count += 1
    return count


def write_android(logo: Image.Image) -> int:
    count = 0
    for density, size in ANDROID_DENSITIES.items():
        d = ANDROID_DIR / density
        # Legacy launcher icon (used on Android < 8.0)
        on_brand_bg(logo, size).save(d / "ic_launcher.png", "PNG", optimize=True)
        # Adaptive icon (Android 8.0+) — foreground + background layers.
        transparent_logo(logo, size).save(d / "ic_launcher_foreground.png", "PNG", optimize=True)
        flat_bg(size).save(d / "ic_launcher_background.png", "PNG", optimize=True)
        # Round variant for circular launchers
        on_brand_bg(logo, size).save(d / "ic_launcher_round.png", "PNG", optimize=True)
        count += 4
    return count


def write_splashes(logo: Image.Image) -> int:
    """Generate the canonical splash screens. Capacitor's tooling (or our CI)
    will downscale these for every density; we just need the masters."""
    # iOS / iPadOS — Capacitor wants a 2732×2732 master so it can crop to
    # both portrait + landscape for every device.
    canvas = Image.new("RGBA", (2732, 2732), BRAND_RGBA)
    logo_size = 800
    fitted = logo.resize((logo_size, logo_size), Image.LANCZOS)
    canvas.paste(fitted, ((2732 - logo_size) // 2, (2732 - logo_size) // 2), fitted)
    canvas.save(SPLASH_DIR / "ios-splash-2732.png", "PNG", optimize=True)
    canvas.save(RESOURCES_DIR / "splash.png", "PNG", optimize=True)

    # Android 12+ splash — recommended foreground is 432×432 inside a 1080×1080
    # canvas. We export a 2160 master for retina.
    a = Image.new("RGBA", (2160, 2160), BRAND_RGBA)
    a_logo = logo.resize((864, 864), Image.LANCZOS)  # 40% of canvas
    a.paste(a_logo, ((2160 - 864) // 2, (2160 - 864) // 2), a_logo)
    a.save(SPLASH_DIR / "android-splash-2160.png", "PNG", optimize=True)
    return 3


def write_resources_master(logo: Image.Image) -> None:
    """Capacitor's `cordova-res` / `capacitor-assets` CLIs expect a master
    1024×1024 icon at `resources/icon.png`. Write it once so the next
    developer can run `npx capacitor-assets generate` with zero config."""
    canvas = on_brand_bg(logo, 1024)
    canvas.save(RESOURCES_DIR / "icon.png", "PNG", optimize=True)


def main() -> None:
    ensure_dirs()
    logo = load_master()

    write_resources_master(logo)
    ios_n = write_ios(logo)
    android_n = write_android(logo)
    splash_n = write_splashes(logo)

    print(f"✓ iOS icons:      {ios_n}")
    print(f"✓ Android icons:  {android_n}")
    print(f"✓ Splash screens: {splash_n}")
    print()
    print("Output:")
    print(f"  {RESOURCES_DIR}/icon.png        ← run `npx capacitor-assets generate`")
    print(f"  {RESOURCES_DIR}/splash.png      ↘")
    print(f"  {IOS_DIR}/                      ← copy into ios/App/App/Assets.xcassets")
    print(f"  {ANDROID_DIR}/                  ← copy into android/app/src/main/res")
    print(f"  {SPLASH_DIR}/                   ← raw splash masters")


if __name__ == "__main__":
    main()

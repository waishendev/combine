# Slider Image Size Guide (Shop Homepage)

This project renders homepage sliders in the Shop frontend at:
`frontend/ecommerce_gentlegurl_shop/src/components/home/Slider.tsx`.

That component uses `object-cover` and fixed heights, so images that are too tall or too wide will be **cropped**. Use the guidance below to keep important content visible on both desktop and mobile.

## Where the sizes come from

The slider container heights are:

- **Mobile**: `h-[380px]`
- **Small screens (≥ 640px)**: `h-[420px]`
- **Large screens (≥ 1024px)**: `h-[480px]`

The slider sits in a `max-w-6xl` container (≈ 1152px wide on large screens) and uses `object-cover` for both desktop and mobile images.

## Recommended image ratios & sizes

### Desktop image

- **Suggested aspect ratio**: **~2.4:1 to 2.6:1**
- **Example size**: **2400 × 960** or **1920 × 768**

This ratio fits the 1152px × 480px view (≈ 2.4:1) without heavy cropping.

### Mobile image

- **Suggested aspect ratio**: **~1:1 to 4:5**
- **Example size**: **1080 × 1080** or **1080 × 1350**

Mobile height is 380px and width is often 360–430px, so square/near‑square images keep the main subject intact.

## Safe area tips (avoid cropping)

- Keep critical content (text, logos, faces) **centered**.
- Leave extra padding on the left/right edges for desktop, and top/bottom for mobile.
- When unsure, export larger images in the target ratio and let the slider scale them down.

## Quick checklist

- ✅ Desktop image roughly **2.5:1**
- ✅ Mobile image **1:1 or 4:5**
- ✅ Important content centered
- ✅ No text near the image edges

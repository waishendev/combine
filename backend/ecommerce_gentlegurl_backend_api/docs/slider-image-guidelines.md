# Slider Image Size Guide (Shop Homepage)

This project renders homepage sliders in the Shop frontend at:
`frontend/ecommerce_gentlegurl_shop/src/components/home/Slider.tsx`.

⚠️ **IMPORTANT**: The component uses `object-cover`, which **crops images** to fill the container. To avoid cutting off important content (like borders/frames), your images **MUST match the exact aspect ratios** below.

## Actual Container Dimensions

### Desktop (Large screens ≥ 1024px)
- **Container width**: `max-w-6xl` = **1152px**
- **Padding**: `lg:px-8` = **32px** on each side (64px total)
- **Actual display width**: **1088px** (1152 - 64)
- **Display height**: **480px**
- **Exact aspect ratio**: **1088:480 = 2.267:1** ≈ **2.27:1**

### Mobile (Small screens < 640px)
- **Container width**: Full viewport width (typically **375px - 428px**)
- **Display height**: **380px**
- **Aspect ratio**: Approximately **1:1** to **1.1:1** (varies by device)

### Tablet (Small screens ≥ 640px, < 1024px)
- **Container width**: Full viewport width with padding
- **Display height**: **420px**
- **Aspect ratio**: Approximately **1.5:1** to **2:1**

## ⚠️ CRITICAL: Exact Image Dimensions Required

To prevent cropping of borders/frames, images **MUST** match these exact ratios:

### Desktop Image (Desktop/Tablet)
- **Required aspect ratio**: **2.27:1** (exactly)
- **Recommended sizes**:
  - **2176 × 960 pixels** (2.27:1 - perfect match)
  - **1920 × 846 pixels** (2.27:1 - perfect match)
  - **1600 × 705 pixels** (2.27:1 - perfect match)
- **Minimum size**: **1088 × 480 pixels** (exact container size, but use larger for quality)
- **Maximum size**: **4000 × 1762 pixels** (for high-DPI displays)

### Mobile Image (Phone)
- **Actual display dimensions**:
  - Height: **380px** (fixed)
  - Width: **328px - 398px** (varies by device, after padding)
  - Actual aspect ratio range: **0.86:1 to 1.05:1**
- **Recommended aspect ratio**: **0.9:1 to 0.95:1** (slightly wider than square)
- **Recommended sizes**:
  - **1080 × 972 pixels** (0.9:1 - best for wide phones, prevents top/bottom cropping)
  - **1200 × 1080 pixels** (0.9:1 - high quality)
  - **1440 × 1296 pixels** (0.9:1 - ultra high quality)
- **Alternative (if you must use square)**:
  - **1080 × 1080 pixels** (1:1 - may crop slightly on wider phones)
  - **1440 × 1440 pixels** (1:1 - may crop slightly on wider phones)
- **Minimum size**: **428 × 380 pixels**
- **Maximum size**: **1440 × 1296 pixels** (recommended) or **1440 × 1440 pixels** (if square)

## Why Images Get Cropped

The slider uses `object-cover` CSS property, which:
1. Scales the image to cover the entire container
2. Maintains the image's aspect ratio
3. **Crops** any parts that don't fit

If your image has a different aspect ratio than the container, edges will be cut off.

## Solution: Match the Exact Ratio

**For Desktop:**
- Your image must be **2.27:1** ratio
- Example: If width is 2176px, height must be 960px
- Formula: `height = width ÷ 2.27`

**For Mobile:**
- Your image should be **1:1** (square) or close to it
- Example: 1080 × 1080 pixels

## Safe Area Guidelines

Even with correct ratios, keep important content in the center:

### Desktop
- **Safe zone**: Center 60% of the image
- **Avoid**: Content within 20% of left/right edges
- **Best**: Keep borders/frames in the center 50%

### Mobile
- **Safe zone**: Center 70% of the image
- **Avoid**: Content within 15% of top/bottom edges
- **Best**: Keep borders/frames in the center 60%

## Quick Reference

| Screen Size | Display Dimensions | Required Ratio | Recommended Size |
|------------|-------------------|----------------|-------------------|
| **Desktop** (≥1024px) | 1088 × 480px | **2.27:1** | **2176 × 960px** |
| **Tablet** (640-1023px) | ~768 × 420px | ~1.83:1 | **1536 × 840px** |
| **Mobile** (<640px) | 328-398 × 380px | **0.9:1** | **1440 × 1296px** |

## Export Settings

When preparing images:

1. **Desktop**: Export at **2176 × 960px** (2.27:1) or **1920 × 846px**
2. **Mobile**: Export at **1440 × 1296px** (0.9:1) - **THIS PREVENTS CROPPING**
   - Alternative: **1080 × 972px** (0.9:1) if file size is a concern
   - ⚠️ Avoid 1:1 (square) on mobile - it will crop on wider phones
3. **Format**: JPG (quality 85-90%) or WebP
4. **File size**: Keep under 500KB per image
5. **Color space**: sRGB

## Testing Checklist

- ✅ Desktop image is exactly **2.27:1** ratio
- ✅ Mobile image is **0.9:1** ratio (NOT 1:1 square - square will crop!)
- ✅ Important content (borders, frames) is in the center 50%
- ✅ No critical text or graphics near the edges
- ✅ Images are exported at recommended sizes above

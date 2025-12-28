# Announcement image guidelines

## API response
- Make sure the announcement API returns a public URL for the image file.
- Recommended: use `Storage::disk('public')->url($path)` to populate `image_url` in the API response.

## Image sizing (avoid cropping)
- The modal in the shop frontend displays the image inside a **4:3** container using `object-contain`, so it will not be cropped.
- For the best fit, upload images close to **4:3** aspect ratio, e.g. **1200 × 900** or **1600 × 1200**.
- Larger images are fine; they will scale down to fit the container while keeping the full image visible.

## Preview sizes in CRM
- The CRM announcement table preview uses a small thumbnail (approx. **96 × 64**).
- Use a clear, high-contrast image so it remains legible at smaller sizes.

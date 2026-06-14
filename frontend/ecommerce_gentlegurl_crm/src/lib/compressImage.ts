export interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number
}

const DEFAULT_MAX_WIDTH = 1920
const DEFAULT_MAX_HEIGHT = 1920
const DEFAULT_QUALITY = 0.82
const DEFAULT_MAX_SIZE_KB = 500

function isTransparent(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
  const { width, height } = canvas
  const step = Math.max(1, Math.floor(Math.min(width, height) / 32))
  const data = ctx.getImageData(0, 0, width, height).data
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 250) return true
    }
  }
  return false
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    maxSizeKB = DEFAULT_MAX_SIZE_KB,
  } = options

  if (!file.type.startsWith('image/')) return file

  const skipTypes = ['image/svg+xml', 'image/gif']
  if (skipTypes.includes(file.type)) return file

  const sizeKB = file.size / 1024
  if (sizeKB <= maxSizeKB) return file

  return new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { naturalWidth: w, naturalHeight: h } = img
      if (w === 0 || h === 0) {
        resolve(file)
        return
      }

      let targetW = w
      let targetH = h

      if (targetW > maxWidth || targetH > maxHeight) {
        const ratio = Math.min(maxWidth / targetW, maxHeight / targetH)
        targetW = Math.round(targetW * ratio)
        targetH = Math.round(targetH * ratio)
      }

      const noResize = targetW === w && targetH === h
      if (noResize && sizeKB <= maxSizeKB) {
        resolve(file)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const hasPngExtension = /\.png$/i.test(file.name)
      const useTransparency = hasPngExtension && isTransparent(canvas, ctx)

      const mimeType = useTransparency ? 'image/png' : 'image/jpeg'
      const ext = useTransparency ? '.png' : '.jpg'
      const outputName = file.name.replace(/\.[^.]+$/, ext)
      const outputQuality = useTransparency ? undefined : quality

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file)
            return
          }
          resolve(new File([blob], outputName, { type: mimeType, lastModified: Date.now() }))
        },
        mimeType,
        outputQuality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

export async function compressImages(
  files: File[],
  options: CompressImageOptions = {},
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)))
}

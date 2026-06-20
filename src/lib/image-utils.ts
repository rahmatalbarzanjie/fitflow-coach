/**
 * Resize dan kompres gambar di client-side sebelum upload.
 * Target: max 1600px lebar, quality 80%, format webp/jpeg.
 * Reject: > 2MB setelah resize, atau format tidak didukung.
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_MB   = 2
const MAX_WIDTH     = 1600
const QUALITY       = 0.8

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

export async function resizeAndCompressImage(file: File): Promise<File> {
  // Validasi format
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ImageValidationError(
      'Format tidak didukung. Gunakan JPG, PNG, atau WebP.'
    )
  }

  // Validasi ukuran awal
  if (file.size > MAX_SIZE_MB * 1024 * 1024 * 3) {
    throw new ImageValidationError(
      `File terlalu besar. Maksimal ${MAX_SIZE_MB * 3}MB.`
    )
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Resize jika lebih lebar dari MAX_WIDTH
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width)
        width  = MAX_WIDTH
      }

      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas tidak tersedia')); return }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Gagal kompres gambar')); return }

          // Validasi ukuran setelah kompres
          if (blob.size > MAX_SIZE_MB * 1024 * 1024) {
            reject(new ImageValidationError(
              `Gambar masih terlalu besar setelah dikompresi (${(blob.size / 1024 / 1024).toFixed(1)}MB). Coba foto dengan resolusi lebih rendah.`
            ))
            return
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          )
          resolve(compressedFile)
        },
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageValidationError('File gambar tidak valid atau rusak.'))
    }

    img.src = url
  })
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'ico']

export const IMAGE_ACCEPT = ['image/*', ...IMAGE_EXTENSIONS.map((ext) => `.${ext}`)].join(',')
export const IMAGE_PDF_ACCEPT = `${IMAGE_ACCEPT},application/pdf,.pdf`

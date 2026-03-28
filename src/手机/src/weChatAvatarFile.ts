/** 将本地图片压成 data URL，控制体积以便写入 localStorage */
const MAX_EDGE = 384;
const JPEG_QUALITY = 0.88;

export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(blobUrl);
    let { width, height } = img;
    if (width > MAX_EDGE || height > MAX_EDGE) {
      const r = Math.min(MAX_EDGE / width, MAX_EDGE / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法处理图片');
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

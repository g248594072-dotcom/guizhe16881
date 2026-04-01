/**
 * 将本地图片缩放并编码为较小体积的 Data URL（优先 WebP，其次 JPEG）。
 * 用于头像弹窗等需生成较小 Data URL 的场景（头像仅存本机时同样可用），避免 Base64 过大。
 */

function estimateBytesFromDataUrl(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

/** 检测当前环境是否可用 canvas 输出指定 MIME（WebP 在旧 Safari 上可能不可用） */
function canEncodeMime(mime: string): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    const u = c.toDataURL(mime, 0.8);
    return u.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

async function fileToScaledCanvas(file: File, maxEdgePx: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 不可用');

  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    try {
      const scale = Math.min(1, maxEdgePx / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bmp, 0, 0, w, h);
      return canvas;
    } finally {
      bmp.close();
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdgePx / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

export type CompressImageOptions = {
  /** 长边最大像素，默认 512 */
  maxEdgePx?: number;
  /** 压缩后目标体积上限（解码后约等于字节数），默认 220KB */
  maxOutputBytes?: number;
};

/**
 * 读取本地图片文件，按长边限制缩放，并优先输出 WebP，其次 JPEG，直到体积满足上限。
 */
export async function compressImageFileToDataUrl(
  file: File,
  options?: CompressImageOptions,
): Promise<string> {
  const maxEdgePx = options?.maxEdgePx ?? 512;
  const maxOutputBytes = options?.maxOutputBytes ?? 220 * 1024;

  const webpOk = canEncodeMime('image/webp');
  const qualities = [0.9, 0.84, 0.78, 0.72, 0.65, 0.58, 0.5, 0.42];
  const edges = [maxEdgePx, Math.round(maxEdgePx * 0.75), 384, 288, 256, 192, 160, 128];

  for (const edge of edges) {
    const canvas = await fileToScaledCanvas(file, edge);
    for (const q of qualities) {
      if (webpOk) {
        const webp = canvas.toDataURL('image/webp', q);
        if (webp.startsWith('data:image/webp') && estimateBytesFromDataUrl(webp) <= maxOutputBytes) {
          return webp;
        }
      }
      const jpeg = canvas.toDataURL('image/jpeg', q);
      if (jpeg.startsWith('data:image/jpeg') && estimateBytesFromDataUrl(jpeg) <= maxOutputBytes) {
        return jpeg;
      }
    }
  }

  const last = await fileToScaledCanvas(file, 96);
  const fallback = last.toDataURL('image/jpeg', 0.82);
  return fallback;
}

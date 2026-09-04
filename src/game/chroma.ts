/** Runtime material key: source art stays untouched; opaque export background becomes sprite alpha. */
export function keyPixels(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = context.getImageData(0, 0, width, height); let changed = 0;
  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
    if (r > 195 && b > 195 && g < 85) { data.data[i + 3] = 0; changed++; }
  }
  if (changed) context.putImageData(data, 0, 0);
  return changed > 0;
}
const imageCache = new Map<string, string>();
export function keyInterfaceImage(image: HTMLImageElement) {
  const source = image.getAttribute('src') ?? '';
  if (!/\/assets\/(enemies|weapons|evolutions)\//.test(source) || !image.naturalWidth) return;
  const cached = imageCache.get(source); if (cached) { image.src = cached; return; }
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return;
  context.drawImage(image, 0, 0);
  if (keyPixels(context, canvas.width, canvas.height)) { const url = canvas.toDataURL('image/png'); imageCache.set(source, url); image.src = url; }
}

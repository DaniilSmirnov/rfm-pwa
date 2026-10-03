import { coordinateText, yandexWebFallback } from '../navigation.js';

export function downloadBlob(filename, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sharePointValue(point) {
  if (!point) return false;
  const title = point.name || 'Точка RallyFans Map';
  const coords = coordinateText(point);
  const url = yandexWebFallback(point);
  const data = { title, text: `${title}\n${coords}`, url };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return true;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return false;
  }
  try {
    await navigator.clipboard.writeText(`${title}\n${coords}\n${url}`);
    return true;
  } catch {
    return false;
  }
}

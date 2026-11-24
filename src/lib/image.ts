/** Redimensiona e comprime a foto (JPEG) para não lotar o armazenamento. */
export async function comprimirImagem(file: File, max = 1600, qualidade = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao comprimir'))), 'image/jpeg', qualidade));
}

export function blobParaDataURL(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export async function dataURLParaBlob(u: string): Promise<Blob> {
  return (await fetch(u)).blob();
}

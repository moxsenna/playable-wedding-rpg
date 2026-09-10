export interface UploadIntentResponse {
  mode: "presigned" | "proxy";
  key: string;
  publicUrl: string;
  uploadUrl?: string;
  expiresIn?: number;
}

export async function fileToWebp(file: File): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("webp encode failed");
  return { bytes: await blob.arrayBuffer(), contentType: "image/webp" };
}

export async function requestUploadUrl(
  apiBase: string,
  adminKey: string,
  projectId: string,
  contentType: string,
  sizeBytes: number
): Promise<UploadIntentResponse> {
  const res = await fetch(`${apiBase}/v1/admin/media/upload-url`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ projectId, contentType, sizeBytes }),
  });
  if (!res.ok) throw new Error(`upload intent refused (${res.status})`);
  return (await res.json()) as UploadIntentResponse;
}

export async function putDirect(uploadUrl: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes });
  if (!res.ok) throw new Error(`direct upload failed (${res.status})`);
}

export async function putProxied(
  apiBase: string,
  adminKey: string,
  projectId: string,
  key: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const qs = new URLSearchParams({ projectId, key, contentType });
  const res = await fetch(`${apiBase}/v1/admin/media/upload?${qs.toString()}`, {
    method: "POST",
    headers: { "x-admin-key": adminKey, "content-type": "application/octet-stream" },
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
}

export async function completeUpload(apiBase: string, adminKey: string, projectId: string, key: string): Promise<void> {
  const res = await fetch(`${apiBase}/v1/admin/media/complete`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ projectId, key }),
  });
  if (!res.ok) throw new Error(`complete failed (${res.status})`);
}

export async function deleteMedia(apiBase: string, adminKey: string, projectId: string, key: string): Promise<"deleted" | "referenced"> {
  const res = await fetch(`${apiBase}/v1/admin/media`, {
    method: "DELETE",
    headers: { "content-type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ projectId, key }),
  });
  if (res.status === 409) return "referenced";
  if (!res.ok) throw new Error(`delete failed (${res.status})`);
  return "deleted";
}

export function mediaKeyFromSrc(apiBase: string, src: string): string | null {
  try {
    const url = new URL(src, apiBase);
    const m = url.pathname.match(/^\/v1\/media\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

import { isSafeKey, storage } from "@/lib/storage";

// Serve as imagens do storage quando não há STORAGE_PUBLIC_URL (CDN/bucket
// público). Capas e avatares são públicos, como eram os buckets no Supabase.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");

  if (!isSafeKey(key) || !/^(game-covers|avatars)\//.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const file = await storage().get(key);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(file.body), {
    headers: {
      "Content-Type": file.contentType,
      // Cada upload gera uma chave nova, então o conteúdo nunca muda.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";

/**
 * Storage de arquivos (capas e avatares), independente do banco:
 *
 *   STORAGE_DRIVER=local  → grava em UPLOADS_DIR (padrão ./uploads)
 *   STORAGE_DRIVER=s3     → qualquer serviço S3-compatível: AWS S3,
 *                           Cloudflare R2, MinIO, Backblaze B2, DO Spaces…
 *
 * O banco guarda só a *chave* (ex.: "game-covers/<uid>/<uuid>.jpg"), nunca a
 * URL, então trocar de provedor/bucket não quebra imagens já cadastradas.
 * A URL pública é montada na hora por publicUrl().
 */

export interface StoredFile {
  body: Uint8Array;
  contentType: string;
}

interface StorageDriver {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  remove(key: string): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif"
};

export const ALLOWED_IMAGE_EXTENSIONS = Object.keys(CONTENT_TYPES);
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Rejeita chaves que tentem sair da pasta de uploads ("../", absolutas…). */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    !key.startsWith("/") &&
    !key.includes("\\") &&
    key.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

function localDriver(): StorageDriver {
  // turbopackIgnore: a pasta é definida em runtime e não deve ser empacotada.
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR ?? "uploads");
  const resolve = (key: string) => path.join(root, ...key.split("/"));

  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      try {
        return { body: await readFile(resolve(key)), contentType: contentTypeFor(key) };
      } catch {
        return null;
      }
    },
    async remove(key) {
      await unlink(resolve(key)).catch(() => {});
    }
  };
}

function s3Driver(): StorageDriver {
  const sdk = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("STORAGE_DRIVER=s3 exige S3_BUCKET.");
  }

  const client: S3Client = new sdk.S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined
  });

  return {
    async put(key, body, contentType) {
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable"
        })
      );
    },
    async get(key) {
      try {
        const result = await client.send(
          new sdk.GetObjectCommand({ Bucket: bucket, Key: key })
        );
        if (!result.Body) return null;
        return {
          body: await result.Body.transformToByteArray(),
          contentType: result.ContentType ?? contentTypeFor(key)
        };
      } catch {
        return null;
      }
    },
    async remove(key) {
      await client
        .send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch(() => {});
    }
  };
}

let driver: StorageDriver | undefined;

export function storage(): StorageDriver {
  if (!driver) {
    const name = process.env.STORAGE_DRIVER ?? "local";

    if (name === "local") driver = localDriver();
    else if (name === "s3") driver = s3Driver();
    else throw new Error(`STORAGE_DRIVER inválido: "${name}" (use local ou s3).`);
  }

  return driver;
}

/**
 * Converte o valor da coluna `image` em URL exibível:
 * - URL absoluta (ex.: capa da Steam) → devolvida como está;
 * - chave do storage → STORAGE_PUBLIC_URL/<chave> se houver um CDN/bucket
 *   público configurado; senão, servida pelo próprio app em /files/<chave>.
 */
export function publicUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;

  const base = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, "");
  return base ? `${base}/${image}` : `/files/${image}`;
}

export function isStorageKey(image: string | null | undefined): image is string {
  return !!image && !/^https?:\/\//i.test(image);
}

export type UploadFolder = "game-covers" | "avatars";

/** Valida e grava uma imagem enviada por formulário; devolve a chave. */
export async function uploadImage(
  file: File,
  folder: UploadFolder,
  userId: string
): Promise<{ key: string } | { error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { error: "Formato de imagem não suportado (use JPG, PNG, GIF, WEBP ou AVIF)." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "A imagem deve ter no máximo 4 MB." };
  }

  const key = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`;

  try {
    await storage().put(key, new Uint8Array(await file.arrayBuffer()), contentTypeFor(key));
  } catch (err) {
    console.error("upload failed:", err);
    return { error: "Não foi possível enviar a imagem. Tente novamente." };
  }

  return { key };
}

export async function removeImage(image: string | null | undefined): Promise<void> {
  if (isStorageKey(image)) {
    await storage().remove(image);
  }
}

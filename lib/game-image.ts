const STORAGE_MARKER = "/game-covers/";

export function extractGameCoverPath(imageUrl: string | null): string | null {
  if (!imageUrl) {
    return null;
  }

  const index = imageUrl.indexOf(STORAGE_MARKER);

  if (index === -1) {
    return null;
  }

  return imageUrl.slice(index + STORAGE_MARKER.length);
}

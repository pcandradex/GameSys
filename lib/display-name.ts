interface DisplayNameProfile {
  nickname?: string | null;
  full_name?: string | null;
  email: string;
}

export function resolveDisplayName(
  profile: DisplayNameProfile | null | undefined
): string {
  if (!profile) {
    return "";
  }

  return profile.nickname?.trim() || profile.full_name?.trim() || profile.email;
}

export function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

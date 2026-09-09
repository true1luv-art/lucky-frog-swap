export function generateAvatarUrl(username: string): string {
  const cleanName = username.toLowerCase().trim();
  return `https://images.hive.blog/u/${cleanName}/avatar`;
}

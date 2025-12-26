export const createRegex = (value: string | undefined) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // Escape special regex characters
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // No ^ or $ means it matches anywhere in the string
  return new RegExp(escaped, "i"); // 'i' = case-insensitive
};

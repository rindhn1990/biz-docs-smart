export function hasUnsavedValues(current: Record<string, string>, saved: Record<string, string>) {
  const keys = new Set([...Object.keys(current), ...Object.keys(saved)]);
  return [...keys].some(key => (current[key] ?? '') !== (saved[key] ?? ''));
}
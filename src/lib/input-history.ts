export type InputValues = Record<string, string>;
export type InputHistory = { past: InputValues[]; present: InputValues; future: InputValues[] };
export function sameInputValues(a: InputValues, b: InputValues) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(key => a[key] === b[key]);
}
export function createInputHistory(values: InputValues): InputHistory {
  return { past: [], present: { ...values }, future: [] };
}
export function changeInputHistory(history: InputHistory, next: InputValues): InputHistory {
  if (sameInputValues(history.present, next)) return history;
  return { past: [...history.past, history.present].slice(-100), present: { ...next }, future: [] };
}
export function undoInputHistory(history: InputHistory): InputHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}
export function redoInputHistory(history: InputHistory): InputHistory {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
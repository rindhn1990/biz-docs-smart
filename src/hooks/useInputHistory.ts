import { useCallback, useState, type SetStateAction } from 'react';
import { changeInputHistory, createInputHistory, redoInputHistory, sameInputValues, undoInputHistory, type InputValues } from '@/lib/input-history';

export function useInputHistory() {
  const [history, setHistory] = useState(() => createInputHistory({}));
  const setValues = useCallback((action: SetStateAction<InputValues>) => {
    setHistory(current => changeInputHistory(current, typeof action === 'function' ? action(current.present) : action));
  }, []);
  const resetValues = useCallback((values: InputValues) => setHistory(createInputHistory(values)), []);
  // Saving/refetching the same snapshot must not destroy typing history.
  const loadValues = useCallback((values: InputValues) => setHistory(current => sameInputValues(current.present, values) ? current : createInputHistory(values)), []);
  const undo = useCallback(() => setHistory(undoInputHistory), []);
  const redo = useCallback(() => setHistory(redoInputHistory), []);
  return { values: history.present, setValues, resetValues, loadValues, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
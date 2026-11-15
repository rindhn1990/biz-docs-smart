import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export type LeaveCheck = () => Promise<boolean>;

export function UnsavedDataGuard({ dirty, saving, onSave, onDiscard, registerLeaveCheck }: {
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  registerLeaveCheck: (check: LeaveCheck | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const resolveRef = useRef<((leave: boolean) => void) | null>(null);
  const check = useCallback((): Promise<boolean> => {
    if (saving) return Promise.resolve(false);
    if (!dirty) return Promise.resolve(true);
    if (resolveRef.current) return Promise.resolve(false);
    setOpen(true);
    return new Promise(resolve => { resolveRef.current = resolve; });
  }, [dirty, saving]);

  useBlocker({ shouldBlockFn: async () => !await check(), enableBeforeUnload: dirty || saving });
  useEffect(() => {
    registerLeaveCheck(check);
    return () => registerLeaveCheck(null);
  }, [check, registerLeaveCheck]);
  useEffect(() => () => { resolveRef.current?.(false); }, []);

  function finish(leave: boolean) {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    resolve?.(leave);
  }
  async function saveAndLeave() {
    if (working || saving) return;
    setWorking(true);
    try { if (await onSave()) finish(true); }
    finally { setWorking(false); }
  }
  return <AlertDialog open={open} onOpenChange={next => { if (!next && !working) finish(false); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Lưu dữ liệu trước khi rời trang?</AlertDialogTitle>
        <AlertDialogDescription>Dữ liệu chung của gói thầu có thay đổi chưa lưu. Nếu không lưu, lần mở sau sẽ dùng phiên bản gần nhất đã lưu.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2">
        <Button variant="outline" disabled={working || saving} onClick={() => finish(false)}>Ở lại</Button>
        <Button variant="outline" disabled={working || saving} onClick={() => { onDiscard(); finish(true); }}>Không lưu</Button>
        <Button disabled={working || saving} onClick={() => void saveAndLeave()}>{working ? 'Đang lưu…' : 'Lưu và tiếp tục'}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
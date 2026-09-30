import { useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Màn bắt buộc đổi mật khẩu sau khi đăng nhập bằng mật khẩu tạm. */
export function ForceChangePassword({
  email,
  onDone,
  onSignOut,
}: {
  email: string;
  onDone: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
    if (!/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next))
      return setError("Mật khẩu mới cần có chữ hoa, chữ thường và số.");
    if (next !== confirm) return setError("Mật khẩu xác nhận không khớp.");
    if (next === current) return setError("Không được dùng lại mật khẩu tạm. Hãy chọn mật khẩu khác.");
    setBusy(true);
    try {
      // Xác minh mật khẩu tạm trước khi đổi.
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signErr) {
        setError("Mật khẩu tạm không đúng.");
        return;
      }
      const { error: upErr } = await supabase.auth.updateUser({ password: next });
      if (upErr) {
        setError(`Không đổi được mật khẩu: ${upErr.message}`);
        return;
      }
      const { error: rpcErr } = await supabase.rpc("complete_password_change");
      if (rpcErr) {
        setError("Đã đổi mật khẩu nhưng chưa cập nhật được trạng thái. Hãy thử lại.");
        return;
      }
      toast.success("Đã đổi mật khẩu thành công.");
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-muted">
            <KeyRound className="size-5 text-muted-foreground" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Bạn cần đổi mật khẩu</h1>
            <p className="text-sm text-muted-foreground">
              Bạn đang dùng mật khẩu tạm. Hãy đặt mật khẩu mới để tiếp tục sử dụng hệ thống.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cur">Mật khẩu tạm (trong email)</Label>
          <Input id="cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">Mật khẩu mới</Label>
          <Input id="new" type="password" required value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf">Nhập lại mật khẩu mới</Label>
          <Input id="cf" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Đổi mật khẩu
          </Button>
          <Button type="button" variant="outline" onClick={() => void onSignOut()}>
            <LogOut className="mr-2 size-4" />
            Đăng xuất
          </Button>
        </div>
      </form>
    </div>
  );
}

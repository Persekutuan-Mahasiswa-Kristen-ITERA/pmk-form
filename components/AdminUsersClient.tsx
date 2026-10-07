"use client";

import { useState, useTransition } from "react";
import { UserPlus, Trash2, Power, PowerOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  inviteAdminAction,
  setAdminStatusAction,
  deleteAdminAction,
  type AdminMember,
} from "@/app/actions/adminMembers";

/**
 * UI manajemen admin (Fase 5-4). Client component karena ada interaksi.
 *
 * Semua aksi memanggil server action yang memvalidasi requireSuperAdmin() di
 * server. Guard self/last-super_admin juga ada di server action + DB.
 */
export function AdminUsersClient({
  members,
  currentUserId,
}: {
  members: AdminMember[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await inviteAdminAction({ email, role: "super_admin" });
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success
          ? `${email.trim().toLowerCase()} diundang. Akan aktif saat login Google pertama.`
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
      if (res.success) setEmail("");
    });
  };

  const handleSetStatus = (member: AdminMember, status: "active" | "disabled") => {
    startTransition(async () => {
      const res = await setAdminStatusAction(member.id, status);
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success
          ? status === "disabled"
            ? `${member.email} dinonaktifkan.`
            : `${member.email} diaktifkan.`
          : res.error,
        variant: res.success ? "default" : "destructive",
      });
    });
  };

  const [pendingDelete, setPendingDelete] = useState<AdminMember | null>(null);

  const handleDelete = (member: AdminMember) => {
    setPendingDelete(member);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const member = pendingDelete;
    startTransition(async () => {
      const res = await deleteAdminAction(member.id);
      toast({
        title: res.success ? "Berhasil" : "Gagal",
        description: res.success ? `${member.email} dihapus dari allowlist.` : res.error,
        variant: res.success ? "default" : "destructive",
      });
      setPendingDelete(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Form undang */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5" /> Undang Admin Baru
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Masukkan email akun Google departemen. Status <Badge className="text-[10px]">invited</Badge> akan
            menjadi <Badge className="text-[10px]">active</Badge> saat login Google pertama kali.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="departemen@pmkitera.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl"
            />
            <Button type="submit" disabled={pending} className="rounded-xl px-8">
              {pending ? "Mengundang…" : "Undang"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Daftar admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Admin ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada admin.</p>
          ) : (
            members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              const statusVariant =
                m.status === "active" ? "default" : m.status === "invited" ? "secondary" : "destructive";
              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-2xl p-4 bg-white"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{m.email}</span>
                      <Badge variant={statusVariant} className="capitalize text-[10px]">
                        {m.status === "active" ? "aktif" : m.status === "invited" ? "diundang" : "dinonaktifkan"}
                      </Badge>
                      {isSelf && <Badge variant="outline" className="text-[10px]">Anda</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.role} · login terakhir:{" "}
                      {m.last_login_at
                        ? new Date(m.last_login_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "belum pernah"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {m.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={pending || isSelf}
                        title={isSelf ? "Tidak dapat menonaktifkan akun sendiri" : "Nonaktifkan"}
                        onClick={() => handleSetStatus(m, "disabled")}
                      >
                        <PowerOff className="w-4 h-4 mr-1" /> Nonaktifkan
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={pending}
                        onClick={() => handleSetStatus(m, "active")}
                      >
                        <Power className="w-4 h-4 mr-1" /> Aktifkan
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-muted-foreground hover:text-destructive"
                      disabled={pending || isSelf}
                      aria-label={isSelf ? "Tidak dapat menghapus akun sendiri" : `Hapus ${m.email} dari allowlist`}
                      title={isSelf ? "Tidak dapat menghapus akun sendiri" : "Hapus dari allowlist"}
                      onClick={() => handleDelete(m)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* U4: konfirmasi hapus admin memakai dialog bermerek (batasan 6). */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Hapus admin ini?"
        description={
          pendingDelete
            ? `${pendingDelete.email} akan dihapus dari allowlist. Akses admin mereka akan dicabut segera.`
            : ""
        }
        confirmLabel="Hapus"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

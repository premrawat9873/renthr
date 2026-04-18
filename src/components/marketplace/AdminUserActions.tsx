"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Props = {
  userId: string;
};

export default function AdminUserActions({ userId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this user and all their posts? This action is irreversible.")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Unable to delete user.");
      }

      toast({ title: "User removed", description: "User and their posts were deleted." });
      router.push("/");
    } catch (error) {
      toast({ title: "Could not delete user", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAvatar = async () => {
    if (!confirm("Reset this user's avatar to default?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/avatar`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Unable to reset avatar.");
      toast({ title: "Avatar reset", description: "User avatar was reset." });
      router.refresh();
    } catch (error) {
      toast({ title: "Could not reset avatar", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const res = await fetch(`/api/admin/users/${userId}/avatar`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Unable to upload avatar.");
      toast({ title: "Avatar updated", description: "User avatar was updated." });
      router.refresh();
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex">
        <input
          type="file"
          accept="image/*"
          disabled={submitting}
          className="sr-only"
          onChange={(e) => handleUpload(e.target.files ? e.target.files[0] : null)}
        />
        <Button size="sm" variant="outline" className="mr-2">
          <ImagePlus className="mr-2 h-4 w-4" /> Upload avatar
        </Button>
      </label>

      <Button size="sm" variant="outline" onClick={handleResetAvatar} disabled={submitting}>
        Reset avatar
      </Button>

      <Button size="sm" variant="destructive" onClick={handleDelete} disabled={submitting}>
        <Trash className="mr-2 h-4 w-4" /> Delete user
      </Button>
    </div>
  );
}

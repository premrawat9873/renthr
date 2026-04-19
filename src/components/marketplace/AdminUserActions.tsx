"use client";

import { useEffect, useRef, useState } from "react";
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const deleteConfirmTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const resetConfirmTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (deleteConfirmTimeoutRef.current) {
        window.clearTimeout(deleteConfirmTimeoutRef.current);
      }

      if (resetConfirmTimeoutRef.current) {
        window.clearTimeout(resetConfirmTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);

      if (deleteConfirmTimeoutRef.current) {
        window.clearTimeout(deleteConfirmTimeoutRef.current);
      }

      deleteConfirmTimeoutRef.current = window.setTimeout(() => {
        setConfirmingDelete(false);
        deleteConfirmTimeoutRef.current = null;
      }, 3000);

      toast({
        title: "Confirm user deletion",
        description: "Click Delete user again within 3 seconds to confirm.",
        variant: "destructive",
      });

      return;
    }

    setConfirmingDelete(false);
    if (deleteConfirmTimeoutRef.current) {
      window.clearTimeout(deleteConfirmTimeoutRef.current);
      deleteConfirmTimeoutRef.current = null;
    }

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
    if (!confirmingReset) {
      setConfirmingReset(true);

      if (resetConfirmTimeoutRef.current) {
        window.clearTimeout(resetConfirmTimeoutRef.current);
      }

      resetConfirmTimeoutRef.current = window.setTimeout(() => {
        setConfirmingReset(false);
        resetConfirmTimeoutRef.current = null;
      }, 3000);

      toast({
        title: "Confirm avatar reset",
        description: "Click Reset avatar again within 3 seconds to confirm.",
      });

      return;
    }

    setConfirmingReset(false);
    if (resetConfirmTimeoutRef.current) {
      window.clearTimeout(resetConfirmTimeoutRef.current);
      resetConfirmTimeoutRef.current = null;
    }

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

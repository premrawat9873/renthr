"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type ReportTargetType = "post" | "user";

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  title?: string;
  buttonLabel?: string;
  variant?: "ghost" | "outline";
  className?: string;
};

const REASONS = [
  "Spam",
  "Fraud or scam",
  "Harassment or abuse",
  "Inappropriate content",
  "Fake listing/profile",
  "Other",
] as const;

export default function ReportActionButton({
  targetType,
  targetId,
  title,
  buttonLabel,
  variant = "ghost",
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const heading = title || (targetType === "post" ? "Report Listing" : "Report User");

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (response.status === 401) {
        const nextPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/";
        router.push(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit report right now.");
      }

      toast({
        title: "Report submitted",
        description: "Thanks. Our moderation team will review this report.",
      });
      setOpen(false);
      setDetails("");
      setReason(REASONS[0]);
    } catch (error) {
      toast({
        title: "Could not submit report",
        description:
          error instanceof Error ? error.message : "Unable to submit report right now.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Flag className="mr-1.5 h-4 w-4" />
        {buttonLabel || heading}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{heading}</DialogTitle>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Reason</label>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {REASONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Details (optional)</label>
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Add any context that helps review this report"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Submit report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

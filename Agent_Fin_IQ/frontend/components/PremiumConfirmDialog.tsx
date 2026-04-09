import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

type ConfirmTone = 'danger' | 'accent' | 'success';

interface PremiumConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  note?: string;
  bullets?: string[];
  tone?: ConfirmTone;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

const TONE_STYLES: Record<ConfirmTone, {
  iconWrap: string;
  icon: React.ReactNode;
  eyebrow: string;
  eyebrowText: string;
  panel: string;
  confirm: string;
}> = {
  danger: {
    iconWrap: 'border-[#E8C9CC] bg-[linear-gradient(180deg,#FFF8F8_0%,#F9EDEE_100%)]',
    icon: <ShieldAlert size={18} className="text-[#A14F59]" />,
    eyebrow: 'Please Review',
    eyebrowText: 'text-[#9A5860]',
    panel: 'border-[#E7D8DB] bg-[linear-gradient(135deg,#FFFFFF_0%,#FCF7F8_100%)]',
    confirm: 'bg-[linear-gradient(135deg,#A14F59_0%,#8C3F49_100%)] hover:opacity-95 text-white shadow-[0_12px_28px_rgba(161,79,89,0.28)]',
  },
  accent: {
    iconWrap: 'border-[#CFE0F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF5FF_100%)]',
    icon: <AlertTriangle size={18} className="text-[#42648C]" />,
    eyebrow: 'Confirm Action',
    eyebrowText: 'text-[#56739F]',
    panel: 'border-[#D8E5F5] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FAFE_100%)]',
    confirm: 'bg-[linear-gradient(135deg,#1E5FAF_0%,#2C74D4_100%)] hover:opacity-95 text-white shadow-[0_12px_28px_rgba(30,95,175,0.24)]',
  },
  success: {
    iconWrap: 'border-[#CDE4D7] bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF8F2_100%)]',
    icon: <CheckCircle2 size={18} className="text-[#2C6B4F]" />,
    eyebrow: 'Proceed With Save',
    eyebrowText: 'text-[#4A7B63]',
    panel: 'border-[#D6E7DE] bg-[linear-gradient(135deg,#FFFFFF_0%,#F7FBF8_100%)]',
    confirm: 'bg-[linear-gradient(135deg,#256B52_0%,#2E8B68_100%)] hover:opacity-95 text-white shadow-[0_12px_28px_rgba(37,107,82,0.24)]',
  },
};

export function PremiumConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  note,
  bullets = [],
  tone = 'accent',
  busy = false,
  onConfirm,
}: PremiumConfirmDialogProps) {
  const styles = TONE_STYLES[tone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-[560px] overflow-hidden rounded-[28px] border p-0 shadow-[0_28px_80px_rgba(15,23,42,0.24)] ${styles.panel}`}>
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.10),transparent_34%)]" />
          <div className="relative px-7 pb-6 pt-7">
            <DialogHeader className="text-left">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${styles.iconWrap}`}>
                  {styles.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${styles.eyebrowText}`}>
                    {styles.eyebrow}
                  </div>
                  <DialogTitle className="mt-2 text-[24px] font-black tracking-[-0.03em] text-[#15233B]">
                    {title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-[13px] font-medium leading-6 text-[#5F6F86]">
                    {description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {(bullets.length > 0 || note) && (
              <div className="mt-6 rounded-[20px] border border-white/70 bg-white/80 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(15,23,42,0.04)]">
                {bullets.length > 0 && (
                  <div className="space-y-2.5">
                    {bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2.5 text-[12px] font-semibold leading-5 text-[#31435E]">
                        <div className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8CA2C0]" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}
                {note && (
                  <div className={`${bullets.length > 0 ? 'mt-4 pt-4 border-t border-slate-100' : ''} text-[11px] font-medium leading-5 text-[#7B879A]`}>
                    {note}
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="mt-7 flex-row items-center justify-end gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-slate-200 bg-white px-5 text-[12px] font-bold text-slate-600 shadow-none hover:bg-slate-50"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                className={`h-11 rounded-2xl px-5 text-[12px] font-black ${styles.confirm}`}
                onClick={() => { void onConfirm(); }}
                disabled={busy}
              >
                {busy ? 'Please wait...' : confirmLabel}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

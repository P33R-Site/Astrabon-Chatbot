'use client';

import { ShieldCheck } from 'lucide-react';
import { PRIVACY_NOTICE } from '@/lib/chatbot/branding';

/**
 * Persistent privacy disclaimer rendered by the widget shell (AstrabonWidget),
 * not by ChatInterface. This is deliberate: it must appear on every widget
 * initialization regardless of chat state, session, or API response, and it
 * must survive future edits to chat/message-rendering logic without being
 * dropped by accident.
 */
export function PrivacyFooter() {
  return (
    <div className="shrink-0 px-4 py-2 border-t border-border-subtle bg-surface-alt/40 backdrop-blur-md">
      <p className="flex items-center justify-center gap-1.5 text-center text-[10px] leading-snug text-text-muted">
        <ShieldCheck className="w-3 h-3 shrink-0 text-primary/70" />
        {PRIVACY_NOTICE}
      </p>
    </div>
  );
}

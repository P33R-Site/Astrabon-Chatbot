'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { AstrabonProvider, useAstrabon } from './AstrabonContext';
import { ChatInterface } from './ChatInterface';

// ─── Widget Inner Content ─────────────────────────────────────────────────────
function WidgetContent() {
  const {
    isExpanded, setIsExpanded,
    agentStatus,
  } = useAstrabon();

  const [showLoader, setShowLoader] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Listen for external open events (from hero CTA / category cards)
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setIsExpanded(true);
      if (e.detail?.prompt) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('astrabon:send-prompt', { detail: { prompt: e.detail.prompt } }));
        }, 400);
      }
    };
    window.addEventListener('astrabon:open-chat', handleOpen as EventListener);
    return () => window.removeEventListener('astrabon:open-chat', handleOpen as EventListener);
  }, [setIsExpanded]);

  const handleExpand = () => {
    setShowLoader(true);
    setIsExpanded(true);
    setTimeout(() => setShowLoader(false), 1200);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const statusDot =
    agentStatus === 'ready' ? 'bg-success' :
    agentStatus === 'unavailable' ? 'bg-error' :
    'bg-warning animate-pulse';

  return (
    <div className="fixed bottom-6 right-6 z-[9000] flex flex-col items-end font-sans" style={{ pointerEvents: 'auto' }}>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`fixed z-[9001] overflow-hidden flex flex-col glass-panel border border-border-subtle shadow-2xl transition-all duration-500
              ${isFullscreen
                ? 'inset-[3vw] top-[5vh] bottom-[5vh] w-auto h-auto rounded-[28px]'
                : 'max-md:inset-0 max-md:w-full max-md:h-[100dvh] max-md:rounded-none md:bottom-6 md:right-6 md:w-[400px] md:h-[680px] md:rounded-[28px]'
              }
            `}
            style={{ background: 'color-mix(in srgb, var(--color-bg) 97%, transparent)', transformOrigin: 'bottom right' }}
          >
            {/* Header */}
            <div className="h-[58px] bg-surface-alt/40 backdrop-blur-xl border-b border-border-subtle flex items-center justify-between px-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-primary/25 overflow-hidden relative">
                  <img src="/chatbot/chatbot-avatar.jpeg" alt="Dhon" className="w-full h-full object-cover" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg ${statusDot}`} />
                </div>
                <div>
                  <h1 className="text-text-primary font-serif text-base tracking-wide leading-none mb-0.5">Dhon</h1>
                  <p className="text-[10px] uppercase tracking-widest font-medium text-primary">Powered by PRV8 · Online</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Fullscreen toggle (desktop only) */}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hidden md:flex w-7 h-7 rounded-lg bg-surface-100 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-200 transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>

                {/* Close */}
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {showLoader ? (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <div className="w-16 h-16 rounded-full border border-primary/25 flex items-center justify-center mb-5 relative">
                      <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    </div>
                    <h3 className="font-serif text-lg text-text-primary mb-2">Connecting...</h3>
                    <p className="text-xs text-text-muted tracking-wide">Preparing your experience</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full relative z-10 flex flex-col"
                  >
                    <ChatInterface />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher Button */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExpand}
            className="relative flex items-center gap-3 bg-surface border border-border-subtle pl-2.5 pr-5 py-2.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-primary/40 hover:shadow-[0_8px_40px_rgba(200,152,94,0.25)] transition-all duration-300 group"
          >
            <div className="w-10 h-10 rounded-full border border-primary/25 shadow-md overflow-hidden relative group-hover:ring-2 group-hover:ring-primary/30 transition-all">
              <img src="/chatbot/chatbot-avatar.jpeg" alt="Dhon" className="w-full h-full object-cover" />
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${statusDot}`} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-text-primary text-sm font-semibold leading-none mb-0.5">Dhon</span>
              <span className="text-[10px] text-primary uppercase tracking-widest font-bold">Chat with us</span>
            </div>
            <MessageSquare className="sr-only" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────
export function AstrabonWidget() {
  return (
    <AstrabonProvider>
      <WidgetContent />
    </AstrabonProvider>
  );
}

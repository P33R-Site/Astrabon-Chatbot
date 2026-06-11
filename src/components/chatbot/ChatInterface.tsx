'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, AlertTriangle } from 'lucide-react';
import { useAstrabon } from './AstrabonContext';
import { ProductCarousel } from './ProductCarousel';
import { LeadCaptureFlow } from './LeadCaptureFlow';
import { detectLeadTrigger } from '@/lib/leadTriggers';
import { MarkdownText } from './MarkdownText';
import { checkHealth, streamChat, getSessionMessages } from '@/lib/dhon/client';
import { mapAgentProducts } from '@/lib/dhon/mapProduct';
import type { AgentProductCard } from '@/lib/dhon/types';
import type { ChatMessage, Product } from '@/types';

const WELCOME_PROMPTS = [
  { label: 'Help me find cookware', icon: '🍳' },
  { label: "I'm buying for a restaurant or café", icon: '🏪' },
  { label: 'Compare cookware materials', icon: '⚖️' },
  { label: 'Show kitchen starter essentials', icon: '🔪' },
  { label: 'Help me choose knives', icon: '🗡️' },
  { label: 'Find coffee essentials', icon: '☕' },
];


export function ChatInterface() {
  const {
    chatHistory, addMessage, updateMessage, isCapturingLead,
    setIsCapturingLead, setFlowState, setProductCategory,
    sessionId, setSessionId,
    agentStatus, setAgentStatus,
    isStreaming, setIsStreaming,
    buyerType, setBuyerType,
  } = useAstrabon();

  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, scrollToBottom]);

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Health check on mount
  useEffect(() => {
    checkHealth().then(ok => {
      setAgentStatus(ok ? 'ready' : 'unavailable');
    });
  }, [setAgentStatus]);

  // Restore session history on mount (if sessionId stored)
  useEffect(() => {
    if (!sessionId || chatHistory.length > 0) return;
    getSessionMessages(sessionId).then(data => {
      data.messages.forEach(m => {
        if (m.role === 'user' || m.role === 'assistant') {
          addMessage({
            sender: m.role === 'user' ? 'user' : 'bot',
            text: m.content,
            type: 'text',
          });
        }
      });
    }).catch(() => {
      // Session not found — clear stale id
      setSessionId(null);
    });
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for external prompts (from category cards, hero CTA)
  useEffect(() => {
    const handleExternalPrompt = (e: CustomEvent) => {
      if (e.detail?.prompt) handleSend(e.detail.prompt);
    };
    window.addEventListener('astrabon:send-prompt', handleExternalPrompt as EventListener);
    return () => window.removeEventListener('astrabon:send-prompt', handleExternalPrompt as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturingLead, sessionId, isStreaming]);

  const sendAgentMessage = useCallback(async (text: string) => {
    setIsStreaming(true);

    // Add placeholder bot bubble and capture the ID returned by addMessage
    const botId = addMessage({ sender: 'bot', text: '', type: 'text' });

    let streamedText = '';

    abortRef.current = new AbortController();

    try {
      await streamChat(
        { message: text, session_id: sessionId ?? undefined },
        (event) => {
          if (event.event === 'token' && typeof event.data.content === 'string') {
            streamedText += event.data.content;
            updateMessage(botId, { text: streamedText });
          }
          if (event.event === 'products' && Array.isArray(event.data.items)) {
            const products = mapAgentProducts(event.data.items as AgentProductCard[]);
            updateMessage(botId, { type: 'product-cards', products });
          }
          if (event.event === 'done') {
            const sid = event.data.session_id as string | undefined;
            if (sid) {
              setSessionId(sid);
            }
            const finalMsg = event.data.message as string | undefined;
            if (!streamedText && finalMsg) {
              updateMessage(botId, { text: finalMsg });
            }
          }
          if (event.event === 'error') {
            throw new Error(String(event.data.detail ?? 'Agent error'));
          }
        },
        abortRef.current.signal,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      updateMessage(botId, { text: msg });
    } finally {
      setIsStreaming(false);
    }
  }, [sessionId, setSessionId, addMessage, updateMessage, setIsStreaming]);

  const handleSend = useCallback((text?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || isStreaming) return;
    setInputValue('');
    addMessage({ sender: 'user', text: msg, type: 'text' });

    // Lead capture short-circuit — messages handled by LeadCaptureFlow form
    if (isCapturingLead) return;

    // Detect commercial buyer type so LeadCaptureFlow shows the businessName step
    const commercialKw = ['restaurant', 'café', 'cafe', 'hotel', 'business', 'wholesale'];
    if (commercialKw.some(k => msg.toLowerCase().includes(k))) {
      setBuyerType('restaurant');
    }

    // High-intent lead trigger
    const leadTrigger = detectLeadTrigger(msg);
    if (leadTrigger === 'high') {
      setTimeout(() => {
        setIsCapturingLead(true);
        setFlowState('lead-capture');
        addMessage({
          sender: 'bot',
          text: "Great! I can pass this to the Astrabon team so they can help you quickly. Please share:\n\nYour name",
          type: 'text',
        });
      }, 400);
      return;
    }

    // Connect-to-team trigger
    const connectKw = ['connect', 'team', 'speak to', 'contact', 'inquire', 'collect my details'];
    if (connectKw.some(k => msg.toLowerCase().includes(k))) {
      setTimeout(() => {
        setIsCapturingLead(true);
        setFlowState('lead-capture');
        addMessage({
          sender: 'bot',
          text: "Great! I can pass this to the Astrabon team so they can help you quickly. Please share:\n\nYour name",
          type: 'text',
        });
      }, 400);
      return;
    }

    sendAgentMessage(msg);
  }, [inputValue, isStreaming, isCapturingLead, addMessage, sendAgentMessage, setBuyerType, setIsCapturingLead, setFlowState]);

  const handleOptionClick = (option: string, messageId: string) => {
    setSelectedOptions(prev => new Set(prev).add(messageId));

    if (['connect', 'team', 'collect my details', 'speak to'].some(k => option.toLowerCase().includes(k))) {
      addMessage({ sender: 'user', text: option, type: 'text' });
      setTimeout(() => {
        setIsCapturingLead(true);
        setFlowState('lead-capture');
        addMessage({ sender: 'bot', text: "Let's get your details so the team can follow up. What's your name?", type: 'text' });
      }, 400);
      return;
    }
    handleSend(option);
  };

  const handleInquire = (product: Product) => {
    addMessage({ sender: 'user', text: `I'm interested in: ${product.name}`, type: 'text' });
    setTimeout(() => {
      setIsCapturingLead(true);
      setFlowState('lead-capture');
      setProductCategory(product.category);
      addMessage({
        sender: 'bot',
        text: `Great choice — ${product.name} is an excellent option. I'll pass this to the Astrabon team. First, what's your name?`,
        type: 'text',
      });
    }, 600);
  };

  // ─── AGENT UNAVAILABLE BANNER ────────────────────────────────────────────────
  const agentBanner = agentStatus === 'unavailable' && (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-error/10 border border-error/25 text-[11px] text-error">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      Dhon is currently unreachable. Please try again shortly.
    </div>
  );

  // ─── WELCOME SCREEN ───────────────────────────────────────────────────────────
  if (chatHistory.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {agentBanner}
        <div className="flex-1 flex flex-col justify-end px-5 pb-5 overflow-y-auto no-scrollbar">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full border border-primary/25 overflow-hidden">
                <img src="/chatbot/chatbot-avatar.jpeg" alt="Dhon" className="w-full h-full object-cover" />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-primary font-light leading-relaxed max-w-[85%] min-w-0 break-words">
                👋 Hi! I&#39;m Dhon, your Astrabon assistant. I can help you find the right kitchenware, cookware, coffee essentials, glassware, and more.
                <br /><br />
                <span className="text-primary font-medium">What are you shopping for today?</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            {WELCOME_PROMPTS.map((prompt, i) => (
              <motion.button
                key={prompt.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                onClick={() => handleSend(prompt.label)}
                disabled={isStreaming || agentStatus === 'unavailable'}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-alt/60 border border-border-subtle hover:border-primary/40 hover:bg-primary/8 text-left transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-base">{prompt.icon}</span>
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors leading-snug">
                  {prompt.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <InputBar
          value={inputValue}
          onChange={setInputValue}
          onSend={() => handleSend()}
          disabled={isStreaming || agentStatus === 'unavailable'}
        />
      </div>
    );
  }

  // ─── CHAT SCREEN ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {agentBanner}
      <div className="flex-1 px-5 pt-5 pb-3 overflow-y-auto no-scrollbar space-y-4">
        {chatHistory.map((msg) => {
          const isOptionSelected = selectedOptions.has(msg.id);
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Bot text / options bubble — skip the empty placeholder while streaming */}
              {msg.sender === 'bot' && (msg.type === 'text' || msg.type === 'options') && msg.text && (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full border border-primary/20 overflow-hidden shrink-0 mb-1">
                    <img src="/chatbot/chatbot-avatar.jpeg" alt="Dhon" className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-primary/10 border border-primary/15 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] min-w-0">
                    <MarkdownText text={msg.text} />
                  </div>
                </div>
              )}

              {/* User message */}
              {msg.sender === 'user' && (
                <div className="bg-surface-alt border border-border-subtle rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-text-primary font-light">{msg.text}</p>
                </div>
              )}

              {/* Options chips */}
              {msg.type === 'options' && msg.options && (
                <div className="flex flex-wrap gap-2 mt-2 pl-9">
                  {msg.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleOptionClick(opt, msg.id)}
                      disabled={isOptionSelected || isStreaming}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-all duration-300 ${
                        isOptionSelected || isStreaming
                          ? 'bg-surface-alt/30 border-border-subtle text-text-muted/50 cursor-default'
                          : 'bg-surface-alt/60 border-border-subtle text-text-secondary hover:bg-primary hover:text-text-on-primary hover:border-primary'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Product cards */}
              {msg.type === 'product-cards' && msg.products && (
                <div className="w-full mt-2">
                  {msg.text && msg.sender === 'bot' && (
                    <div className="flex items-end gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full border border-primary/20 overflow-hidden shrink-0">
                        <img src="/chatbot/chatbot-avatar.jpeg" alt="Dhon" className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-primary/10 border border-primary/15 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] min-w-0">
                        <MarkdownText text={msg.text} />
                      </div>
                    </div>
                  )}
                  <ProductCarousel products={msg.products} onInquire={handleInquire} />
                  {msg.options && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {msg.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleOptionClick(opt, msg.id)}
                          disabled={isOptionSelected || isStreaming}
                          className={`px-3 py-1.5 rounded-full border text-xs transition-all duration-300 ${
                            isOptionSelected || isStreaming
                              ? 'bg-surface-alt/30 border-border-subtle text-text-muted/50 cursor-default'
                              : 'bg-surface-alt/60 border-border-subtle text-text-secondary hover:bg-primary hover:text-text-on-primary hover:border-primary'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}


            </motion.div>
          );
        })}

        {/* Lead capture form (active) */}
        {isCapturingLead && <LeadCaptureFlow />}

        <div ref={messagesEndRef} />
      </div>

      <InputBar
        value={inputValue}
        onChange={setInputValue}
        onSend={() => handleSend()}
        disabled={isCapturingLead || isStreaming || agentStatus === 'unavailable'}
      />
    </div>
  );
}

// ─── Input Bar ────────────────────────────────────────────────────────────────
function InputBar({
  value, onChange, onSend, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="p-4 border-t border-border-subtle bg-surface/60 backdrop-blur-md shrink-0">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={disabled ? 'Please complete the form above...' : 'Type a message or ask a question...'}
          className="w-full bg-surface-alt/60 border border-border-subtle rounded-2xl pl-5 pr-20 py-4 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all disabled:opacity-50"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-text-on-primary hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

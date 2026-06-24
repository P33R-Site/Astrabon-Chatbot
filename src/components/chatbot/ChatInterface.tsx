'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, AlertTriangle, RotateCcw, Zap, ChevronDown } from 'lucide-react';
import { useAstrabon } from './AstrabonContext';
import { ProductCarousel } from './ProductCarousel';
import { LeadCaptureFlow } from './LeadCaptureFlow';
import { detectLeadTrigger } from '@/lib/leadTriggers';
import { MarkdownText } from './MarkdownText';
import { checkHealth, fetchFlashSaleProducts, streamChat, getSessionMessages, postChat } from '@/lib/dhon/client';
import { mapAgentProducts } from '@/lib/dhon/mapProduct';
import { stripProductReply } from '@/lib/stripProductReply';
import type { AgentProductCard } from '@/lib/dhon/types';
import type { Product } from '@/types';
import { BOT_NAME, BOT_AVATAR_URL } from '@/lib/chatbot/branding';

const WELCOME_PROMPTS = [
  { label: 'Shop Coffee Essentials', icon: '☕' },
  { label: 'Find Knives & Cutlery', icon: '🔪' },
  { label: 'Browse Glassware & Barware', icon: '🥂' },
  { label: "I'm setting up a restaurant or café", icon: '🏪' },
  { label: 'Buffet & Serving Equipment', icon: '🍽️' },
  { label: 'Industrial Kitchen Equipment', icon: '🏭' },
];

function isRecoverableAgentError(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('provider rejected') ||
    lower.includes('openrouter') ||
    lower.includes('rate limit') ||
    lower.includes('something went wrong') ||
    lower.includes('agent error') ||
    lower.includes('try again')
  );
}

function isProviderError(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('provider') || lower.includes('openrouter');
}


export function ChatInterface() {
  const {
    chatHistory, addMessage, updateMessage, removeMessage, isCapturingLead,
    setIsCapturingLead, setFlowState, setProductCategory,
    sessionId, setSessionId,
    agentStatus, setAgentStatus,
    isStreaming, setIsStreaming,
    buyerType, setBuyerType,
    setLeadData,
    chatEpoch, registerChatCleanup,
  } = useAstrabon();

  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [flashSaleProducts, setFlashSaleProducts] = useState<Product[]>([]);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const welcomeScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const restoreAbortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef(sessionId);
  const chatEpochRef = useRef(chatEpoch);

  sessionIdRef.current = sessionId;
  chatEpochRef.current = chatEpoch;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, scrollToBottom]);

  // Register cleanup for resetChat
  useEffect(() => {
    return registerChatCleanup(() => {
      abortRef.current?.abort();
      restoreAbortRef.current?.abort();
      setInputValue('');
      setSelectedOptions(new Set());
      setShowScrollHint(true);
    });
  }, [registerChatCleanup]);

  const updateScrollHint = useCallback(() => {
    const el = welcomeScrollRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight > el.clientHeight + 4;
    const scrolled = el.scrollTop > 8;
    setShowScrollHint(canScroll && !scrolled);
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0) return;
    updateScrollHint();
    const el = welcomeScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    return () => observer.disconnect();
  }, [chatHistory.length, flashSaleProducts.length, updateScrollHint]);

  // Abort on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Health check on mount
  useEffect(() => {
    checkHealth().then(ok => {
      setAgentStatus(ok ? 'ready' : 'unavailable');
    });
  }, [setAgentStatus]);

  // Load flash-sale products for welcome screen
  useEffect(() => {
    fetchFlashSaleProducts(20).then(data => {
      if (data.items.length > 0) {
        setFlashSaleProducts(mapAgentProducts(data.items));
      }
    });
  }, []);

  // Restore session history when sessionId hydrates or widget remounts
  useEffect(() => {
    if (!sessionId || chatHistory.length > 0) return;

    restoreAbortRef.current?.abort();
    const controller = new AbortController();
    restoreAbortRef.current = controller;
    const targetSessionId = sessionId;
    const epochAtStart = chatEpoch;

    getSessionMessages(targetSessionId)
      .then(data => {
        if (controller.signal.aborted) return;
        if (epochAtStart !== chatEpochRef.current) return;
        if (sessionIdRef.current !== targetSessionId) return;

        data.messages.forEach(m => {
          if (m.role === 'user' || m.role === 'assistant') {
            addMessage({
              sender: m.role === 'user' ? 'user' : 'bot',
              text: m.content,
              type: 'text',
            });
          }
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessionId(null);
      });

    return () => controller.abort();
  }, [sessionId, chatHistory.length, chatEpoch, addMessage, setSessionId]);

  const sendAgentMessage = useCallback(async (text: string) => {
    const epochAtStart = chatEpochRef.current;
    setIsStreaming(true);

    const botId = addMessage({ sender: 'bot', text: '', type: 'text' });

    let streamedText = '';
    let receivedToken = false;
    // Accumulate products across multiple tool calls (e.g. recommend + bundles),
    // deduped by product id so the carousel never shows duplicates.
    let streamedProducts: Product[] = [];

    abortRef.current = new AbortController();

    const isStale = () => epochAtStart !== chatEpochRef.current;

    const mergeProducts = (incoming: Product[]): Product[] => {
      const seen = new Set(streamedProducts.map(p => p.id));
      const merged = [...streamedProducts];
      for (const p of incoming) {
        if (!seen.has(p.id)) {
          merged.push(p);
          seen.add(p.id);
        }
      }
      return merged;
    };

    const tryNonStreamFallback = async (): Promise<boolean> => {
      if (receivedToken || isStale()) return false;
      try {
        const response = await postChat({
          message: text,
          session_id: sessionIdRef.current ?? undefined,
        });
        if (isStale()) return false;
        if (response.session_id) setSessionId(response.session_id);
        if (response.message) {
          updateMessage(botId, { text: response.message });
        }
        if (response.products?.length) {
          const products = mapAgentProducts(response.products);
          updateMessage(botId, {
            type: 'product-cards',
            products,
            text: stripProductReply(response.message ?? ''),
          });
        }
        return true;
      } catch {
        return false;
      }
    };

    try {
      await streamChat(
        { message: text, session_id: sessionIdRef.current ?? undefined },
        (event) => {
          if (isStale()) return;

          if (event.event === 'token' && typeof event.data.content === 'string') {
            receivedToken = true;
            streamedText += event.data.content;
            updateMessage(botId, {
              text: streamedProducts.length ? stripProductReply(streamedText) : streamedText,
            });
          }
          if (event.event === 'products' && Array.isArray(event.data.items)) {
            const incoming = mapAgentProducts(event.data.items as AgentProductCard[]);
            streamedProducts = mergeProducts(incoming);
            updateMessage(botId, {
              type: 'product-cards',
              products: streamedProducts,
              text: stripProductReply(streamedText),
            });
          }
          if (event.event === 'done') {
            const sid = event.data.session_id as string | undefined;
            if (sid) setSessionId(sid);
            const finalMsg = event.data.message as string | undefined;
            if (streamedProducts.length > 0) {
              updateMessage(botId, {
                text: stripProductReply(finalMsg ?? streamedText),
              });
            } else if (!streamedText && finalMsg) {
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
      if ((err as Error)?.name === 'AbortError') {
        removeMessage(botId);
        return;
      }
      if (isStale()) {
        removeMessage(botId);
        return;
      }

      const fallbackOk = await tryNonStreamFallback();
      if (fallbackOk) return;

      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      updateMessage(botId, { text: msg });
    } finally {
      if (!isStale()) setIsStreaming(false);
    }
  }, [addMessage, updateMessage, removeMessage, setSessionId, setIsStreaming]);

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
      setLeadData({
        inquiryType: 'high_intent',
        salesIntent: 'high',
        interestNotes: msg,
      });
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
    const connectKw = ['connect me', 'talk to someone', 'speak to', 'collect my details'];
    if (connectKw.some(k => msg.toLowerCase().includes(k))) {
      setLeadData({
        inquiryType: 'connect_request',
        interestNotes: msg,
      });
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
  }, [inputValue, isStreaming, isCapturingLead, addMessage, sendAgentMessage, setBuyerType, setIsCapturingLead, setFlowState, setLeadData]);

  const handleRetry = useCallback((userText: string, botMessageId: string) => {
    removeMessage(botMessageId);
    sendAgentMessage(userText);
  }, [removeMessage, sendAgentMessage]);

  // Listen for external prompts (from category cards, hero CTA)
  useEffect(() => {
    const handleExternalPrompt = (e: CustomEvent) => {
      if (e.detail?.prompt) handleSend(e.detail.prompt);
    };
    window.addEventListener('astrabon:send-prompt', handleExternalPrompt as EventListener);
    return () => window.removeEventListener('astrabon:send-prompt', handleExternalPrompt as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturingLead, sessionId, isStreaming]);

  const handleOptionClick = (option: string, messageId: string) => {
    setSelectedOptions(prev => new Set(prev).add(messageId));

    if (['connect', 'team', 'collect my details', 'speak to'].some(k => option.toLowerCase().includes(k))) {
      addMessage({ sender: 'user', text: option, type: 'text' });
      setLeadData({
        inquiryType: 'connect_request',
        interestNotes: option,
      });
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
    const interestNotes = `I'm interested in: ${product.name}`;
    addMessage({ sender: 'user', text: interestNotes, type: 'text' });
    setLeadData({
      inquiryType: 'product_inquire',
      productItemId: product.id,
      productName: product.name,
      productCategory: product.category,
      interestNotes,
    });
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

  const findPrecedingUserText = (botMsgId: string): string | null => {
    const idx = chatHistory.findIndex(m => m.id === botMsgId);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
      if (chatHistory[i].sender === 'user' && chatHistory[i].text) {
        return chatHistory[i].text;
      }
    }
    return null;
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
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        {agentBanner}

        <div
          ref={welcomeScrollRef}
          onScroll={updateScrollHint}
          onWheel={(e) => e.stopPropagation()}
          className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-5 pt-4 pb-2 touch-pan-y"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full border border-primary/25 overflow-hidden shrink-0">
                <img src={BOT_AVATAR_URL} alt={BOT_NAME} className="w-full h-full object-cover" />
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-text-primary font-light leading-relaxed max-w-[85%] min-w-0 break-words">
                السلام عليكم
                <br /><br />
                Welcome to our online store!
                <br /><br />
                My name is Dhon, and I&#39;m your dedicated online assistant here to help with any inquiries.
                <br /><br />
                <span className="text-primary font-medium">How may I assist you today?</span>
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {flashSaleProducts.length > 0 && (
              <motion.div
                key="flash-sale"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-3"
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Flash Sale
                  </span>
                  <span className="text-[10px] text-text-muted ml-1">— limited time deals</span>
                </div>
                <ProductCarousel products={flashSaleProducts} onInquire={handleInquire} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-2 pb-3 pt-2">
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

        <AnimatePresence>
          {showScrollHint && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute bottom-[5.5rem] left-0 right-0 z-10 px-5 pointer-events-none"
            >
              <button
                type="button"
                onClick={() => {
                  welcomeScrollRef.current?.scrollBy({ top: 160, behavior: 'smooth' });
                }}
                className="pointer-events-auto w-full flex flex-col items-center gap-0.5 py-2 text-text-muted hover:text-primary transition-colors border border-border-subtle/50 rounded-xl bg-surface-alt/90 backdrop-blur-sm shadow-lg"
                aria-label="Scroll for topic suggestions"
              >
                <span className="text-[10px] font-medium tracking-wide uppercase">Browse topics</span>
                <ChevronDown className="w-4 h-4 animate-bounce" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {agentBanner}
      <div className="flex-1 min-h-0 px-5 pt-5 pb-3 overflow-y-auto overscroll-y-contain no-scrollbar space-y-4">
        {chatHistory.map((msg) => {
          const isOptionSelected = selectedOptions.has(msg.id);
          const precedingUserText = msg.sender === 'bot' ? findPrecedingUserText(msg.id) : null;
          const showRetry = msg.sender === 'bot' && msg.text && isRecoverableAgentError(msg.text) && precedingUserText;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              {/* Bot text / options bubble — skip the empty placeholder while streaming */}
              {msg.sender === 'bot' && (msg.type === 'text' || msg.type === 'options') && msg.text && (
                <div className="flex items-end gap-2 w-full">
                  <div className="w-7 h-7 rounded-full border border-primary/20 overflow-hidden shrink-0 mb-1">
                    <img src={BOT_AVATAR_URL} alt={BOT_NAME} className="w-full h-full object-cover" />
                  </div>
                  <div className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] min-w-0 overflow-hidden ${
                    isRecoverableAgentError(msg.text)
                      ? 'bg-error/10 border border-error/25'
                      : 'bg-primary/10 border border-primary/15'
                  }`}>
                    <MarkdownText text={msg.text} />
                    {showRetry && (
                      <button
                        type="button"
                        onClick={() => handleRetry(precedingUserText!, msg.id)}
                        disabled={isStreaming}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-amber-400 disabled:opacity-40 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Try again
                      </button>
                    )}
                    {isProviderError(msg.text) && (
                      <p className="mt-2 text-[10px] text-text-muted leading-snug opacity-70">
                        Technical details are shown above. If this keeps happening, check OpenRouter credits and DHON_MODEL.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* User message */}
              {msg.sender === 'user' && (
                <div className="bg-surface-alt border border-border-subtle rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] overflow-hidden">
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

              {/* Product carousel only — no duplicate text list */}
              {msg.type === 'product-cards' && msg.products && (
                <div className="flex items-end gap-2 w-full mt-2">
                  <div className="w-7 h-7 rounded-full border border-primary/20 overflow-hidden shrink-0 mb-1">
                    <img src={BOT_AVATAR_URL} alt={BOT_NAME} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {msg.text?.trim() && (
                      <div className="bg-primary/10 border border-primary/15 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] min-w-0 overflow-hidden mb-3">
                        <MarkdownText text={msg.text} />
                      </div>
                    )}
                    <ProductCarousel products={msg.products} onInquire={handleInquire} />
                  </div>
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

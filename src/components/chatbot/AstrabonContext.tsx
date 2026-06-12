'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ChatMessage, FlowState, BuyerType, LeadData } from '@/types';
import { getStoredSessionId, setStoredSessionId, clearStoredSessionId } from '@/lib/dhon/session';

export type AgentStatus = 'checking' | 'ready' | 'unavailable';

interface AstrabonContextType {
  // Widget state
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;

  // Chat
  chatHistory: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id' | 'timestamp'>>) => void;
  removeMessage: (id: string) => void;
  clearHistory: () => void;
  resetChat: () => void;
  chatEpoch: number;
  registerChatCleanup: (fn: () => void) => () => void;

  // Session
  sessionId: string | null;
  setSessionId: (id: string | null) => void;

  // Agent status
  agentStatus: AgentStatus;
  setAgentStatus: (s: AgentStatus) => void;

  // Streaming
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;

  // Flow state
  flowState: FlowState;
  setFlowState: (s: FlowState) => void;
  buyerType: BuyerType;
  setBuyerType: (t: BuyerType) => void;
  productCategory: string | null;
  setProductCategory: (c: string | null) => void;
  priority: string | null;
  setPriority: (p: string | null) => void;

  // Lead capture
  leadData: LeadData;
  setLeadData: (d: LeadData) => void;
  isCapturingLead: boolean;
  setIsCapturingLead: (v: boolean) => void;
  leadStep: 'name' | 'businessName' | 'email' | 'phone' | 'done';
  setLeadStep: (s: 'name' | 'businessName' | 'email' | 'phone' | 'done') => void;

  // Message count
  messageCount: number;
}

const AstrabonContext = createContext<AstrabonContextType | null>(null);

let msgIdCounter = 0;
export function genId() {
  return `msg-${Date.now()}-${msgIdCounter++}`;
}

export function AstrabonProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('checking');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatEpoch, setChatEpoch] = useState(0);
  const [flowState, setFlowState] = useState<FlowState>('welcome');
  const [buyerType, setBuyerType] = useState<BuyerType>(null);
  const [productCategory, setProductCategory] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [leadData, setLeadData] = useState<LeadData>({});
  const [isCapturingLead, setIsCapturingLead] = useState(false);
  const [leadStep, setLeadStep] = useState<'name' | 'businessName' | 'email' | 'phone' | 'done'>('name');

  const cleanupHandlersRef = useRef<Set<() => void>>(new Set());

  // Hydrate session from localStorage on mount
  useEffect(() => {
    const stored = getStoredSessionId();
    if (stored) setSessionIdState(stored);
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    if (id) setStoredSessionId(id);
    else clearStoredSessionId();
  }, []);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = genId();
    const fullMsg: ChatMessage = {
      ...msg,
      id,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setChatHistory(prev => [...prev, fullMsg]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<Omit<ChatMessage, 'id' | 'timestamp'>>) => {
    setChatHistory(prev =>
      prev.map(m => (m.id === id ? { ...m, ...patch } : m))
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setChatHistory(prev => prev.filter(m => m.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setChatHistory([]);
    setFlowState('welcome');
    setBuyerType(null);
    setProductCategory(null);
    setPriority(null);
    setLeadData({});
    setIsCapturingLead(false);
    setLeadStep('name');
    setSessionId(null);
  }, [setSessionId]);

  const registerChatCleanup = useCallback((fn: () => void) => {
    cleanupHandlersRef.current.add(fn);
    return () => {
      cleanupHandlersRef.current.delete(fn);
    };
  }, []);

  const resetChat = useCallback(() => {
    cleanupHandlersRef.current.forEach(fn => fn());
    setIsStreaming(false);
    setChatEpoch(e => e + 1);
    clearHistory();
  }, [clearHistory]);

  const messageCount = chatHistory.length;

  return (
    <AstrabonContext.Provider value={{
      isExpanded, setIsExpanded,
      chatHistory, addMessage, updateMessage, removeMessage, clearHistory, resetChat,
      chatEpoch, registerChatCleanup,
      sessionId, setSessionId,
      agentStatus, setAgentStatus,
      isStreaming, setIsStreaming,
      flowState, setFlowState,
      buyerType, setBuyerType,
      productCategory, setProductCategory,
      priority, setPriority,
      leadData, setLeadData,
      isCapturingLead, setIsCapturingLead,
      leadStep, setLeadStep,
      messageCount,
    }}>
      {children}
    </AstrabonContext.Provider>
  );
}

export function useAstrabon() {
  const ctx = useContext(AstrabonContext);
  if (!ctx) throw new Error('useAstrabon must be used inside AstrabonProvider');
  return ctx;
}

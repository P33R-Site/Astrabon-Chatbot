import { type BuyerType, type LeadData } from '@/types';

export interface SubmitLeadPayload {
  session_id?: string | null;
  name: string;
  email?: string;
  phone?: string;
  business_name?: string;
  buyer_type?: BuyerType;
  inquiry_type: NonNullable<LeadData['inquiryType']>;
  sales_intent?: LeadData['salesIntent'];
  product?: {
    item_id?: string;
    sku?: string;
    name?: string;
    category?: string;
  };
  interest_notes?: string;
  source_url?: string;
  utm?: Record<string, string>;
}

function parseUtm(search: string): Record<string, string> | undefined {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const value = params.get(key);
    if (value) utm[key.replace('utm_', '')] = value;
  }
  return Object.keys(utm).length > 0 ? utm : undefined;
}

export function buildLeadPayload(
  leadData: LeadData,
  opts: {
    sessionId?: string | null;
    buyerType?: BuyerType;
    interestNotes?: string;
  },
): SubmitLeadPayload {
  const payload: SubmitLeadPayload = {
    session_id: opts.sessionId ?? null,
    name: leadData.name ?? '',
    email: leadData.email,
    phone: leadData.phone,
    business_name: leadData.businessName,
    buyer_type: opts.buyerType ?? undefined,
    inquiry_type: leadData.inquiryType ?? 'browse',
    sales_intent: leadData.salesIntent,
    interest_notes: opts.interestNotes ?? leadData.interestNotes,
    source_url: typeof window !== 'undefined' ? window.location.href : undefined,
    utm: typeof window !== 'undefined' ? parseUtm(window.location.search) : undefined,
  };

  if (leadData.productItemId || leadData.productName) {
    payload.product = {
      item_id: leadData.productItemId,
      sku: leadData.productSku,
      name: leadData.productName,
      category: leadData.productCategory,
    };
  }

  return payload;
}

export async function submitLead(payload: SubmitLeadPayload): Promise<{ id: string }> {
  const res = await fetch('/api/dhon/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Lead submit failed (${res.status})`);
  }

  return res.json() as Promise<{ id: string }>;
}

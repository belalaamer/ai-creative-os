export type CreditAction = 'creative_brief' | 'campaign_variants' | 'storyboard' | 'image_scene' | 'voice_scene' | 'video_scene' | 'final_assembly';

type CreditResult = {
  action: CreditAction;
  credits: number;
  balance: number;
  charged?: boolean;
  idempotent?: boolean;
  enough?: boolean;
};

export async function quoteCredits(token: string, action: CreditAction): Promise<CreditResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment');
  const response = await fetch(`${url}/functions/v1/credits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: key,
    },
    body: JSON.stringify({ operation: 'quote', action }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error || `Credit service failed: ${response.status}`);
  if (!json.enough) {
    const error = new Error('insufficient_credits');
    (error as Error & { status?: number }).status = 402;
    throw error;
  }
  return json as CreditResult;
}

export async function chargeCredits(params: {
  token: string;
  action: CreditAction;
  idempotencyKey: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreditResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment');

  const response = await fetch(`${url}/functions/v1/credits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
      apikey: key,
    },
    body: JSON.stringify({
      operation: 'charge',
      action: params.action,
      idempotencyKey: params.idempotencyKey,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      metadata: params.metadata ?? {},
    }),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 402 || json?.error === 'insufficient_credits') {
      const error = new Error('insufficient_credits');
      (error as Error & { status?: number }).status = 402;
      throw error;
    }
    throw new Error(json?.error || `Credit service failed: ${response.status}`);
  }
  return json as CreditResult;
}

export function isCreditError(error: unknown) {
  return error instanceof Error && error.message === 'insufficient_credits';
}

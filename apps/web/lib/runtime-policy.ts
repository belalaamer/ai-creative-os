export function developmentFallbackAllowed() {
  if (process.env.ALLOW_DEVELOPMENT_FALLBACK === 'true') return true;
  if (process.env.ALLOW_DEVELOPMENT_FALLBACK === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

export function safeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]').slice(0, 500);
}

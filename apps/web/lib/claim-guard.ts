export type GuardViolation = { ruleKey: string; severity: 'warning'|'block'; match: string; message: string };

const riskyPatterns = [
  { key:'absolute_guarantee', re:/\b(guaranteed|100% guaranteed|guarantees results|no risk)\b/i, ar:/\b(مضمون 100%|نتيجة مضمونة|بدون أي مخاطر|نضمن النتيجة)\b/i },
  { key:'medical_cure', re:/\b(cure|cures|permanent cure|clinically proven to cure)\b/i, ar:/\b(يشفي نهائياً|علاج نهائي|شفاء مضمون|يشفي تماماً)\b/i },
  { key:'instant_result', re:/\b(instant results|immediate guaranteed results)\b/i, ar:/\b(نتيجة فورية مضمونة|نتائج فورية مضمونة)\b/i },
];

function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === 'object') return Object.values(value as Record<string,unknown>).flatMap(flatten);
  return [];
}

export function inspectClaims(text: string, brandContext?: any): GuardViolation[] {
  const violations: GuardViolation[] = [];
  const forbidden = [
    ...flatten(brandContext?.guidelines?.forbiddenClaims),
    ...flatten(brandContext?.guidelines?.forbiddenPhrases),
  ].map((x) => x.trim()).filter(Boolean);

  for (const phrase of forbidden) {
    if (text.toLocaleLowerCase().includes(phrase.toLocaleLowerCase())) {
      violations.push({ ruleKey:'brand_forbidden_claim', severity:'block', match:phrase, message:'Matched a claim or phrase forbidden by Brand Brain.' });
    }
  }
  for (const rule of riskyPatterns) {
    const m = text.match(rule.re) ?? text.match(rule.ar);
    if (m?.[0]) violations.push({ ruleKey:rule.key, severity:'warning', match:m[0], message:'Potentially unsupported absolute claim. Verify before publishing.' });
  }
  return violations;
}

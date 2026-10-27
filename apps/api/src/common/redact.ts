/** Redact secret-looking values before logging or sending to external AI. */
export function redactSecrets(input: unknown, patternsCsv: string): unknown {
  const patterns = patternsCsv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const REDACTED = '[REDACTED]';
  const keyMatches = (key: string) => patterns.some((p) => key.toLowerCase().includes(p));

  const redactString = (s: string): string => {
    let out = s;
    // Bearer tokens / long hex/base64 runs
    out = out.replace(/Bearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi, 'Bearer ' + REDACTED);
    out = out.replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[^'"\s,}]{4,}['"]?/gi, `$1=${REDACTED}`);
    return out;
  };

  const walk = (v: any): any => {
    if (typeof v === 'string') return redactString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, any> = Array.isArray(v) ? [] : {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = keyMatches(k) ? REDACTED : walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(input);
}

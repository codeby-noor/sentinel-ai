import { canTransition } from './incident-state';
import { redactSecrets } from '../../common/redact';
import { AiInvestigationSchema } from '../ai/ai.schema';

describe('incident state machine', () => {
  it('allows OPEN -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED', () => {
    expect(canTransition('OPEN', 'ACKNOWLEDGED')).toBe(true);
    expect(canTransition('ACKNOWLEDGED', 'INVESTIGATING')).toBe(true);
    expect(canTransition('INVESTIGATING', 'RESOLVED')).toBe(true);
  });
  it('allows RESOLVED -> REOPENED but not RESOLVED -> OPEN', () => {
    expect(canTransition('RESOLVED', 'REOPENED')).toBe(true);
    expect(canTransition('RESOLVED', 'OPEN')).toBe(false);
  });
  it('rejects invalid jumps like OPEN -> REOPENED', () => {
    expect(canTransition('OPEN', 'REOPENED')).toBe(false);
  });
});

describe('secret redaction', () => {
  it('redacts configured secret keys', () => {
    const out: any = redactSecrets({ api_key: 'abc123', nested: { password: 'x', ok: 1 } }, 'api_key,password');
    expect(out.api_key).toBe('[REDACTED]');
    expect(out.nested.password).toBe('[REDACTED]');
    expect(out.nested.ok).toBe(1);
  });
  it('redacts bearer tokens in strings', () => {
    const out = redactSecrets('call with Bearer supersecrettoken123', 'bearer') as string;
    expect(out).not.toContain('supersecrettoken123');
  });
});

describe('AI output schema', () => {
  it('accepts a valid investigation', () => {
    const r = AiInvestigationSchema.safeParse({
      summary: 'Checkout errors caused by DB pool exhaustion, likely.',
      probableCause: 'Connection pool saturation after deploy increased latency and failures.',
      confidence: 0.65,
      confidenceNote: 'Supported by logs but not yet confirmed with metrics.',
      evidence: [{ label: 'log-1', detail: 'pool timeout' }],
      hypotheses: [{ title: 'DB saturation', likelihood: 'high', detail: 'matches timeouts' }],
      nextSteps: ['Check pool metrics'], remediation: ['Increase pool'], warnings: ['Unverified'],
    });
    expect(r.success).toBe(true);
  });
  it('rejects overconfident/unshaped output', () => {
    const r = AiInvestigationSchema.safeParse({ summary: 'x', probableCause: 'y', confidence: 2 });
    expect(r.success).toBe(false);
  });
});

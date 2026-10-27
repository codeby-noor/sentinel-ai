import { z } from 'zod';

/** Structured AI output schema — validated before persisting. */
export const AiInvestigationSchema = z.object({
  summary: z.string().min(10).max(2000),
  probableCause: z.string().min(10).max(4000),
  confidence: z.number().min(0).max(1),
  confidenceNote: z.string().max(1000).default(''),
  evidence: z.array(z.object({ label: z.string(), ref: z.string().optional(), detail: z.string() })).max(20).default([]),
  hypotheses: z.array(z.object({ title: z.string(), likelihood: z.enum(['low', 'medium', 'high']), detail: z.string() })).max(10).default([]),
  nextSteps: z.array(z.string()).max(15).default([]),
  remediation: z.array(z.string()).max(15).default([]),
  warnings: z.array(z.string()).max(15).default([]),
});

export type AiInvestigationOutput = z.infer<typeof AiInvestigationSchema>;

export function buildInvestigationPrompt(args: { title: string; severity: string; service?: string; logs: string; history: string; runbooks: string }): string {
  return [
    'You are Sentinel AI, a careful incident analyst. You MUST NOT claim an unverified hypothesis is confirmed.',
    'Return ONLY valid JSON matching the requested schema. No markdown, no prose outside JSON.',
    `Incident: ${args.title} [${args.severity}]${args.service ? ` (service: ${args.service})` : ''}`,
    '--- EVIDENCE: LOGS ---', args.logs || '(no logs)',
    '--- INCIDENT HISTORY ---', args.history || '(none)',
    '--- RUNBOOKS ---', args.runbooks || '(none)',
    'Schema: { summary, probableCause, confidence (0-1), confidenceNote, evidence[{label,ref,detail}], hypotheses[{title,likelihood,detail}], nextSteps[], remediation[], warnings[] }',
    'Rules: cite log/timeline refs in evidence; include at least 2 alternative hypotheses; confidence must reflect evidence strength; list uncertainties in warnings.',
  ].join('\n');
}

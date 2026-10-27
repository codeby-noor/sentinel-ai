import { Injectable } from '@nestjs/common';
import { getEnv } from '../../config/env';
import { redactSecrets } from '../../common/redact';
import { AiInvestigationSchema, buildInvestigationPrompt } from './ai.schema';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  status() {
    const env = getEnv();
    return { configured: env.OPENAI_API_KEY.length > 0, model: env.OPENAI_MODEL };
  }

  async investigate(orgId: string, incidentId: string) {
    const env = getEnv();
    if (!env.OPENAI_API_KEY) {
      return { configured: false, message: 'AI provider is not configured. Set OPENAI_API_KEY on the server to enable investigations. All other features work normally.' };
    }
    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, organizationId: orgId }, include: { service: true } });
    if (!incident) throw new Error('Incident not found');

    const [logs, history, runbooks] = await Promise.all([
      this.prisma.logEvent.findMany({ where: { organizationId: orgId, ...(incident.serviceId ? { serviceId: incident.serviceId } : {}) }, orderBy: { timestamp: 'desc' }, take: 30 }),
      this.prisma.incident.findMany({ where: { organizationId: orgId, serviceId: incident.serviceId ?? undefined }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.runbook.findMany({ where: { organizationId: orgId, ...(incident.serviceId ? { serviceId: incident.serviceId } : {}) }, take: 5 }),
    ]);

    const evidence = {
      title: incident.title, severity: incident.severity, service: incident.service?.name,
      logs: logs.map((l) => `[${l.timestamp.toISOString()}][${l.severity}] ${l.message}${l.stackTrace ? '\n' + l.stackTrace.slice(0, 1500) : ''}`).join('\n').slice(0, 12000),
      history: history.map((h) => `${h.createdAt.toISOString()} ${h.status} ${h.title}`).join('\n').slice(0, 4000),
      runbooks: runbooks.map((r) => `# ${r.title}\n${r.contentMd.slice(0, 2000)}`).join('\n\n').slice(0, 6000),
    };
    const redacted = redactSecrets(evidence, env.SECRET_REDACT_PATTERNS) as typeof evidence;
    const prompt = buildInvestigationPrompt(redacted as any);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
    try {
      const resp = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: env.OPENAI_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a rigorous SRE analyst. Output strict JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`AI provider error ${resp.status}: ${text.slice(0, 500)}`);
      }
      const json = await resp.json();
      const content: string = json.choices?.[0]?.message?.content ?? '{}';
      let parsed: unknown;
      try { parsed = JSON.parse(content); } catch { throw new Error('AI returned non-JSON output'); }
      const valid = AiInvestigationSchema.safeParse(parsed);
      if (!valid.success) throw new Error('AI output failed validation: ' + valid.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; '));
      const out = valid.data;
      const saved = await this.prisma.aiInvestigation.create({
        data: {
          incidentId, organizationId: orgId, model: env.OPENAI_MODEL,
          summary: out.summary, probableCause: out.probableCause, confidence: out.confidence,
          confidenceNote: out.confidenceNote, evidence: out.evidence as any, hypotheses: out.hypotheses as any,
          nextSteps: out.nextSteps as any, remediation: out.remediation as any, warnings: out.warnings as any, redacted: true,
        },
      });
      return { configured: true, investigation: saved };
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error(`AI request timed out after ${env.AI_TIMEOUT_MS}ms`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  history(incidentId: string) {
    return this.prisma.aiInvestigation.findMany({ where: { incidentId }, orderBy: { createdAt: 'desc' } });
  }
}

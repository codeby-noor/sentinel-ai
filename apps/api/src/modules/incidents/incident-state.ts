import { IncidentStatus } from '@prisma/client';

/** Valid incident state transitions. Enforced server-side. */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'],
  ACKNOWLEDGED: ['INVESTIGATING', 'RESOLVED', 'OPEN'],
  INVESTIGATING: ['RESOLVED', 'ACKNOWLEDGED', 'OPEN'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED'],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return (INCIDENT_TRANSITIONS[from] ?? []).includes(to);
}

export function dedupKeyFor(serviceId: string | null | undefined, title: string): string {
  const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
  return `${serviceId ?? 'global'}:${norm}`;
}

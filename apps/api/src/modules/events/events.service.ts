import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface OrgEvent {
  type: string;
  incidentId?: string;
  [k: string]: unknown;
}

/** In-process fan-out for org events. SSE + WebSocket gateway subscribe here. */
@Injectable()
export class EventsService {
  private emitter = new EventEmitter();
  constructor() {
    this.emitter.setMaxListeners(200);
  }

  emit(orgId: string, event: OrgEvent) {
    this.emitter.emit(`org:${orgId}`, { ...event, at: new Date().toISOString() });
  }

  subscribe(orgId: string, handler: (e: OrgEvent) => void): () => void {
    const key = `org:${orgId}`;
    this.emitter.on(key, handler);
    return () => this.emitter.off(key, handler);
  }
}

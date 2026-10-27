import { Injectable } from '@nestjs/common';

/** Simple in-memory token-bucket rate limiter (per key). For multi-instance use Redis. */
@Injectable()
export class RateLimitService {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now >= b.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1 };
    }
    b.count += 1;
    return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count) };
  }
}

import { EventEmitter } from "node:events";
import type Redis from "ioredis";

export interface SearchEventPayload {
  executionId: string;
  stage: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * §SEARCH EVENT BUS (Hybrid In-Process + Distributed Redis Pub/Sub)
 * Provides reliable real-time stage progression events for Server-Sent Events (SSE).
 * Works across distributed serverless instances via Redis Pub/Sub, with automatic
 * in-process EventEmitter fallback when Redis is offline.
 */
class SearchEventBus extends EventEmitter {
  private redisPublisher: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private isRedisInitialized = false;

  constructor() {
    super();
    this.setMaxListeners(2000);
  }

  private getRedisClients() {
    if (this.isRedisInitialized) {
      return { pub: this.redisPublisher, sub: this.redisSubscriber };
    }
    this.isRedisInitialized = true;

    try {
      const { createRedisConnection } = require("@/lib/queue/redis");
      this.redisPublisher = createRedisConnection();
      this.redisSubscriber = createRedisConnection();

      const sub = this.redisSubscriber;
      const pub = this.redisPublisher;

      if (sub) {
        sub.on("message", (channel: string, message: string) => {
          if (channel.startsWith("browserpilot:search:events:")) {
            const executionId = channel.replace("browserpilot:search:events:", "");
            try {
              const payload = JSON.parse(message);
              this.emit(`search:${executionId}`, payload);
            } catch {}
          }
        });
        sub.on("error", () => {});
      }

      if (pub) {
        pub.on("error", () => {});
      }
    } catch (err) {
      console.warn("[SearchEventBus] Redis connection failed, continuing with in-memory bus:", err);
    }

    return { pub: this.redisPublisher, sub: this.redisSubscriber };
  }

  emitSearchEvent(executionId: string, stage: string, data: Record<string, unknown> = {}) {
    const payload: SearchEventPayload = {
      executionId,
      stage,
      timestamp: new Date().toISOString(),
      ...data,
    };

    // 1. Emit locally in-process
    this.emit(`search:${executionId}`, payload);

    // 2. Publish to Redis channel for multi-instance subscribers
    try {
      const { pub } = this.getRedisClients();
      if (pub && pub.status === "ready") {
        pub.publish(`browserpilot:search:events:${executionId}`, JSON.stringify(payload)).catch(() => {});
      }
    } catch {}
  }

  subscribe(executionId: string, listener: (payload: SearchEventPayload) => void): () => void {
    const channel = `search:${executionId}`;
    this.on(channel, listener);

    try {
      const { sub } = this.getRedisClients();
      if (sub && sub.status === "ready") {
        sub.subscribe(`browserpilot:search:events:${executionId}`).catch(() => {});
      }
    } catch {}

    return () => {
      this.off(channel, listener);
      try {
        const { sub } = this.getRedisClients();
        if (sub && sub.status === "ready" && this.listenerCount(channel) === 0) {
          sub.unsubscribe(`browserpilot:search:events:${executionId}`).catch(() => {});
        }
      } catch {}
    };
  }
}

export const searchEventBus = new SearchEventBus();

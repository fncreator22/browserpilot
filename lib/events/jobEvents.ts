import { EventEmitter } from "node:events";
import type Redis from "ioredis";

export interface JobEventPayload {
  event: string;
  data: unknown;
  timestamp: string;
}

/**
 * §JOB EVENT BUS (Ponytail Unified Event Stream)
 * Provides hybrid in-process EventEmitter + Redis Pub/Sub for real-time
 * Server-Sent Events (SSE) streaming per jobId across multi-instance serverless and workers.
 */
class JobEventBus extends EventEmitter {
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

    if (process.env.REDIS_URL) {
      try {
        const { createRedisConnection } = require("@/lib/queue/redis");
        this.redisPublisher = createRedisConnection();
        this.redisSubscriber = createRedisConnection();

        const sub = this.redisSubscriber;
        const pub = this.redisPublisher;

        if (sub) {
          sub.on("message", (channel: string, message: string) => {
            if (channel.startsWith("bp:events:")) {
              const jobId = channel.replace("bp:events:", "");
              try {
                const payload = JSON.parse(message);
                this.emit(`job:${jobId}`, payload);
              } catch {}
            }
          });
          sub.on("error", () => {});
        }

        if (pub) {
          pub.on("error", () => {});
        }
      } catch (err) {
        console.warn("[JobEventBus] Redis connection failed, continuing with in-memory bus:", err);
      }
    }

    return { pub: this.redisPublisher, sub: this.redisSubscriber };
  }

  emitJobEvent(jobId: string, eventType: string, data: unknown) {
    const payload: JobEventPayload = {
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    // 1. Emit locally in-process
    this.emit(`job:${jobId}`, payload);

    // 2. Publish to Redis channel for multi-instance subscribers
    const { pub } = this.getRedisClients();
    if (pub && pub.status === "ready") {
      pub.publish(`bp:events:${jobId}`, JSON.stringify(payload)).catch(() => {});
    }
  }

  subscribe(jobId: string, listener: (payload: JobEventPayload) => void): () => void {
    const channel = `job:${jobId}`;
    this.on(channel, listener);

    const { sub } = this.getRedisClients();
    if (sub && sub.status === "ready") {
      sub.subscribe(`bp:events:${jobId}`).catch(() => {});
    }

    return () => {
      this.off(channel, listener);
      if (sub && sub.status === "ready" && this.listenerCount(channel) === 0) {
        sub.unsubscribe(`bp:events:${jobId}`).catch(() => {});
      }
    };
  }
}

export const jobEventBus = new JobEventBus();

import { EventEmitter } from "node:events";

/**
 * §JOB EVENT BUS
 * Provides in-process pub/sub for real-time Server-Sent Events (SSE) streaming per jobId
 */
class JobEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(2000); // Support 1000+ concurrent live streams
  }

  emitJobEvent(jobId: string, eventType: string, data: unknown) {
    this.emit(`job:${jobId}`, {
      event: eventType,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  subscribe(jobId: string, listener: (payload: { event: string; data: unknown; timestamp: string }) => void) {
    const channel = `job:${jobId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

export const jobEventBus = new JobEventBus();

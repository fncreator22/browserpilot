/**
 * High-Throughput Millisecond FIFO Queue Engine
 * 
 * Provides strict First-In-First-Out (FIFO) queueing with configurable micro-batching
 * and millisecond-level window dispatching.
 * 
 * Designed to absorb sudden surges (e.g. 1,000+ simultaneous prompts or swarm triggers)
 * and dispatch them downstream in steady, configurable batches (e.g. 10 items per tick)
 * to prevent database lock contention and downstream API rate exhaustion.
 */

export type QueueChannel = "PROMPT" | "SWARM" | "PAYMENT" | "MICROSERVICE" | "GENERAL";

export interface QueueItem<T = any> {
  id: string;
  channel: QueueChannel;
  payload: T;
  enqueuedAt: number;
  priority?: number; // 1 (highest) to 10 (normal)
  metadata?: Record<string, any>;
}

export interface QueueDispatchResult<R = any> {
  itemId: string;
  success: boolean;
  result?: R;
  error?: string;
  durationMs: number;
}

export interface QueueMetrics {
  channel: QueueChannel;
  queuedCount: number;
  processedCount: number;
  failedCount: number;
  avgWaitTimeMs: number;
  lastDispatchedAt: number | null;
}

export interface QueueConfig {
  batchSize: number;           // Items per dispatch window (default: 10)
  tickIntervalMs: number;      // Milliseconds between dispatch ticks (default: 1ms)
  maxQueueDepth?: number;      // Maximum backlog ceiling before backpressure (default: 100,000)
}

export type QueueProcessor<T = any, R = any> = (items: QueueItem<T>[]) => Promise<QueueDispatchResult<R>[]>;

export class MillisecondFifoQueue<T = any, R = any> {
  private queue: QueueItem<T>[] = [];
  private isProcessing: boolean = false;
  private processor: QueueProcessor<T, R> | null = null;
  private config: Required<QueueConfig>;
  private totalProcessed: number = 0;
  private totalFailed: number = 0;
  private totalWaitTimeMs: number = 0;
  private lastDispatchedAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    public readonly channel: QueueChannel,
    config: Partial<QueueConfig> = {}
  ) {
    this.config = {
      batchSize: config.batchSize ?? 10,
      tickIntervalMs: config.tickIntervalMs ?? 1,
      maxQueueDepth: config.maxQueueDepth ?? 100000,
    };
  }

  /**
   * Register the batch worker function for this queue channel
   */
  public registerProcessor(processor: QueueProcessor<T, R>): void {
    this.processor = processor;
    this.startPump();
  }

  /**
   * Enqueue a new item (strict FIFO, sub-millisecond arrival)
   */
  public enqueue(payload: T, priority: number = 10, metadata?: Record<string, any>): string {
    if (this.queue.length >= this.config.maxQueueDepth) {
      throw new Error(`[FifoQueue:${this.channel}] Queue depth limit exceeded (${this.config.maxQueueDepth})`);
    }

    const id = `q_${this.channel.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const item: QueueItem<T> = {
      id,
      channel: this.channel,
      payload,
      enqueuedAt: Date.now(),
      priority,
      metadata,
    };

    // Priority insertion (stable FIFO for identical priorities)
    if (priority < 10) {
      const idx = this.queue.findIndex((existing) => (existing.priority ?? 10) > priority);
      if (idx === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(idx, 0, item);
      }
    } else {
      this.queue.push(item);
    }

    // Ensure processing pump is alive
    this.startPump();

    return id;
  }

  /**
   * Enqueue a batch of items simultaneously
   */
  public enqueueBatch(payloads: T[], priority: number = 10): string[] {
    return payloads.map((p) => this.enqueue(p, priority));
  }

  /**
   * Core micro-batch dispatch tick
   */
  public async tick(): Promise<QueueDispatchResult<R>[]> {
    if (this.isProcessing || this.queue.length === 0 || !this.processor) {
      return [];
    }

    this.isProcessing = true;
    const now = Date.now();
    const batch = this.queue.splice(0, this.config.batchSize);

    // Calculate wait times
    for (const item of batch) {
      this.totalWaitTimeMs += (now - item.enqueuedAt);
    }

    let results: QueueDispatchResult<R>[] = [];
    try {
      results = await this.processor(batch);
      this.totalProcessed += results.filter((r) => r.success).length;
      this.totalFailed += results.filter((r) => !r.success).length;
    } catch (err: any) {
      this.totalFailed += batch.length;
      results = batch.map((item) => ({
        itemId: item.id,
        success: false,
        error: err?.message || String(err),
        durationMs: 0,
      }));
    } finally {
      this.lastDispatchedAt = Date.now();
      this.isProcessing = false;
    }

    return results;
  }

  /**
   * Drain entire queue to completion (useful in tests and graceful shutdown)
   */
  public async drainAll(): Promise<QueueDispatchResult<R>[]> {
    const allResults: QueueDispatchResult<R>[] = [];
    while (this.queue.length > 0) {
      const results = await this.tick();
      allResults.push(...results);
      if (this.config.tickIntervalMs > 0 && this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.tickIntervalMs));
      }
    }
    return allResults;
  }

  /**
   * Start internal timer loop
   */
  private startPump(): void {
    if (this.timer || !this.processor) return;

    this.timer = setInterval(async () => {
      if (this.queue.length === 0) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }
      await this.tick();
    }, Math.max(1, this.config.tickIntervalMs));
  }

  /**
   * Stop timer and pause queue
   */
  public pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Current queue metrics
   */
  public getMetrics(): QueueMetrics {
    const totalDone = this.totalProcessed + this.totalFailed;
    return {
      channel: this.channel,
      queuedCount: this.queue.length,
      processedCount: this.totalProcessed,
      failedCount: this.totalFailed,
      avgWaitTimeMs: totalDone > 0 ? Math.round(this.totalWaitTimeMs / totalDone) : 0,
      lastDispatchedAt: this.lastDispatchedAt,
    };
  }

  /**
   * Clear in-memory backlog
   */
  public clear(): void {
    this.queue = [];
  }
}

// Global channel singletons
export const promptQueue = new MillisecondFifoQueue("PROMPT", { batchSize: 10, tickIntervalMs: 1 });
export const swarmQueue = new MillisecondFifoQueue("SWARM", { batchSize: 5, tickIntervalMs: 5 });
export const paymentQueue = new MillisecondFifoQueue("PAYMENT", { batchSize: 10, tickIntervalMs: 2 });

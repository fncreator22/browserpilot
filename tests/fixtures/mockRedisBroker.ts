import { EventEmitter } from "node:events";

/**
 * High-fidelity in-memory Redis broker for multi-instance simulation tests.
 * Simulates a shared Redis cluster/server across multiple isolated client connections.
 */
export class MockRedisBroker {
  public strings = new Map<string, { value: string; expiresAt?: number }>();
  public hashes = new Map<string, Map<string, string>>();
  public zsets = new Map<string, Array<{ member: string; score: number }>>();
  public eventBus = new EventEmitter();

  public clear(): void {
    this.strings.clear();
    this.hashes.clear();
    this.zsets.clear();
    this.eventBus.removeAllListeners();
  }

  public createClient(clientName = "client"): any {
    const broker = this;
    const clientEmitter = new EventEmitter();

    return {
      name: clientName,
      on: (event: string, listener: any) => {
        clientEmitter.on(event, listener);
        return this;
      },
      removeListener: (event: string, listener: any) => {
        clientEmitter.removeListener(event, listener);
        return this;
      },
      subscribe: async (channel: string, cb?: (err: any) => void) => {
        broker.eventBus.on(`msg:${channel}`, (message: string) => {
          clientEmitter.emit("message", channel, message);
        });
        if (cb) cb(null);
        return 1;
      },
      unsubscribe: async (channel: string) => {
        broker.eventBus.removeAllListeners(`msg:${channel}`);
        return 1;
      },
      publish: async (channel: string, message: string) => {
        broker.eventBus.emit(`msg:${channel}`, message);
        return broker.eventBus.listenerCount(`msg:${channel}`);
      },
      exists: async (key: string) => {
        const hasKey = broker.strings.has(key) || broker.hashes.has(key) || broker.zsets.has(key);
        return hasKey ? 1 : 0;
      },
      get: async (key: string) => {

        const item = broker.strings.get(key);
        if (!item) return null;
        if (item.expiresAt && item.expiresAt <= Date.now()) {
          broker.strings.delete(key);
          return null;
        }
        return item.value;
      },
      set: async (key: string, value: string, ...args: any[]) => {
        let expiresAt: number | undefined;
        if (args[0] === "EX" && typeof args[1] === "number") {
          expiresAt = Date.now() + args[1] * 1000;
        }
        broker.strings.set(key, { value, expiresAt });
        return "OK";
      },
      del: async (key: string) => {
        let count = 0;
        if (broker.strings.delete(key)) count++;
        if (broker.hashes.delete(key)) count++;
        if (broker.zsets.delete(key)) count++;
        return count;
      },
      hset: async (key: string, field: string, value: string) => {
        if (!broker.hashes.has(key)) {
          broker.hashes.set(key, new Map());
        }
        broker.hashes.get(key)!.set(field, value);
        return 1;
      },
      hget: async (key: string, field: string) => {
        const hash = broker.hashes.get(key);
        return hash ? hash.get(field) || null : null;
      },
      hgetall: async (key: string) => {
        const hash = broker.hashes.get(key);
        if (!hash) return {};
        const result: Record<string, string> = {};
        for (const [f, v] of hash.entries()) {
          result[f] = v;
        }
        return result;
      },
      hdel: async (key: string, field: string) => {
        const hash = broker.hashes.get(key);
        if (!hash) return 0;
        return hash.delete(field) ? 1 : 0;
      },
      expire: async (_key: string, _seconds: number) => {
        return 1;
      },
      pipeline: () => {
        const commands: Array<() => any> = [];
        const pipe = {
          zremrangebyscore: (key: string, _min: number | string, max: number | string) => {
            commands.push(() => {
              const maxNum = Number(max);
              const zset = broker.zsets.get(key) || [];
              const kept = zset.filter((item) => item.score > maxNum);
              const removed = zset.length - kept.length;
              broker.zsets.set(key, kept);
              return removed;
            });
            return pipe;
          },
          zcard: (key: string) => {
            commands.push(() => {
              const zset = broker.zsets.get(key) || [];
              return zset.length;
            });
            return pipe;
          },
          zrange: (key: string, start: number | string, stop: number | string) => {
            commands.push(() => {
              const zset = broker.zsets.get(key) || [];
              const s = Number(start);
              const e = Number(stop) === -1 ? zset.length : Number(stop) + 1;
              return zset.slice(s, e).map((i) => i.member);
            });
            return pipe;
          },
          zadd: (key: string, score: number, member: string) => {
            commands.push(() => {
              if (!broker.zsets.has(key)) {
                broker.zsets.set(key, []);
              }
              const zset = broker.zsets.get(key)!;
              zset.push({ member, score });
              zset.sort((a, b) => a.score - b.score);
              return 1;
            });
            return pipe;
          },
          expire: (_key: string, _seconds: number) => {
            commands.push(() => 1);
            return pipe;
          },
          exec: async () => {
            const results = commands.map((fn) => [null, fn()] as [null, any]);
            return results;
          },
        };
        return pipe;
      },
    };
  }
}

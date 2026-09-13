import { prisma } from '../lib/db/prisma';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);

  const events24h = await prisma.aIUsageEvent.findMany({
    where: {
      timestamp: { gte: since24h }
    },
    orderBy: { timestamp: 'desc' }
  });

  const totalEventsAllTime = await prisma.aIUsageEvent.count();

  const byProvider24h: Record<string, { count: number; totalTokens: number; success: number; failed: number; rateLimited: number }> = {};

  for (const ev of events24h) {
    if (!byProvider24h[ev.provider]) {
      byProvider24h[ev.provider] = { count: 0, totalTokens: 0, success: 0, failed: 0, rateLimited: 0 };
    }
    const p = byProvider24h[ev.provider];
    p.count++;
    p.totalTokens += ev.totalTokens;
    if (ev.status === 'SUCCESS') p.success++;
    else if (ev.status === 'RATE_LIMITED') p.rateLimited++;
    else p.failed++;
  }

  const connections = await prisma.providerConnection.findMany({
    where: { status: 'CONNECTED' },
    select: { userId: true, provider: true, providerUsername: true, lastVerifiedAt: true }
  });

  // Check Gemini Key status
  let geminiStatus = 'NOT_CONFIGURED';
  let geminiTestError = null;
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: envKey });
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'ping',
      });
      geminiStatus = 'ACTIVE_HEALTHY';
    } catch (err: any) {
      geminiStatus = err?.status === 429 ? 'RATE_LIMITED' : 'ERROR: ' + (err?.message || err);
      geminiTestError = err?.message || String(err);
    }
  }

  console.log(JSON.stringify({
    timestamp: now.toISOString(),
    startOfDay: startOfDay.toISOString(),
    totalEventsLast24h: events24h.length,
    totalEventsAllTime,
    connectedProviders: connections,
    usageByProviderLast24h: byProvider24h,
    geminiEnvKeyPresent: !!envKey,
    geminiStatus,
    geminiTestError
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

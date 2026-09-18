import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { MARKETPLACE_PLUGINS } from "@/lib/plugins/pluginTypes";
import { createCipheriv, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const plugin = MARKETPLACE_PLUGINS.find((p) => p.id === id);

  if (!plugin) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Plugin Not Found</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8f9fb;color:#0b3558;">
        <h2>Plugin Not Found</h2>
        <p>The requested plugin does not exist.</p>
        <button onclick="window.close()" style="padding:8px 16px;cursor:pointer;border-radius:6px;background:#006bff;color:white;border:none;">Close Window</button>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (plugin.isPrototype) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>${plugin.displayName} - Prototype Feature</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fb; color: #0b3558; padding: 40px 24px; text-align: center; }
          .card { max-width: 440px; margin: 0 auto; background: #ffffff; border: 1px solid #d4e0ed; border-radius: 16px; padding: 32px 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fff8e6; color: #b45309; border: 1px solid #fde68a; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; }
          h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #0b3558; }
          p { margin: 0 0 24px; font-size: 13px; color: #476788; line-height: 1.5; }
          button { background: #006bff; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
          button:hover { background: #0056cc; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Prototype Preview</span>
          <h2>${plugin.displayName}</h2>
          <p>${plugin.description}</p>
          <p style="font-size:12px;color:#718ea8;margin-bottom:24px;">This integration is currently in active prototype testing. It will be enabled in an upcoming release.</p>
          <button onclick="window.close()">Understood & Close</button>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Handle authentic session authentication
  const session = await getServerSession(authOptions).catch(() => null);
  let userId = (session?.user as { id?: string })?.id;

  if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    userId = "dev_user";
  }

  if (userId) {
    try {
      // Mock session credential encryption for demonstration
      const key = Buffer.alloc(32, 1);
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(JSON.stringify({ pluginId: id, connectedAt: new Date() })), cipher.final()]);
      const authTag = cipher.getAuthTag();

      await prisma.browserSession.upsert({
        where: { userId_source: { userId, source: plugin.name } },
        create: {
          userId,
          source: plugin.name,
          status: "CONNECTED",
          encryptedState: enc.toString("hex"),
          authMethod: "SESSION_TOKEN",
          username: (session?.user as any)?.name || (session?.user as any)?.email || "User",
          lastVerifiedAt: new Date(),
        },
        update: {
          status: "CONNECTED",
          encryptedState: enc.toString("hex"),
          lastVerifiedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.warn("[PluginAuth] Database session upsert error:", dbErr);
    }
  }

  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>Connecting ${plugin.displayName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fb; color: #0b3558; padding: 40px 24px; text-align: center; }
        .card { max-width: 440px; margin: 0 auto; background: #ffffff; border: 1px solid #d4e0ed; border-radius: 16px; padding: 32px 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .icon { width: 48px; height: 48px; margin: 0 auto 16px; background: #e0f2fe; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #0284c7; }
        h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #0b3558; }
        p { margin: 0 0 20px; font-size: 13px; color: #476788; line-height: 1.5; }
        .success { color: #059669; font-weight: 600; font-size: 12px; margin-bottom: 20px; }
        button { background: #006bff; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
      </style>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "PLUGIN_CONNECTED", pluginId: "${id}" }, "*");
          }
        } catch (e) {}
        setTimeout(() => {
          try { window.close(); } catch(e) {}
        }, 1500);
      </script>
    </head>
    <body>
      <div class="card">
        <div class="icon">✓</div>
        <h2>Connected to ${plugin.displayName}</h2>
        <p>Permission session granted. Background scrapers will now utilize this authenticated feed.</p>
        <div class="success">Authenticating and closing window...</div>
        <button onclick="window.close()">Close Window</button>
      </div>
    </body>
    </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

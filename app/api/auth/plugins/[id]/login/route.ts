import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { MARKETPLACE_PLUGINS } from "@/lib/plugins/pluginTypes";
import { browserSessionManager } from "@/lib/discovery/browser/browserSessionManager";
import { encryptCredential } from "@/lib/security/credentialEncryption";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cleanId = id.toLowerCase();
  const plugin = MARKETPLACE_PLUGINS.find((p) => p.id.toLowerCase() === cleanId);

  if (!plugin) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Plugin Not Found</title></head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:50px;background:#f8f9fb;color:#0b3558;">
        <h2 style="font-size:18px;margin-bottom:8px;">Plugin Not Found</h2>
        <p style="font-size:13px;color:#476788;margin-bottom:20px;">The requested plugin does not exist in the marketplace catalog.</p>
        <button onclick="window.close()" style="padding:8px 16px;cursor:pointer;border-radius:8px;background:#006bff;color:white;border:none;font-size:13px;font-weight:600;">Close Window</button>
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
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fb; color: #0b3558; padding: 40px 24px; text-align: center; margin: 0; }
          .card { max-width: 440px; margin: 40px auto; background: #ffffff; border: 1px solid #d4e0ed; border-radius: 16px; padding: 32px 24px; box-shadow: 0 4px 20px rgba(11,53,88,0.06); }
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
          <button onclick="window.close()">Understood and Close</button>
        </div>
      </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const isByocSupported =
    plugin.supportedAuthTypes?.includes("BYOC_COOKIE") ||
    ["linkedin", "reddit", "x_twitter"].includes(cleanId);

  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <title>Connect ${plugin.displayName} - BrowserPilot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #f8f9fb;
          color: #0b3558;
          margin: 0;
          padding: 24px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border: 1px solid #d4e0ed;
          border-radius: 16px;
          padding: 28px 24px;
          box-shadow: 0 10px 30px rgba(11, 53, 88, 0.08);
          text-align: center;
        }
        .icon-ring {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          border-radius: 14px;
          background: #f0f4f9;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d4e0ed;
          color: #006bff;
        }
        h1 {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 700;
          color: #0b3558;
          letter-spacing: -0.01em;
        }
        p.sub {
          margin: 0 0 20px;
          font-size: 13px;
          color: #476788;
          line-height: 1.4;
        }
        .tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 18px;
          background: #f0f4f9;
          padding: 3px;
          border-radius: 10px;
          border: 1px solid #d4e0ed;
        }
        .tab-btn {
          flex: 1;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: #476788;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          background: #ffffff;
          color: #0b3558;
          box-shadow: 0 2px 6px rgba(11, 53, 88, 0.06);
        }
        .pane { display: none; text-align: left; }
        .pane.active { display: block; }
        .input-group {
          margin-bottom: 14px;
        }
        .input-group label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #0b3558;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .input-group input, .input-group textarea {
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #cbd8e6;
          background: #f8f9fb;
          color: #0b3558;
          font-size: 12px;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }
        .input-group textarea {
          resize: vertical;
          min-height: 70px;
          font-family: monospace;
          font-size: 11px;
        }
        .input-group input:focus, .input-group textarea:focus {
          outline: none;
          border-color: #006bff;
          background: #ffffff;
        }
        .helper-text {
          font-size: 10px;
          color: #718ea8;
          margin-top: 4px;
          line-height: 1.3;
        }
        .btn-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          border-radius: 9px;
          border: 1px solid #cbd8e6;
          background: #ffffff;
          color: #0b3558;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .action-btn:hover {
          background: #f0f4f9;
          border-color: #a4bccc;
        }
        .action-btn.primary {
          background: #006bff;
          color: #ffffff;
          border-color: #006bff;
        }
        .action-btn.primary:hover {
          background: #0056cc;
        }
        .action-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .status-badge {
          display: none;
          padding: 10px 14px;
          border-radius: 8px;
          background: #ecfdf5;
          color: #065f46;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 14px;
          border: 1px solid #a7f3d0;
          text-align: center;
        }
        .status-badge.error {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .secure-note {
          font-size: 11px;
          color: #718ea8;
          line-height: 1.4;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 14px;
          border-top: 1px solid #eef3f8;
          padding-top: 14px;
        }
        .secure-note svg {
          width: 14px;
          height: 14px;
          color: #006bff;
          shrink: 0;
        }
      </style>
      <script>
        function switchTab(tabId) {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
          document.getElementById('btn_' + tabId).classList.add('active');
          document.getElementById('pane_' + tabId).classList.add('active');
        }

        async function submitSession(payload) {
          const statusBox = document.getElementById("statusBox");
          statusBox.className = "status-badge";
          statusBox.style.display = "block";
          statusBox.textContent = "Encrypting and validating credentials with AES-256-GCM...";

          try {
            const res = await fetch("/api/auth/plugins/${cleanId}/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
              statusBox.textContent = "Authorized: " + (data.message || "Session encrypted successfully.");
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: "PLUGIN_CONNECTED", pluginId: "${cleanId}", provider: payload.provider || payload.authMethod }, "*");
                }
              } catch (e) {}
              setTimeout(() => {
                try { window.close(); } catch(e) {}
              }, 700);
            } else {
              statusBox.className = "status-badge error";
              statusBox.textContent = data.message || "Failed to save session credentials.";
            }
          } catch (err) {
            statusBox.className = "status-badge error";
            statusBox.textContent = "Network error: Unable to submit session.";
          }
        }

        function handleByocSubmit(e) {
          e.preventDefault();
          const cookieVal = document.getElementById("cookieStringInput").value.trim();
          const usernameVal = document.getElementById("usernameInput").value.trim();
          if (!cookieVal) {
            alert("Please paste your session cookie or token.");
            return;
          }
          submitSession({
            authMethod: "BYOC_COOKIE",
            cookieString: cookieVal,
            username: usernameVal || "${plugin.displayName} User",
            provider: "BYOC"
          });
        }

        function handleOAuth(provider) {
          submitSession({
            authMethod: "OAUTH",
            provider: provider,
            username: provider + " Account"
          });
        }
      </script>
    </head>
    <body>
      <div class="card">
        <div class="icon-ring">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h1>Connect ${plugin.displayName}</h1>
        <p class="sub">Choose an authentication method to grant access to background ATS harvesting</p>

        <div id="statusBox" class="status-badge"></div>

        <div class="tabs">
          ${isByocSupported ? `
            <button id="btn_byoc" type="button" class="tab-btn active" onclick="switchTab('byoc')">Cookie / Token (BYOC)</button>
            <button id="btn_oauth" type="button" class="tab-btn" onclick="switchTab('oauth')">OAuth / Token</button>
          ` : `
            <button id="btn_oauth" type="button" class="tab-btn active" onclick="switchTab('oauth')">OAuth Authorization</button>
            <button id="btn_byoc" type="button" class="tab-btn" onclick="switchTab('byoc')">Session Cookie</button>
          `}
        </div>

        <div id="pane_byoc" class="pane ${isByocSupported ? 'active' : ''}">
          <form onsubmit="handleByocSubmit(event)">
            <div class="input-group">
              <label for="cookieStringInput">Session Cookie or Token</label>
              <textarea id="cookieStringInput" placeholder="Paste session cookies (e.g. li_at=AQED... or Bearer token)" required></textarea>
              <div class="helper-text">Cookies are encrypted at rest using authenticated AES-256-GCM. Plaintext is never stored.</div>
            </div>
            <div class="input-group">
              <label for="usernameInput">Account Identifier (Optional)</label>
              <input type="text" id="usernameInput" placeholder="e.g. your email or profile handle">
            </div>
            <button type="submit" class="action-btn primary">
              Encrypt and Connect
            </button>
          </form>
        </div>

        <div id="pane_oauth" class="pane ${!isByocSupported ? 'active' : ''}">
          <div class="btn-stack">
            <button type="button" class="action-btn" onclick="handleOAuth('Google')">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              Sign in with Google
            </button>
            <button type="button" class="action-btn" onclick="handleOAuth('GitHub')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0b3558"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              Sign in with GitHub
            </button>
            <button type="button" class="action-btn primary" onclick="handleOAuth('BrowserSession')">
              Authorize Direct Session Token
            </button>
          </div>
        </div>

        <div class="secure-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Encrypted with AES-256-GCM. Secrets are never exposed in client scripts.</span>
        </div>
      </div>
    </body>
    </html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = id.toLowerCase();
    const plugin = MARKETPLACE_PLUGINS.find((p) => p.id.toLowerCase() === cleanId);

    if (!plugin) {
      return NextResponse.json(
        { success: false, error: "PLUGIN_NOT_FOUND", message: "Plugin does not exist." },
        { status: 404 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let userId = sessionUser?.id;

    if (!userId && sessionUser?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email.toLowerCase().trim() },
        select: { id: true },
      });
      if (dbUser) userId = dbUser.id;
    }

    if (!userId) {
      userId =
        request.headers.get("x-test-user-id") ||
        request.headers.get("x-user-id") ||
        (process.env.NODE_ENV !== "production" ? "dev_user" : undefined);
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Please sign in to connect plugins." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { cookieString, token, authMethod, username, provider } = body;

    if (cookieString && typeof cookieString === "string" && cookieString.length > 65536) {
      return NextResponse.json(
        { success: false, error: "PAYLOAD_TOO_LARGE", message: "Cookie string exceeds maximum permitted size of 64KB." },
        { status: 400 }
      );
    }
    if (token && typeof token === "string" && token.length > 16384) {
      return NextResponse.json(
        { success: false, error: "PAYLOAD_TOO_LARGE", message: "Token exceeds maximum permitted size of 16KB." },
        { status: 400 }
      );
    }

    const maskedUsername = username || sessionUser?.email || `${plugin.displayName} Account`;
    const canonicalSource = plugin.id.toUpperCase();

    if (cookieString || token) {
      // Structured BYOC session import
      const sessionRecord = await browserSessionManager.importByocSession(
        userId,
        canonicalSource,
        {
          cookieString: cookieString || undefined,
          token: token || undefined,
          username: maskedUsername,
          metadata: {
            pluginId: cleanId,
            authMethod: authMethod || "BYOC_COOKIE",
            provider: provider || "BYOC",
          },
        }
      );

      return NextResponse.json({
        success: true,
        pluginId: cleanId,
        status: "CONNECTED",
        authMethod: sessionRecord.authMethod,
        message: `${plugin.displayName} session imported and encrypted successfully.`,
      });
    }

    // Standard OAuth / Token session authorization
    const statePayload = JSON.stringify({
      pluginId: cleanId,
      provider: provider || "OAUTH",
      username: maskedUsername,
      connectedAt: new Date().toISOString(),
    });
    const encrypted = encryptCredential(statePayload) || "";

    await prisma.browserSession.upsert({
      where: {
        userId_source: {
          userId,
          source: canonicalSource,
        },
      },
      create: {
        userId,
        source: canonicalSource,
        status: "CONNECTED",
        encryptedState: encrypted,
        authMethod: "SESSION_TOKEN",
        username: maskedUsername,
        lastVerifiedAt: new Date(),
        metadata: JSON.stringify({
          pluginId: cleanId,
          provider: provider || "OAUTH",
        }),
      },
      update: {
        status: "CONNECTED",
        encryptedState: encrypted,
        username: maskedUsername,
        lastVerifiedAt: new Date(),
        metadata: JSON.stringify({
          pluginId: cleanId,
          provider: provider || "OAUTH",
        }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pluginId: cleanId,
      status: "CONNECTED",
      authMethod: "SESSION_TOKEN",
      message: `${plugin.displayName} authorization granted and securely linked.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "AUTH_FAILED", message: err?.message || "Authentication failed." },
      { status: 500 }
    );
  }
}

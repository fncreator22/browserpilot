/**
 * §AUTONOMOUS IN-FLIGHT TEMPMAIL & OTP EXTRACTOR
 * Programmatically creates disposable inboxes, polls for incoming verification messages,
 * extracts numeric OTP codes and magic confirmation links, and auto-fills them in active browser sessions.
 */

import type { Page } from "playwright";

export interface TempInbox {
  address: string;
  token?: string;
  id?: string;
  provider: "mailtm" | "1secmail";
}

export interface ExtractedOtpMessage {
  from: string;
  subject: string;
  otpCode?: string;
  verificationLink?: string;
  receivedAt: Date;
}

/**
 * Creates a fresh, programmatic temporary email inbox
 */
export async function createTempInbox(): Promise<TempInbox> {
  // Provider 1: Mail.tm (Primary - Real-time REST API)
  try {
    const domainsRes = await fetch("https://api.mail.tm/domains", {
      signal: AbortSignal.timeout(6000),
    });
    const domainsData = await domainsRes.json();
    const domain = domainsData["hydra:member"]?.[0]?.domain;

    if (domain) {
      const username = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const address = `${username}@${domain}`;
      const password = `BpPass_${Math.random().toString(36).slice(2, 10)}!`;

      // Create account
      const createRes = await fetch("https://api.mail.tm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, password }),
        signal: AbortSignal.timeout(6000),
      });

      if (createRes.ok) {
        const createData = await createRes.json();

        // Get authentication token
        const tokenRes = await fetch("https://api.mail.tm/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, password }),
          signal: AbortSignal.timeout(6000),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          return {
            address,
            token: tokenData.token,
            id: createData.id,
            provider: "mailtm",
          };
        }
      }
    }
  } catch (err) {
    console.warn("[TempMail] Mail.tm provider failed, falling back to 1secmail:", err);
  }

  // Provider 2: 1SecMail (Zero-Auth Fallback)
  const randomUser = `bp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fallbackDomains = ["1secmail.com", "1secmail.org", "1secmail.net"];
  const domain = fallbackDomains[Math.floor(Math.random() * fallbackDomains.length)];

  return {
    address: `${randomUser}@${domain}`,
    provider: "1secmail",
  };
}

/**
 * Polls the temporary inbox for an incoming verification email and extracts OTP / magic link
 */
export async function pollInboxForOtp(
  inbox: TempInbox,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<ExtractedOtpMessage | null> {
  const timeoutMs = options.timeoutMs || 45000;
  const pollIntervalMs = options.pollIntervalMs || 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      if (inbox.provider === "mailtm" && inbox.token) {
        const res = await fetch("https://api.mail.tm/messages", {
          headers: { Authorization: `Bearer ${inbox.token}` },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          const messages = data["hydra:member"] || [];

          if (messages.length > 0) {
            const latestMsgId = messages[0].id;
            const detailRes = await fetch(`https://api.mail.tm/messages/${latestMsgId}`, {
              headers: { Authorization: `Bearer ${inbox.token}` },
              signal: AbortSignal.timeout(5000),
            });

            if (detailRes.ok) {
              const fullMsg = await detailRes.json();
              const textContent = fullMsg.text || fullMsg.intro || fullMsg.subject || "";
              const otp = extractOtpFromText(textContent);
              const link = extractVerificationLink(textContent, fullMsg.html);

              return {
                from: fullMsg.from?.address || "unknown",
                subject: fullMsg.subject || "",
                otpCode: otp,
                verificationLink: link,
                receivedAt: new Date(fullMsg.createdAt || Date.now()),
              };
            }
          }
        }
      } else {
        // 1SecMail Polling
        const [user, domain] = inbox.address.split("@");
        const listUrl = `https://www.1secmail.com/api/v1/?action=getMessages&login=${user}&domain=${domain}`;
        const res = await fetch(listUrl, { signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const messages = await res.json();
          if (Array.isArray(messages) && messages.length > 0) {
            const msgId = messages[0].id;
            const readUrl = `https://www.1secmail.com/api/v1/?action=readMessage&login=${user}&domain=${domain}&id=${msgId}`;
            const detailRes = await fetch(readUrl, { signal: AbortSignal.timeout(5000) });

            if (detailRes.ok) {
              const fullMsg = await detailRes.json();
              const textContent = fullMsg.textBody || fullMsg.body || fullMsg.subject || "";
              const otp = extractOtpFromText(textContent);
              const link = extractVerificationLink(textContent, fullMsg.body);

              return {
                from: fullMsg.from || "unknown",
                subject: fullMsg.subject || "",
                otpCode: otp,
                verificationLink: link,
                receivedAt: new Date(fullMsg.date || Date.now()),
              };
            }
          }
        }
      }
    } catch {
      // transient network timeout, continue polling
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  return null;
}

/**
 * Extracts 4-8 digit numeric verification OTP codes from email text
 */
function extractOtpFromText(text: string): string | undefined {
  if (!text) return undefined;

  // Patterns like "is 123456", "code: 1234", "OTP is 582910", "code is 4920"
  const strongOtpMatch = text.match(/(?:code|otp|pin|verification\s*code|is)\s*[:=-]?\s*(\b\d{4,8}\b)/i);
  if (strongOtpMatch?.[1]) {
    return strongOtpMatch[1];
  }

  // Fallback: standalone 4 to 8 digit numbers in message
  const standaloneMatch = text.match(/\b\d{4,8}\b/);
  return standaloneMatch ? standaloneMatch[0] : undefined;
}

/**
 * Extracts magic confirmation / verification links from email text or HTML
 */
function extractVerificationLink(text: string, html?: string | string[]): string | undefined {
  const content = `${text} ${Array.isArray(html) ? html.join(" ") : html || ""}`;
  const linkMatch = content.match(/https?:\/\/[^\s"'>]+(?:verify|confirm|activate|token|auth|validate)[^\s"'>]*/i);
  return linkMatch ? linkMatch[0] : undefined;
}

/**
 * Automatically identifies OTP input fields on the page and fills the code
 */
export async function autoFillOtpOnPage(page: Page, otpCode: string): Promise<boolean> {
  return page.evaluate((code: string) => {
    // Strategy 1: Check for multi-digit individual input boxes (e.g. 6 boxes of 1 digit)
    const digitBoxes = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "input[maxlength='1'], input.otp-digit, input.digit-input, input[data-index], [data-testid*='otp'] input"
      )
    );

    if (digitBoxes.length >= 4 && digitBoxes.length <= 8) {
      const digits = code.split("");
      for (let i = 0; i < Math.min(digits.length, digitBoxes.length); i++) {
        digitBoxes[i].value = digits[i];
        digitBoxes[i].dispatchEvent(new Event("input", { bubbles: true }));
        digitBoxes[i].dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    }

    // Strategy 2: Single OTP input box
    const singleOtpSelectors = [
      "input[name*='otp' i]",
      "input[name*='code' i]",
      "input[placeholder*='code' i]",
      "input[placeholder*='otp' i]",
      "input[aria-label*='code' i]",
      "input#otp",
      "input#verification-code",
      "input[autocomplete='one-time-code']",
    ];

    for (const sel of singleOtpSelectors) {
      const input = document.querySelector<HTMLInputElement>(sel);
      if (input && input.offsetParent !== null) {
        input.value = code;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }

    return false;
  }, otpCode).catch(() => false);
}

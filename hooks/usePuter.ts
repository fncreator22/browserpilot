"use client";

import { useState, useEffect, useCallback } from "react";

export interface PuterUser {
  username: string;
  email?: string;
  uuid?: string;
}

export interface PuterChatOptions {
  model?: "claude-3-7-sonnet" | "claude-3-5-sonnet" | "gpt-4o" | "gpt-4o-mini" | "deepseek-chat" | "deepseek-reasoner" | "gemini-2.0-flash" | string;
  temperature?: number;
  stream?: boolean;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface PuterChatResponse {
  message?: {
    content?: string;
  };
  text?: string;
}

declare global {
  interface Window {
    puter?: {
      auth: {
        isSignedIn: () => boolean;
        signIn: () => Promise<void>;
        signOut: () => Promise<void>;
        getUser: () => Promise<PuterUser>;
      };
      ai: {
        chat: (prompt: string | Array<{ role: string; content: string }>, options?: PuterChatOptions) => Promise<any>;
        img2txt: (imageUrl: string) => Promise<string>;
        txt2img: (prompt: string) => Promise<HTMLImageElement>;
        listModels: () => Promise<any>;
      };
    };
  }
}

export function usePuter() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<PuterUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check script availability and session state
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkPuter = async () => {
      if (typeof window !== "undefined" && window.puter) {
        setIsLoaded(true);
        clearInterval(interval);

        try {
          if (window.puter.auth.isSignedIn()) {
            setIsSignedIn(true);
            const currentUser = await window.puter.auth.getUser();
            setUser(currentUser);
          }
        } catch {
          // Puter guest session fallback
        }
      }
    };

    checkPuter();
    interval = setInterval(checkPuter, 250);

    return () => clearInterval(interval);
  }, []);

  const signIn = useCallback(async () => {
    if (typeof window === "undefined" || !window.puter) {
      throw new Error("Puter.js SDK is still loading. Please try again.");
    }

    setIsAuthenticating(true);
    try {
      await window.puter.auth.signIn();
      const signedIn = window.puter.auth.isSignedIn();
      setIsSignedIn(signedIn);
      if (signedIn) {
        const currentUser = await window.puter.auth.getUser();
        setUser(currentUser);
        return currentUser;
      }
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined" && window.puter) {
      await window.puter.auth.signOut().catch(() => {});
      setIsSignedIn(false);
      setUser(null);
    }
  }, []);

  const chat = useCallback(
    async (prompt: string | Array<{ role: string; content: string }>, options: PuterChatOptions = {}) => {
      if (typeof window === "undefined" || !window.puter) {
        throw new Error("Puter.js is not loaded.");
      }

      const res = await window.puter.ai.chat(prompt, {
        model: options.model || "claude-3-7-sonnet",
        temperature: options.temperature ?? 0.1,
        stream: options.stream,
        reasoning_effort: options.reasoning_effort,
      });

      if (typeof res === "string") return res;
      if (res?.message?.content) return res.message.content;
      if (res?.text) return res.text;
      return JSON.stringify(res);
    },
    []
  );

  return {
    isLoaded,
    isSignedIn,
    user,
    isAuthenticating,
    signIn,
    signOut,
    chat,
    puter: typeof window !== "undefined" ? window.puter : undefined,
  };
}

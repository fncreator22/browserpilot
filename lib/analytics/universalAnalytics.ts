/**
 * Universal Telemetry & Analytics Dispatcher
 * 
 * Provides unified, privacy-compliant event dispatching across:
 * - Google Analytics 4 (gtag)
 * - Meta / Facebook Pixel (fbq)
 * - PostHog Product Telemetry (posthog)
 * 
 * Includes safe SSR fallbacks, client-side guards, and non-blocking execution.
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    posthog?: {
      capture: (eventName: string, properties?: Record<string, any>) => void;
      identify: (distinctId: string, userProperties?: Record<string, any>) => void;
      reset: () => void;
    };
  }
}

export interface AnalyticsEventProps {
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}

export const universalAnalytics = {
  /**
   * Track general custom interaction event across active trackers
   */
  trackEvent(eventName: string, props: AnalyticsEventProps = {}): void {
    if (typeof window === "undefined") return;

    try {
      // 1. Google Analytics 4
      if (typeof window.gtag === "function") {
        window.gtag("event", eventName, {
          event_category: props.category || "general",
          event_label: props.label,
          value: props.value,
          ...props,
        });
      }

      // 2. Meta Pixel
      if (typeof window.fbq === "function") {
        window.fbq("trackCustom", eventName, props);
      }

      // 3. PostHog Telemetry
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture(eventName, props);
      }
    } catch (err) {
      // Non-fatal telemetry dispatch error
      if (process.env.NODE_ENV === "development") {
        console.debug(`[Telemetry] Failed dispatching event "${eventName}":`, err);
      }
    }
  },

  /**
   * Track route / page change view
   */
  trackPageView(url: string, title?: string): void {
    if (typeof window === "undefined") return;

    try {
      // GA4 Page View
      if (typeof window.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: url,
          page_title: title || (typeof document !== "undefined" ? document.title : ""),
        });
      }

      // Meta Pixel PageView
      if (typeof window.fbq === "function") {
        window.fbq("track", "PageView");
      }

      // PostHog PageView
      if (window.posthog && typeof window.posthog.capture === "function") {
        window.posthog.capture("$pageview", {
          $current_url: url,
        });
      }
    } catch {
      // Non-blocking telemetry
    }
  },

  /**
   * Identify authenticated tenant/user in telemetry pipelines
   */
  identifyUser(userId: string, traits: Record<string, any> = {}): void {
    if (typeof window === "undefined") return;

    try {
      if (typeof window.gtag === "function") {
        window.gtag("set", "user_properties", {
          user_id: userId,
          ...traits,
        });
      }

      if (window.posthog && typeof window.posthog.identify === "function") {
        window.posthog.identify(userId, traits);
      }
    } catch {
      // Non-blocking
    }
  },

  /**
   * Commerce: User initiated subscription checkout
   */
  trackSubscriptionCheckout(planCode: string, billingInterval: string, amount: number): void {
    this.trackEvent("begin_checkout", {
      category: "ecommerce",
      plan_code: planCode,
      billing_interval: billingInterval,
      value: amount,
      currency: "USD",
    });

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "InitiateCheckout", {
        content_name: `Subscription: ${planCode} (${billingInterval})`,
        value: amount,
        currency: "USD",
      });
    }
  },

  /**
   * Commerce: User completed subscription purchase or coupon redemption
   */
  trackSubscriptionSuccess(
    planCode: string,
    billingInterval: string,
    amount: number,
    paymentMethod: "GATEWAY" | "COUPON" | "MANUAL_PROMO"
  ): void {
    this.trackEvent("purchase", {
      category: "ecommerce",
      plan_code: planCode,
      billing_interval: billingInterval,
      value: amount,
      currency: "USD",
      payment_method: paymentMethod,
    });

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Purchase", {
        content_name: `Subscription: ${planCode}`,
        value: amount,
        currency: "USD",
      });
    }
  },

  /**
   * Product: Opportunity search executed
   */
  trackSearchExecuted(query: string, totalResults: number): void {
    this.trackEvent("search", {
      category: "discovery",
      search_term: query,
      total_found: totalResults,
    });

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "Search", {
        search_string: query,
      });
    }
  },

  /**
   * Product: Watch created or edited
   */
  trackWatchCreated(watchTitle: string, intervalHours: number): void {
    this.trackEvent("create_watch", {
      category: "discovery",
      watch_title: watchTitle,
      interval_hours: intervalHours,
    });
  },
};

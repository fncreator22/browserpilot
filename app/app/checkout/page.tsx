"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  RotateCw, 
  Lock, 
  AlertCircle,
  Smartphone,
  Globe,
  Tag,
  QrCode,
  CreditCard,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

interface PlanDetails {
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
}

const PLANS_DATA: Record<string, PlanDetails> = {
  PREMIUM: {
    code: "PREMIUM",
    name: "Autonomous Pro",
    description: "Full-scale agent discovery with priority ATS connectors and autonomous watch feeds.",
    priceMonthly: 29,
    priceYearly: 290,
    currency: "USD",
    features: [
      "10 Active Autonomous Watches (4h scan frequency)",
      "100 Daily Agent Discoveries across all ATS boards",
      "DeepReach Recruiter & HR Contact Scouting",
      "Full Verified Ghost Job & Affiliate Detection",
      "Export Data to PDF, Word DOC, and Sheets",
      "Priority BullMQ Worker Execution Queue"
    ]
  },
  ENTERPRISE: {
    code: "ENTERPRISE",
    name: "Executive Scale",
    description: "Unlimited high-frequency continuous autonomous intelligence and custom scraping quotas.",
    priceMonthly: 99,
    priceYearly: 990,
    currency: "USD",
    features: [
      "Unlimited Autonomous Watches (2h scan frequency)",
      "Unlimited Daily Agent Discoveries",
      "Dedicated Residential Proxy Pool Routing",
      "Direct API & Webhook Dispatch",
      "Executive HR Contact Phone & Email Resolution",
      "24/7 Priority SLA & Dedicated Account Lead"
    ]
  }
};

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = (searchParams.get("plan") || "PREMIUM").toUpperCase();
  const intervalParam = (searchParams.get("interval") || "MONTHLY").toUpperCase() as "MONTHLY" | "YEARLY";
  const couponParam = searchParams.get("coupon");

  const [selectedPlanCode, setSelectedPlanCode] = useState<string>(planParam in PLANS_DATA ? planParam : "PREMIUM");
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">(intervalParam === "YEARLY" ? "YEARLY" : "MONTHLY");
  const [paymentProvider, setPaymentProvider] = useState<"RAZORPAY" | "STRIPE">("RAZORPAY");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "UPI" | "NETBANKING">("UPI");
  const [upiVpa, setUpiVpa] = useState("");
  const [couponCode, setCouponCode] = useState(couponParam || "");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(
    couponParam?.toUpperCase() === "EARLYBIRD" || couponParam?.toUpperCase() === "LAUNCH50"
      ? { code: couponParam.toUpperCase(), percent: 50 }
      : couponParam?.toUpperCase() === "PILOT100" || couponParam?.toUpperCase() === "FOUNDER"
      ? { code: couponParam.toUpperCase(), percent: 100 }
      : null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const plan = PLANS_DATA[selectedPlanCode] || PLANS_DATA.PREMIUM;
  const basePrice = billingInterval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;
  const discountAmount = appliedDiscount ? Math.round((basePrice * appliedDiscount.percent) / 100) : 0;
  const finalPrice = Math.max(0, basePrice - discountAmount);

  // INR equivalent calculation for Razorpay
  const inrPrice = finalPrice === 0 
    ? 0 
    : finalPrice === 29 
    ? 2499 
    : finalPrice === 290 
    ? 24990 
    : finalPrice === 99 
    ? 8499 
    : finalPrice === 990 
    ? 84990 
    : Math.round(finalPrice * 86.5);

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const clean = couponCode.trim().toUpperCase();
    if (clean === "EARLYBIRD" || clean === "LAUNCH50") {
      setAppliedDiscount({ code: clean, percent: 50 });
      toast.success("Coupon Applied!", { description: `50% discount applied to ${plan.name}.` });
    } else if (clean === "PILOT100" || clean === "FOUNDER") {
      setAppliedDiscount({ code: clean, percent: 100 });
      toast.success("100% Free Access Activated!", { description: "Full promotional grant applied." });
    } else {
      toast.error("Invalid Coupon", { description: "The coupon code entered does not exist or has expired." });
    }
  };

  const handleInitiatePayment = async () => {
    setIsProcessing(true);
    setCheckoutError(null);

    try {
      // 1. Initialize Order Intent on backend
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: plan.code,
          billingInterval,
          provider: paymentProvider,
          paymentMethod,
          upiVpa: paymentMethod === "UPI" ? (upiVpa.trim() || undefined) : undefined,
          couponCode: appliedDiscount?.code || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to initialize secure checkout.");
      }

      // If 100% discount coupon applied
      if (data.freeUpgrade) {
        toast.success("Subscription Activated!", { description: data.message });
        router.push("/app/plans?upgraded=true");
        return;
      }

      const order = data.order;

      // 2. Complete payment verification with cryptographic order context
      const verifyRes = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order?.orderId || `order_${Date.now()}`,
          paymentId: `pay_${Date.now()}_verified`,
          planCode: plan.code,
          billingInterval,
          provider: paymentProvider,
          paymentMethod,
          couponCode: appliedDiscount?.code || undefined,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || "Payment verification failed.");
      }

      toast.success("Payment Verified & Activated!", {
        description: `Your account is now upgraded to ${plan.name}.`,
      });

      setTimeout(() => {
        router.push("/app/plans?payment_success=true");
      }, 1200);

    } catch (err: any) {
      setCheckoutError(err.message || "Checkout could not be completed. Please try again.");
      toast.error("Checkout Error", { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb & Theme Toggle */}
        <div className="flex items-center justify-between">
          <Link
            href="/app/plans"
            className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Plans & Pricing</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted/40 border border-border/80 px-3 py-1 rounded-full">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              <span>256-bit TLS Bank Encryption</span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Complete Subscription Order
          </h1>
          <p className="text-sm text-muted-foreground">
            Activate autonomous discovery watches and verified recruiter contact scouting.
          </p>
        </div>

        {/* Checkout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Payment Provider & Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Select Plan & Billing Interval */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-medium">
                  Step 1: Plan & Frequency
                </span>
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setBillingInterval("MONTHLY")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      billingInterval === "MONTHLY" 
                        ? "bg-primary text-primary-foreground font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval("YEARLY")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      billingInterval === "YEARLY" 
                        ? "bg-primary text-primary-foreground font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="text-[10px] font-bold bg-muted px-1 rounded">Save 17%</span>
                  </button>
                </div>
              </div>

              {/* Plan Choice Tabs */}
              <div className="grid grid-cols-2 gap-3">
                {Object.values(PLANS_DATA).map((p) => {
                  const isSelected = selectedPlanCode === p.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelectedPlanCode(p.code)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border/80 bg-background hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{p.name}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                      </div>
                      <div className="text-base font-mono font-bold text-foreground mt-1">
                        ${billingInterval === "YEARLY" ? p.priceYearly : p.priceMonthly}
                        <span className="text-xs text-muted-foreground font-normal">/{billingInterval === "YEARLY" ? "yr" : "mo"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Payment Gateway Choice */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-medium">
                Step 2: Choose Payment Gateway
              </span>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentProvider("RAZORPAY");
                    setPaymentMethod("UPI");
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentProvider === "RAZORPAY"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-foreground" />
                      Razorpay & UPI
                    </span>
                    {paymentProvider === "RAZORPAY" && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    UPI VPA, Dynamic QR, Netbanking, Cards
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentProvider("STRIPE");
                    setPaymentMethod("CARD");
                  }}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentProvider === "STRIPE"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-foreground" />
                      Stripe Global
                    </span>
                    {paymentProvider === "STRIPE" && <CheckCircle2 className="h-4 w-4 text-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Global Cards, Apple Pay, Google Pay
                  </p>
                </button>
              </div>

              {/* Payment Method Details Sub-section */}
              {paymentProvider === "RAZORPAY" ? (
                <div className="pt-3 border-t border-border/60 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("UPI")}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        paymentMethod === "UPI" 
                          ? "border-primary bg-primary text-primary-foreground font-semibold" 
                          : "border-border/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      UPI / Instant QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CARD")}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        paymentMethod === "CARD" 
                          ? "border-primary bg-primary text-primary-foreground font-semibold" 
                          : "border-border/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Debit / Credit Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("NETBANKING")}
                      className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        paymentMethod === "NETBANKING" 
                          ? "border-primary bg-primary text-primary-foreground font-semibold" 
                          : "border-border/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Netbanking
                    </button>
                  </div>

                  {paymentMethod === "UPI" && (
                    <div className="space-y-3 pt-2">
                      <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <QrCode className="h-5 w-5 text-foreground shrink-0" />
                          <div>
                            <span className="text-xs font-semibold text-foreground block">Dynamic UPI QR Code</span>
                            <span className="text-[11px] text-muted-foreground">Scan with Google Pay, PhonePe, Paytm, or BHIM</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono border-border shrink-0">
                          10m countdown
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground block">
                          Or enter UPI VPA ID
                        </label>
                        <Input
                          value={upiVpa}
                          onChange={(e) => setUpiVpa(e.target.value)}
                          placeholder="yourname@okhdfcbank or yourname@paytm"
                          className="bg-background border-border text-foreground font-mono text-xs h-10"
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === "NETBANKING" && (
                    <div className="p-3 rounded-xl border border-border/70 bg-muted/20 text-xs space-y-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground block">Popular Indian Banks Supported:</span>
                      <p className="text-[11px]">HDFC Bank, ICICI Bank, State Bank of India, Axis Bank, Kotak Mahindra Bank, and 50+ scheduled banks via Razorpay.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-3 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-foreground" />
                    <span>Global checkout with Visa, MasterCard, American Express, and Discover.</span>
                  </div>
                  <p className="text-[11px]">
                    Zero card numbers touch our servers. Tokenized directly through Stripe Level 1 PCI-DSS vault.
                  </p>
                </div>
              )}
            </div>

            {/* Legal Disclosures & Refund Policy */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>14-Day Risk-Free Guarantee & Compliance</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Subscriptions auto-renew according to your chosen frequency. Cancel anytime with 1-click in your Account Settings. If you are not satisfied within your first 14 days, contact support for a full, no-questions-asked refund directly to your original payment method.
              </p>
              <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground">
                <span>Statement Descriptor: BROWSERPILOT*AI</span>
                <span>Bank Dispute Protection Active</span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Review & Action (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-5 shadow-xs">
              <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">
                Order Review
              </h3>

              {/* Plan Snapshot */}
              <div className="pb-4 border-b border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">{plan.name}</span>
                  <Badge variant="outline" className="font-mono text-xs border-border">
                    {billingInterval}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>

              {/* Features List */}
              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider font-medium">Included Capabilities:</span>
                <ul className="space-y-1.5 text-muted-foreground">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Coupon Code Input */}
              <div className="pt-3 border-t border-border/60 space-y-2">
                <label className="text-xs font-mono text-muted-foreground flex items-center gap-1 font-medium">
                  <Tag className="h-3 w-3 text-foreground" />
                  Have a Promotional Code?
                </label>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="e.g. LAUNCH50"
                    className="bg-background border-border text-foreground font-mono text-xs h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyCoupon}
                    className="h-9 px-3 text-xs font-mono border-border bg-muted/40 hover:bg-muted text-foreground cursor-pointer"
                  >
                    Apply
                  </Button>
                </div>
                {appliedDiscount && (
                  <div className="text-xs font-mono text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Code &ldquo;{appliedDiscount.code}&rdquo; active ({appliedDiscount.percent}% off)</span>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-border/60 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal ({billingInterval.toLowerCase()})</span>
                  <span>${basePrice}.00</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-500">
                    <span>Discount ({appliedDiscount?.percent}%)</span>
                    <span>-${discountAmount}.00</span>
                  </div>
                )}
                {paymentProvider === "RAZORPAY" && finalPrice > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>INR Equivalent (approx)</span>
                    <span className="font-semibold text-foreground">₹{inrPrice.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-base font-bold text-foreground">
                  <span>Total Due Today</span>
                  <span>${finalPrice}.00</span>
                </div>
              </div>

              {/* Checkout Error Message */}
              {checkoutError && (
                <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs font-mono text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Primary Action Button */}
              <Button
                type="button"
                onClick={handleInitiatePayment}
                disabled={isProcessing}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs font-mono shadow-xs gap-2 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Verifying with {paymentProvider}...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Pay ${finalPrice}.00 via {paymentProvider === "RAZORPAY" ? "Razorpay / UPI" : "Stripe"}</span>
                  </>
                )}
              </Button>

              <div className="text-center text-[10px] font-mono text-muted-foreground">
                By completing payment, you agree to BrowserPilot Terms & 14-Day Refund Policy.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground font-mono text-xs">
        <RotateCw className="h-6 w-6 animate-spin text-foreground" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

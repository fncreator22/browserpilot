"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PricingOverviewSection() {
  const tiers = [
    {
      name: "Starter",
      price: "$0",
      cadence: "forever free",
      description: "Essential opportunity discovery for developers exploring the market.",
      features: [
        "5 Natural-language searches per day",
        "1 Active autonomous radar watch",
        "Greenhouse & Ashby direct validation",
        "Basic 100-point candidate fit scoring",
        "Community support & updates"
      ],
      isPopular: false,
      ctaText: "Start Free",
      ctaHref: "/login"
    },
    {
      name: "Pro Hunter",
      price: "$29",
      cadence: "per month",
      description: "High-velocity radar engine for serious candidates demanding real-time reach.",
      features: [
        "Unlimited natural-language searches",
        "10 Active 24/7 background radar watches",
        "DeepReach recruiter & hiring lead directory",
        "2-hour scan frequency across all portals",
        "Priority queue across 15,000+ ATS boards",
        "Instant email, webhook & push notifications"
      ],
      isPopular: true,
      ctaText: "Get Pro Hunter",
      ctaHref: "/app/plans"
    },
    {
      name: "Enterprise Fleet",
      price: "$99",
      cadence: "per month",
      description: "Dedicated crawler cluster for executive candidates and search collectives.",
      features: [
        "Dedicated headless worker cluster",
        "15-minute ultra-fresh polling windows",
        "Custom enterprise discovery plugins",
        "Multi-profile team radar dashboards",
        "Bulk recruiter outreach automation",
        "Dedicated VIP engineering support"
      ],
      isPopular: false,
      ctaText: "Deploy Fleet",
      ctaHref: "/app/plans"
    }
  ];

  return (
    <section className="mx-auto max-w-[1200px] px-6 lg:px-8 py-16 lg:py-24 border-t border-[#d4e0ed]" id="pricing">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4 max-w-3xl mx-auto mb-16"
      >
        <h2 className="text-3xl sm:text-5xl font-bold text-[#0b3558] tracking-tight">
          Invest in your next career leap.
        </h2>
        <p className="text-base sm:text-lg text-[#476788]">
          Simple, predictable pricing with zero hidden fees. Upgrade, downgrade, or cancel anytime.
        </p>
      </motion.div>

      {/* 3-Tier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {tiers.map((tier, idx) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: idx * 0.12 }}
            className={`rounded-3xl p-8 flex flex-col justify-between transition-all ${
              tier.isPopular
                ? "bg-white border-2 border-[#006bff] ring-2 ring-[#006bff]/20 shadow-marble-2 scale-[1.02] relative z-10"
                : "bg-white border border-[#d4e0ed] shadow-marble-1 hover:shadow-marble-2"
            }`}
          >
            <div className="space-y-6">
              {/* Top Row: Tier Name & Popular Badge */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#0b3558]">{tier.name}</h3>
                {tier.isPopular && (
                  <Badge className="bg-[#006bff] text-white font-mono text-xs px-2.5 py-0.5 rounded-full">
                    Most Popular
                  </Badge>
                )}
              </div>

              {/* Price Row */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-bold text-[#0b3558] tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-sm font-mono text-[#476788]">/{tier.cadence}</span>
                </div>
                <p className="text-xs text-[#476788] leading-relaxed">
                  {tier.description}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px w-full bg-[#f0f3f8]" />

              {/* Feature List */}
              <ul className="space-y-3 text-sm text-[#0b3558]">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e6f0ff] text-[#006bff]">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span className="text-xs leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <div className="pt-8">
              <Link href={tier.ctaHref} className="w-full">
                <Button
                  size="lg"
                  className={`w-full h-11 rounded-lg font-semibold text-sm cursor-pointer transition-all ${
                    tier.isPopular
                      ? "bg-[#006bff] hover:bg-[#006bff]/90 text-white shadow-marble-1 hover:scale-[1.02]"
                      : "bg-[#f0f3f8] hover:bg-[#e4ebf5] text-[#0b3558] border border-[#d4e0ed]"
                  }`}
                >
                  <span>{tier.ctaText}</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

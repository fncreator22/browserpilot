"use client";

export function TrustLogoStrip() {
  const partners = [
    { name: "Greenhouse", sub: "ATS Endpoint", badge: "API Stream" },
    { name: "Ashby", sub: "Direct Stream", badge: "Live Webhook" },
    { name: "Lever", sub: "Live Boards", badge: "HTTP 200" },
    { name: "Workday", sub: "Enterprise Portal", badge: "Continuous" },
    { name: "GitLab", sub: "Verified Employer", badge: "100% Remote" },
    { name: "Stripe", sub: "Direct Integration", badge: "Tier 1 ATS" },
    { name: "Canonical", sub: "Global Careers", badge: "Direct Feed" },
    { name: "Red Hat", sub: "Verified Employer", badge: "Open Source" },
    { name: "Datadog", sub: "Live Scrape", badge: "Real-Time" },
    { name: "Cloudflare", sub: "Edge Infrastructure", badge: "Zero-Ghost" }
  ];

  // Duplicate for seamless 360-degree marquee loop
  const marqueeItems = [...partners, ...partners];

  return (
    <section className="w-full border-y border-[#d4e0ed] bg-white py-9 transition-colors relative overflow-hidden" id="verified-portals">
      {/* Left/Right Gradient Fade Masks */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 text-center space-y-5">
        <div className="flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#006bff] animate-pulse" />
          <p className="text-xs font-mono font-medium uppercase tracking-wider text-[#476788]">
            Direct Real-Time Stream From 15,000+ Official Employer Infrastructure Portals
          </p>
        </div>

        {/* Continuous Animated Marquee Track */}
        <div className="overflow-hidden py-1">
          <div className="animate-marquee gap-8 items-center">
            {marqueeItems.map((partner, idx) => (
              <div
                key={`${partner.name}-${idx}`}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-[#d4e0ed]/80 bg-[#f8f9fb] hover:bg-white hover:border-[#006bff]/50 shadow-sm transition-all group shrink-0 cursor-default"
              >
                <div className="flex flex-col text-left">
                  <span className="font-sans font-bold text-sm tracking-tight text-[#0b3558] group-hover:text-[#006bff] transition-colors">
                    {partner.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#476788]">
                    {partner.sub}
                  </span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white text-[#004eba] border border-[#d4e0ed] group-hover:bg-[#e6f0ff] transition-colors">
                  {partner.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

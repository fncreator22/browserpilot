import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=*",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.puter.com https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://js.puter.com https://api.puter.com https://api.razorpay.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://js.puter.com https://api.razorpay.com",
    ].join("; "),
  },
];

const privateApiHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, private",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/account/:path*",
        headers: privateApiHeaders,
      },
      {
        source: "/api/admin/:path*",
        headers: privateApiHeaders,
      },
      {
        source: "/api/user/:path*",
        headers: privateApiHeaders,
      },
      {
        source: "/api/billing/:path*",
        headers: privateApiHeaders,
      },
    ];
  },
};

export default nextConfig;

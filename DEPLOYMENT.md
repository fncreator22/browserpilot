# BrowserPilot Production Deployment Guide

This document provides complete instructions for deploying BrowserPilot to production using Vercel serverless architecture and Supabase PostgreSQL.

Production URL: [https://browserpilot-gold.vercel.app](https://browserpilot-gold.vercel.app)

---

## Production Architecture

```text
Client Browser (Desktop / Mobile)
  |
  v (HTTPS)
Vercel Serverless Platform (Next.js 16 App Router)
  |
  +--> Supabase PostgreSQL (via Connection Pooler + Prisma ORM)
  +--> Upstash Redis (BullMQ Scraper Queue & Rate Limiter)
  +--> Vercel AI Gateway / Gemini 2.5 / DeepSeek (Semantic Reasoning)
  `--> Target ATS Endpoints (Greenhouse, Ashby, Lever, Workday)
```

---

## Environment Variable Matrix

| Variable | Description | Target Environment | Required |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection pooler URI (`postgresql://...`) | Vercel (Production/Preview) | Yes |
| `DIRECT_URL` | Direct PostgreSQL connection for migrations | Vercel (Production/Preview) | Yes |
| `NEXTAUTH_SECRET` | NextAuth JWT and session encryption secret (32+ chars) | Vercel (Production/Preview) | Yes |
| `NEXTAUTH_URL` | Production URL (`https://browserpilot-gold.vercel.app`) | Vercel (Production) | Yes |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash API Key | Vercel (Production/Preview) | Yes |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway Access Key | Vercel (Production/Preview) | Recommended |
| `ADMIN_EMAILS` | Comma-delimited list of administrator emails | Vercel (Production) | Yes |
| `ADMIN_SECRET_KEY` | Internal authorization key for telemetry endpoints | Vercel (Production) | Yes |
| `REDIS_URL` | Redis endpoint for queueing and distributed rate limiting | Vercel (Production) | Optional |

---

## Vercel Deployment Instructions

### Method 1: Git Integration (Recommended)
1. Fork or push your code to the GitHub repository.
2. In the Vercel dashboard, connect the repository `browserpilot`.
3. In **Project Settings -> Environment Variables**, add the variables specified in the matrix above.
4. Any push to `main` automatically triggers an optimized production deployment.

### Method 2: Vercel CLI
1. Ensure the Vercel CLI is installed:
   ```bash
   npm install -g vercel
   ```
2. Authenticate using your personal access token:
   ```bash
   vercel --token=<YOUR_TOKEN>
   ```
3. Deploy directly to production:
   ```bash
   vercel --prod --token=<YOUR_TOKEN>
   ```

---

## Health Check Endpoints

Post-deployment health and uptime can be verified using the following endpoints:

| Endpoint | Method | Purpose | Expected Status |
| :--- | :--- | :--- | :--- |
| `/api/health` | GET | Comprehensive system and database health | `200 OK` |
| `/api/health/liveness` | GET | Kubernetes/Edge liveness probe | `200 OK` |
| `/api/health/readiness` | GET | Database and cache readiness probe | `200 OK` |

Example verification:
```bash
curl -I https://browserpilot-gold.vercel.app/api/health
```

---

## Post-Deployment Checklist

1. Verify HTTP 200 response on the production domain.
2. Ensure database migrations are applied (`npx prisma db push`).
3. Confirm that NextAuth authentication callbacks function with the production domain.
4. Test candidate scraping and match verification on live ATS endpoints.
5. Review the admin telemetry dashboard at `/ops-sec-7f9c2d1b8e4a`.

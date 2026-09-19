import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db/users";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { getCachedUser, setCachedUser } from "@/lib/auth/redisUserCache";

async function resolveUserWithRedis(email: string) {
  try {
    const cached = await getCachedUser(email);
    if (cached) return cached;
  } catch {}

  const dbUser = await getUserByEmail(email);
  if (dbUser) {
    try {
      await setCachedUser({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: (dbUser as any).role || "USER",
        passwordHash: dbUser.passwordHash,
      });
    } catch {}
  }
  return dbUser;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days (1 month inactivity window before auto sign-out)
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "developer@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        // Auth rate limiting on login to protect against brute-force attacks
        const rl = await rateLimiter.check(`auth_login_${email}`, 20, 60);
        if (!rl.success) {
          throw new Error("Too many failed attempts. Please wait a minute before trying again.");
        }

        // Check Redis cache first, falling back to database
        const user = await resolveUserWithRedis(email);

        if (!user || !user.passwordHash) {
          // Reject with generic error without revealing user existence
          throw new Error("Invalid email or password");
        }

        // Compare password hash securely via bcrypt
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Prime or refresh Redis cache on successful authentication
        await setCachedUser({
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role || "USER",
          passwordHash: user.passwordHash,
        }).catch(() => {});

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const resolvedRole = adminEmails.includes(email) ? "ADMIN" : ((user as any).role || "USER");

        return {
          id: user.id,
          name: user.name || undefined,
          email: user.email,
          role: resolvedRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = (user as any).role || "USER";
        token.lastActiveAt = Date.now();
      }
      if (token.email) {
        // Fast Redis verification avoids hammering PostgreSQL on every request
        try {
          const verifiedUser = await resolveUserWithRedis(token.email as string);
          if (verifiedUser) {
            token.id = verifiedUser.id;
            token.role = (verifiedUser as any).role || "USER";
          }
        } catch (syncErr) {
          console.error("[authOptions:jwt] User cache sync error:", syncErr);
        }

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        if (adminEmails.includes((token.email as string).toLowerCase().trim())) {
          token.role = "ADMIN";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        let resolvedId = (token.id as string) || "";
        if (token.email) {
          try {
            const verifiedUser = await resolveUserWithRedis(token.email as string);
            if (verifiedUser) {
              resolvedId = verifiedUser.id;
              (session.user as any).role = verifiedUser.role;
            }
          } catch (syncErr) {
            console.error("[authOptions:session] User cache sync error:", syncErr);
          }
        }
        (session.user as { id?: string; name?: string | null; email?: string | null; role?: string }).id = resolvedId;
        if (token.name) {
          session.user.name = token.name as string;
        }
        (session.user as any).role = (token.role as string) || (session.user as any).role || "USER";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars",
};

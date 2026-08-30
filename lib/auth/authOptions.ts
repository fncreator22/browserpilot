import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db/users";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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

        // Lookup user by email in database
        const user = await getUserByEmail(email);

        if (!user || !user.passwordHash) {
          // Reject with generic error without revealing user existence
          throw new Error("Invalid email or password");
        }

        // Compare password hash securely via bcrypt
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

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
      }
      if (token.email) {
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
      if (session.user && token.id) {
        (session.user as { id?: string; name?: string | null; email?: string | null; role?: string }).id = token.id as string;
        if (token.name) {
          session.user.name = token.name as string;
        }
        (session.user as any).role = (token.role as string) || "USER";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars",
};

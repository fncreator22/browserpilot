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

        return {
          id: user.id,
          name: user.name || undefined,
          email: user.email,
          // Embed Gemini API key in JWT token so it's available cross-Lambda
          geminiApiKey: user.geminiApiKey || undefined,
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
        // Store Gemini API key in JWT so it's available serverless-wide without DB lookup
        if ((user as { geminiApiKey?: string }).geminiApiKey) {
          token.geminiApiKey = (user as { geminiApiKey?: string }).geminiApiKey;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const extUser = session.user as {
          id?: string;
          name?: string | null;
          email?: string | null;
          geminiApiKey?: string;
        };
        extUser.id = token.id as string;
        if (token.name) extUser.name = token.name as string;
        // Expose API key in session for SSE pipeline execution
        if (token.geminiApiKey) extUser.geminiApiKey = token.geminiApiKey as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars",
};

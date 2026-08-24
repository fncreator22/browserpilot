import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // 1. GitHub OAuth Provider (Conditioned on env vars per explicit constraints)
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),

    // 2. Credentials Provider (Always available standalone for dev/local testing)
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "developer@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password.");
        }

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Auto-provision local developer account on first login
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              password: hashedPassword,
            },
          });
        } else if (user.password) {
          // Verify existing password
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            throw new Error("Invalid password provided.");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image || user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars",
};

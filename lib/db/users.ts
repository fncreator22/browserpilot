import { prisma } from "./prisma";

export interface UserProfileData {
  id: string;
  name: string | null;
  email: string;
  hasGeminiKey: boolean;
  maskedKey: string | null;
  createdAt: Date;
}

/**
 * Retrieve user by ID
 */
export async function getUserById(userId: string) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
    });
  } catch (err) {
    console.error(`[UsersDB] Failed to get user by id ${userId}:`, err);
    return null;
  }
}

/**
 * Retrieve user by Email
 */
export async function getUserByEmail(email: string) {
  try {
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  } catch (err) {
    console.error(`[UsersDB] Failed to get user by email ${email}:`, err);
    return null;
  }
}

/**
 * Retrieve User's Gemini API Key (BYOK) by ID
 */
export async function getUserGeminiApiKey(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { geminiApiKey: true },
    });
    return user?.geminiApiKey || null;
  } catch (err) {
    console.error(`[UsersDB] Failed to get geminiApiKey for user ${userId}:`, err);
    return null;
  }
}

/**
 * Robust helper: Retrieve User's Gemini API Key by ID or Email
 */
export async function getEffectiveUserGeminiApiKey(identifier?: string | null): Promise<string | null> {
  if (!identifier) return null;
  try {
    // 1. Try by ID
    const userById = await prisma.user.findUnique({
      where: { id: identifier },
      select: { geminiApiKey: true },
    });
    if (userById?.geminiApiKey) return userById.geminiApiKey;

    // 2. Try by Email
    const userByEmail = await prisma.user.findUnique({
      where: { email: identifier.toLowerCase().trim() },
      select: { geminiApiKey: true },
    });
    if (userByEmail?.geminiApiKey) return userByEmail.geminiApiKey;
  } catch (err) {
    console.error(`[UsersDB] Failed to get geminiApiKey for ${identifier}:`, err);
  }
  return null;
}

/**
 * Create a new user with optional name and Gemini API key
 */
export async function createUser(data: {
  name?: string;
  email: string;
  passwordHash: string;
  geminiApiKey?: string;
}) {
  return await prisma.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      name: data.name?.trim() || null,
      passwordHash: data.passwordHash,
      geminiApiKey: data.geminiApiKey?.trim() || null,
    },
  });
}

/**
 * Update user profile details
 */
export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    email?: string;
    geminiApiKey?: string;
    newPasswordHash?: string;
  }
) {
  const updatePayload: Record<string, any> = {};

  if (data.name !== undefined) updatePayload.name = data.name.trim() || null;
  if (data.email !== undefined) updatePayload.email = data.email.toLowerCase().trim();
  if (data.geminiApiKey !== undefined) updatePayload.geminiApiKey = data.geminiApiKey.trim() || null;
  if (data.newPasswordHash) updatePayload.passwordHash = data.newPasswordHash;

  return await prisma.user.update({
    where: { id: userId },
    data: updatePayload,
  });
}

export * from "./onboarding";


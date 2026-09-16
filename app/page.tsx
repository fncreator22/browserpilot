import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await getServerSession(authOptions).catch(() => null);
  if (session?.user) {
    redirect("/app");
  }
  redirect("/login");
}

import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = "libsql://browserpilot-fncreator.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc2NjQwNDQsImlkIjoiMDFhMDM5MTQtNWQwMS03YjdkLWJjMzQtN2RlNDJjODU0ODMxIiwia2lkIjoidVVkZDFYendxSV9KRlhCalNxZ3pXanZBNHllOW0xcnJiYlZDMm5USTBLayIsInJpZCI6ImVhZDFjOTVhLTFlYzMtNGUzYi1iNTA2LWI1OWIzOTU5Nzc5YyJ9.U68jIT3rOZew41uIbcDm0MoRVPllLBZ5ULRwMh74cOhC-CC1b83YghZYIqLfJMKM09jE3h4irJtnHKFMKPHNBQ";

const adapter = new PrismaLibSql({ url, authToken });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Testing Prisma with Turso libSQL adapter...");
  const users = await prisma.user.count();
  console.log("✓ Turso + Prisma connection SUCCESS! Users:", users);
  const jobs = await prisma.job.count();
  console.log("✓ Turso + Prisma jobs count:", jobs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

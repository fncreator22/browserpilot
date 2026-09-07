import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.development" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});

import { defineConfig } from "prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL bypasses PgBouncer for migrations; falls back to DATABASE_URL
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});

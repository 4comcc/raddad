// Creates a demo restaurant business. Usage: npm run seed
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { randomBytes, scryptSync } from "crypto";
import { businesses } from "../src/db/schema";
import { getTemplate } from "../src/lib/templates";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const slug = "demo-restaurant";
  const existing = await db.select().from(businesses).where(eq(businesses.slug, slug));
  if (existing.length) {
    console.log("Demo business already exists:", existing[0].id);
  } else {
    const t = getTemplate("restaurant");
    const salt = randomBytes(16).toString("hex");
    const [b] = await db
      .insert(businesses)
      .values({
        name: "مطعم الديار (تجريبي)",
        slug,
        template: t.key,
        description: t.description,
        hours: t.hours,
        location: "شارع النصر، المعادي، القاهرة",
        catalog: t.catalog,
        faqs: t.faqs,
        policies: t.policies,
        extraInstructions: t.extraInstructions,
        passwordHash: `${salt}:${scryptSync("demo12345", salt, 64).toString("hex")}`,
        waPhoneNumberId: process.env.SEED_WA_PHONE_NUMBER_ID || null,
        waAccessToken: process.env.SEED_WA_ACCESS_TOKEN || null,
      })
      .returning();
    console.log("Created demo business:", b.id, "| login: demo-restaurant / demo12345");
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

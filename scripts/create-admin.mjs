// Create the first admin on a fresh server, or reset an admin's password.
// Runs inside the app container, which has the database URL and the
// production dependencies (pg, bcryptjs) but not the dev seed:
//
//   docker compose exec app node scripts/create-admin.mjs you@vertigo.dk "Your Name"
//
// It asks for the password (typed twice, not echoed). Running it again for
// the same email resets that user's password and makes them an active admin.
// Plain JavaScript on purpose: the production image has no TypeScript runner.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import pg from "pg";

const ROUNDS = 12; // same as src/lib/auth/password.ts
const MIN_LENGTH = 8; // same as passwordSchema in src/modules/users/schema.ts

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
if (!email || !email.includes("@") || !name) {
  console.error('Usage: node scripts/create-admin.mjs you@vertigo.dk "Your Name"');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this inside the app container: docker compose exec app node scripts/create-admin.mjs ...");
  process.exit(1);
}

/** Read a line without echoing it on a terminal; piped input (non-TTY) is read as is. */
function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    if (process.stdin.isTTY) rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : "");
    rl.question(question, (answer) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await ask("Password: ");
if (password.length < MIN_LENGTH) {
  console.error(`The password must be at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
if (process.stdin.isTTY && (await ask("Again: ")) !== password) {
  console.error("The two passwords differ.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const hash = await bcrypt.hash(password, ROUNDS);
  const normalised = email.trim().toLowerCase();
  const existing = await client.query('SELECT id FROM "User" WHERE lower(email) = $1', [normalised]);
  if (existing.rows.length) {
    await client.query('UPDATE "User" SET "passwordHash" = $1, role = \'admin\', active = true, name = $2, "updatedAt" = now() WHERE id = $3', [hash, name, existing.rows[0].id]);
    console.log(`Updated ${normalised}: admin, active, new password.`);
  } else {
    await client.query('INSERT INTO "User" (id, email, name, "passwordHash", role, active, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'admin\', true, now(), now())', [randomUUID(), normalised, name, hash]);
    console.log(`Created admin ${normalised}. Sign in and add your colleagues under Settings › Users.`);
  }
} finally {
  await client.end();
}

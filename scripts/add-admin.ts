/**
 * Creates an admin user in Supabase Auth + Prisma User table.
 *
 * Usage:
 *   npm run add-admin -- --email admin@example.com --password secret --name "Admin User"
 */
import { PrismaClient, Role } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1]) {
      parsed[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return parsed;
}

async function main() {
  const { email, password, name } = parseArgs();

  if (!email || !password || !name) {
    console.error('Usage: npm run add-admin -- --email <email> --password <password> --name <name>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const prisma = new PrismaClient();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.admin, name },
    });
    await supabase.auth.admin.updateUserById(existing.supabaseId, {
      user_metadata: { name, role: 'admin', must_change_password: false },
    });
    console.log(`Promoted existing user to admin: ${email} (${existing.id})`);
    await prisma.$disconnect();
    return;
  }

  const { data: authData, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'admin', must_change_password: false },
  });

  if (error || !authData.user) {
    console.error('Failed to create auth user:', error?.message);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      supabaseId: authData.user.id,
      name,
      email,
      role: Role.admin,
    },
  });

  console.log(`Admin user created: ${email} (${user.id})`);
  await prisma.$disconnect();
}

main();

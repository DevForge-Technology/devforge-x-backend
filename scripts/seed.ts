import { PrismaClient, Role } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const companiesData = [
  {
    name: 'Acme Corp',
    description: 'A global supplier of widgets and gears.',
    logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
    accentColor: '#4F46E5',
    status: 'active' as const,
  },
  {
    name: 'Stark Industries',
    description: 'Leading the world in advanced technology and defense.',
    logo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
    accentColor: '#DC2626',
    status: 'active' as const,
  },
  {
    name: 'Wayne Enterprises',
    description: 'Diverse multinational conglomerate specializing in tech and shipping.',
    logo: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf',
    accentColor: '#111827',
    status: 'active' as const,
  },
];

const vendorsData = [
  {
    email: 'vendor.john@example.com',
    name: 'John Vendor',
    password: 'Password123!',
    companies: ['Acme Corp', 'Stark Industries'],
  },
  {
    email: 'vendor.jane@example.com',
    name: 'Jane Vendor',
    password: 'Password123!',
    companies: ['Stark Industries', 'Wayne Enterprises'],
  },
  {
    email: 'vendor.bob@example.com',
    name: 'Bob Vendor',
    password: 'Password123!',
    companies: ['Acme Corp'],
  },
];

const referralsData = [
  {
    name: 'Alice Cooper',
    email: 'alice.cooper@example.com',
    productInfo: 'Looking for Acme Corp heavy machinery solutions.',
    referenceLinks: ['https://example.com/alice-rfq'],
    hostName: 'Admin Host',
    hostEmail: 'admin@example.com',
    vendorEmail: 'vendor.john@example.com',
    companyName: 'Acme Corp',
  },
  {
    name: 'Bruce Wayne',
    email: 'bruce@wayne.com',
    productInfo: 'Interested in Stark Industries defense grids.',
    referenceLinks: ['https://example.com/bruce-contact'],
    hostName: 'Admin Host',
    hostEmail: 'admin@example.com',
    vendorEmail: 'vendor.jane@example.com',
    companyName: 'Stark Industries',
  },
  {
    name: 'Clark Kent',
    email: 'clark@dailyplanet.com',
    productInfo: 'Needs Wayne Enterprises satellite uplink systems.',
    referenceLinks: [],
    hostName: 'Admin Host',
    hostEmail: 'admin@example.com',
    vendorEmail: 'vendor.jane@example.com',
    companyName: 'Wayne Enterprises',
  },
  {
    name: 'Diana Prince',
    email: 'diana@themyscira.gov',
    productInfo: 'Inquiring about Stark Industries clean energy initiative.',
    referenceLinks: ['https://example.com/clean-energy'],
    hostName: 'Admin Host',
    hostEmail: 'admin@example.com',
    vendorEmail: 'vendor.jane@example.com',
    companyName: 'Stark Industries',
  },
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const prisma = new PrismaClient();

  console.log('Seeding companies...');
  const companyMap: Record<string, string> = {};

  for (const cData of companiesData) {
    let company = await prisma.company.findFirst({
      where: { name: cData.name },
    });

    if (!company) {
      company = await prisma.company.create({
        data: cData,
      });
      console.log(`Created company: ${company.name} (${company.id})`);
    } else {
      console.log(`Company already exists: ${company.name} (${company.id})`);
    }
    companyMap[company.name] = company.id;
  }

  console.log('\nSeeding vendors...');
  const vendorMap: Record<string, string> = {};

  // List existing Supabase users to check before creating
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Failed to list Supabase users:', listError.message);
    process.exit(1);
  }
  const existingSupabaseUsers = listData.users || [];

  for (const vData of vendorsData) {
    let user = await prisma.user.findUnique({
      where: { email: vData.email },
    });

    if (!user) {
      // Check if user exists in Supabase
      const match = existingSupabaseUsers.find((u) => u.email === vData.email);
      let supabaseId = '';

      if (match) {
        supabaseId = match.id;
        console.log(`Found existing Supabase user for ${vData.email}`);
      } else {
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
          email: vData.email,
          password: vData.password,
          email_confirm: true,
          user_metadata: { name: vData.name, role: 'vendor', must_change_password: false },
        });

        if (createError || !authData.user) {
          console.error(`Failed to create Supabase user for ${vData.email}:`, createError?.message);
          continue;
        }
        supabaseId = authData.user.id;
        console.log(`Created Supabase auth user for ${vData.email}`);
      }

      user = await prisma.user.create({
        data: {
          supabaseId,
          name: vData.name,
          email: vData.email,
          role: Role.vendor,
        },
      });
      console.log(`Created Prisma user: ${user.email} (${user.id})`);
    } else {
      console.log(`Prisma user already exists: ${user.email} (${user.id})`);
    }
    vendorMap[user.email] = user.id;

    // Link user to companies
    for (const compName of vData.companies) {
      const company = await prisma.company.update({
        where: { id: companyMap[compName] },
        data: {
          vendorId: user.id,
        },
      });
      console.log(`Updated company ${company.name} with vendor ${user.email}`);
    }

    // Set default and last used company if not set
    if (vData.companies.length > 0 && (!user.defaultCompanyId || !user.lastUsedCompanyId)) {
      const firstCompanyId = companyMap[vData.companies[0]];
      if (firstCompanyId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            defaultCompanyId: user.defaultCompanyId || firstCompanyId,
            lastUsedCompanyId: user.lastUsedCompanyId || firstCompanyId,
          },
        });
        console.log(`Set default/last used company for ${user.email} to ${vData.companies[0]}`);
      }
    }
  }

  console.log('\nSeeding referrals...');
  for (const ref of referralsData) {
    const vendorId = vendorMap[ref.vendorEmail];
    const companyId = companyMap[ref.companyName];

    if (!vendorId || !companyId) {
      console.warn(`Skipping referral for ${ref.name}: vendor or company not found.`);
      continue;
    }

    // Check if referral exists
    const existingRef = await prisma.referral.findFirst({
      where: {
        email: ref.email,
        vendorId,
        companyId,
      },
    });

    if (!existingRef) {
      const created = await prisma.referral.create({
        data: {
          name: ref.name,
          email: ref.email,
          productInfo: ref.productInfo,
          referenceLinks: ref.referenceLinks,
          hostName: ref.hostName,
          hostEmail: ref.hostEmail,
          vendorId,
          companyId,
        },
      });
      console.log(`Created referral: ${created.name} (${created.id})`);
    } else {
      console.log(`Referral already exists: ${existingRef.name} (${existingRef.id})`);
    }
  }

  console.log('\nSeeding complete.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});

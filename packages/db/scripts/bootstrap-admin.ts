/**
 * One-time bootstrap: upsert a company and create an ADMIN user.
 * Use for local/staging setup when the web /setup flow is not used.
 *
 * Required: DATABASE_URL (env). Company/admin data from env OR CLI args.
 * Env: BOOTSTRAP_COMPANY_NAME, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD (min 8 chars).
 * CLI: npm run bootstrap:admin -- "Company Name" admin@example.com "Admin Name" yourpassword
 * Blocked when NODE_ENV=production unless BOOTSTRAP_FORCE=1 or BOOTSTRAP_FORCE=true.
 *
 * Run from root: npm run bootstrap:admin
 * Or: npm run bootstrap:admin -- "My Co" admin@test.com Admin password123
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function guard() {
  const isProduction = process.env.NODE_ENV === 'production';
  const force = process.env.BOOTSTRAP_FORCE === '1' || process.env.BOOTSTRAP_FORCE === 'true';
  if (isProduction && !force) {
    console.error('❌ Bootstrap is not allowed in production unless BOOTSTRAP_FORCE=1 is set.');
    process.exit(1);
  }
}

function getInput(): { companyName: string; email: string; name: string; password: string } {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Missing required env: DATABASE_URL');
    process.exit(1);
  }

  const fromEnv =
    process.env.BOOTSTRAP_COMPANY_NAME &&
    process.env.BOOTSTRAP_EMAIL &&
    process.env.BOOTSTRAP_NAME &&
    process.env.BOOTSTRAP_PASSWORD;
  if (fromEnv) {
    const password = process.env.BOOTSTRAP_PASSWORD!;
    if (password.length < 8) {
      console.error('❌ BOOTSTRAP_PASSWORD must be at least 8 characters.');
      process.exit(1);
    }
    return {
      companyName: process.env.BOOTSTRAP_COMPANY_NAME!,
      email: process.env.BOOTSTRAP_EMAIL!,
      name: process.env.BOOTSTRAP_NAME!,
      password,
    };
  }

  const argv = process.argv.slice(2);
  if (argv.length < 4) {
    console.error('❌ Missing bootstrap data. Either set in .env:');
    console.error('   BOOTSTRAP_COMPANY_NAME, BOOTSTRAP_EMAIL, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD');
    console.error('   Or pass as arguments:');
    console.error('   npm run bootstrap:admin -- "Company Name" admin@example.com "Admin Name" yourpassword');
    process.exit(1);
  }
  const [companyName, email, name, password] = argv;
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters.');
    process.exit(1);
  }
  return { companyName, email, name, password };
}

async function main() {
  guard();
  const { companyName, email, name, password } = getInput();

  const passwordHash = await bcrypt.hash(password, 10);

  let company = await prisma.company.findFirst({ where: { name: companyName } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: companyName, isActive: true },
    });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log('Company ID:', company.id);
    console.log('User already exists with email:', email);
    process.exit(0);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      companyId: company.id,
      isActive: true,
    },
  });

  console.log('Company ID:', company.id);
  console.log('Admin email:', user.email);
}

main()
  .catch((e) => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

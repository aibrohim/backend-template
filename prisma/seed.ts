import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

import { PrismaClient, Role } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const fullName = process.env.SUPERADMIN_FULL_NAME;

  if (!email || !password || !fullName) {
    console.log('Superadmin env vars not set, skipping seed');
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });

  if (existingUser) {
    console.log('Superadmin already exists');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName,
      role: Role.superadmin,
      emailVerified: true,
    },
  });

  console.log('Superadmin created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

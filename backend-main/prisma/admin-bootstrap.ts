import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE?.trim();

  if (!adminPhone) {
    throw new Error(
      'ADMIN_PHONE is missing. Add ADMIN_PHONE to the .env file.',
    );
  }

  const adminRole = await prisma.role.findUnique({
    where: {
      name: 'ADMIN',
    },
  });

  if (!adminRole) {
    throw new Error(
      'ADMIN role does not exist. Run the Prisma seed command first.',
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      phone: adminPhone,
    },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new Error(
      `No user found with phone ${adminPhone}. First log in once using OTP from the customer login so the account is created.`,
    );
  }

  if (user.role?.name === 'ADMIN') {
    console.log(`✅ User ${adminPhone} is already an ADMIN.`);
    return;
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      roleId: adminRole.id,
      isActive: true,
      isBlocked: false,
      isVerified: true,
    },
    include: {
      role: true,
    },
  });

  console.log('✅ Admin account configured successfully');
  console.log({
    id: updatedUser.id,
    phone: updatedUser.phone,
    role: updatedUser.role.name,
    isActive: updatedUser.isActive,
    isBlocked: updatedUser.isBlocked,
  });
}

main()
  .catch((error: unknown) => {
    console.error('❌ Admin bootstrap failed');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
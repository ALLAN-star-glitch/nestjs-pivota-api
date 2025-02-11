import { PrismaClient, Plan } from "@prisma/client";
import * as crypto from 'crypto';
const dayjs = require('dayjs');

const prisma = new PrismaClient();

async function main() {
  // Define roles
  const roleNames = ["user", "serviceProvider", "landlord", "employer", "admin"];

  // Create roles in the database
  await prisma.role.createMany({
    data: roleNames.map((role) => ({ name: role })),
    skipDuplicates: true, // Skip if the role already exists
  });

  // Fetch roles from the database
  const roles = await prisma.role.findMany();

  // Helper function to get role ID by name
  const getRoleId = (name: string) => roles.find((role) => role.name === name)?.id;

  // Remove the password hashing step and use plain text passwords
  const defaultPassword = "password"; // Plaintext password
  const premiumPassword = "premiumpassword"; // Plaintext password

  console.log(defaultPassword); // Log the plaintext password
  console.log(premiumPassword); // Log the plaintext password

  // Create a default free user
  const freeUser = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      firstName: "Default",
      lastName: "User",
      phone: "1234567890",
      password: defaultPassword, // Use plaintext password
      isPremium: false,
      plan: Plan.free, // Use Prisma Enum
    },
  });

  // Assign the "user" role to free user if not already assigned
  if (getRoleId("user")) {
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: freeUser.id,
        roleId: getRoleId("user")!,
      },
    });

    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: freeUser.id,
          roleId: getRoleId("user")!,
        },
      });
    }
  }

  // Create a premium user
  const premiumUser = await prisma.user.upsert({
    where: { email: "premium@example.com" },
    update: {},
    create: {
      email: "premium@example.com",
      firstName: "Premium",
      lastName: "User",
      phone: "9876543210",
      password: premiumPassword, // Use plaintext password
      isPremium: true,
      plan: Plan.gold, // Use Prisma Enum
    },
  });

  // Assign multiple roles to premium user
  const premiumRoles = ["user", "serviceProvider", "landlord"];
  for (const role of premiumRoles) {
    if (getRoleId(role)) {
      const existingPremiumUserRole = await prisma.userRole.findFirst({
        where: {
          userId: premiumUser.id,
          roleId: getRoleId(role)!,
        },
      });

      if (!existingPremiumUserRole) {
        await prisma.userRole.create({
          data: {
            userId: premiumUser.id,
            roleId: getRoleId(role)!,
          },
        });
      }
    }
  }

  // Create refresh tokens for testing (using secure random token generation)
  const createRefreshToken = async (userId: string) => {
    const refreshToken = crypto.randomBytes(64).toString("hex"); // Generate a secure 64-byte hex string
    const expiresAt = dayjs().add(30, "days").toDate(); // Set expiration time for 30 days
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: userId,
        expiresAt: expiresAt,
      },
    });
  };

  // Create refresh token for the free user (for testing purposes)
  await createRefreshToken(freeUser.id);

  // Create refresh token for the premium user (for testing purposes)
  await createRefreshToken(premiumUser.id);

  console.log("Roles, users, refresh tokens, and plans seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

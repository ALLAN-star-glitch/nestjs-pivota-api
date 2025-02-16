import { PrismaClient, Plan } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import * as dayjs from "dayjs";

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

  // Securely hash passwords before storing
  const defaultPassword = await bcrypt.hash("password", 12);
  const premiumPassword = await bcrypt.hash("premiumpassword", 12);

  console.log("Default User Password:", defaultPassword);
  console.log("Premium User Password:", premiumPassword);

  // Create a default free user
  const freeUser = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      firstName: "Default",
      lastName: "User",
      phone: "1234567890",
      password: defaultPassword, // Hashed password
      isPremium: false,
      plan: Plan.free,
    },
  });

  // Assign the "user" role to free user if not already assigned
  if (getRoleId("user")) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: freeUser.id, roleId: getRoleId("user")! },
      },
      update: {},
      create: {
        userId: freeUser.id,
        roleId: getRoleId("user")!,
      },
    });
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
      password: premiumPassword, // Hashed password
      isPremium: true,
      plan: Plan.gold,
    },
  });

  // Assign multiple roles to premium user
  const premiumRoles = ["user", "serviceProvider", "landlord"];
  for (const role of premiumRoles) {
    if (getRoleId(role)) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: { userId: premiumUser.id, roleId: getRoleId(role)! },
        },
        update: {},
        create: {
          userId: premiumUser.id,
          roleId: getRoleId(role)!,
        },
      });
    }
  }

  // Function to create refresh tokens with device info
  const createRefreshToken = async (userId: string, device: string, ipAddress?: string) => {
    const refreshToken = crypto.randomBytes(64).toString("hex"); // Generate secure token
    const expiresAt = dayjs().add(30, "days").toDate(); // Expire in 30 days

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        device,
        ipAddress,
        expiresAt,
      },
    });

    console.log(`Created refresh token for ${userId} on ${device}`);
  };

  // Create refresh tokens for users (simulating different devices)
  await createRefreshToken(freeUser.id, "Laptop", "192.168.1.10");
  await createRefreshToken(freeUser.id, "Mobile", "192.168.1.11");
  await createRefreshToken(premiumUser.id, "Desktop", "192.168.1.12");
  await createRefreshToken(premiumUser.id, "Tablet", "192.168.1.13");

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(" Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

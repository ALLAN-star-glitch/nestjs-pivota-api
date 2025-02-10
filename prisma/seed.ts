import { PrismaClient, Plan } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Define roles
  const roleNames = ["user", "serviceProvider", "landlord", "employer"];

  // Create roles in the database
  const roles = await prisma.role.createMany({
    data: roleNames.map((role) => ({ name: role })),
    skipDuplicates: true, // Skip if the role already exists (optional)
  });

  // Hash passwords
  const defaultPassword = await bcrypt.hash("password", 12);
  const premiumPassword = await bcrypt.hash("premiumpassword", 12);

  // Create a default free user
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      firstName: "Default",
      lastName: "User",
      phone: "1234567890",
      password: defaultPassword,
      isPremium: false,
      plan: "free" as Plan, // Use Prisma Enum
      roles: { connect: [{ name: "user" }] }, // Connect to the user role
    },
  });

  // Create a premium user with multiple roles
  await prisma.user.upsert({
    where: { email: "premium@example.com" },
    update: {},
    create: {
      email: "premium@example.com",
      firstName: "Premium",
      lastName: "User",
      phone: "9876543210",
      password: premiumPassword,
      isPremium: true,
      plan: "gold" as Plan, // Use Prisma Enum
      roles: {
        connect: [
          { name: "user" },
          { name: "serviceProvider" },
          { name: "landlord" },
        ], // Connect to multiple roles
      },
    },
  });

  console.log("Roles, users, and plans seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

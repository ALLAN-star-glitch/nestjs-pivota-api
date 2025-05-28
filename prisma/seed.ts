/**
 * Seed script for Pivota platform
 * Uses Prisma Client to populate initial data:
 * - Roles, Permissions, Role-Permission links
 * - Plans, Plan Features
 * - Categories, Category Rules
 * - Users with default 'user' role plus any extra roles
 * - User-Category links
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ========== ROLES ==========
  const rolesData = [
    { name: "user", description: "Registered user with basic access" },
    { name: "admin", description: "Administrator with full privileges" },
    { name: "super_admin", description: "Super administrator with elevated privileges" },
  ];

  // Upsert roles & keep a map of name → id for easy reference
  const roleMap = new Map<string, string>();
  for (const role of rolesData) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    roleMap.set(role.name, r.id);
  }

  // ========== PERMISSIONS ==========
  const permissionsData = [
    { name: "read_users", description: "Can read user data" },
    { name: "write_users", description: "Can create or update user data" },
    { name: "delete_users", description: "Can delete user data" },
    { name: "manage_roles", description: "Can assign and manage roles" },
    { name: "post_house_ads", description: "Can post house listings" },
    { name: "manage_plans", description: "Can create or update plans" },
    { name: "manage_categories", description: "Can create or update service categories" },
  ];

  const permissionMap = new Map<string, string>();
  for (const perm of permissionsData) {
    const p = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    permissionMap.set(perm.name, p.id);
  }

  // ========== ROLE-PERMISSION LINKS ==========
  // Example: admin and super_admin have all permissions; user has only some basic permissions
  const rolePermissions = [
    { role: "user", permissions: ["post_house_ads"] },
    { role: "admin", permissions: [...permissionsData.map(p => p.name)] },
    { role: "super_admin", permissions: [...permissionsData.map(p => p.name)] },
  ];

  for (const rp of rolePermissions) {
    const roleId = roleMap.get(rp.role);
    if (!roleId) continue;
    for (const permName of rp.permissions) {
      const permId = permissionMap.get(permName);
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
  }

  // ========== PLANS ==========
  const plansData = [
    {
      name: "free",
      slug: "free",
      price: 0,
      description: "Basic free plan",
      features: ["limited_listings", "basic_support"],
    },
    {
      name: "premium",
      slug: "premium",
      price: 29.99,
      description: "Premium plan with more features",
      features: ["unlimited_listings", "priority_support", "visibility_boost"],
    },
  ];

  const planMap = new Map<string, string>();
  for (const plan of plansData) {
    const p = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        price: plan.price,
        description: plan.description,
        features: plan.features,
      },
      create: plan,
    });
    planMap.set(plan.slug, p.id);
  }

  // ========== PLAN FEATURES ==========
  // Example granular features for plans
  const planFeaturesData = [
    { planSlug: "free", key: "max_listings", value: "5" },
    { planSlug: "premium", key: "max_listings", value: "unlimited" },
  ];

  for (const pf of planFeaturesData) {
    const planId = planMap.get(pf.planSlug);
    if (!planId) continue;
    await prisma.planFeature.upsert({
      where: { id: `${planId}-${pf.key}` }, // composite key workaround: using a synthetic id
      update: { value: pf.value },
      create: {
        id: `${planId}-${pf.key}`, // ensure unique id for upsert
        planId,
        key: pf.key,
        value: pf.value,
      },
    });
  }

  // ========== CATEGORIES ==========
  const categoriesData = [
    { name: "Plumbing", slug: "plumbing", description: "Plumbing services" },
    { name: "Electrician", slug: "electrician", description: "Electrical services" },
    { name: "Carpentry", slug: "carpentry", description: "Carpentry and woodworking" },
  ];

  const categoryMap = new Map<string, string>();
  for (const category of categoriesData) {
    const c = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { description: category.description, name: category.name },
      create: category,
    });
    categoryMap.set(category.slug, c.id);
  }

  // ========== CATEGORY RULES ==========
  // Rules define limits and features per plan per category
  const categoryRulesData = [
    {
      categorySlug: "plumbing",
      planSlug: "free",
      maxListings: 2,
      visibilityBoost: false,
    },
    {
      categorySlug: "plumbing",
      planSlug: "premium",
      maxListings: 10,
      visibilityBoost: true,
    },
    {
      categorySlug: "electrician",
      planSlug: "free",
      maxListings: 1,
      visibilityBoost: false,
    },
    {
      categorySlug: "electrician",
      planSlug: "premium",
      maxListings: 8,
      visibilityBoost: true,
    },
    {
      categorySlug: "carpentry",
      planSlug: "free",
      maxListings: 1,
      visibilityBoost: false,
    },
    {
      categorySlug: "carpentry",
      planSlug: "premium",
      maxListings: 5,
      visibilityBoost: true,
    },
  ];

  for (const rule of categoryRulesData) {
    const categoryId = categoryMap.get(rule.categorySlug);
    const planId = planMap.get(rule.planSlug);
    if (!categoryId || !planId) continue;
    await prisma.categoryRule.upsert({
      where: { id: `${categoryId}-${planId}` }, // synthetic composite id
      update: {
        maxListings: rule.maxListings,
        visibilityBoost: rule.visibilityBoost,
      },
      create: {
        id: `${categoryId}-${planId}`,
        categoryId,
        planId,
        maxListings: rule.maxListings,
        visibilityBoost: rule.visibilityBoost,
      },
    });
  }

  // ========== USERS ==========
  // Example users, with roles (apart from default "user" role)
  const usersData = [
    {
      email: "user@example.com",
      firstName: "Default",
      lastName: "User",
      phone: "+254700000001",
      password: "hashed_password_here",
      isPremium: false,
      planSlug: "free",
      role: "user",
      categories: ["plumbing"],
    },
    {
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      phone: "+254700000002",
      password: "hashed_password_here",
      isPremium: true,
      planSlug: "premium",
      role: "admin",
      categories: ["plumbing", "electrician"],
    },
    {
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      phone: "+254700000003",
      password: "hashed_password_here",
      isPremium: true,
      planSlug: "premium",
      role: "super_admin",
      categories: ["plumbing", "electrician", "carpentry"],
    },
  ];

  // Helper fn to get role id
  const getRoleId = (roleName: string) => roleMap.get(roleName);

  // Helper fn to get plan id
  const getPlanId = (planSlug: string) => planMap.get(planSlug);

  // Seed users and assign roles & categories
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        password: u.password,
        isPremium: u.isPremium,
        planId: getPlanId(u.planSlug) ?? undefined,
      },
    });

    // Assign default "user" role to every user
    const userRoleId = getRoleId("user");
    if (userRoleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: userRoleId } },
        update: {},
        create: { userId: user.id, roleId: userRoleId },
      });
    }

    // Assign additional specific role if not "user"
    if (u.role !== "user") {
      const extraRoleId = getRoleId(u.role);
      if (extraRoleId) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: extraRoleId } },
          update: {},
          create: { userId: user.id, roleId: extraRoleId },
        });
      }
    }

    // Assign user categories (many-to-many)
    if (u.categories?.length) {
      for (const catSlug of u.categories) {
        const catId = categoryMap.get(catSlug);
        if (!catId) continue;
        await prisma.userCategory.upsert({
          where: { userId_categoryId: { userId: user.id, categoryId: catId } },
          update: {},
          create: { userId: user.id, categoryId: catId },
        });
      }
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

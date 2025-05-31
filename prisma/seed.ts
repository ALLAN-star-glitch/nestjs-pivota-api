import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ========== ROLES ==========
  const rolesData = [
    { name: "registered_user", description: "Default role for all signed-up users" },
    { name: "moderator", description: "Can review and moderate content or reports" },
    { name: "admin", description: "Administrator with platform-level privileges" },
    { name: "super_admin", description: "Full access to manage platform settings" },
    { name: "partner", description: "External partner with limited elevated access" },
  ];

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
    { name: "view_listings", description: "Can view listings" },
    { name: "moderate_content", description: "Can moderate reports and listings" },
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
  const rolePermissions = [
    { role: "registered_user", permissions: ["view_listings"] },
    { role: "moderator", permissions: ["read_users", "moderate_content"] },
    { role: "admin", permissions: permissionsData.map(p => p.name).filter(p => p !== "manage_roles") },
    { role: "super_admin", permissions: permissionsData.map(p => p.name) },
    { role: "partner", permissions: ["read_users", "view_listings"] },
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
    { name: "Free Plan", slug: "free", price: 0, description: "Basic free plan", features: ["limited_listings", "basic_support"] },
    { name: "Bronze Plan", slug: "bronze", price: 9.99, description: "Starter plan", features: ["more_listings", "basic_support"] },
    { name: "Silver Plan", slug: "silver", price: 19.99, description: "Good value plan", features: ["even_more_listings", "standard_support", "boosted_visibility"] },
    { name: "Gold Plan", slug: "gold", price: 29.99, description: "Pro-level features", features: ["many_listings", "priority_support", "high_visibility"] },
    { name: "Platinum Plan", slug: "platinum", price: 49.99, description: "All features unlocked", features: ["unlimited_listings", "premium_support", "top_visibility", "priority_ads"] },
  ];

  const planMap = new Map<string, string>();
  for (const plan of plansData) {
    const p = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { price: plan.price, description: plan.description, features: plan.features },
      create: plan,
    });
    planMap.set(plan.slug, p.id);
  }

  // ========== PLAN FEATURES ==========
  const planFeaturesData = [
    { planSlug: "free", key: "max_listings", value: "5" },
    { planSlug: "bronze", key: "max_listings", value: "10" },
    { planSlug: "silver", key: "max_listings", value: "20" },
    { planSlug: "gold", key: "max_listings", value: "50" },
    { planSlug: "platinum", key: "max_listings", value: "unlimited" },
  ];

  for (const pf of planFeaturesData) {
    const planId = planMap.get(pf.planSlug);
    if (!planId) continue;
    await prisma.planFeature.upsert({
      where: { id: `${planId}-${pf.key}` },
      update: { value: pf.value },
      create: {
        id: `${planId}-${pf.key}`,
        planId,
        key: pf.key,
        value: pf.value,
      },
    });
  }

  // ========== SERVICE CATEGORIES ==========
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

  // ========== CATEGORY RULES PER PLAN ==========
  type CategoryRuleSeed = {
  id: string;
  categoryId: string;
  planId: string;
  maxListings: number;
  visibilityBoost: boolean;
};

const categoryRulesData: CategoryRuleSeed[] = [];

  for (const [categorySlug, rules] of Object.entries({
    plumbing: [2, 5, 10, 20, 50],
    electrician: [1, 4, 8, 15, 30],
    carpentry: [1, 3, 6, 12, 25],
  })) {
    const categoryId = categoryMap.get(categorySlug)!;

    ["free", "bronze", "silver", "gold", "platinum"].forEach((planSlug, index) => {
      const planId = planMap.get(planSlug);
      if (!planId) return;

      categoryRulesData.push({
        id: `${categoryId}-${planId}`,
        categoryId,
        planId,
        maxListings: rules[index],
        visibilityBoost: planSlug !== "free" && planSlug !== "bronze",
      });
    });
  }

  for (const rule of categoryRulesData) {
    await prisma.categoryRule.upsert({
      where: { id: rule.id },
      update: { maxListings: rule.maxListings, visibilityBoost: rule.visibilityBoost },
      create: rule,
    });
  }

  // ========== USERS ==========
  const usersData = [
    {
      email: "user@example.com",
      firstName: "Default",
      lastName: "User",
      phone: "+254700000001",
      password: "hashed_password_here",
      isPremium: false,
      planSlug: "free",
      roles: ["registered_user"],
    },
    {
      email: "provider@example.com",
      firstName: "Service",
      lastName: "Provider",
      phone: "+254700000004",
      password: "hashed_password_here",
      isPremium: true,
      planSlug: "gold",
      roles: ["registered_user"],
      categories: ["plumbing", "electrician"],
    },
    {
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      phone: "+254700000002",
      password: "hashed_password_here",
      isPremium: true,
      planSlug: "silver",
      roles: ["registered_user", "admin"],
    },
    {
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      phone: "+254700000003",
      password: "Brav1997@#",
      isPremium: true,
      planSlug: "platinum",
      roles: ["registered_user", "super_admin"],
    },
  ];

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
        planId: planMap.get(u.planSlug) ?? undefined,
      },
    });

    for (const roleName of u.roles) {
      const roleId = roleMap.get(roleName);
      if (!roleId) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }

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

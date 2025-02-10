// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { SignupSchema } from './dto/signup.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async signup(signupDto: any) {
    const parsedData = SignupSchema.safeParse(signupDto);

    if (!parsedData.success) {
      return { message: "Validation failed", errors: parsedData.error.errors, status: 400 };
    }

    const { firstName, lastName, email, password, confirmPassword, phone, plan, roles } = parsedData.data;

    // Check if passwords match
    if (password !== confirmPassword) {
      return { message: "Passwords do not match", status: 400 };
    }

    // Check if email already exists
    const existingUserByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      return { message: "An account with this email already exists.", status: 409 };
    }

    // Check if phone number is already taken
    const existingPhoneNumber = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhoneNumber) {
      return { message: "An account with this phone number already exists.", status: 409 };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Define roles per plan
    const rolesPerPlan = {
      free: ["user"],
      bronze: ["employer", "landlord", "serviceProvider"],
      silver: ["employer", "landlord", "serviceProvider"],
      gold: ["employer", "landlord", "serviceProvider"],
    };

    let roleNames = ["user"];

    // Validate roles
    if (roles) {
      const invalidRoles = roles.filter(role => !rolesPerPlan[plan]?.includes(role));
      if (invalidRoles.length > 0) {
        return { message: `Invalid role(s): ${invalidRoles.join(", ")}`, status: 400 };
      }

      roleNames = [...roleNames, ...roles];
    }

    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    if (roleRecords.length !== roleNames.length) {
      return { message: "One or more roles do not exist.", status: 400 };
    }

    // Create the user
    const newUserData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      plan,
      isPremium: plan !== "free",
      roles: {
        connect: roleRecords.map((role) => ({ id: role.id })),
      },
    };

    const newUser = await this.prisma.user.create({ data: newUserData });

    let successMessage = "Your account was created successfully.";
    if (plan === "bronze") successMessage = "Your bronze premium membership has been created successfully.";
    else if (plan === "silver") successMessage = "Your silver premium membership has been created successfully.";
    else if (plan === "gold") successMessage = "Your gold premium membership has been created successfully.";

    return { user: newUser, message: successMessage, status: 201 };
  }
}

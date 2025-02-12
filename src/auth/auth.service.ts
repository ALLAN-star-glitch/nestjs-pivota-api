import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
const dayjs = require('dayjs');
import * as crypto from 'crypto';

import { SignupSchema } from './dto/signup.dto';
import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService, // Injecting JwtService for signing tokens ... JwtService is used for generating tokens
  ) {
    console.log('AuthService is being initialized');
    console.log(process.env.JWT_SECRET);
  }

  async validateUser(email: string, password: string): Promise<User> {
    // Find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true }, // Optionally include roles for role-based checks
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare the provided password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return the user if credentials are valid
    return user;
  }

  async signup(signupDto: any) {
    const parsedData = SignupSchema.safeParse(signupDto);
  
    if (!parsedData.success) {
      console.log(parsedData.error.errors)
      return { message: "Validation failed", errors: parsedData.error.errors, status: 400 };
    }
  
    const { firstName, lastName, email, password, confirmPassword, phone, plan, roles } = parsedData.data;
  
    if (password !== confirmPassword) {
      return { message: "Passwords do not match", status: 400 };
    }
  
    const existingUserByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      return { message: "An account with this email already exists.", status: 409 };
    }
  
    const existingPhoneNumber = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhoneNumber) {
      return { message: "An account with this phone number already exists.", status: 409 };
    }
  
    const hashedPassword = await bcrypt.hash(password, 12);
  
    const rolesPerPlan = {
      free: ["user"], // Free plan only allows "user" role
      bronze: ["landlord", "employer", "serviceProvider"], // 1 premium role limit
      silver: ["landlord", "employer", "serviceProvider"], // 2 premium roles limit
      gold: ["landlord", "employer", "serviceProvider"], // 3 premium roles limit
    };
  
    let roleNames = ["user"]; // Every user gets the "user" role by default
  
    if (roles) {
      // Filter out any roles that don't match the allowed roles for the selected plan
      const validRoles = roles.filter(role => rolesPerPlan[plan]?.includes(role));
  
      if (validRoles.length !== roles.length) {
        return { message: "Some roles are invalid for your plan.", status: 400 };
      }
  
      // Enforce the plan's limit on roles
      if (validRoles.length > (plan === 'bronze' ? 1 : plan === 'silver' ? 2 : 3)) {
        return { message: `You can select up to ${plan === 'bronze' ? 1 : plan === 'silver' ? 2 : 3} roles for your plan.`, status: 400 };
      }
  
      roleNames = [...roleNames, ...validRoles];
    }
  
    // Fetch roles from the database
    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
  
    if (roleRecords.length !== roleNames.length) {
      return { message: "One or more roles do not exist.", status: 400 };
    }
  
    const newUserData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      plan,
      isPremium: plan !== "free",
    };
  
    // Create the new user
    const user = await this.prisma.user.create({
      data: newUserData,
    });
  
    // Create the user roles for the user
    const rolesForUser = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });
  
    //saving roles for user in the UserRole table ... i.e., assigning roles to the user
    await this.prisma.userRole.createMany({
      data: rolesForUser.map(role => ({
        userId: user.id,
        roleId: role.id,
      })),
    });
  
    let successMessage = "Your account was created successfully.";
    if (plan === "bronze") successMessage = "Your bronze premium membership has been created successfully.";
    else if (plan === "silver") successMessage = "Your silver premium membership has been created successfully.";
    else if (plan === "gold") successMessage = "Your gold premium membership has been created successfully.";
  
    return { user, message: successMessage, status: 201 };
  }
  
  

  // ------------------ LOGIN FUNCTION ------------------
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          select: {
            role: {
              select: {
                name: true, // Select the 'name' field from the Role model
              }
            }
          }
        }
      },
    });
  
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }
  
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
  
    // Extract role names from the user roles relation
    const userRoles = user.roles.map(role => role.role.name);
  
    // Check if the user has allowed roles
    const allowedRoles = ["user", "employer", "landlord", "serviceProvider"];
    const isAuthorized = userRoles.some(role => allowedRoles.includes(role));
  
    if (!isAuthorized) {
      throw new UnauthorizedException("You do not have permission to access this application.");
    }
  
    // Generate access and refresh tokens
    const jwtResponse = this.generateJwt(user);
  
    // Save the refresh token to the database
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: jwtResponse.refresh_token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days (refresh token validity)
      },
    });
  
    return {
      access_token: jwtResponse.access_token,
      refresh_token: jwtResponse.refresh_token, // Return the refresh token as well
      roles: userRoles, // Now returning the correct roles
    };
  }
  

// ------------------ GENERATE JWT FUNCTION ------------------
private generateJwt(user: any) {
  const refreshToken = crypto.randomBytes(64).toString('hex'); // Generate a random refresh token

  // Prepare the payload without 'exp' in the payload
  const payload = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    roles: user.roles.map((role: any) => role.name),
  };

  // Generate the access token
  const access_token = this.jwtService.sign(payload, {
    expiresIn: '1h', // Access token expires in 1 hour
  });

  return {
    access_token,
    refresh_token: refreshToken, // Return the refresh token
  };
}

}

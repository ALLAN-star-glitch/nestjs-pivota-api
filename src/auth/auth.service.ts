import { Injectable, UnauthorizedException } from '@nestjs/common';

import * as bcrypt from 'bcryptjs';

import { SignupSchema } from './dto/signup.dto';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService, // Injecting JwtService for signing tokens
  ) {

    console.log('AuthService is being initialized');
    console.log(process.env.JWT_SECRET);
  }
  
  async validateUser(email: string, password: string) {
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
      free: ["user"],
      bronze: ["employer", "landlord", "serviceProvider"],
      silver: ["employer", "landlord", "serviceProvider"],
      gold: ["employer", "landlord", "serviceProvider"],
    };

    let roleNames = ["user"];

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

  // ------------------ LOGIN FUNCTION ------------------
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check if the user has allowed roles
    const allowedRoles = ["user", "employer", "landlord", "serviceProvider"];
    const isAuthorized = user.roles.some(role => allowedRoles.includes(role.name));

    if (!isAuthorized) {
      throw new UnauthorizedException("You do not have permission to access this application.");
    }

    return this.generateJwt(user);
  }

  // ------------------ GENERATE JWT FUNCTION ------------------
  private generateJwt(user: any) {
    const payload = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      plan: user.plan,
      roles: user.roles.map((role: any) => role.name),
    };
    
    return {
      access_token: this.jwtService.sign(payload), //The JwtService is generally used to sign and generate JWT tokens.
    };
  }
}

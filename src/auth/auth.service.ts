import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
const dayjs = require('dayjs');
import * as crypto from 'crypto';


import { PrismaService } from './prisma.service';
import { User } from '@prisma/client';
import { validate } from 'class-validator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';


@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService, // Injecting JwtService for signing tokens ... JwtService is used for generating tokens
  ) {
    console.log('AuthService is being initialized');
    console.log(process.env.JWT_SECRET);
  }

  // ------------------ USER VALIDATION ------------------
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }


   // ------------------ SIGNUP FUNCTION ------------------
   async signup(signupDto: SignupDto) {
    // Validate the signup DTO
    const errors = await validate(signupDto); // Validate the DTO using class-validator

    if (errors.length > 0) {
      return { message: 'Validation failed', errors, status: 400 };
    }

    const { firstName, lastName, email, password, confirmPassword, phone, plan, roles } = signupDto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUserByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      throw new BadRequestException('An account with this email already exists.');
    }

    const existingPhoneNumber = await this.prisma.user.findUnique({ where: { phone } });
    if (existingPhoneNumber) {
      throw new BadRequestException('An account with this phone number already exists.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const rolesPerPlan = {
      free: ['user'],
      bronze: ['landlord', 'employer', 'serviceProvider'],
      silver: ['landlord', 'employer', 'serviceProvider'],
      gold: ['landlord', 'employer', 'serviceProvider'],
    };

    let roleNames = ['user'];

    if (roles) {
      const validRoles = roles.filter(role => rolesPerPlan[plan]?.includes(role));

      if (validRoles.length !== roles.length) {
        throw new BadRequestException('Some roles are invalid for your plan.');
      }

      if (validRoles.length > (plan === 'bronze' ? 1 : plan === 'silver' ? 2 : 3)) {
        throw new BadRequestException(`You can select up to ${plan === 'bronze' ? 1 : plan === 'silver' ? 2 : 3} roles for your plan.`);
      }

      roleNames = [...roleNames, ...validRoles];
    }

    const roleRecords = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    if (roleRecords.length !== roleNames.length) {
      throw new BadRequestException('One or more roles do not exist.');
    }

    const newUserData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phone,
      plan,
      isPremium: plan !== 'free',
    };

    const user = await this.prisma.user.create({
      data: newUserData,
    });

    const rolesForUser = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    await this.prisma.userRole.createMany({
      data: rolesForUser.map(role => ({
        userId: user.id,
        roleId: role.id,
      })),
    });

    let successMessage = 'Your account was created successfully.';
    if (plan === 'bronze') successMessage = 'Your bronze premium membership has been created successfully.';
    else if (plan === 'silver') successMessage = 'Your silver premium membership has been created successfully.';
    else if (plan === 'gold') successMessage = 'Your gold premium membership has been created successfully.';

    return { user, message: successMessage, status: 201 };
  }

  // ------------------ LOGIN FUNCTION ------------------
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const userRoles = user.roles.map(role => role.role.name);

    const jwtResponse = this.generateJwt(user);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: jwtResponse.refresh_token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      access_token: jwtResponse.access_token,
      refresh_token: jwtResponse.refresh_token,
      roles: userRoles,
    };
  }

  // ------------------ GENERATE JWT FUNCTION ------------------
  private generateJwt(user: any) {
    const refreshToken = crypto.randomBytes(64).toString('hex');

    const payload = {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      roles: user.roles.map((role: any) => role.name),
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    return {
      access_token,
      refresh_token: refreshToken,
    };
  }
}



import { Injectable, UnauthorizedException } from '@nestjs/common'; 
import { PassportStrategy } from '@nestjs/passport'; 
import { Strategy, ExtractJwt } from 'passport-jwt'; 
import { Request } from 'express';
import { PrismaService } from 'src/auth/prisma.service'; 
import { JwtPayload } from './jwt-payload.interface'; 

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          console.log("Extracting JWT from cookies:", request.cookies); // Debugging
          return request?.cookies?.access_token || null;
        }
      ]),
      ignoreExpiration: false, 
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const { email, firstName, plan, roles } = payload;

    // Fetch user from the database
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
      throw new UnauthorizedException('User not found');
    }

    // Validate user information
    if (user.firstName !== firstName) {
      throw new UnauthorizedException('JWT payload firstName mismatch');
    }

    if (user.plan !== plan) {
      throw new UnauthorizedException('JWT payload plan mismatch');
    }

    // Validate roles
    const userRoles = user.roles.map((role: { role: { name: any } }) => role.role.name);
    const invalidRoles = roles.filter(role => !userRoles.includes(role));

    if (invalidRoles.length > 0) {
      throw new UnauthorizedException(`Invalid roles in the JWT payload: ${invalidRoles.join(', ')}`);
    }

    return { userId: user.id, email: user.email, roles: user.roles };
  }
}

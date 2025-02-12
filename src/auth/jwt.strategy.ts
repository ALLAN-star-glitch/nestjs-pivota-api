import { Injectable, UnauthorizedException } from '@nestjs/common'; 
import { PassportStrategy } from '@nestjs/passport'; 
import { Strategy, ExtractJwt } from 'passport-jwt'; 
import { PrismaService } from 'src/auth/prisma.service'; 
import { JwtPayload } from './jwt-payload.interface'; 

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, 
      secretOrKey: process.env.JWT_SECRET || 'default-secret',
    });

    console.log("JWT SECRET", process.env.JWT_SECRET);
  }

  async validate(payload: JwtPayload) {
    const { email, firstName, plan, roles } = payload;

    // Find the user from the JWT payload
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Validate that the user data matches the payload
    if (user.firstName !== firstName) {
      throw new UnauthorizedException('JWT payload firstName mismatch');
    }

    if (user.plan !== plan) {
      throw new UnauthorizedException('JWT payload plan mismatch');
    }

    // Optional: Validate roles from the JWT payload against the roles in the DB
    const userRoles = user.roles.map((role: { name: any; }) => role.name);
    const invalidRoles = roles.filter(role => !userRoles.includes(role));
    if (invalidRoles.length > 0) {
      throw new UnauthorizedException('Invalid roles in the JWT payload');
    }

    // If the user is valid and the roles match, return the user information
    return { userId: user.id, email: user.email, roles: user.roles };
  }
}

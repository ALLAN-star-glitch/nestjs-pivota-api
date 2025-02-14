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
    const { email, firstName, plan, roles } = payload;  // Extract roles from JWT payload

    // Fetch the user from DB by email (or userId)
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

    console.log("User from db", user)
    

    // If the user doesn't exist, throw an unauthorized exception
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Validate that the user's first name and plan match the JWT payload
    if (user.firstName !== firstName) {
      throw new UnauthorizedException('JWT payload firstName mismatch');
    }

    if (user.plan !== plan) {
      throw new UnauthorizedException('JWT payload plan mismatch');
    }

    // Validate roles: Check that the roles in the payload are the same as the roles assigned to this specific user
    const userRoles = user.roles.map((role: { role: { name: any; }; }) => role.role.name);
  // Get roles assigned to the current user
    const invalidRoles = roles.filter(role => !userRoles.includes(role));  // Compare with roles in JWT payload

    console.log('JWT roles:', roles); // roles from the JWT payload
    console.log('User roles from DB:', userRoles); // roles from the database
    // If there's any mismatch in roles, throw an exception
    if (invalidRoles.length > 0) {
      throw new UnauthorizedException(`Invalid roles in the JWT payload: ${invalidRoles.join(', ')}`);
    }

    // If everything matches, return the user information to allow the request to proceed
    return { userId: user.id, email: user.email, roles: user.roles };
}

}

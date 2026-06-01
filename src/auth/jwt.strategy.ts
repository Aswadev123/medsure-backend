import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { AdminService } from '../admin/admin.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private adminService: AdminService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'medsure-secret-key',
    });
    this.logger.log('JwtStrategy initialized');
  }

  async validate(payload: any) {
    this.logger.log(`JWT Strategy - Validating payload: ${JSON.stringify(payload)}`);
    
    if (!payload) {
      this.logger.error('Empty payload');
      throw new UnauthorizedException('Invalid token');
    }

    // Extract user ID from payload
    const userId = payload.sub || payload.id || payload.userId;
    const email = payload.email || payload.username;
    
    if (!userId) {
      this.logger.error('No user ID in payload');
      throw new UnauthorizedException('Invalid token: no user ID');
    }

    this.logger.log(`JWT Strategy - Resolving subject: ${email} (${userId}) role=${payload.role}`);

    try {
      const role = (payload.role || '').toString().toUpperCase();

      if (role.includes('ADMIN')) {
        const admin = await this.adminService.findOne(userId);
        if (!admin) {
          this.logger.error(`Admin not found for id: ${userId}`);
          throw new UnauthorizedException('Invalid token: admin not found');
        }
        if (admin.isActive === false) {
          this.logger.warn(`Admin is suspended/inactive: ${admin.email || userId}`);
          throw new UnauthorizedException('Admin suspended');
        }
        return {
          userId: userId,
          id: userId,
          sub: userId,
          email: admin.email || email,
          role: payload.role || admin.role || 'ADMIN',
        };
      }

      // Fallback to regular user
      const user = await this.userService.findOne(userId);
      if (!user) {
        this.logger.error(`User not found for id: ${userId}`);
        throw new UnauthorizedException('Invalid token: user not found');
      }
      if (user.isActive === false) {
        this.logger.warn(`User is suspended/inactive: ${user.email || userId}`);
        throw new UnauthorizedException('User is suspended');
      }
      return {
        userId: userId,
        id: userId,
        sub: userId,
        email: user.email || email,
        role: payload.role || user.role || 'USER',
      };
    } catch (err) {
      this.logger.error(`JWT validation error for subject ${userId}: ${err?.message || err}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
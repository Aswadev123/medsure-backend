import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`JwtAuthGuard checking request to: ${request.url}`);
    
    // Log authorization header
    const authHeader = request.headers.authorization;
    this.logger.log(`Auth header: ${authHeader ? 'Present' : 'Missing'}`);
    
    try {
      const result = await super.canActivate(context) as boolean;
      this.logger.log(`JwtAuthGuard result: ${result}`);
      this.logger.log(`User after authentication: ${JSON.stringify(request.user)}`);
      return result;
    } catch (error) {
      this.logger.error(`JwtAuthGuard error: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  handleRequest(err: any, user: any, info: any) {
    this.logger.log(`JwtAuthGuard handleRequest - err: ${err?.message}, user: ${JSON.stringify(user)}, info: ${info?.message}`);
    
    if (err) {
      throw err;
    }
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    return user;
  }
}
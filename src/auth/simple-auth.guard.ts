import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SimpleAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(SimpleAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.log(`SimpleAuthGuard checking request to: ${request.url}`);
    
    try {
      const result = await super.canActivate(context) as boolean;
      this.logger.log(`SimpleAuthGuard result: ${result}`);
      this.logger.log(`User after authentication: ${JSON.stringify(request.user)}`);
      return result;
    } catch (error) {
      this.logger.error(`SimpleAuthGuard error: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  handleRequest(err: any, user: any, info: any) {
    this.logger.log(`SimpleAuthGuard handleRequest - err: ${err?.message}, user: ${JSON.stringify(user)}, info: ${info?.message}`);
    
    if (err) {
      throw err;
    }
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    return user;
  }
}
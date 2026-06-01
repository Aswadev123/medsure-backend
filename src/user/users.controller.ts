import { Controller, Get, Put, UseGuards, Request, NotFoundException, Body, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`GET /users/me -> ${userId}`);
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Request() req: any, @Body() body: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`PUT /users/me -> ${userId}`);
    this.logger.log(`PUT /users/me body: ${JSON.stringify(body)}`);
    const updated = await this.userService.update(userId, body);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }
}

import { Controller, UseGuards, Request, Get, Post, Body, Param, Put, Delete, Logger } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('routines')
export class RoutinesController {
  private readonly logger = new Logger(RoutinesController.name);

  constructor(private readonly routinesService: RoutinesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async listMyRoutines(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`List routines for ${userId}`);
    return this.routinesService.listRoutines(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  async addRoutine(@Request() req: any, @Body() body: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Add routine for ${userId}`);
    return this.routinesService.addRoutine(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/:index')
  async updateRoutine(@Request() req: any, @Param('index') index: string, @Body() body: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    const idx = parseInt(index, 10);
    this.logger.log(`Update routine ${idx} for ${userId}`);
    return this.routinesService.updateRoutine(userId, idx, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/:index')
  async removeRoutine(@Request() req: any, @Param('index') index: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    const idx = parseInt(index, 10);
    this.logger.log(`Remove routine ${idx} for ${userId}`);
    return this.routinesService.removeRoutine(userId, idx);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/by-id/:id')
  async removeRoutineById(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Remove routine by id ${id} for ${userId}`);
    return this.routinesService.removeRoutineById(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('me/by-id/:id')
  async updateRoutineById(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Update routine by id ${id} for ${userId}`);
    return this.routinesService.updateRoutineById(userId, id, body);
  }

  // Admin-friendly count endpoint for routines per user
  @UseGuards(JwtAuthGuard)
  @Get('user/:id/count')
  async getUserRoutinesCount(@Param('id') id: string) {
    this.logger.log(`Counting routines for user: ${id}`);
    const routines = await this.routinesService.listRoutines(id);
    return { count: Array.isArray(routines) ? routines.length : 0 };
  }
}

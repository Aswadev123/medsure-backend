// src/prescription/prescription.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Param, 
  Body, 
  UseGuards, 
  Req,
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    userId?: string;
    id?: string;
    sub?: string;
    email?: string;
  };
}

@Controller('prescriptions')
@UseGuards(SimpleAuthGuard)
export class PrescriptionController {
  private readonly logger = new Logger(PrescriptionController.name);

  constructor(private readonly prescriptionService: PrescriptionService) {}

  @Get('recent')
  async getRecentAnalyses(@Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    return this.prescriptionService.getRecentAnalyses(userId);
  }

  @Get(':id')
  async getPrescription(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    return this.prescriptionService.getPrescriptionById(id, userId);
  }

  @Post(':id/analyze')
  async analyzePrescription(@Param('id') id: string) {
    return this.prescriptionService.analyzePrescription(id);
  }

  @Delete(':id')
  async deletePrescription(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    
    return this.prescriptionService.deletePrescription(id, userId);
  }
}
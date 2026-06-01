import { Controller, Get, Post, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { MedicineService } from './medicine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('medicines')
@UseGuards(JwtAuthGuard)
export class MedicineController {
  private readonly logger = new Logger(MedicineController.name);

  constructor(private readonly medicineService: MedicineService) {}

  // Count endpoint - must come BEFORE :id
  @Get('count')
  async getCount() {
    this.logger.log('Fetching medicine count');
    const count = await this.medicineService.getTotalCount();
    return { count };
  }

  // Search endpoint with optional pagination - must come BEFORE :id
  @Get('search')
  async searchMedicines(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    this.logger.log(`Searching medicines with query: ${q} limit=${limit} page=${page}`);
    const lim = Math.min(parseInt(limit || '50', 10) || 50, 1000);
    const pg = Math.max(parseInt(page || '1', 10) || 1, 1);
    return this.medicineService.searchMedicines(q || '', lim, pg);
  }

  // Alternatives endpoint - must come BEFORE :id
  @Get(':id/alternatives')
  async getMedicineAlternatives(@Param('id') id: string) {
    this.logger.log(`Fetching alternatives for medicine: ${id}`);
    return this.medicineService.getMedicineAlternatives(id);
  }

  // Seed endpoint
  @Post('seed')
  async seedMedicines() {
    this.logger.log('Seeding medicines');
    return this.medicineService.seedMedicines();
  }

  // Get medicine by ID - THIS MUST BE LAST
  @Get(':id')
  async getMedicineById(@Param('id') id: string) {
    this.logger.log(`Fetching medicine with ID: ${id}`);
    return this.medicineService.getMedicineById(id);
  }
}
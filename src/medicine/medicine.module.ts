// src/medicine/medicine.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Medicine, MedicineSchema } from './medicine.schema';
import { MedicineService } from './medicine.service';
import { MedicineController } from './medicine.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Medicine.name, schema: MedicineSchema }]),
  ],
  providers: [MedicineService],
  controllers: [MedicineController],
  exports: [MongooseModule],
})
export class MedicineModule {}
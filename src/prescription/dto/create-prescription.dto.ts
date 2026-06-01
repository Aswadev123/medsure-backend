// src/prescription/dto/create-prescription.dto.ts
import { IsString, IsOptional, IsDate } from 'class-validator';

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsString()
  hospitalName?: string;

  @IsOptional()
  @IsDate()
  issueDate?: Date;
}
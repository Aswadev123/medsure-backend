// src/ai/dto/create-chat.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  prescriptionId?: string;

  @IsString()
  title: string;
}
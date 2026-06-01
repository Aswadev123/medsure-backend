import { IsBoolean, IsOptional, IsObject } from 'class-validator';
import { CreateDocumentDto } from './create-document.dto';

export class UpdateDocumentDto extends CreateDocumentDto {
  @IsBoolean()
  @IsOptional()
  isAnalyzed?: boolean;

  @IsObject()
  @IsOptional()
  analysisResults?: any;
}
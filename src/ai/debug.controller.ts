import { Controller, Post, Body, UseGuards, Logger, Req } from '@nestjs/common';
import { FreeOcrService } from './freeocr.service';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';
import { AiService } from './ai.service';

interface RequestWithUser extends Request {
  user?: any;
}

@Controller('ai/debug')
@UseGuards(SimpleAuthGuard)
export class AiDebugController {
  private readonly logger = new Logger(AiDebugController.name);

  constructor(
    private readonly freeOcr: FreeOcrService,
    private readonly aiService: AiService,
  ) {}

  @Post('freeocr')
  async testFreeOcr(@Body() body: { url?: string; text?: string; base64?: string }, @Req() req: RequestWithUser) {
    this.logger.log('FreeOcr debug called');
    const result = await this.freeOcr.extract(body);
    return { ok: Boolean(result), result };
  }

  @Post('analyze-extraction')
  async analyzeExtraction(@Body() body: { extraction: any }, @Req() req: RequestWithUser) {
    this.logger.log('Analyze extraction called');
    const extraction = body?.extraction;
    if (!extraction) {
      return { ok: false, error: 'No extraction provided' };
    }

    try {
      const analysis = await this.aiService.analyzePrescription(extraction as any);
      return { ok: true, analysis };
    } catch (err) {
      this.logger.error('Analyze extraction failed: ' + (err as any)?.message || String(err));
      return { ok: false, error: (err as any)?.message || String(err) };
    }
  }
}

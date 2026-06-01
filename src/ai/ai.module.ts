// src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiService } from './ai.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { FreeOcrService } from './freeocr.service';
import { AiDebugController } from './debug.controller';
import { ChatSession, ChatSessionSchema } from '../schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../schemas/chat-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController, AiDebugController],
  providers: [AiService, ChatService, FreeOcrService],
  exports: [AiService, ChatService, FreeOcrService],
})
export class AiModule {}
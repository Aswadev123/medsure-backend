// medsure-backend/src/ai/chat.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Req, 
  Logger 
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SimpleAuthGuard } from '../auth/simple-auth.guard';

interface RequestWithUser extends Request {
  user: {
    _id: string;
    userId: string;
    email: string;
  };
}

@Controller('chat')
@UseGuards(SimpleAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Get('sessions')
  async getSessions(@Req() req: RequestWithUser) {
    this.logger.log('Getting chat sessions');
    const userId = req.user._id || req.user.userId;
    return this.chatService.getUserSessions(userId);
  }

  @Get('sessions/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(`Getting session: ${sessionId}`);
    const userId = req.user._id || req.user.userId;
    return this.chatService.getSessionWithMessages(sessionId, userId);
  }

  @Post('sessions')
  async createSession(
    @Body() body: { title?: string },
    @Req() req: RequestWithUser,
  ) {
    this.logger.log('Creating new chat session');
    const userId = req.user._id || req.user.userId;
    return this.chatService.createSession({
      userId,
      title: body.title || 'New Chat Session',
    });
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string; type?: string; context?: any },
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(`Sending message in session: ${sessionId}`);
    const userId = req.user._id || req.user.userId;
    return this.chatService.sendMessage({
      sessionId,
      userId,
      content: body.content,
      type: body.type,
      context: body.context,
    });
  }

  @Post('quick')
  async quickChat(
    @Body() body: { message: string; context?: any; forceGemini?: boolean },
    @Req() req: RequestWithUser,
  ) {
    this.logger.log('Quick chat');
    try {
      const medsLen = Array.isArray(body.context?.medicines) ? body.context.medicines.length : 0;
      this.logger.log(`QuickChat received message len=${String(body.message).slice(0,80)} meds=${medsLen}`);
    } catch (e) {}
    const userId = req.user._id || req.user.userId;
    const mergedContext = Object.assign({}, body.context || {}, { forceGemini: body.forceGemini });
    return this.chatService.quickChat({
      userId,
      message: body.message,
      context: mergedContext,
    });
  }
}
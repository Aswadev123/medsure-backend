// src/ai/chat.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSession, ChatSessionDocument } from '../schemas/chat-session.schema';
import { ChatMessage, ChatMessageDocument } from '../schemas/chat-message.schema';
import { AiService } from './ai.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatSession.name) private chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name) private chatMessageModel: Model<ChatMessageDocument>,
    private readonly aiService: AiService,
  ) {}

  async getUserSessions(userId: string): Promise<ChatSessionDocument[]> {
    this.logger.log(`Getting chat sessions for user: ${userId}`);
    const sessions = await this.chatSessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
    return sessions;
  }

  async getSessionWithMessages(sessionId: string, userId: string): Promise<any> {
    this.logger.log(`Getting chat session with messages: ${sessionId}`);
    const session = await this.chatSessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    }).exec();

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    const messages = await this.chatMessageModel
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();

    return {
      session,
      messages,
    };
  }

  async createSession(data: { userId: string; title: string }): Promise<ChatSessionDocument> {
    this.logger.log(`Creating chat session for user: ${data.userId}`);
    const session = new this.chatSessionModel({
      userId: new Types.ObjectId(data.userId),
      title: data.title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await session.save();
  }

  async sendMessage(data: {
    sessionId: string;
    userId: string;
    content: string;
    type?: string;
    context?: any;
  }): Promise<ChatMessageDocument> {
    this.logger.log(`Sending message in session: ${data.sessionId}`);

    // Save user message
    const userMessage = new this.chatMessageModel({
      sessionId: new Types.ObjectId(data.sessionId),
      userId: new Types.ObjectId(data.userId),
      content: data.content,
      role: 'user',
      type: data.type || 'text',
      createdAt: new Date(),
    });

    await userMessage.save();

    // Get recent messages for context
    const recentMessages = await this.chatMessageModel
      .find({ sessionId: new Types.ObjectId(data.sessionId) })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    const recent = recentMessages.reverse().map(m => ({ role: (m as any).role, content: (m as any).content }));

    // Merge any provided context with recent messages
    const context = Object.assign({}, data.context || {}, { recentMessages: recent });

    const forceGemini = (data.context && data.context.forceGemini) || false;
    const aiResponse = await this.aiService.generateChatResponse(data.content, context, { forceGemini });

    // Save AI response
    const assistantMessage = new this.chatMessageModel({
      sessionId: new Types.ObjectId(data.sessionId),
      userId: new Types.ObjectId(data.userId),
      content: aiResponse,
      role: 'assistant',
      type: 'text',
      createdAt: new Date(),
    });

    await assistantMessage.save();

    // Update session message refs
    await this.chatSessionModel.findByIdAndUpdate(
      new Types.ObjectId(data.sessionId),
      {
        $push: { messages: { $each: [userMessage._id, assistantMessage._id] } },
        updatedAt: new Date(),
      }
    );

    return assistantMessage;
  }

  // Simplified quick chat: stateless, returns AI response directly (requires auth at controller level)
  async quickChat(data: {
    userId: string;
    message: string;
    context?: any;
  }): Promise<{ response: string; sessionId?: string }> {
    this.logger.log(`Quick chat for user: ${data.userId}`);
    try {
      const responseText = await this.aiService.generateChatResponse(data.message, data.context || {}, {});
      return { response: responseText };
    } catch (error) {
      this.logger.error('Quick chat error:', error);
      return { response: "I'm having trouble connecting to the AI service. Please try again in a moment." };
    }
  }
}

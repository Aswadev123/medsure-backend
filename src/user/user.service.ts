import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<User[]> {
    this.logger.log('Finding all users');
    try {
      const users = await this.userModel.find().select('-password').exec();
      return users;
    } catch (error) {
      this.logger.error('Error finding users:', error);
      throw error;
    }
  }

  async findOne(id: string): Promise<UserDocument | null> {
    this.logger.log(`Finding user with id: ${id}`);
    try {
      const user = await this.userModel.findById(id).select('-password').exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    } catch (error) {
      this.logger.error(`Error finding user ${id}:`, error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    this.logger.log(`Finding user by email: ${email}`);
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    this.logger.log(`Finding user by phone: ${phone}`);
    return this.userModel.findOne({ phone }).exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    this.logger.log(`Creating user with email: ${userData.email}`);
    
    // Hash password if provided
    if (userData.password) {
      const saltRounds = 10;
      userData.password = await bcrypt.hash(userData.password, saltRounds);
    }
    
    const createdUser = await this.userModel.create(userData);
    return createdUser;
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument | null> {
    this.logger.log(`Updating user with id: ${id}`);
    this.logger.log(`Update payload for user ${id}: ${JSON.stringify(updateData)}`);
    
    // Hash password if being updated
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }
    
    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .select('-password')
        .exec();

      this.logger.log(`User ${id} update result: ${updatedUser ? 'success' : 'no document found'}`);
      return updatedUser;
    } catch (err) {
      this.logger.error(`Error updating user ${id}: ${err?.message || err}`);
      throw err;
    }
  }



  async updateRoutines(userId: string, routines: any[]): Promise<UserDocument | null> {
    this.logger.log(`Updating routines for user: ${userId}`);
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { routines },
      { new: true }
    ).select('-password').exec();
    return updated;
  }

  async remove(id: string): Promise<UserDocument | null> {
    this.logger.log(`Removing user with id: ${id}`);
    try {
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      if (deletedUser) {
        this.logger.log(`User ${id} deleted successfully`);
      }
      return deletedUser;
    } catch (error) {
      this.logger.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }

  async getTotalCount(): Promise<number> {
    try {
      return await this.userModel.countDocuments().exec();
    } catch (error) {
      this.logger.error('Error counting users:', error);
      return 0;
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.log(`Validating user: ${email}`);
    
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Return user without password
    const userObject = user.toJSON();
    const { password: _, ...result } = userObject;
    return result;
  }
}
import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Admin } from './schemas/admin.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private jwtService: JwtService,
  ) {}

  async register(createAdminDto: CreateAdminDto) {
    try {
      // Check if admin already exists
      const existingAdmin = await this.adminModel.findOne({ email: createAdminDto.email });
      if (existingAdmin) {
        throw new ConflictException('Admin already exists with this email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

      // Create new admin
      const admin = new this.adminModel({
        ...createAdminDto,
        password: hashedPassword,
      });

      await admin.save();

      // Generate JWT token
      const token = this.jwtService.sign({ 
        id: admin._id, 
        email: admin.email,
        role: admin.role 
      });

      this.logger.log(`Admin registered: ${admin.email}`);

      return {
        success: true,
        message: 'Admin registered successfully',
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      };
    } catch (error) {
      this.logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(loginAdminDto: LoginAdminDto) {
    try {
      // Find admin by email
      const admin = await this.adminModel.findOne({ email: loginAdminDto.email });
      this.logger.log(`Admin lookup for ${loginAdminDto.email}: ${admin ? 'FOUND' : 'NOT FOUND'}`);
      if (!admin) {
        this.logger.warn(`Login failed - admin not found for email: ${loginAdminDto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Check if admin is active
      if (!admin.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Verify password (do not log actual hashes)
      this.logger.log(`Comparing provided password against stored hash (hash length=${admin.password?.length || 0}) for ${loginAdminDto.email}`);
      const isPasswordValid = await bcrypt.compare(loginAdminDto.password, admin.password);
      if (!isPasswordValid) {
        this.logger.warn(`Login failed - invalid password for email: ${loginAdminDto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      admin.lastLogin = new Date();
      await admin.save();

      // Generate JWT token
      const token = this.jwtService.sign({ 
        id: admin._id, 
        email: admin.email,
        role: admin.role 
      });

      this.logger.log(`Admin logged in: ${admin.email}`);

      return {
        success: true,
        message: 'Login successful',
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      };
    } catch (error) {
      this.logger.error('Login error:', error);
      throw error;
    }
  }

  async findAll() {
    return this.adminModel.find().select('-password').exec();
  }

  async findOne(id: string) {
    return this.adminModel.findById(id).select('-password').exec();
  }

  async update(id: string, updateData: Partial<Admin>) {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    return this.adminModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-password')
      .exec();
  }

  async remove(id: string) {
    return this.adminModel.findByIdAndDelete(id).exec();
  }
}
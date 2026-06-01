import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    this.logger.log(`Validating user: ${email}`);
    
    const user = await this.userService.findByEmail(email);
    if (!user) {
      this.logger.log(`User not found: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.log(`Invalid password for: ${email}`);
      return null;
    }

    // Return user object (without password)
    const userObject = user.toObject ? user.toObject() : { ...user };
    const { password: _, ...result } = userObject;
    return result;
  }

  async login(user: any) {
    this.logger.log(`Logging in user: ${user.email}`);
    
    // Ensure we have a valid user ID
    const userId = user._id?.toString() || user.id?.toString();
    
    if (!userId) {
      this.logger.error('No user ID found in user object');
      throw new UnauthorizedException('Invalid user data');
    }
    
    const payload = { 
      email: user.email, 
      sub: userId,
      id: userId,
      userId: userId,
      role: user.role || 'USER'
    };
    
    this.logger.log(`Creating JWT with payload: ${JSON.stringify(payload)}`);
    
    return {
      access_token: this.jwtService.sign(payload),
      token: this.jwtService.sign(payload),
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role || 'USER'
      }
    };
  }

  async register(userData: any) {
    this.logger.log(`Registering user: ${userData.email}`);
    
    // Check if user exists
    const existingUser = await this.userService.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // If phone provided, ensure it's not already registered
    if (userData.phone) {
      const existingPhone = await this.userService.findByPhone(userData.phone);
      if (existingPhone) {
        throw new ConflictException('Phone already registered');
      }
    }

    // Create user (UserService hashes the password)
    let newUser;
    try {
      newUser = await this.userService.create(userData);
    } catch (err: any) {
      // Handle duplicate key errors from MongoDB
      if (err?.code === 11000 || (err?.message && err.message.includes('E11000'))) {
        const dupField = err.message.match(/index: (\w+)_1/)?.[1] || 'field';
        throw new ConflictException(`${dupField} already registered`);
      }
      throw err;
    }
    
    // Get user ID
    const userId = newUser._id?.toString() || newUser.id?.toString();
    
    // Generate token
    const payload = { 
      email: newUser.email, 
      sub: userId,
      id: userId,
      userId: userId,
      role: newUser.role || 'USER'
    };
    
    // Convert to plain object and remove password
    const userObject = newUser.toObject ? newUser.toObject() : { ...newUser };
    const { password, ...result } = userObject;
    
    return {
      access_token: this.jwtService.sign(payload),
      token: this.jwtService.sign(payload),
      user: {
        id: userId,
        email: result.email,
        name: result.name,
        role: result.role || 'USER'
      }
    };
  }
}
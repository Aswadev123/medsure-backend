// src/auth/auth.controller.ts
import { Controller, Post, Body, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OtpService } from './otp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    // Validate user credentials first
    const validated = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!validated) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Pass the validated user object (without password) to login so it can populate userId
    return this.authService.login(validated);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // Require OTP verification for the provided email
    const email = registerDto.email?.toLowerCase?.() || registerDto.email;
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    if (!this.otpService.isVerified(email)) {
      throw new BadRequestException('Email not verified by OTP');
    }

    // Clear OTP after use
    this.otpService.clear(email);

    return this.authService.register(registerDto);
  }

  @Post('send-otp')
  async sendOtp(@Body() body: { email: string }) {
    const email = body.email?.toLowerCase?.();
    if (!email) throw new BadRequestException('Email is required');
    const res = await this.otpService.sendOtp(email);
    return { success: true, sent: res.sent };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; code: string }) {
    const email = body.email?.toLowerCase?.();
    const code = body.code;
    if (!email || !code) throw new BadRequestException('Email and code are required');
    const ok = this.otpService.verifyOtp(email, String(code));
    return { success: ok };
  }
}

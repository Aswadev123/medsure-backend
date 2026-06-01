import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Logger,
  HttpCode,
  HttpStatus,
  NotFoundException
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from '@nestjs/common';

@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // PUBLIC TEST ENDPOINT - no auth required
  @Get('test/ping')
  async test() {
    this.logger.log('✅ Test endpoint called');
    return { 
      message: 'User controller is working!', 
      timestamp: new Date().toISOString(),
      endpoints: {
        getAll: '/user (GET) - requires auth',
        getCount: '/user/count (GET) - requires auth',
        getOne: '/user/:id (GET) - requires auth',
        delete: '/user/:id (DELETE) - requires auth',
        test: '/user/test/ping (GET) - no auth',
        create: '/user (POST) - register endpoint',
        update: '/user/:id (PUT) - requires auth'
      }
    };
  }

  // CREATE USER (REGISTRATION) - public endpoint
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: any) {
    this.logger.log(`Creating user with email: ${createUserDto.email}`);
    const user = await this.userService.create(createUserDto);
    
    // Remove password from response
    const userObject = user.toJSON();
    const { password, ...result } = userObject;
    return result;
  }

  // GET ALL USERS - requires authentication
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    this.logger.log('Fetching all users');
    const users = await this.userService.findAll();
    return users;
  }

  // GET USER COUNT - requires authentication
  @Get('count')
  @UseGuards(JwtAuthGuard)
  async getCount() {
    this.logger.log('Fetching user count');
    const count = await this.userService.getTotalCount();
    return { count };
  }

  // GET USER BY ID - requires authentication
  // GET current authenticated user
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Fetching current user: ${userId}`);
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // GET USER BY ID - requires authentication
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    this.logger.log(`Fetching user with ID: ${id}`);
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // GET USER BY EMAIL - requires authentication
  @Get('email/:email')
  @UseGuards(JwtAuthGuard)
  async findByEmail(@Param('email') email: string) {
    this.logger.log(`Fetching user with email: ${email}`);
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Remove password from response
    const userObject = user.toJSON();
    const { password, ...result } = userObject;
    return result;
  }

  // UPDATE USER - requires authentication
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateUserDto: any) {
    this.logger.log(`Updating user with ID: ${id}`);
    const user = await this.userService.update(id, updateUserDto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  // Update favorites for current user
  

  // Update routines for current user
  @Put('me/routines')
  @UseGuards(JwtAuthGuard)
  async updateRoutines(@Request() req: any, @Body() body: { routines: any[] }) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Updating routines for user: ${userId}`);
    const user = await this.userService.updateRoutines(userId, body.routines || []);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // DELETE USER - requires authentication
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    this.logger.log(`Deleting user with ID: ${id}`);
    const user = await this.userService.remove(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User deleted successfully', user };
  }
}
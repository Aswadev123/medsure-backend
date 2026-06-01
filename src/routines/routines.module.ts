import { Module } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { RoutinesController } from './routines.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [RoutinesService],
  controllers: [RoutinesController],
})
export class RoutinesModule {}

import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class RoutinesService {
  private readonly logger = new Logger(RoutinesService.name);

  constructor(private readonly userService: UserService) {}

  async listRoutines(userId: string) {
    const user = await this.userService.findOne(userId);
    return user?.routines || [];
  }

  async addRoutine(userId: string, routine: any) {
    try {
      this.logger.log(`Adding routine for ${userId}`);
      const user = await this.userService.findOne(userId);
      this.logger.log(`Current routines count: ${user?.routines?.length || 0}`);
      const routines = Array.isArray(user?.routines) ? [...user.routines] : [];
      routines.push(routine);
      this.logger.log(`New routines count: ${routines.length}`);
      const result = await this.userService.updateRoutines(userId, routines);
      this.logger.log(`Update result for addRoutine: ${result ? 'ok' : 'null'}`);
      return result;
    } catch (error) {
      this.logger.error(`Error adding routine for ${userId}:`, error);
      throw error;
    }
  }

  async updateRoutine(userId: string, index: number, update: any) {
    try {
      this.logger.log(`Updating routine index ${index} for ${userId}`);
      const user = await this.userService.findOne(userId);
      const routines = Array.isArray(user?.routines) ? [...user.routines] : [];
      if (index < 0 || index >= routines.length) {
        this.logger.warn(`Index ${index} out of bounds (len=${routines.length})`);
        return null;
      }
      routines[index] = { ...routines[index], ...update };
      const result = await this.userService.updateRoutines(userId, routines);
      this.logger.log(`Update result for updateRoutine: ${result ? 'ok' : 'null'}`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating routine for ${userId}:`, error);
      throw error;
    }
  }

  async removeRoutine(userId: string, index: number) {
    try {
      this.logger.log(`Removing routine index ${index} for ${userId}`);
      const user = await this.userService.findOne(userId);
      const routines = Array.isArray(user?.routines) ? [...user.routines] : [];
      if (index < 0 || index >= routines.length) {
        this.logger.warn(`Index ${index} out of bounds (len=${routines.length})`);
        return null;
      }
      routines.splice(index, 1);
      const result = await this.userService.updateRoutines(userId, routines);
      this.logger.log(`Update result for removeRoutine: ${result ? 'ok' : 'null'}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing routine for ${userId}:`, error);
      throw error;
    }
  }

  async removeRoutineById(userId: string, id: string) {
    try {
      this.logger.log(`Removing routine by id ${id} for ${userId}`);
      const user = await this.userService.findOne(userId);
      const routines = Array.isArray(user?.routines) ? [...user.routines] : [];
      const idx = routines.findIndex((r: any) => r?.id === id || r?._id === id);
      if (idx === -1) {
        this.logger.warn(`Routine id ${id} not found (len=${routines.length})`);
        return null;
      }
      routines.splice(idx, 1);
      const result = await this.userService.updateRoutines(userId, routines);
      this.logger.log(`Update result for removeRoutineById: ${result ? 'ok' : 'null'}`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing routine by id for ${userId}:`, error);
      throw error;
    }
  }

  async updateRoutineById(userId: string, id: string, update: any) {
    try {
      this.logger.log(`Updating routine by id ${id} for ${userId}`);
      const user = await this.userService.findOne(userId);
      const routines = Array.isArray(user?.routines) ? [...user.routines] : [];
      const idx = routines.findIndex((r: any) => r?.id === id || r?._id === id);
      if (idx === -1) {
        this.logger.warn(`Routine id ${id} not found (len=${routines.length})`);
        return null;
      }
      routines[idx] = { ...routines[idx], ...update };
      const result = await this.userService.updateRoutines(userId, routines);
      this.logger.log(`Update result for updateRoutineById: ${result ? 'ok' : 'null'}`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating routine by id for ${userId}:`, error);
      throw error;
    }
  }
}

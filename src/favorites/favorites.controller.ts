import { Controller, Put, Get, Body, Request, UseGuards, Logger } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateFavoritesDto } from './dto/update-favorites.dto';

@Controller('favorites')
export class FavoritesController {
  private readonly logger = new Logger(FavoritesController.name);

  constructor(private readonly favoritesService: FavoritesService) {}

  @UseGuards(JwtAuthGuard)
  @Put('me')
  async updateMyFavorites(@Request() req: any, @Body() body: UpdateFavoritesDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Update favorites for ${userId}`);
    const result = await this.favoritesService.updateFavorites(userId, body.favorites || []);
    return { favorites: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyFavorites(@Request() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    this.logger.log(`Get favorites for ${userId}`);
    const favs = await this.favoritesService.getFavorites(userId);
    return { favorites: favs };
  }
}

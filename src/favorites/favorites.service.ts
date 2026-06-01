
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Favorite, FavoriteDocument } from './favorites.schema';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectModel(Favorite.name) private favoriteModel: Model<FavoriteDocument>,
  ) {}

  /**
   * Replace user's favorites with provided list (atomic replace)
   */
  async updateFavorites(userId: string, favorites: string[]) {
    this.logger.log(`Updating favorites for ${userId}`);

    // Remove existing favorites for user
    await this.favoriteModel.deleteMany({ userId }).exec();

    if (!favorites || favorites.length === 0) return [];

    // Insert new favorites
    const docs = favorites.map((medId) => ({ userId, medicineId: medId }));
    const created = await this.favoriteModel.insertMany(docs);
    return created.map((d) => d.medicineId);
  }

  async getFavorites(userId: string) {
    this.logger.log(`Fetching favorites for ${userId}`);
    const docs = await this.favoriteModel.find({ userId }).exec();
    return docs.map((d) => d.medicineId);
  }
}

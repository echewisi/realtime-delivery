import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { Rider } from '../models/rider.model';

@Injectable()
export class RidersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitMQService: RabbitMQService
  ) {}

  async findById(id: number): Promise<Rider> {
    const rider = await this.db.knex('riders')
      .where('id', id)
      .first();
    
    if (!rider) {
      throw new NotFoundException(`Rider with ID ${id} not found`);
    }
    
    return rider;
  }

  async findAllActiveRiders(): Promise<Rider[]> {
    return this.db.knex('riders')
      .where('is_available', true)
      .orderBy('updated_at', 'desc');
  }

  async updateLocation(riderId: number, latitude: number, longitude: number): Promise<void> {
    await this.db.knex.transaction(async (trx) => {
      // Update rider's location
      const updated = await trx('riders')
        .where('id', riderId)
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          updated_at: trx.fn.now()
        });

      if (!updated) {
        throw new NotFoundException(`Rider with ID ${riderId} not found`);
      }

      // Publish location update to RabbitMQ
      await this.rabbitMQService.publishRiderLocation({
        riderId,
        latitude,
        longitude
      });
    });
  }

  async updateAvailability(riderId: number, isAvailable: boolean): Promise<void> {
    const updated = await this.db.knex('riders')
      .where('id', riderId)
      .update({
        is_available: isAvailable,
        updated_at: this.db.knex.fn.now()
      });

    if (!updated) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }
  }

  async findNearbyAvailableRiders(lat: number, lng: number, radiusKm = 5): Promise<Array<Rider & { distance: number }>> {
    // Haversine formula in SQL for precise distance calculation
    const result = await this.db.knex.raw(`
      WITH rider_distances AS (
        SELECT 
          riders.*,
          (
            6371 * acos(
              cos(radians(?)) * cos(radians(current_latitude)) *
              cos(radians(current_longitude) - radians(?)) +
              sin(radians(?)) * sin(radians(current_latitude))
            )
          ) AS distance
        FROM riders
        WHERE 
          is_available = true
          AND current_latitude IS NOT NULL
          AND current_longitude IS NOT NULL
      )
      SELECT *
      FROM rider_distances
      WHERE distance < ?
      ORDER BY distance ASC
    `, [lat, lng, lat, radiusKm]);

    return result.rows;
  }

  async getCurrentOrders(riderId: number): Promise<any[]> {
    return this.db.knex('orders')
      .where({
        rider_id: riderId,
        completed: false,
        cancelled: false
      })
      .orderBy('created_at', 'desc');
  }

  async countActiveRiders(): Promise<number> {
    const result = await this.db.knex('riders')
      .where('is_available', true)
      .count('id as count')
      .first();
    
    return parseInt(result?.count as string ?? '0');
  }

  async create(riderData: Partial<Rider>): Promise<Rider> {
    const [id] = await this.db.knex('riders')
      .insert({
        ...riderData,
        created_at: this.db.knex.fn.now(),
        updated_at: this.db.knex.fn.now()
      })
      .returning('id');

    return this.findById(id);
  }

  async getRiderStats(riderId: number): Promise<any> {
    const [totalDeliveries, totalDistance, avgRating] = await Promise.all([
      this.db.knex('orders')
        .where({ rider_id: riderId, completed: true })
        .count('id as count')
        .first(),
      
      this.db.knex.raw(`
        SELECT SUM(
          6371 * acos(
            cos(radians(pickup_latitude)) * cos(radians(delivery_latitude)) *
            cos(radians(delivery_longitude) - radians(pickup_longitude)) +
            sin(radians(pickup_latitude)) * sin(radians(delivery_latitude))
          )
        ) as total_distance
        FROM orders
        WHERE rider_id = ? AND completed = true
      `, [riderId]),

      this.db.knex('orders')
        .where({ rider_id: riderId, completed: true })
        .avg('rating as average')
        .first()
    ]);

    return {
      totalDeliveries: parseInt(totalDeliveries?.count as string ?? '0'),
      totalDistance: parseFloat(totalDistance.rows[0]?.total_distance || '0'),
      averageRating: parseFloat(avgRating?.average as string ?? '0')
    };
  }
}

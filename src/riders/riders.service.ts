import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { Rider } from '../models/rider.model';
import { CustomLogger } from '../common/logger/logger.service';

@Injectable()
export class RidersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext(RidersService.name);
  }

  async findById(id: number): Promise<Rider> {
    try {
      const rider = await this.db.knex('riders').where('id', id).first();

      if (!rider) {
        throw new NotFoundException(`Rider with ID ${id} not found`);
      }

      return rider;
    } catch (error) {
      this.logger.error(`Failed to find rider with ID ${id}`, error.stack, 'findById');
      throw error;
    }
  }

  async findByEmail(email: string): Promise<Rider | undefined> {
    try {
      const rider = await this.db.knex('riders').where('email', email).first();
      return rider;
    } catch (error) {
      this.logger.error(`Failed to find rider with email ${email}`, error.stack, 'findByEmail');
      throw error;
    }
  }

  async findAllActiveRiders(): Promise<Rider[]> {
    try {
      return this.db
        .knex('riders')
        .where('is_available', true)
        .orderBy('updated_at', 'desc');
    } catch (error) {
      this.logger.error('Failed to find all active riders', error.stack, 'findAllActiveRiders');
      throw error;
    }
  }

  async updateLocation(riderId: number, latitude: number, longitude: number): Promise<void> {
    try {
      await this.db.knex.transaction(async (trx) => {
        const updated = await trx('riders').where('id', riderId).update({
          current_latitude: latitude,
          current_longitude: longitude,
          updated_at: trx.fn.now(),
        });

        if (!updated) {
          throw new NotFoundException(`Rider with ID ${riderId} not found`);
        }

        await this.rabbitMQService.publishRiderLocation({
          riderId,
          latitude,
          longitude,
        });
      });
    } catch (error) {
      this.logger.error(`Failed to update location for rider ${riderId}`, error.stack, 'updateLocation');
      throw error;
    }
  }

  async updateAvailability(riderId: number, isAvailable: boolean): Promise<void> {
    try {
      const updated = await this.db
        .knex('riders')
        .where('id', riderId)
        .update({
          is_available: isAvailable,
          updated_at: this.db.knex.fn.now(),
        });

      if (!updated) {
        throw new NotFoundException(`Rider with ID ${riderId} not found`);
      }
    } catch (error) {
      this.logger.error(`Failed to update availability for rider ${riderId}`, error.stack, 'updateAvailability');
      throw error;
    }
  }

  async findNearbyAvailableRiders(
    lat: number,
    lng: number,
    radiusKm = 5,
  ): Promise<Array<Rider & { distance: number }>> {
    try {
      const result = await this.db.knex.raw(
        `
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
    `,
        [lat, lng, lat, radiusKm],
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to find nearby available riders', error.stack, 'findNearbyAvailableRiders');
      throw error;
    }
  }

  async getCurrentOrders(riderId: number): Promise<any[]> {
    try {
      return this.db
        .knex('orders')
        .where({
          rider_id: riderId,
          completed: false,
          cancelled: false,
        })
        .orderBy('created_at', 'desc');
    } catch (error) {
      this.logger.error(`Failed to get current orders for rider ${riderId}`, error.stack, 'getCurrentOrders');
      throw error;
    }
  }

  async countActiveRiders(): Promise<number> {
    try {
      const result = await this.db
        .knex('riders')
        .where('is_available', true)
        .count('id as count')
        .first();

      return parseInt(result?.count as string ?? '0');
    } catch (error) {
      this.logger.error('Failed to count active riders', error.stack, 'countActiveRiders');
      throw error;
    }
  }

  async create(riderData: Partial<Rider>): Promise<Rider> {
    try {
      const [rider] = await this.db
        .knex('riders')
        .insert({
          ...riderData,
          created_at: this.db.knex.fn.now(),
          updated_at: this.db.knex.fn.now(),
        })
        .returning('*');

      return rider;
    } catch (error) {
      this.logger.error('Failed to create rider', error.stack, 'create');
      throw error;
    }
  }

  async getRiderStats(riderId: number): Promise<any> {
    try {
      const [totalDeliveries, totalDistance, avgRating] = await Promise.all([
        this.db.knex('orders').where({ rider_id: riderId, completed: true }).count('id as count').first(),

        this.db.knex.raw(
          `
        SELECT SUM(
          6371 * acos(
            cos(radians(pickup_latitude)) * cos(radians(delivery_latitude)) *
            cos(radians(delivery_longitude) - radians(pickup_longitude)) +
            sin(radians(pickup_latitude)) * sin(radians(delivery_latitude))
          )
        ) as total_distance
        FROM orders
        WHERE rider_id = ? AND completed = true
      `,
          [riderId],
        ),

        this.db.knex('orders').where({ rider_id: riderId, completed: true }).avg('rating as average').first(),
      ]);

      return {
        totalDeliveries: parseInt(totalDeliveries?.count as string ?? '0'),
        totalDistance: parseFloat(totalDistance.rows[0]?.total_distance || '0'),
        averageRating: parseFloat(avgRating?.average as string ?? '0'),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for rider ${riderId}`, error.stack, 'getRiderStats');
      throw error;
    }
  }
}

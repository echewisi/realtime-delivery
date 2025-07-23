import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';
import { Order } from '../models/order.model';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RidersService } from '../riders/riders.service';
import { DispatchGateway } from '../websockets/dispatch.gateway';
import { CreateOrderDto } from '../dto/create-order.dto';
import { CustomLogger } from '../common/logger/logger.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly ridersService: RidersService,
    private readonly dispatchGateway: DispatchGateway,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  async createOrder(orderData: CreateOrderDto): Promise<number> {
    try {
      const orderId = await this.db.knex.transaction(async (trx) => {
        // First create the calculated order
        const [calculatedOrder] = await trx('calculated_orders').insert({
          total_amount: orderData.calculated_order.total_amount.toString(),
          free_delivery: orderData.calculated_order.free_delivery,
          delivery_fee: orderData.calculated_order.delivery_fee.toString(),
          service_charge: orderData.calculated_order.service_charge.toString(),
          amount: orderData.calculated_order.amount,
          lat: orderData.calculated_order.lat.toString(),
          lng: orderData.calculated_order.lng.toString(),
          address_details: orderData.calculated_order.address_details,
          meals: [],
          internal_profit: 0,
          cokitchen_polygon_id: '',
          user_id: orderData.user_id,
          cokitchen_id: '',
          pickup: false,
          prev_price: '0',
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        }).returning('id');

        const calculatedOrderId = typeof calculatedOrder === 'object' ? calculatedOrder.id : calculatedOrder;

        // Create the order
        const orderCode = `OD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const validOrderTypeId = await this.getOrCreateDefaultOrderType(trx, orderData.order_type_id);

        // Create the order
        const [newOrder] = await trx('orders').insert({
          user_id: orderData.user_id,
          order_type_id: validOrderTypeId,
          calculated_order_id: calculatedOrderId,
          scheduled: orderData.scheduled,
          order_code: orderCode,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        }).returning('id');

        const newOrderId = typeof newOrder === 'object' ? newOrder.id : newOrder;

        // Create initial log
        await trx('logs').insert({
          order_id: newOrderId,
          description: 'Order received',
          time: trx.fn.now()
        });

        // Create initial order total amount history
        await trx('order_total_amount_history').insert({
          order_id: newOrderId,
          total_amount: orderData.calculated_order.total_amount,
          time: trx.fn.now()
        });

        // Find and notify nearby riders if coordinates are available
        // Convert lat/lng to string in DB but use as numbers for finding nearby riders
        const lat = Number(orderData.calculated_order.lat);
        const lng = Number(orderData.calculated_order.lng);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const nearbyRiders = await this.ridersService.findNearbyAvailableRiders(
            lat,
            lng
          );

          // Get complete order details
          const order = await this.getOrderById(newOrderId, trx);
          
          if (!order.calculated_order) {
            throw new Error('Order does not have required calculated order details');
          }

          // Prepare order data for WebSocket broadcast
          const orderForBroadcast = {
            id: order.id.toString(),
            order_code: order.order_code,
            calculated_order: {
              total_amount: order.calculated_order.total_amount.toString(),
              delivery_fee: order.calculated_order.delivery_fee.toString(),
              service_charge: order.calculated_order.service_charge.toString(),
              address_details: order.calculated_order.address_details,
              lat: order.calculated_order.lat,
              lng: order.calculated_order.lng
            }
          };

          // Notify each nearby rider through WebSocket with distance information
          await Promise.all(nearbyRiders.map(rider => 
            this.dispatchGateway.sendOrderToRider(rider.id, {
              ...orderForBroadcast,
              distance: rider.distance ?? 0
            })
          ));
        }

        // Publish complete order to RabbitMQ
        const createdOrder = await this.getOrderById(newOrderId, trx);
        await this.rabbitMQService.publishOrderCreated(createdOrder);

        return newOrderId;
      });
      return orderId;
    } catch (error) {
      this.logger.error('Failed to create order', error.stack, 'createOrder');
      throw error;
    }
  }

  private async getOrCreateDefaultOrderType(trx: any, providedTypeId: string): Promise<number> {
    const defaultOrderTypeName = 'Standard Delivery';
    // Ensure providedTypeId is treated as a number for the check
    let orderTypeId = providedTypeId ? parseInt(providedTypeId, 10) : NaN;

    // Check if the provided ID is a valid number and exists
    if (!isNaN(orderTypeId)) {
      const existingType = await trx('order_types').where('id', orderTypeId).first();
      if (existingType) {
        return existingType.id;
      }
    }

    // If no valid ID is found, fall back to the default
    let defaultType = await trx('order_types').where('name', defaultOrderTypeName).first();

    if (!defaultType) {
      // If default doesn't exist, create it
      const [newDefaultType] = await trx('order_types').insert({ name: defaultOrderTypeName }).returning('id');
      defaultType = newDefaultType;
    }

    // Handle both object and raw ID returns from different DB drivers
    const defaultTypeId = typeof defaultType === 'object' ? defaultType.id : defaultType;
    return defaultTypeId;
  }

  async getOrderById(orderId: number, trx: any = null): Promise<Order> {
    try {
      const db = trx || this.db.knex;
      const orderData = await db('orders')
        .select(
          'orders.*',
          'calculated_orders.total_amount as calculated_total_amount',
          'calculated_orders.delivery_fee as calculated_delivery_fee',
          'calculated_orders.service_charge as calculated_service_charge',
          'calculated_orders.address_details as calculated_address_details',
          'calculated_orders.lat as calculated_lat',
          'calculated_orders.lng as calculated_lng',
          'order_types.name as order_type_name'
        )
        .leftJoin('calculated_orders', 'orders.calculated_order_id', 'calculated_orders.id')
        .leftJoin('order_types', 'orders.order_type_id', 'order_types.id')
        .where('orders.id', orderId)
        .first();

      if (!orderData) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      const { 
        calculated_total_amount,
        calculated_delivery_fee,
        calculated_service_charge,
        calculated_address_details,
        calculated_lat,
        calculated_lng,
        ...order
      } = orderData;

      const [logs, amountHistory] = await Promise.all([
        db('logs').where('order_id', orderId).orderBy('time', 'asc'),
        db('order_total_amount_history').where('order_id', orderId).orderBy('time', 'asc')
      ]);

      return {
        ...order,
        calculated_order: {
          total_amount: calculated_total_amount,
          delivery_fee: calculated_delivery_fee,
          service_charge: calculated_service_charge,
          address_details: calculated_address_details,
          lat: calculated_lat,
          lng: calculated_lng,
        },
        logs,
        order_total_amount_history: amountHistory,
      };
    } catch (error) {
      this.logger.error(`Failed to get order by ID ${orderId}`, error.stack, 'getOrderById');
      throw error;
    }
  }

  async getAllOrdersWithRelated(options: { page: number; limit: number; status?: string }): Promise<any> {
    try {
      const query = this.db.knex('orders')
        .select(
          'orders.*',
          'calculated_orders.total_amount',
          'calculated_orders.meals',
          'order_types.name as order_type_name'
        )
        .leftJoin('calculated_orders', 'orders.calculated_order_id', 'calculated_orders.id')
        .leftJoin('order_types', 'orders.order_type_id', 'order_types.id');

      if (options.status) {
        query.where('orders.status', options.status);
      }

      const offset = (options.page - 1) * options.limit;
      const [totalCount] = await query.clone().count();
    
      const orders = await query
        .offset(offset)
        .limit(options.limit)
        .orderBy('orders.created_at', 'desc');

      // Get related data for each order
      const ordersWithRelated = await Promise.all(
        orders.map(async (order) => {
          const [logs, amountHistory] = await Promise.all([
            this.db.knex('logs').where('order_id', order.id).orderBy('time', 'asc'),
            this.db.knex('order_total_amount_history').where('order_id', order.id).orderBy('time', 'asc')
          ]);

          return {
            ...order,
            logs,
            order_total_amount_history: amountHistory
          };
        })
      );

      return {
        data: ordersWithRelated,
        meta: {
          total: parseInt(totalCount.count as string),
          page: options.page,
          limit: options.limit,
          totalPages: Math.ceil(parseInt(totalCount.count as string) / options.limit)
        }
      };
    } catch (error) {
      this.logger.error('Failed to get all orders with related data', error.stack, 'getAllOrdersWithRelated');
      throw error;
    }
  }

  async getOrderLogs(orderId: number): Promise<any[]> {
    try {
      const logs = await this.db.knex('logs')
        .where('order_id', orderId)
        .orderBy('time', 'asc');

      if (!logs.length) {
        throw new NotFoundException(`No logs found for order ID ${orderId}`);
      }

      return logs;
    } catch (error) {
      this.logger.error(`Failed to get logs for order ${orderId}`, error.stack, 'getOrderLogs');
      throw error;
    }
  }

  async updateOrderStatus(orderId: number, status: string, description?: string): Promise<Order> {
    try {
      return this.db.knex.transaction(async (trx) => {
        // Update order status
        await trx('orders')
          .where('id', orderId)
          .update({
            status,
            updated_at: trx.fn.now()
          });

        // Create log entry
        if (description) {
          await trx('logs').insert({
            order_id: orderId,
            description,
            time: trx.fn.now()
          });
        }

        const updatedOrder = await this.getOrderById(orderId);
        
        // Publish order update event to RabbitMQ
        await this.rabbitMQService.publishOrderUpdated(updatedOrder);

        return updatedOrder;
      });
    } catch (error) {
      this.logger.error(`Failed to update status for order ${orderId}`, error.stack, 'updateOrderStatus');
      throw error;
    }
  }

  async getMostBoughtMeal(startDate?: string, endDate?: string): Promise<any> {
    try {
      const result = await this.db.knex.raw(`
        WITH meal_quantities AS (
          SELECT 
            meal->>'name' as name,
            SUM((meal->>'quantity')::int) as quantity
          FROM calculated_orders
          CROSS JOIN LATERAL jsonb_array_elements(meals) as meal
          WHERE ($1::timestamp IS NULL OR calculated_orders.created_at >= $1)
            AND ($2::timestamp IS NULL OR calculated_orders.created_at <= $2)
          GROUP BY meal->>'name'
        )
        SELECT name, quantity
        FROM meal_quantities
        WHERE quantity = (SELECT MAX(quantity) FROM meal_quantities)
      `, [startDate, endDate]);

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to get most bought meal', error.stack, 'getMostBoughtMeal');
      throw error;
    }
  }

  async getDailyOrderStats(startDate?: string, endDate?: string): Promise<any[]> {
    try {
      return this.db.knex('orders')
        .select(
          this.db.knex.raw('DATE(created_at) as date'),
          this.db.knex.raw('COUNT(*) as total_orders'),
          this.db.knex.raw('COUNT(CASE WHEN completed = true THEN 1 END) as completed_orders'),
          this.db.knex.raw('COUNT(CASE WHEN cancelled = true THEN 1 END) as cancelled_orders'),
          this.db.knex.raw('AVG(CASE WHEN completed = true THEN EXTRACT(EPOCH FROM (completed_time - created_at))/60 END) as avg_completion_time_minutes')
        )
        .whereRaw('created_at >= ?', [startDate || this.db.knex.raw('CURRENT_DATE - INTERVAL \'30 days\'')])
        .whereRaw('created_at < ?', [endDate || this.db.knex.raw('CURRENT_DATE + INTERVAL \'1 day\'')])
        .groupByRaw('DATE(created_at)')
        .orderByRaw('DATE(created_at)');
    } catch (error) {
      this.logger.error('Failed to get daily order stats', error.stack, 'getDailyOrderStats');
      throw error;
    }
  }

  async countPendingOrders(): Promise<number> {
    try {
      const result = await this.db.knex('orders')
        .where({
          completed: false,
          cancelled: false
        })
        .count('id as count')
        .first();
    
      return parseInt(result?.count as string) || 0;
    } catch (error) {
      this.logger.error('Failed to count pending orders', error.stack, 'countPendingOrders');
      throw error;
    }
  }

  async getCompletedOrdersToday(): Promise<number> {
    try {
      const result = await this.db.knex('orders')
        .where('completed', true)
        .whereRaw('DATE(completed_time) = CURRENT_DATE')
        .count('id as count')
        .first();
    
      return parseInt(result?.count as string) || 0;
    } catch (error) {
      this.logger.error('Failed to get completed orders for today', error.stack, 'getCompletedOrdersToday');
      throw error;
    }
  }

  async getAverageDeliveryTime(): Promise<number> {
    try {
      const result = await this.db.knex.raw(`
        SELECT AVG(EXTRACT(EPOCH FROM (completed_time - created_at))/60) as avg_time
        FROM orders
        WHERE completed = true
          AND completed_time IS NOT NULL
          AND DATE(completed_time) = CURRENT_DATE
      `);
    
      return parseFloat(result.rows[0]?.avg_time) || 0;
    } catch (error) {
      this.logger.error('Failed to get average delivery time', error.stack, 'getAverageDeliveryTime');
      throw error;
    }
  }

  async assignRider(orderId: number, riderId: number): Promise<Order> {
    try {
      return this.db.knex.transaction(async (trx) => {
        // Verify order exists and isn't already assigned
        const order = await trx('orders')
          .where('id', orderId)
          .first();

        if (!order) {
          throw new NotFoundException(`Order with ID ${orderId} not found`);
        }

        if (order.rider_assigned) {
          throw new Error('Order already has an assigned rider');
        }

        // Update order with rider assignment
        await trx('orders')
          .where('id', orderId)
          .update({
            rider_id: riderId,
            rider_assigned: true,
            updated_at: trx.fn.now()
          });

        // Create log entry for rider assignment
        await trx('logs').insert({
          order_id: orderId,
          description: `Rider (ID: ${riderId}) assigned to order`,
          time: trx.fn.now()
        });

        const updatedOrder = await this.getOrderById(orderId);
        
        // Publish order assignment event to RabbitMQ
        await this.rabbitMQService.publishOrderAssigned(updatedOrder);

        return updatedOrder;
      });
    } catch (error) {
      this.logger.error(`Failed to assign rider ${riderId} to order ${orderId}`, error.stack, 'assignRider');
      throw error;
    }
  }
}
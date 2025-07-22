import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../config/database.service';
import { Order } from '../models/order.model';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { RidersService } from '../riders/riders.service';
import { DispatchGateway } from '../websockets/dispatch.gateway';
import { OrderForBroadcast } from '../interfaces/websocket-messages';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderStatus } from '../dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly ridersService: RidersService,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  async createOrder(orderData: CreateOrderDto): Promise<number> {
    return this.db.knex.transaction(async (trx) => {
      // First create the calculated order
      const [calculatedOrderId] = await trx('calculated_orders').insert({
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

      // Create the order
      const [orderId] = await trx('orders').insert({
        user_id: orderData.user_id,
        order_type_id: orderData.order_type_id,
        calculated_order_id: calculatedOrderId,
        scheduled: orderData.scheduled,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      }).returning('id');

      // Create initial log
      await trx('logs').insert({
        order_id: orderId,
        description: 'Order received',
        time: trx.fn.now()
      });

      // Create initial order total amount history
      await trx('order_total_amount_history').insert({
        order_id: orderId,
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
          const order = await this.getOrderById(orderId);
          
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
      const createdOrder = await this.getOrderById(orderId);
      await this.rabbitMQService.publishOrderCreated(createdOrder);

      return orderId;
    });
  }

  async getOrderById(orderId: number): Promise<Order> {
    const order = await this.db.knex('orders')
      .select(
        'orders.*',
        'calculated_orders.total_amount',
        'calculated_orders.meals',
        'calculated_orders.delivery_fee',
        'calculated_orders.service_charge',
        'order_types.name as order_type_name'
      )
      .leftJoin('calculated_orders', 'orders.calculated_order_id', 'calculated_orders.id')
      .leftJoin('order_types', 'orders.order_type_id', 'order_types.id')
      .where('orders.id', orderId)
      .first();
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get related data
    const [logs, amountHistory] = await Promise.all([
      this.db.knex('logs').where('order_id', orderId).orderBy('time', 'asc'),
      this.db.knex('order_total_amount_history').where('order_id', orderId).orderBy('time', 'asc')
    ]);

    return {
      ...order,
      logs,
      order_total_amount_history: amountHistory
    };
  }

  async getAllOrdersWithRelated(options: { page: number; limit: number; status?: string }): Promise<any> {
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
  }

  async getOrderLogs(orderId: number): Promise<any[]> {
    const logs = await this.db.knex('logs')
      .where('order_id', orderId)
      .orderBy('time', 'asc');

    if (!logs.length) {
      throw new NotFoundException(`No logs found for order ID ${orderId}`);
    }

    return logs;
  }

  async updateOrderStatus(orderId: number, status: string, description?: string): Promise<Order> {
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
  }

  async getMostBoughtMeal(startDate?: string, endDate?: string): Promise<any> {
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
  }

  async getDailyOrderStats(startDate?: string, endDate?: string): Promise<any[]> {
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
  }

  async countPendingOrders(): Promise<number> {
    const result = await this.db.knex('orders')
      .where({
        completed: false,
        cancelled: false
      })
      .count('id as count')
      .first();
    
    return parseInt(result?.count as string) || 0;
  }

  async getCompletedOrdersToday(): Promise<number> {
    const result = await this.db.knex('orders')
      .where('completed', true)
      .whereRaw('DATE(completed_time) = CURRENT_DATE')
      .count('id as count')
      .first();
    
    return parseInt(result?.count as string) || 0;
  }

  async getAverageDeliveryTime(): Promise<number> {
    const result = await this.db.knex.raw(`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_time - created_at))/60) as avg_time
      FROM orders
      WHERE completed = true
        AND completed_time IS NOT NULL
        AND DATE(completed_time) = CURRENT_DATE
    `);
    
    return parseFloat(result.rows[0]?.avg_time) || 0;
  }

  async assignRider(orderId: number, riderId: number): Promise<Order> {
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
  }
} 
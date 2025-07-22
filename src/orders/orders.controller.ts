import { Controller, Post, Get, Put, Body, UseGuards, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { Order } from '../models/order.model';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderStatus, OrderResponse, UpdateOrderStatusDto } from '../dto/order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('api/orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ 
    status: 201, 
    description: 'Order created successfully',
    schema: {
      properties: {
        orderId: {
          type: 'number',
          example: 123,
          description: 'ID of the created order'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  async createOrder(@Body() orderData: CreateOrderDto): Promise<{ orderId: number }> {
    try {
      // Pass the DTO directly - service will handle type conversions
      const orderId = await this.ordersService.createOrder(orderData);
      return { orderId };
    } catch (error) {
      throw new BadRequestException('Failed to create order: ' + error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: OrderStatus,
    description: 'Filter by order status' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of orders retrieved successfully',
    type: [OrderResponse]
  })
  async getAllOrders(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.getAllOrdersWithRelated({ page, limit, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', required: true, description: 'Order ID' })
  @ApiResponse({ status: 200, type: OrderResponse })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') id: number) {
    const order = await this.ordersService.getOrderById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get order logs by order ID' })
  @ApiParam({ name: 'id', required: true, description: 'Order ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order logs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number' },
          order_id: { type: 'number' },
          description: { type: 'string' },
          time: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Order logs not found' })
  async getOrderLogs(@Param('id') id: number) {
    const order = await this.ordersService.getOrderById(id);
    if (!order || !order.logs) {
      throw new NotFoundException(`Logs for order ID ${id} not found`);
    }
    return order.logs;
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', required: true, description: 'Order ID' })
  @ApiResponse({ status: 200, type: OrderResponse })
  @ApiResponse({ status: 400, description: 'Invalid status update data' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param('id') id: number,
    @Body() data: UpdateOrderStatusDto
  ) {
    const order = await this.ordersService.updateOrderStatus(id, data.status, data.description);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  @Get('stats/most-bought')
  @ApiOperation({ summary: 'Get most frequently ordered meal in a date range' })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String,
    description: 'Start date in ISO format (YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String,
    description: 'End date in ISO format (YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200,
    description: 'Most bought meal statistics',
    schema: {
      properties: {
        meal_id: { type: 'number' },
        meal_name: { type: 'string' },
        total_orders: { type: 'number' }
      }
    }
  })
  async getMostBoughtMeal(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ordersService.getMostBoughtMeal(startDate, endDate);
  }

  @Get('stats/daily')
  @ApiOperation({ summary: 'Get daily order statistics in a date range' })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String,
    description: 'Start date in ISO format (YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String,
    description: 'End date in ISO format (YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200,
    description: 'Daily order statistics',
    schema: {
      type: 'array',
      items: {
        properties: {
          date: { type: 'string', format: 'date' },
          total_orders: { type: 'number' },
          total_amount: { type: 'number' }
        }
      }
    }
  })
  async getDailyOrderStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ordersService.getDailyOrderStats(startDate, endDate);
  }

  @Put(':id/assign-rider')
  @ApiOperation({ summary: 'Assign a rider to an order' })
  @ApiParam({ name: 'id', required: true, description: 'Order ID' })
  @ApiResponse({ status: 200, type: OrderResponse })
  @ApiResponse({ status: 400, description: 'Invalid rider assignment data' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async assignRider(
    @Param('id') orderId: number,
    @Body() data: { riderId: number }
  ) {
    const order = await this.ordersService.assignRider(orderId, data.riderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}

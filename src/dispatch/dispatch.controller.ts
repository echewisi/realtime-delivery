import { Controller, Get, Post, Put, Body, UseGuards, Param, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DispatchGateway } from '../websockets/dispatch.gateway';
import { RidersService } from '../riders/riders.service';
import { OrdersService } from '../orders/orders.service';
import { OrderForBroadcast } from '../interfaces/websocket-messages';
import { AssignOrderDto, NearbyRidersQueryDto } from '../dto/dispatch.dto';

@ApiTags('dispatch')
@ApiBearerAuth()
@Controller('api/dispatch')
export class DispatchController {
  constructor(
    private readonly dispatchGateway: DispatchGateway,
    private readonly ridersService: RidersService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('riders/active')
  async getActiveRiders(
    @Query('lat') latitude?: number,
    @Query('lng') longitude?: number,
    @Query('radius') radiusKm?: number
  ) {
    if (latitude && longitude) {
      return this.ridersService.findNearbyAvailableRiders(latitude, longitude, radiusKm);
    }
    return this.ridersService.findAllActiveRiders();
  }

  @Post('orders/:orderId/assign')
  async assignOrderToRider(
    @Param('orderId') orderId: number,
    @Body() data: { riderId: number },
  ) {
    try {
      // Update order with assigned rider
      const updatedOrder = await this.ordersService.assignRider(orderId, data.riderId);
      
      // Get rider's current location
      const rider = await this.ridersService.findById(data.riderId);
      
      if (!updatedOrder.calculated_order) {
        throw new BadRequestException('Order does not have required calculated order details');
      }

      // Prepare order data for WebSocket notification
      const orderForBroadcast: OrderForBroadcast = {
        id: updatedOrder.id.toString(),
        order_code: updatedOrder.order_code,
        calculated_order: {
          total_amount: updatedOrder.calculated_order.total_amount.toString(),
          delivery_fee: updatedOrder.calculated_order.delivery_fee.toString(),
          service_charge: updatedOrder.calculated_order.service_charge.toString(),
          address_details: updatedOrder.calculated_order.address_details,
          lat: updatedOrder.calculated_order.lat,
          lng: updatedOrder.calculated_order.lng
        }
      };
      
      // Send notification to rider through WebSocket
      await this.dispatchGateway.sendOrderToRider(data.riderId, orderForBroadcast);
      
      // Broadcast rider's location update through WebSocket
      if (rider.current_latitude && rider.current_longitude) {
        this.dispatchGateway.handleRiderLocationUpdate(
          data.riderId,
          rider.current_latitude,
          rider.current_longitude
        );
      }
      
      return updatedOrder;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Get('orders/:orderId/nearby-riders')
  async getNearbyRidersForOrder(@Param('orderId') orderId: number) {
    const order = await this.ordersService.getOrderById(orderId);
    if (!order.calculated_order) {
      throw new BadRequestException('Order does not have location information');
    }

    const { lat, lng } = order.calculated_order;
    if (!lat || !lng) {
      throw new BadRequestException('Order location coordinates are missing');
    }
    
    const nearbyRiders = await this.ridersService.findNearbyAvailableRiders(
      parseFloat(lat),
      parseFloat(lng),
      5 // Default 5km radius
    );
    
    return {
      order: {
        id: order.id,
        code: order.order_code,
        location: { lat, lng }
      },
      riders: nearbyRiders.map(rider => ({
        id: rider.id,
        name: rider.name,
        location: {
          lat: rider.current_latitude,
          lng: rider.current_longitude
        },
        distance: rider.distance
      }))
    };
  }

  @Post('orders/:orderId/broadcast')
  async broadcastOrderToNearbyRiders(
    @Param('orderId') orderId: number,
    @Query('radius') radiusKm: number = 5
  ) {
    const order = await this.ordersService.getOrderById(orderId);
    if (!order.calculated_order) {
      throw new BadRequestException('Order does not have location information');
    }

    const { lat, lng } = order.calculated_order;
    if (!lat || !lng) {
      throw new BadRequestException('Order location coordinates are missing');
    }

    const nearbyRiders = await this.ridersService.findNearbyAvailableRiders(
      parseFloat(lat),
      parseFloat(lng),
      radiusKm
    );

    if (nearbyRiders.length === 0) {
      return { success: false, message: 'No available riders found nearby' };
    }

    // Prepare order with essential data for broadcasting
    const orderForBroadcast: OrderForBroadcast = {
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

    // Broadcast order to all nearby riders
    await Promise.all(
      nearbyRiders.map(rider =>
        this.dispatchGateway.sendOrderToRider(rider.id, {
          ...orderForBroadcast,
          distance: rider.distance ?? 0
        })
      )
    );

    return {
      success: true,
      message: `Order broadcasted to ${nearbyRiders.length} nearby riders`,
      riders: nearbyRiders.map(r => ({ id: r.id, distance: r.distance || 0 }))
    };
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    const pendingOrders = await this.ordersService.countPendingOrders();
    const completedToday = await this.ordersService.getCompletedOrdersToday();
    const avgDeliveryTime = await this.ordersService.getAverageDeliveryTime();

    return {
      pendingOrders,
      completedToday,
      avgDeliveryTime
    };
  }
}

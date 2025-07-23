import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { CustomLogger } from '../common/logger/logger.service';
import { 
  RiderLocationUpdateMessage, 
  OrderAssignmentMessage, 
  OrderActionMessage,
  OrderRejectionMessage,
  NewOrderMessage 
} from '../interfaces/websocket-messages';

@WebSocketGateway({ namespace: '/dispatch', cors: true })
@Injectable()
export class DispatchGateway {
  @WebSocketServer()
  server: Server;

  private riderSockets: Map<number, string> = new Map(); // riderId -> socketId
  private dispatchSockets: Set<string> = new Set(); // Set of dispatcher socket IDs

  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext(DispatchGateway.name);
  }

  handleRiderLocationUpdate(riderId: number, latitude: number, longitude: number): void {
    try {
      const message: RiderLocationUpdateMessage = { riderId, latitude, longitude };
      this.server.emit('riderLocationUpdate', message);
      // Also notify dispatch dashboard specifically
      this.broadcastToDispatchers('riderLocationUpdate', message);
    } catch (error) {
      this.logger.error('Failed to handle rider location update', error.stack, 'handleRiderLocationUpdate');
    }
  }

  sendOrderToRider(riderId: string | number, order: NewOrderMessage['order']): boolean {
    try {
      const riderIdNumber = typeof riderId === 'string' ? parseInt(riderId) : riderId;
      const socketId = this.riderSockets.get(riderIdNumber);
      if (socketId) {
        this.server.to(socketId).emit('newOrder', { order });
        this.logger.debug(`Order sent to rider ${riderId}`);
        return true;
      }
      this.logger.warn(`Failed to send order to rider ${riderId}: rider not connected`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to send order to rider ${riderId}`, error.stack, 'sendOrderToRider');
      return false;
    }
  }

  broadcastOrderAssignment(orderId: number, riderId: number): void {
    try {
      const message: OrderAssignmentMessage = { orderId, riderId };
      this.broadcastToDispatchers('orderAssigned', message);
    } catch (error) {
      this.logger.error('Failed to broadcast order assignment', error.stack, 'broadcastOrderAssignment');
    }
  }

  @SubscribeMessage('registerRider')
  handleRegisterRider(@MessageBody() data: { riderId: number }, @ConnectedSocket() client: Socket) {
    try {
      this.riderSockets.set(data.riderId, client.id);
      this.logger.log(`Rider ${data.riderId} registered with socket ${client.id}`);
      // Notify dispatchers of new rider connection
      this.broadcastToDispatchers('riderConnected', { riderId: data.riderId });
    } catch (error) {
      this.logger.error(`Failed to register rider ${data.riderId}`, error.stack, 'handleRegisterRider');
    }
  }

  @SubscribeMessage('unregisterRider')
  handleUnregisterRider(@MessageBody() data: { riderId: number }, @ConnectedSocket() client: Socket) {
    try {
      if (this.riderSockets.get(data.riderId) === client.id) {
        this.riderSockets.delete(data.riderId);
        this.logger.log(`Rider ${data.riderId} unregistered`);
        // Notify dispatchers of rider disconnection
        this.broadcastToDispatchers('riderDisconnected', { riderId: data.riderId });
      }
    } catch (error) {
      this.logger.error(`Failed to unregister rider ${data.riderId}`, error.stack, 'handleUnregisterRider');
    }
  }

  @SubscribeMessage('registerDispatcher')
  handleRegisterDispatcher(@ConnectedSocket() client: Socket) {
    try {
      this.dispatchSockets.add(client.id);
      this.logger.log(`Dispatcher registered with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Failed to register dispatcher', error.stack, 'handleRegisterDispatcher');
    }
  }

  @SubscribeMessage('unregisterDispatcher')
  handleUnregisterDispatcher(@ConnectedSocket() client: Socket) {
    try {
      this.dispatchSockets.delete(client.id);
      this.logger.log(`Dispatcher unregistered with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Failed to unregister dispatcher', error.stack, 'handleUnregisterDispatcher');
    }
  }

  @SubscribeMessage('orderAccepted')
  handleOrderAccepted(
    @MessageBody() data: { orderId: number; riderId: number },
    @ConnectedSocket() client: Socket
  ) {
    try {
      if (this.riderSockets.get(data.riderId) === client.id) {
        this.broadcastToDispatchers('orderAccepted', data);
        this.logger.log(`Order ${data.orderId} accepted by rider ${data.riderId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle order accepted by rider ${data.riderId}`, error.stack, 'handleOrderAccepted');
    }
  }

  @SubscribeMessage('orderRejected')
  handleOrderRejected(
    @MessageBody() data: { orderId: number; riderId: number; reason?: string },
    @ConnectedSocket() client: Socket
  ) {
    try {
      if (this.riderSockets.get(data.riderId) === client.id) {
        this.broadcastToDispatchers('orderRejected', data);
        this.logger.log(`Order ${data.orderId} rejected by rider ${data.riderId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle order rejected by rider ${data.riderId}`, error.stack, 'handleOrderRejected');
    }
  }

  @SubscribeMessage('orderDelivered')
  handleOrderDelivered(
    @MessageBody() data: { orderId: number; riderId: number },
    @ConnectedSocket() client: Socket
  ) {
    try {
      if (this.riderSockets.get(data.riderId) === client.id) {
        this.broadcastToDispatchers('orderDelivered', data);
        this.logger.log(`Order ${data.orderId} delivered by rider ${data.riderId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle order delivered by rider ${data.riderId}`, error.stack, 'handleOrderDelivered');
    }
  }

  private broadcastToDispatchers(event: string, data: any) {
    try {
      this.dispatchSockets.forEach(socketId => {
        this.server.to(socketId).emit(event, data);
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast event '${event}' to dispatchers`, error.stack, 'broadcastToDispatchers');
    }
  }
}
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
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

  private readonly logger = new Logger(DispatchGateway.name);
  private riderSockets: Map<number, string> = new Map(); // riderId -> socketId
  private dispatchSockets: Set<string> = new Set(); // Set of dispatcher socket IDs

  handleRiderLocationUpdate(riderId: number, latitude: number, longitude: number): void {
    const message: RiderLocationUpdateMessage = { riderId, latitude, longitude };
    this.server.emit('riderLocationUpdate', message);
    // Also notify dispatch dashboard specifically
    this.broadcastToDispatchers('riderLocationUpdate', message);
  }

  sendOrderToRider(riderId: string | number, order: NewOrderMessage['order']): boolean {
    const riderIdNumber = typeof riderId === 'string' ? parseInt(riderId) : riderId;
    const socketId = this.riderSockets.get(riderIdNumber);
    if (socketId) {
      this.server.to(socketId).emit('newOrder', { order });
      this.logger.debug(`Order sent to rider ${riderId}`);
      return true;
    }
    this.logger.warn(`Failed to send order to rider ${riderId}: rider not connected`);
    return false;
  }

  broadcastOrderAssignment(orderId: number, riderId: number): void {
    const message: OrderAssignmentMessage = { orderId, riderId };
    this.broadcastToDispatchers('orderAssigned', message);
  }

  @SubscribeMessage('registerRider')
  handleRegisterRider(@MessageBody() data: { riderId: number }, @ConnectedSocket() client: Socket) {
    this.riderSockets.set(data.riderId, client.id);
    this.logger.log(`Rider ${data.riderId} registered with socket ${client.id}`);
    
    // Notify dispatchers of new rider connection
    this.broadcastToDispatchers('riderConnected', { riderId: data.riderId });
  }

  @SubscribeMessage('unregisterRider')
  handleUnregisterRider(@MessageBody() data: { riderId: number }, @ConnectedSocket() client: Socket) {
    if (this.riderSockets.get(data.riderId) === client.id) {
      this.riderSockets.delete(data.riderId);
      this.logger.log(`Rider ${data.riderId} unregistered`);
      
      // Notify dispatchers of rider disconnection
      this.broadcastToDispatchers('riderDisconnected', { riderId: data.riderId });
    }
  }

  @SubscribeMessage('registerDispatcher')
  handleRegisterDispatcher(@ConnectedSocket() client: Socket) {
    this.dispatchSockets.add(client.id);
    this.logger.log(`Dispatcher registered with socket ${client.id}`);
  }

  @SubscribeMessage('unregisterDispatcher')
  handleUnregisterDispatcher(@ConnectedSocket() client: Socket) {
    this.dispatchSockets.delete(client.id);
    this.logger.log(`Dispatcher unregistered with socket ${client.id}`);
  }

  @SubscribeMessage('orderAccepted')
  handleOrderAccepted(
    @MessageBody() data: { orderId: number; riderId: number },
    @ConnectedSocket() client: Socket
  ) {
    if (this.riderSockets.get(data.riderId) === client.id) {
      this.broadcastToDispatchers('orderAccepted', data);
      this.logger.log(`Order ${data.orderId} accepted by rider ${data.riderId}`);
    }
  }

  @SubscribeMessage('orderRejected')
  handleOrderRejected(
    @MessageBody() data: { orderId: number; riderId: number; reason?: string },
    @ConnectedSocket() client: Socket
  ) {
    if (this.riderSockets.get(data.riderId) === client.id) {
      this.broadcastToDispatchers('orderRejected', data);
      this.logger.log(`Order ${data.orderId} rejected by rider ${data.riderId}`);
    }
  }

  @SubscribeMessage('orderDelivered')
  handleOrderDelivered(
    @MessageBody() data: { orderId: number; riderId: number },
    @ConnectedSocket() client: Socket
  ) {
    if (this.riderSockets.get(data.riderId) === client.id) {
      this.broadcastToDispatchers('orderDelivered', data);
      this.logger.log(`Order ${data.orderId} delivered by rider ${data.riderId}`);
    }
  }

  private broadcastToDispatchers(event: string, data: any) {
    this.dispatchSockets.forEach(socketId => {
      this.server.to(socketId).emit(event, data);
    });
  }
} 
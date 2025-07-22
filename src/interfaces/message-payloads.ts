import { Order } from '../models/order.model';

export interface RiderLocationPayload {
  riderId: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface OrderCreatedPayload {
  order: Order;
  timestamp: string;
}

export interface OrderUpdatedPayload {
  order: Order;
  previousStatus?: string;
  newStatus: string;
  timestamp: string;
}

export interface OrderAssignedPayload {
  order: Order;
  riderId: number;
  timestamp: string;
}

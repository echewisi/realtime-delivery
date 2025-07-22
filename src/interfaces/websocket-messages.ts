import { Order } from '../models/order.model';

export interface RiderLocationUpdateMessage {
  riderId: number;
  latitude: number;
  longitude: number;
}

export interface OrderAssignmentMessage {
  orderId: number;
  riderId: number;
}

export interface OrderActionMessage {
  orderId: number;
  riderId: number;
}

export interface OrderRejectionMessage extends OrderActionMessage {
  reason?: string;
}

export interface OrderForBroadcast {
  id: string;
  order_code: string;
  calculated_order: {
    total_amount: string;
    delivery_fee: string;
    service_charge: string;
    address_details: {
      city: string;
      name: string;
      address_line: string;
      building_number: string;
    };
    lat: string;
    lng: string;
  };
  distance?: number;
}

export interface NewOrderMessage {
  order: OrderForBroadcast;
}

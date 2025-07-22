import { Log } from './log.model';
import { OrderTotalAmountHistory } from './order-total-amount-history.model';
import { CalculatedOrder } from './calculated-order.model';
import { OrderType } from './order-type.model'; 


export interface Order {
  id: string;
  user_id: string;
  completed: boolean;
  cancelled: boolean;
  kitchen_cancelled: boolean;
  kitchen_accepted: boolean;
  kitchen_dispatched: boolean;
  kitchen_dispatched_time: string | null;
  completed_time: string | null;
  rider_id: string | null;
  kitchen_prepared: boolean;
  rider_assigned: boolean;
  paid: boolean;
  order_code: string;
  order_change: number | null;
  calculated_order_id: string;
  created_at: string;
  updated_at: string;
  kitchen_verified_time: string | null;
  kitchen_completed_time: string | null;
  shop_accepted: boolean;
  shop_prepared: boolean;
  no_of_mealbags_delivered: number;
  no_of_drinks_delivered: number;
  rider_started_time: string | null;
  rider_started: boolean;
  rider_arrived_time: string | null;
  rider_arrived: boolean;
  is_failed_trip: boolean;
  failed_trip_details: object;
  box_number: string;
  shelf_id: string | null;
  scheduled: boolean;
  confirmed_by_id: string | null;
  completed_by_id: string | null;
  scheduled_delivery_date: string | null;
  scheduled_delivery_time: string | null;
  is_hidden: boolean;
  // Relations
  logs?: Log[];
  order_total_amount_history?: OrderTotalAmountHistory[];
  calculated_order?: CalculatedOrder;
  order_type?: OrderType;
}


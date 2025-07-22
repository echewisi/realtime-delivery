export interface CreateOrderInterface {
  user_id: string;
  order_type_id: string;
  calculated_order: {
    total_amount: number;
    delivery_fee: number;
    service_charge: number;
    amount: number;
    free_delivery: boolean;
    lat: number;
    lng: number;
  };
}

export interface UpdateOrderStatusInterface {
  order_id: string;
  status: string;
  rider_id?: string;
}

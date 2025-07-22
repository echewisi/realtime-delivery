export interface OrdersServiceInterface {
  createOrder(orderData: any): Promise<number>;
  getOrderById(orderId: number): Promise<any>;
  getAllOrdersWithRelated(options: { page: number; limit: number; status?: string }): Promise<any>;
  updateOrderStatus(orderId: number, status: string, description?: string): Promise<any>;
  assignRider(orderId: number, riderId: string): Promise<any>;
}

export interface OrderForBroadcast {
  id: string;
  lat: string;
  lng: string;
  amount: string;
}

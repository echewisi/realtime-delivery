import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.ACCEPTED,
    description: 'New status for the order'
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({
    example: 'Order accepted by kitchen',
    description: 'Optional description of the status change',
    required: false
  })
  @IsString()
  description?: string;
}

export class OrderResponse {
  @ApiProperty({ example: '123', description: 'Order ID' })
  id: string;

  @ApiProperty({ example: 'ORD-2025-001', description: 'Order tracking code' })
  order_code: string;

  @ApiProperty({ example: false, description: 'Whether the order is completed' })
  completed: boolean;

  @ApiProperty({ example: false, description: 'Whether the order is cancelled' })
  cancelled: boolean;

  @ApiProperty({ type: () => Object, description: 'Calculated order details including prices' })
  calculated_order: any;

  @ApiProperty({ type: [Object], description: 'Order status history logs' })
  logs: any[];

  @ApiProperty({ type: [Object], description: 'Order price history' })
  order_total_amount_history: any[];
}

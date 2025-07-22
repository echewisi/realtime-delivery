import { ApiProperty } from '@nestjs/swagger';

export class CalculatedOrderDetails {
  @ApiProperty({ description: 'Total amount including all fees' })
  total_amount: number;

  @ApiProperty({ description: 'Delivery fee for the order' })
  delivery_fee: number;

  @ApiProperty({ description: 'Service charge for the order' })
  service_charge: number;

  @ApiProperty({ description: 'Base amount for the order' })
  amount: number;

  @ApiProperty({ description: 'Whether delivery is free' })
  free_delivery: boolean;

  @ApiProperty({ description: 'Restaurant latitude' })
  lat: number;

  @ApiProperty({ description: 'Restaurant longitude' })
  lng: number;
}

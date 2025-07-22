import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDetails {
  @ApiProperty({ example: 'New York', description: 'City name' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'John Doe', description: 'Customer name' })
  @IsString()
  name: string;

  @ApiProperty({ example: '123 Main St', description: 'Street address' })
  @IsString()
  address_line: string;

  @ApiProperty({ example: 'Apt 4B', description: 'Building/Apartment number' })
  @IsString()
  building_number: string;
}

class CalculatedOrderDetails {
  @ApiProperty({ example: '25.00', description: 'Total amount of the order' })
  @IsNumber()
  total_amount: number;

  @ApiProperty({ example: '5.00', description: 'Delivery fee' })
  @IsNumber()
  delivery_fee: number;

  @ApiProperty({ example: '2.00', description: 'Service charge' })
  @IsNumber()
  service_charge: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => AddressDetails)
  address_details: AddressDetails;

  @ApiProperty({ example: 40.7128, description: 'Latitude coordinate' })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -74.0060, description: 'Longitude coordinate' })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: false, description: 'Whether delivery is free' })
  @IsBoolean()
  free_delivery: boolean;

  @ApiProperty({ example: 20.00, description: 'Base amount before fees' })
  @IsNumber()
  amount: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: '123', description: 'User ID placing the order' })
  @IsString()
  user_id: string;

  @ApiProperty({ example: '1', description: 'Order type ID' })
  @IsString()
  order_type_id: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => CalculatedOrderDetails)
  calculated_order: CalculatedOrderDetails;

  @ApiProperty({ example: false, description: 'Whether this is a scheduled delivery' })
  @IsBoolean()
  scheduled: boolean;
}

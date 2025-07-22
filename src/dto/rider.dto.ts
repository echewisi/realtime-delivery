import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsBoolean } from 'class-validator';

export class UpdateRiderLocationDto {
  @ApiProperty({ example: 40.7128, description: 'Rider\'s current latitude' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: -74.0060, description: 'Rider\'s current longitude' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class UpdateRiderAvailabilityDto {
  @ApiProperty({ example: true, description: 'Whether the rider is available for orders' })
  @IsBoolean()
  @IsNotEmpty()
  isAvailable: boolean;
}

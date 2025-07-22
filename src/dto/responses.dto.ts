import { ApiProperty } from '@nestjs/swagger';

export class RiderLocationResponse {
  @ApiProperty({ example: 123, description: 'Rider ID' })
  id: number;

  @ApiProperty({ example: 'John Doe', description: 'Rider name' })
  name: string;

  @ApiProperty({ example: 40.7128, description: 'Current latitude' })
  current_latitude: number;

  @ApiProperty({ example: -74.0060, description: 'Current longitude' })
  current_longitude: number;

  @ApiProperty({ example: 2.5, description: 'Distance from search point in kilometers' })
  distance: number;

  @ApiProperty({ example: true, description: 'Whether the rider is available' })
  is_available: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class AssignOrderDto {
  @ApiProperty({ example: 123, description: 'ID of the rider to assign' })
  @IsNumber()
  @IsNotEmpty()
  riderId: number;
}

export class NearbyRidersQueryDto {
  @ApiProperty({ example: 40.7128, description: 'Latitude coordinate' })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: -74.0060, description: 'Longitude coordinate' })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @ApiProperty({ example: 5, description: 'Search radius in kilometers', required: false })
  @IsNumber()
  @IsOptional()
  radius?: number;
}

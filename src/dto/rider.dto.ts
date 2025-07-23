import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsBoolean, IsString, IsEmail, MinLength } from 'class-validator';

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

export class CreateRiderDto {
  @ApiProperty({ example: 'John Doe', description: 'Rider\'s full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com', description: 'Rider\'s email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '1234567890', description: 'Rider\'s phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'password123', description: 'Rider\'s password' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

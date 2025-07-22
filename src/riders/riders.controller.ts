import { Controller, Put, Get, Post, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RidersService } from './riders.service';
import { DispatchGateway } from '../websockets/dispatch.gateway';
import { UpdateRiderLocationDto, UpdateRiderAvailabilityDto } from '../dto/rider.dto';
import { RiderLocationResponse } from '../dto/responses.dto';

@ApiTags('riders')
@ApiBearerAuth()
@Controller('api/riders')
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

  @ApiOperation({ summary: 'Update rider location' })
  @ApiResponse({ 
    status: 200, 
    description: 'Location updated successfully' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid location coordinates' 
  })
  @ApiQuery({ 
    name: 'riderId', 
    type: Number, 
    description: 'ID of the rider to update' 
  })
  @Put('location')
  async updateLocation(
    @Query('riderId') riderId: number,
    @Body() data: UpdateRiderLocationDto,
  ): Promise<void> {
    await this.ridersService.updateLocation(riderId, data.latitude, data.longitude);
    
    // Broadcast location update through WebSocket
    this.dispatchGateway.handleRiderLocationUpdate(riderId, data.latitude, data.longitude);
  }

  @ApiOperation({ summary: 'Update rider availability status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Availability updated successfully' 
  })
  @ApiQuery({ 
    name: 'riderId', 
    type: Number, 
    description: 'ID of the rider to update' 
  })
  @Put('availability')
  async updateAvailability(
    @Query('riderId') riderId: number,
    @Body() data: UpdateRiderAvailabilityDto,
  ): Promise<void> {
    await this.ridersService.updateAvailability(riderId, data.isAvailable);
  }

  @ApiOperation({ summary: 'Find nearby available riders' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of nearby riders with distances',
    type: [RiderLocationResponse] 
  })
  @ApiQuery({ 
    name: 'latitude', 
    type: Number, 
    description: 'Center point latitude' 
  })
  @ApiQuery({ 
    name: 'longitude', 
    type: Number, 
    description: 'Center point longitude' 
  })
  @ApiQuery({ 
    name: 'radiusKm', 
    type: Number, 
    required: false, 
    description: 'Search radius in kilometers' 
  })
  @Get('nearby')
  async findNearbyRiders(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radiusKm') radiusKm?: number,
  ) {
    return this.ridersService.findNearbyAvailableRiders(latitude, longitude, radiusKm);
  }
}

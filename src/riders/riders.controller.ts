import { Controller, Put, Get, Post, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { RidersService } from './riders.service';
import { DispatchGateway } from '../websockets/dispatch.gateway';
import { UpdateRiderLocationDto, UpdateRiderAvailabilityDto } from '../dto/rider.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RiderLocationResponse } from '../dto/responses.dto';

@ApiTags('riders')
@ApiBearerAuth()
@Controller('riders')
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
  @UseGuards(JwtAuthGuard)
  @Put('/mee/location')
  async updateLocation(
    @Request() req,
    @Body() data: UpdateRiderLocationDto,
  ): Promise<any> {
    const riderId = Number(req.user.userId);
    if (isNaN(riderId)) {
      throw new Error('Invalid user ID');
    }
    const rider= await this.ridersService.updateLocation(riderId, data.latitude, data.longitude);

    
    // Broadcast location update through WebSocket
    this.dispatchGateway.handleRiderLocationUpdate(riderId, data.latitude, data.longitude);

    return rider

  }

  @ApiOperation({ summary: 'Update rider availability status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Availability updated successfully' 
  })
  @Put('availability')
  async updateAvailability(
    @Request() req,
    @Body() data  : UpdateRiderAvailabilityDto,
  ): Promise<any> {
    const riderId = req.user.id;
    await this.ridersService.updateAvailability(riderId, data.isAvailable);
  }

  @ApiOperation({ summary: 'Find nearby available riders' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of nearby riders with distances',
    type: [RiderLocationResponse] 
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

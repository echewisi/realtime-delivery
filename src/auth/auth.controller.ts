import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateRiderDto, LoginRiderDto } from '../dto/rider.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new rider' })
  @ApiResponse({ status: 201, description: 'Rider registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @Post('register')
  async register(@Body() createRiderDto: CreateRiderDto) {
    return this.authService.register(createRiderDto);
  }

  @ApiOperation({ summary: 'Log in a rider' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginRiderDto) {
    return this.authService.login(loginDto);
  }
}

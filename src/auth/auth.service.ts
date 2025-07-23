import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RidersService } from '../riders/riders.service';
import { CreateRiderDto, LoginRiderDto } from '../dto/rider.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly ridersService: RidersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(createRiderDto: CreateRiderDto): Promise<{ access_token: string }> {
    const existingRider = await this.ridersService.findByEmail(createRiderDto.email);
    if (existingRider) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(createRiderDto.password, 10);
    
    const rider = await this.ridersService.create({
      ...createRiderDto,
      password: hashedPassword,
    });

    const payload = { email: rider.email, sub: rider.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginRiderDto): Promise<{ access_token: string }> {
    const rider = await this.ridersService.findByEmail(loginDto.email);
    if (!rider || !rider.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordMatching = await bcrypt.compare(loginDto.password, rider.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: rider.email, sub: rider.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

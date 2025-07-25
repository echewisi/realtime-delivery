import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './config/database.service';
import { RabbitMQService } from './rabbitmq/rabbitmq.service';
import { OrdersService } from './orders/orders.service';
import { RidersService } from './riders/riders.service';
import { DispatchGateway } from './websockets/dispatch.gateway';
import { OrdersController } from './orders/orders.controller';
import { RidersController } from './riders/riders.controller';
import { DispatchController } from './dispatch/dispatch.controller';
import { CustomLogger } from './common/logger/logger.service';
import { RidersModule } from './riders/riders.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [
        () => ({
          JWT_SECRET: process.env.JWT_SECRET || 'default-secret-key',
        }),
      ],
    }),
    RidersModule,
    AuthModule
  ],
  controllers: [
    AppController,
    OrdersController,
    RidersController,
    DispatchController,
  ],
  providers: [
    AppService,
    DatabaseService,
    RabbitMQService,
    OrdersService,
    RidersService,
    DispatchGateway,
    CustomLogger
  ],
  exports: [
    DatabaseService,
    RabbitMQService,
    OrdersService,
    RidersService,
    DispatchGateway,
  ],
})
export class AppModule {}

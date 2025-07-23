import { Module } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { DatabaseService } from 'src/config/database.service';
import { RabbitMQService } from 'src/rabbitmq/rabbitmq.service';
import { CustomLogger } from 'src/common/logger/logger.service';
import { DispatchGateway } from 'src/websockets/dispatch.gateway';

@Module({
  providers: [RidersService, DatabaseService, RabbitMQService, CustomLogger, DispatchGateway],
  controllers: [RidersController],
  exports: [RidersService],
})
export class RidersModule {}

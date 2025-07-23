import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Connection, Channel, connect, Options } from 'amqplib';
import { 
  RiderLocationPayload,
  OrderCreatedPayload,
  OrderUpdatedPayload,
  OrderAssignedPayload 
} from '../interfaces/message-payloads';
import { Order } from '../models/order.model';
import { CustomLogger } from '../common/logger/logger.service';

interface QueueConfig {
  name: string;
  options: Options.AssertQueue;
  deadLetter?: boolean;
}

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: Connection;
  private channel: Channel;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectInterval: number;
  private readonly rabbitmqUrl: string;

  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext(RabbitMQService.name);
    // Load configuration from environment variables
    this.rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    this.maxReconnectAttempts = parseInt(process.env.RABBITMQ_RECONNECT_ATTEMPTS || '5', 10);
    this.reconnectInterval = parseInt(process.env.RABBITMQ_RECONNECT_INTERVAL || '5000', 10);
  }
  // Exchange configuration
  private readonly exchangeName = 'delivery_events';
  private readonly exchangeType = 'topic';

  // Queue configurations
  private readonly queues: { [key: string]: QueueConfig } = {
    orderCreated: {
      name: 'order.created',
      options: {
        durable: true,
        deadLetterExchange: 'delivery_events_dlx',
        deadLetterRoutingKey: 'order.created.dead',
      }
    },
    orderUpdated: {
      name: 'order.updated',
      options: {
        durable: true,
        deadLetterExchange: 'delivery_events_dlx',
        deadLetterRoutingKey: 'order.updated.dead',
      }
    },
    orderAssigned: {
      name: 'order.assigned',
      options: {
        durable: true,
        deadLetterExchange: 'delivery_events_dlx',
        deadLetterRoutingKey: 'order.assigned.dead',
      }
    },
    riderLocation: {
      name: 'rider.location',
      options: {
        durable: true,
        deadLetterExchange: 'delivery_events_dlx',
        deadLetterRoutingKey: 'rider.location.dead',
        messageTtl: 60000, // Location updates expire after 1 minute
      }
    },
    // Dead letter queues
    orderCreatedDLQ: {
      name: 'order.created.dead',
      options: { durable: true },
      deadLetter: true
    },
    orderUpdatedDLQ: {
      name: 'order.updated.dead',
      options: { durable: true },
      deadLetter: true
    },
    orderAssignedDLQ: {
      name: 'order.assigned.dead',
      options: { durable: true },
      deadLetter: true
    },
    riderLocationDLQ: {
      name: 'rider.location.dead',
      options: { durable: true },
      deadLetter: true
    }
  };

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      // Connect to RabbitMQ with heartbeat
      this.connection = await connect(this.rabbitmqUrl, {
        heartbeat: 60 // 60 seconds heartbeat
      }) as any;

      this.logger.log(`Connected to RabbitMQ at ${this.rabbitmqUrl.replace(/:[^:]*@/, ':***@')}`);

      (this.connection as any).on('error', (err) => {
        this.logger.error('RabbitMQ connection error', err.stack, 'ConnectionError');
        this.handleConnectionError();
      });

      (this.connection as any).on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this.handleConnectionError();
      });

      // Create channel with prefetch for better load balancing
      this.channel = await (this.connection as any).createChannel();
      await this.channel.prefetch(10); // Process max 10 messages at once

      // Setup exchanges
      await this.channel.assertExchange(this.exchangeName, this.exchangeType, { durable: true });
      await this.channel.assertExchange('delivery_events_dlx', 'direct', { durable: true });

      // Setup queues and bindings
      await this.setupQueues();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('Successfully connected to RabbitMQ');

    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error.stack, 'connect');
      this.handleConnectionError();
    }
  }

  private async setupQueues() {
    for (const [key, config] of Object.entries(this.queues)) {
      await this.channel.assertQueue(config.name, config.options);
      
      if (!config.deadLetter) {
        // Bind regular queues to the main exchange
        await this.channel.bindQueue(
          config.name,
          this.exchangeName,
          key.toLowerCase()
        );
      } else {
        // Bind dead letter queues to the DLX exchange
        await this.channel.bindQueue(
          config.name,
          'delivery_events_dlx',
          config.name
        );
      }
    }
  }

  private async handleConnectionError() {
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.warn(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );

      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      this.logger.error('Max reconnection attempts reached', '', 'handleConnectionError');
    }
  }

  async publishOrderCreated(order: OrderCreatedPayload['order']): Promise<void> {
    try {
      const payload: OrderCreatedPayload = {
        order,
        timestamp: new Date().toISOString()
      };
      await this.publishMessage('orderCreated', payload);
    } catch (error) {
      this.logger.error('Failed to publish order created event', error.stack, 'publishOrderCreated');
      throw error;
    }
  }

  async publishOrderUpdated(order: Order): Promise<void> {
    try {
      const payload: OrderUpdatedPayload = {
        order,
        previousStatus: undefined,
        newStatus: order.completed ? 'completed' : order.cancelled ? 'cancelled' : 'pending',
        timestamp: new Date().toISOString()
      };
      await this.publishMessage('orderUpdated', payload);
    } catch (error) {
      this.logger.error('Failed to publish order updated event', error.stack, 'publishOrderUpdated');
      throw error;
    }
  }

  async publishOrderAssigned(order: Order): Promise<void> {
    try {
      if (!order.rider_id) {
        throw new Error('Cannot publish order assignment: no rider assigned');
      }
      
      const payload: OrderAssignedPayload = {
        order,
        riderId: parseInt(order.rider_id, 10),
        timestamp: new Date().toISOString()
      };
      await this.publishMessage('orderAssigned', payload);
    } catch (error) {
      this.logger.error('Failed to publish order assigned event', error.stack, 'publishOrderAssigned');
      throw error;
    }
  }

  async publishRiderLocation(locationUpdate: Omit<RiderLocationPayload, 'timestamp'>): Promise<void> {
    try {
      const payload: RiderLocationPayload = {
        ...locationUpdate,
        timestamp: new Date().toISOString()
      };
      await this.publishMessage('riderLocation', payload);
    } catch (error) {
      this.logger.error('Failed to publish rider location event', error.stack, 'publishRiderLocation');
      throw error;
    }
  }

  private async publishMessage(routingKey: string, data: any) {
    if (!this.isConnected || !this.channel) {
      throw new Error('RabbitMQ connection not available');
    }

    try {
      const message = Buffer.from(JSON.stringify(data));
      const published = this.channel.publish(
        this.exchangeName,
        routingKey.toLowerCase(),
        message,
        {
          persistent: true, // Message persistence
          timestamp: Date.now(),
          contentType: 'application/json',
          headers: {
            'x-retry-count': 0
          }
        }
      );

      if (!published) {
        throw new Error('Message could not be published');
      }
    } catch (error) {
      this.logger.error(`Error publishing message to ${routingKey}`, error.stack, 'publishMessage');
      throw error;
    }
  }

  async consumeMessages(
    queueName: string,
    handler: (data: any) => Promise<void>
  ) {
    if (!this.isConnected || !this.channel) {
      throw new Error('RabbitMQ connection not available');
    }

    try {
      await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
          const data = JSON.parse(msg.content.toString());
          await handler(data);
          this.channel.ack(msg);
        } catch (error) {
          const headers = msg.properties.headers || {};
          const retryCount = (headers['x-retry-count'] as number || 0) + 1;
          
          if (retryCount <= 3) {
            // Retry with exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => {
              this.channel.publish(
                this.exchangeName,
                msg.fields.routingKey,
                msg.content,
                {
                  ...msg.properties,
                  headers: {
                    ...headers,
                    'x-retry-count': retryCount
                  }
                }
              );
              this.channel.ack(msg);
            }, delay);
          } else {
            // Move to dead letter queue after max retries
            this.channel.reject(msg, false);
          }
        }
      });
    } catch (error) {
      this.logger.error(`Error setting up consumer for ${queueName}`, error.stack, 'consumeMessages');
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await (this.connection as any).close();
      }
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connections', error.stack, 'onModuleDestroy');
    }
  }
} 

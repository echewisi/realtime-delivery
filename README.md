# Realtime Delivery System

A scalable real-time delivery management system built with NestJS, featuring live order tracking, intelligent rider dispatch, and real-time notifications.

## Features

- Real-time order tracking and management
-  Intelligent rider dispatch system
-  Proximity-based rider search
-  Real-time notifications via WebSocket
-  Event-driven architecture using RabbitMQ
-  Geospatial queries for efficient delivery matching
-  Order analytics and statistics

## Prerequisites

- Node.js (v18.x or higher)
- PostgreSQL (v14.x or higher)
- RabbitMQ (v3.x or higher)
- PostGIS extension for PostgreSQL (for optimized geospatial queries)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/echewisi/realtime-delivery.git
   cd realtime-delivery
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   # Database (Option 1 - Connection String)
   DATABASE_URL=postgresql://user:password@localhost:5432/realtime_delivery_dev

   # Database (Option 2 - Individual Parameters)
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_NAME=realtime_delivery_dev

   # RabbitMQ
   RABBITMQ_URL=amqp://guest:guest@localhost:5672
   ```

4. **Database Setup**
   ```bash
   # Run migrations
   npm run migration:latest


5. **Start the Application**
   ```bash
   # Development
   npm run start:dev

   # Production
   npm run start:prod
   ```

## Architecture Overview

### Core Components

- **Order Management**: Handles order creation, updates, and status tracking
- **Rider Management**: Manages rider availability, location updates, and assignments
- **Dispatch System**: Matches orders with nearby available riders
- **Real-time Communication**: WebSocket-based live updates
- **Event Processing**: RabbitMQ-based event handling

### Database Schema

Key tables and their relationships:
- orders
- riders
- calculated_orders
- order_types
- logs
- order_total_amount_history

## Optimization Strategies

### Geospatial Performance Optimization

For large-scale rider proximity searches, we implement several optimization strategies:

1. **PostGIS Integration**
   ```sql
   -- Enable PostGIS extension
   CREATE EXTENSION postgis;

   -- Modify riders table to use geography type
   ALTER TABLE riders 
   ADD COLUMN location geography(POINT);

   -- Create spatial index
   CREATE INDEX riders_location_idx 
   ON riders USING GIST (location);
   ```

2. **Efficient Proximity Queries**
   ```sql
   -- Find nearby riders using ST_DWithin
   SELECT 
     id, 
     name,
     ST_Distance(
       location, 
       ST_MakePoint(:lng, :lat)::geography
     ) as distance
   FROM riders
   WHERE ST_DWithin(
     location,
     ST_MakePoint(:lng, :lat)::geography,
     5000  -- 5km radius in meters
   )
   AND is_available = true
   ORDER BY distance
   LIMIT 10;
   ```

3. **Location Updates Optimization**
   - Implement rate limiting for location updates
   - Use batch processing for multiple location updates
   - Implement geofencing for delivery zones

4. **Caching Strategy**
   - Cache frequent proximity searches
   - Implement grid-based caching for geographic areas
   - Use Redis geospatial features for temporary storage

### Performance Considerations

- Implement request queuing for high-load scenarios
- Use connection pooling for database connections
- Implement rate limiting for API endpoints
- Use WebSocket heartbeat for connection management

## API Documentation

Interactive API documentation is available at `/api/docs` when running the application. The documentation is generated using Swagger/OpenAPI and provides:

### Order Management
- `POST /api/orders` - Create a new delivery order
  - Request body includes order details, delivery location, and items
  - Returns created order with tracking information

- `GET /api/orders/:id` - Get order details
  - Returns full order information including status and history
  - Includes calculated prices and delivery details

- `PUT /api/orders/:id/status` - Update order status
  - Supports status transitions (accepted, picked-up, delivered, etc.)
  - Triggers relevant WebSocket events

### Rider Management
- `PUT /api/riders/location` - Update rider location
  - Real-time location updates with latitude/longitude
  - Optimized for frequent updates with rate limiting

- `PUT /api/riders/availability` - Update rider availability
  - Set rider's active/inactive status
  - Includes current location and status info

### Dispatch System
- `GET /api/dispatch/nearby-riders` - Find nearby riders
  - Query params for location (lat/lng) and radius
  - Returns distance-sorted list of available riders

- `POST /api/dispatch/orders/:orderId/assign` - Assign order to rider
  - Automatic rider selection based on proximity and metrics
  - Handles rider notification and order status updates

### WebSocket Events
The following real-time events are available through WebSocket connections:

- `orderUpdate` - Real-time order status updates
- `riderLocation` - Live rider location updates
- `newOrder` - New order notifications for riders
- `orderAssigned` - Order assignment confirmations

### Rate Limiting
API endpoints are rate-limited as follows:
- Location updates: 1 request per 5 seconds per rider
- Order creation: 10 requests per minute per user
- General endpoints: 100 requests per minute per IP

For detailed request/response schemas and interactive testing, visit the Swagger UI at `/api/docs`.

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

1. **Environment Setup**
   - Set all required environment variables
   - Configure SSL certificates if needed
   - Set up database backups

2. **Database Migration**
   ```bash
   npm run migration:latest
   ```

3. **Application Launch**
   ```bash
   npm run start:prod
   ```

## Monitoring and Logging

- Application logs are stored in the `logs` directory
- Use PM2 or similar for process management
- Monitor RabbitMQ queues for message processing
- Track database performance metrics

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

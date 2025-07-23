import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const { method, url } = request;
      
      this.logger.warn(
        `JWT Authentication failed for ${method} ${url}: ${info?.message || 'Invalid token'}`,
      );
      
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid or missing authentication token',
        details: {
          path: url,
          method,
        },
      });
    }

    this.logger.debug(`JWT Authentication successful for user: ${user.userId}`);
    return user;
  }
}

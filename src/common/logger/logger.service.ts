import { Injectable, Scope, ConsoleLogger } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLogger extends ConsoleLogger {
  error(message: any, stack?: string, context?: string) {
    // You can add custom logging logic here, for example, sending logs to a third-party service.
    super.error(message, stack, context);
  }
}

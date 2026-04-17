import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = (() => {
      if (typeof responseBody === 'string' || Array.isArray(responseBody)) {
        return responseBody;
      }

      if (responseBody && typeof responseBody === 'object') {
        const responseMessage = (responseBody as { message?: unknown }).message;

        if (
          typeof responseMessage === 'string' ||
          Array.isArray(responseMessage)
        ) {
          return responseMessage;
        }
      }

      return exception instanceof HttpException
        ? exception.message
        : 'Internal server error';
    })();

    const body =
      responseBody &&
      typeof responseBody === 'object' &&
      !Array.isArray(responseBody)
        ? { ...responseBody }
        : {};

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      ...body,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

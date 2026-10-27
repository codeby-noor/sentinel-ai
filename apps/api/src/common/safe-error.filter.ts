import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

/** Never leak stack traces to clients; log server-side only. */
@Catch()
export class SafeErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = isHttp ? exception.getResponse() : null;
    // eslint-disable-next-line no-console
    if (!isHttp || status >= 500) console.error('[api-error]', exception);
    const message =
      typeof raw === 'string' ? raw : (raw as any)?.message ?? (isHttp ? 'Request failed' : 'Internal server error');
    res.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message : [message].flat(),
      error: status >= 500 ? 'Internal Server Error' : (raw as any)?.error ?? 'Error',
    });
  }
}

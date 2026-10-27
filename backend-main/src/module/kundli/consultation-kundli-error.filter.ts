import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

/** Never serialize or log raw database/engine errors containing birth data. */
@Catch()
export class ConsultationKundliErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ConsultationKundliErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      return response.status(error.getStatus()).json(error.getResponse());
    }
    this.logger.warn('Consultation Kundli operation not confirmed');
    return response.status(503).json({ statusCode: 503,
      code: 'KUNDLI_SERVICE_UNAVAILABLE', message: 'Kundli service is unavailable. Retry safely with the same request key.' });
  }
}

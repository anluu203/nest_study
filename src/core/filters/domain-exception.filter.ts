import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DomainException,
  InvalidOrderStateTransitionException,
  OrderNotFoundException,
  ProductNotFoundException,
  UserAlreadyExistsException,
  UserNotFoundException,
} from '../exceptions/domain.exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.mapException(exception);
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private mapException(exception: DomainException): HttpException {
    if (
      exception instanceof UserNotFoundException ||
      exception instanceof ProductNotFoundException ||
      exception instanceof OrderNotFoundException
    ) {
      return new NotFoundException(exception.message);
    }
    if (
      exception instanceof UserAlreadyExistsException ||
      exception instanceof InvalidOrderStateTransitionException
    ) {
      return new ConflictException(exception.message);
    }
    return new ConflictException(exception.message);
  }
}

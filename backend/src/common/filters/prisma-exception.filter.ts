import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

const KNOWN_ERRORS: Record<string, { status: number; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Uno de los valores enviados es demasiado largo.' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con esos datos.' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El registro hace referencia a un dato inexistente o todavía está en uso.',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'El registro solicitado no existe.' },
};

/** Traduce errores de MySQL/Prisma a respuestas claras, sin filtrar detalles internos del esquema. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const known = KNOWN_ERRORS[exception.code];
    if (!known) this.logger.error(`Error Prisma ${exception.code}: ${exception.message}`);
    const status = known?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message: known?.message ?? 'Ocurrió un error interno. Intentá nuevamente.',
      });
  }
}

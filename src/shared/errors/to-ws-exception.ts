import { WsException } from '@nestjs/websockets';
import { DomainError } from './domain-error';

export function toWsException(error: DomainError): WsException {
  return new WsException({ code: error.code, message: error.message, details: error.details });
}

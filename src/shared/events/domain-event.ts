export interface DomainEvent<TPayload = unknown> {
  readonly name: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export function createDomainEvent<TPayload>(
  name: string,
  version: number,
  payload: TPayload,
): DomainEvent<TPayload> {
  return { name, version, occurredAt: new Date(), payload };
}

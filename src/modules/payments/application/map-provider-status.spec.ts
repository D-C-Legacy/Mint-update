import { describe, expect, it } from 'vitest';
import { mapProviderStatusToPaymentStatus } from './map-provider-status';

describe('mapProviderStatusToPaymentStatus', () => {
  it('maps REQUIRES_PAYMENT to REQUIRES_PAYMENT', () => {
    expect(mapProviderStatusToPaymentStatus('REQUIRES_PAYMENT')).toBe('REQUIRES_PAYMENT');
  });

  it('maps REQUIRES_CAPTURE to PROCESSING (defensive — should never actually persist at rest)', () => {
    expect(mapProviderStatusToPaymentStatus('REQUIRES_CAPTURE')).toBe('PROCESSING');
  });

  it('maps PROCESSING to PROCESSING', () => {
    expect(mapProviderStatusToPaymentStatus('PROCESSING')).toBe('PROCESSING');
  });

  it('maps SUCCEEDED to SUCCEEDED', () => {
    expect(mapProviderStatusToPaymentStatus('SUCCEEDED')).toBe('SUCCEEDED');
  });

  it('maps FAILED to FAILED', () => {
    expect(mapProviderStatusToPaymentStatus('FAILED')).toBe('FAILED');
  });

  it('maps CANCELLED to CANCELLED', () => {
    expect(mapProviderStatusToPaymentStatus('CANCELLED')).toBe('CANCELLED');
  });
});

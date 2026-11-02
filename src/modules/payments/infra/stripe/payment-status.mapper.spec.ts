import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { toProviderStatus, toRefundStatus } from './payment-status.mapper';

function fakeIntent(fields: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntent {
  return fields as Stripe.PaymentIntent;
}

describe('toProviderStatus', () => {
  it('maps requires_payment_method to REQUIRES_PAYMENT when there is no error yet', () => {
    expect(toProviderStatus(fakeIntent({ status: 'requires_payment_method', last_payment_error: null }))).toBe(
      'REQUIRES_PAYMENT',
    );
  });

  it('maps requires_confirmation and requires_action to REQUIRES_PAYMENT', () => {
    expect(toProviderStatus(fakeIntent({ status: 'requires_confirmation', last_payment_error: null }))).toBe(
      'REQUIRES_PAYMENT',
    );
    expect(toProviderStatus(fakeIntent({ status: 'requires_action', last_payment_error: null }))).toBe(
      'REQUIRES_PAYMENT',
    );
  });

  it('maps requires_capture to REQUIRES_CAPTURE', () => {
    expect(toProviderStatus(fakeIntent({ status: 'requires_capture', last_payment_error: null }))).toBe(
      'REQUIRES_CAPTURE',
    );
  });

  it('maps processing to PROCESSING', () => {
    expect(toProviderStatus(fakeIntent({ status: 'processing', last_payment_error: null }))).toBe('PROCESSING');
  });

  it('maps succeeded to SUCCEEDED', () => {
    expect(toProviderStatus(fakeIntent({ status: 'succeeded', last_payment_error: null }))).toBe('SUCCEEDED');
  });

  it('maps canceled to CANCELLED', () => {
    expect(toProviderStatus(fakeIntent({ status: 'canceled', last_payment_error: null }))).toBe('CANCELLED');
  });

  it('maps to FAILED whenever last_payment_error is present, regardless of status string', () => {
    const declined = fakeIntent({
      status: 'requires_payment_method',
      last_payment_error: { code: 'card_declined', message: 'Your card was declined.' } as Stripe.PaymentIntent['last_payment_error'],
    });
    expect(toProviderStatus(declined)).toBe('FAILED');
  });
});

describe('toRefundStatus', () => {
  it('maps succeeded to SUCCEEDED', () => {
    expect(toRefundStatus('succeeded')).toBe('SUCCEEDED');
  });

  it('maps failed and canceled to FAILED', () => {
    expect(toRefundStatus('failed')).toBe('FAILED');
    expect(toRefundStatus('canceled')).toBe('FAILED');
  });

  it('maps pending, requires_action and null to PENDING', () => {
    expect(toRefundStatus('pending')).toBe('PENDING');
    expect(toRefundStatus('requires_action')).toBe('PENDING');
    expect(toRefundStatus(null)).toBe('PENDING');
  });
});

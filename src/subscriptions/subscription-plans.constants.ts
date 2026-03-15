/**
 * Subscription plan configuration
 * Centralized constants for subscription plans and pricing
 */

export type SubscriptionPlanType = 'STARTER';

/**
 * Subscription plan prices (in VND)
 */
export const SUBSCRIPTION_PRICES: Record<SubscriptionPlanType, number> = {
  STARTER: 390000,
} as const;

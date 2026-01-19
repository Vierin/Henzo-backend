/**
 * Subscription plan configuration
 * Centralized constants for subscription plans and pricing
 */

export type SubscriptionPlanType = 'BASIC';

/**
 * Subscription plan prices (in VND)
 */
export const SUBSCRIPTION_PRICES: Record<SubscriptionPlanType, number> = {
	BASIC: 390000,
} as const;


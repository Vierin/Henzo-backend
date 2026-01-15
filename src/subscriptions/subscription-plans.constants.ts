/**
 * Subscription plan configuration
 * Centralized constants for subscription plans and pricing
 */

export type SubscriptionPlanType = 'FREEMIUM' | 'BASIC' | 'ENTERPRISE';

/**
 * Subscription plan prices (in VND)
 */
export const SUBSCRIPTION_PRICES: Record<SubscriptionPlanType, number> = {
	FREEMIUM: 0,
	BASIC: 390000,
	ENTERPRISE: 0, // TODO: Set enterprise price
} as const;


import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not set, Sentry error tracking disabled');
    return;
  }

  const isEnabled = environment !== 'development' || !!process.env.ENABLE_SENTRY_IN_DEV;

  Sentry.init({
    dsn,
    environment,
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    // Profiling
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Don't send errors in development unless explicitly testing
    enabled: isEnabled,
    // Send events immediately (no batching delay)
    transportOptions: {
      // Use default transport, but ensure events are sent quickly
    },
  });

  // Sentry initialized silently
}


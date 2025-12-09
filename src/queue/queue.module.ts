import { Module } from '@nestjs/common';

// Queue module disabled for MVP - email will be sent synchronously
// To enable queues in the future, add Redis and uncomment BullModule
@Module({
  imports: [],
  // BullModule requires Redis - disabled for MVP
  // Email sending will be synchronous (acceptable for MVP scale)
})
export class QueueModule {}


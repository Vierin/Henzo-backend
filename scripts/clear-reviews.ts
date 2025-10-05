import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearFakeReviews() {
  try {
    console.log('Clearing fake reviews...');

    // Delete all reviews
    const deletedReviews = await prisma.review.deleteMany({});

    console.log(`Deleted ${deletedReviews.count} reviews`);

    // Optionally delete fake users (only those with example.com emails)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: {
          endsWith: '@example.com',
        },
      },
    });

    console.log(`Deleted ${deletedUsers.count} fake users`);

    console.log('✅ Reviews and fake users cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing reviews:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  clearFakeReviews();
}

export { clearFakeReviews };

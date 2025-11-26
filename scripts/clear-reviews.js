"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearFakeReviews = clearFakeReviews;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function clearFakeReviews() {
    try {
        console.log('Clearing fake reviews...');
        const deletedReviews = await prisma.review.deleteMany({});
        console.log(`Deleted ${deletedReviews.count} reviews`);
        const deletedUsers = await prisma.user.deleteMany({
            where: {
                email: {
                    endsWith: '@example.com',
                },
            },
        });
        console.log(`Deleted ${deletedUsers.count} fake users`);
        console.log('✅ Reviews and fake users cleared successfully!');
    }
    catch (error) {
        console.error('❌ Error clearing reviews:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
if (require.main === module) {
    clearFakeReviews();
}
//# sourceMappingURL=clear-reviews.js.map
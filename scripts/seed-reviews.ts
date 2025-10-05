import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fakeReviews = [
  {
    rating: 5,
    comments: [
      'Excellent service! The staff was very professional and the atmosphere was amazing.',
      'Best salon in town! Highly recommend to everyone.',
      'Outstanding experience. The stylist really understood what I wanted.',
      'Clean, modern salon with friendly staff. Will definitely come back!',
      'Perfect haircut and great service. Worth every penny.',
    ],
  },
  {
    rating: 4,
    comments: [
      'Good service overall. The stylist was skilled and friendly.',
      'Nice salon with good atmosphere. Would recommend.',
      'Satisfied with the service. Staff was professional.',
      'Clean place with decent service. Good value for money.',
      'Pleasant experience. The stylist did a good job.',
    ],
  },
  {
    rating: 3,
    comments: [
      'Average service. Nothing special but not bad either.',
      'Okay experience. The stylist was decent but could be better.',
      'Service was fine. The salon is clean and organized.',
      'Not the best but not the worst. Average experience.',
      'Acceptable service. The staff was polite but not exceptional.',
    ],
  },
  {
    rating: 2,
    comments: [
      "Below average service. The stylist didn't seem very experienced.",
      'Not impressed with the service. Could be much better.',
      'Disappointing experience. The staff seemed rushed.',
      'Poor service quality. Would not recommend.',
      'Not worth the price. The stylist made mistakes.',
    ],
  },
  {
    rating: 1,
    comments: [
      'Terrible experience. The stylist was unprofessional and rude.',
      'Worst salon ever. Poor service and dirty environment.',
      'Complete waste of money. Will never come back.',
      'Awful service. The stylist ruined my hair.',
      'Very disappointed. The staff was unfriendly and unskilled.',
    ],
  },
];

const fakeUsers = [
  { name: 'Sarah Johnson', email: 'sarah.j@example.com' },
  { name: 'Michael Chen', email: 'm.chen@example.com' },
  { name: 'Emma Davis', email: 'emma.davis@example.com' },
  { name: 'David Wilson', email: 'd.wilson@example.com' },
  { name: 'Lisa Anderson', email: 'lisa.a@example.com' },
  { name: 'James Brown', email: 'james.brown@example.com' },
  { name: 'Maria Garcia', email: 'maria.g@example.com' },
  { name: 'Robert Taylor', email: 'robert.t@example.com' },
  { name: 'Jennifer Martinez', email: 'j.martinez@example.com' },
  { name: 'Christopher Lee', email: 'chris.lee@example.com' },
  { name: 'Amanda White', email: 'amanda.w@example.com' },
  { name: 'Daniel Harris', email: 'daniel.h@example.com' },
  { name: 'Jessica Clark', email: 'jessica.c@example.com' },
  { name: 'Matthew Rodriguez', email: 'matt.r@example.com' },
  { name: 'Ashley Lewis', email: 'ashley.l@example.com' },
  { name: 'Joshua Walker', email: 'josh.w@example.com' },
  { name: 'Stephanie Hall', email: 'stephanie.h@example.com' },
  { name: 'Andrew Allen', email: 'andrew.a@example.com' },
  { name: 'Nicole Young', email: 'nicole.y@example.com' },
  { name: 'Kevin King', email: 'kevin.k@example.com' },
];

async function createFakeUsers() {
  console.log('Creating fake users...');

  const createdUsers: any[] = [];

  for (const userData of fakeUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const user = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            role: 'CLIENT',
          },
        });
        createdUsers.push(user);
        console.log(`Created user: ${user.name} (${user.email})`);
      } else {
        createdUsers.push(existingUser);
        console.log(
          `User already exists: ${existingUser.name} (${existingUser.email})`,
        );
      }
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error);
    }
  }

  return createdUsers;
}

async function createFakeReviews() {
  console.log('Creating fake reviews...');

  // Get all salons
  const salons = await prisma.salon.findMany({
    select: { id: true, name: true },
  });

  if (salons.length === 0) {
    console.log('No salons found. Please create salons first.');
    return;
  }

  // Get all users
  const users = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) {
    console.log('No client users found. Creating fake users first...');
    await createFakeUsers();
    const newUsers = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      select: { id: true, name: true, email: true },
    });
    users.push(...newUsers);
  }

  let totalReviews = 0;

  for (const salon of salons) {
    console.log(`Adding reviews for salon: ${salon.name}`);

    // Generate 5-15 reviews per salon
    const reviewCount = Math.floor(Math.random() * 11) + 5;

    for (let i = 0; i < reviewCount; i++) {
      try {
        // Pick a random user
        const user = users[Math.floor(Math.random() * users.length)];

        // Pick a random rating (weighted towards higher ratings)
        const ratingWeights = [1, 2, 3, 4, 5];
        const weights = [0.05, 0.1, 0.15, 0.3, 0.4]; // 40% chance of 5 stars, 30% chance of 4 stars, etc.

        let rating = 1;
        const random = Math.random();
        let cumulativeWeight = 0;

        for (let j = 0; j < ratingWeights.length; j++) {
          cumulativeWeight += weights[j];
          if (random <= cumulativeWeight) {
            rating = ratingWeights[j];
            break;
          }
        }

        // Get a random comment for this rating
        const ratingGroup = fakeReviews.find((r) => r.rating === rating);
        const comment = ratingGroup
          ? ratingGroup.comments[
              Math.floor(Math.random() * ratingGroup.comments.length)
            ]
          : 'Good service.';

        // Check if review already exists for this user and salon
        const existingReview = await prisma.review.findFirst({
          where: {
            userId: user.id,
            salonId: salon.id,
          },
        });

        if (!existingReview) {
          await prisma.review.create({
            data: {
              salonId: salon.id,
              userId: user.id,
              rating: rating,
              comment: comment,
              createdAt: new Date(
                Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000,
              ), // Random date within last 90 days
            },
          });

          totalReviews++;
          console.log(`  Created review: ${rating} stars by ${user.name}`);
        } else {
          console.log(
            `  Review already exists for ${user.name} and ${salon.name}`,
          );
        }
      } catch (error) {
        console.error(`Error creating review for salon ${salon.name}:`, error);
      }
    }
  }

  console.log(`\nTotal reviews created: ${totalReviews}`);
}

async function main() {
  try {
    console.log('Starting to seed fake reviews...\n');

    // Create fake users first
    await createFakeUsers();

    // Create fake reviews
    await createFakeReviews();

    console.log('\n✅ Fake reviews seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding fake reviews:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as seedFakeReviews };

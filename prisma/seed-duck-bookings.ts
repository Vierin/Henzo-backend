import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📅 Adding 30 bookings to Duck salon...');

  const duckSalonId = 'cmgm9ksdm0003yx65szd0jxqj';

  // Verify Duck salon exists
  const duckSalon = await prisma.salon.findUnique({
    where: { id: duckSalonId },
  });

  if (!duckSalon) {
    console.error('❌ Duck salon not found!');
    return;
  }

  console.log(`✅ Found: ${duckSalon.name}`);

  // Get services and staff
  const services = await prisma.service.findMany({
    where: { salonId: duckSalonId },
  });

  const staff = await prisma.staff.findMany({
    where: { salonId: duckSalonId },
  });

  if (services.length === 0) {
    console.error('❌ No services found for this salon!');
    return;
  }

  if (staff.length === 0) {
    console.error('❌ No staff found for this salon!');
    return;
  }

  console.log(
    `📊 Found: ${services.length} services, ${staff.length} staff members`,
  );

  // Get or create test clients
  console.log('\n👥 Getting/creating test clients...');

  const clientEmails = [
    'client1@test.com',
    'client2@test.com',
    'client3@test.com',
    'client4@test.com',
    'client5@test.com',
    'client6@test.com',
    'client7@test.com',
    'client8@test.com',
  ];

  const clients: any[] = [];

  for (let i = 0; i < clientEmails.length; i++) {
    const client = await prisma.user.upsert({
      where: { email: clientEmails[i] },
      update: {},
      create: {
        email: clientEmails[i],
        name: `Test Client ${i + 1}`,
        phone: `+8490${1000000 + i}`,
        role: 'CLIENT',
      },
    });
    clients.push(client);
  }

  console.log(`✅ ${clients.length} clients ready`);

  // Create 30 bookings with various statuses and dates
  console.log('\n📅 Creating bookings...\n');

  const now = new Date();
  const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED'];
  let createdCount = 0;

  for (let i = 0; i < 30; i++) {
    // Random service and staff
    const randomService = services[Math.floor(Math.random() * services.length)];
    const randomStaff = staff[Math.floor(Math.random() * staff.length)];
    const randomClient = clients[Math.floor(Math.random() * clients.length)];

    // Determine booking status based on index
    let status: string;
    let bookingDate: Date;
    let createdAt: Date;

    if (i < 8) {
      // 8 completed bookings (past dates)
      status = 'COMPLETED';
      const daysAgo = Math.floor(Math.random() * 30) + 5; // 5-35 days ago
      bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() - daysAgo);
      bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0); // 9-17:00

      createdAt = new Date(bookingDate);
      createdAt.setDate(createdAt.getDate() - 3); // Created 3 days before booking
    } else if (i < 16) {
      // 8 confirmed bookings (future dates)
      status = 'CONFIRMED';
      const daysAhead = Math.floor(Math.random() * 14) + 1; // 1-14 days ahead
      bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + daysAhead);
      bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);

      createdAt = new Date(now);
      createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 48)); // Created 0-48 hours ago
    } else if (i < 22) {
      // 6 pending bookings (future dates, recent)
      status = 'PENDING';
      const hoursAhead = Math.floor(Math.random() * 72) + 24; // 24-96 hours ahead
      bookingDate = new Date(now);
      bookingDate.setTime(bookingDate.getTime() + hoursAhead * 60 * 60 * 1000);
      bookingDate.setMinutes(0, 0, 0);

      createdAt = new Date(now);
      createdAt.setMinutes(
        createdAt.getMinutes() - Math.floor(Math.random() * 120),
      ); // Created 0-120 minutes ago
    } else {
      // 8 canceled bookings (mixed dates)
      status = 'CANCELED';
      const daysOffset = Math.floor(Math.random() * 20) - 10; // -10 to +10 days
      bookingDate = new Date(now);
      bookingDate.setDate(bookingDate.getDate() + daysOffset);
      bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);

      createdAt = new Date(bookingDate);
      createdAt.setDate(createdAt.getDate() - 2); // Created 2 days before
    }

    // Random notes (50% chance)
    const notes =
      Math.random() > 0.5
        ? [
            'Please use organic products',
            'First time customer',
            'Allergic to certain chemicals',
            'Prefers quiet environment',
            'VIP customer',
            'Regular customer',
            null,
            null,
          ][Math.floor(Math.random() * 8)]
        : null;

    try {
      await prisma.booking.create({
        data: {
          userId: randomClient.id,
          salonId: duckSalonId,
          serviceId: randomService.id,
          staffId: randomStaff.id,
          dateTime: bookingDate,
          status: status as any,
          notes: notes,
          createdAt: createdAt,
        },
      });

      createdCount++;
      const emoji =
        status === 'COMPLETED'
          ? '✅'
          : status === 'CONFIRMED'
            ? '📅'
            : status === 'PENDING'
              ? '⏳'
              : '❌';
      console.log(
        `${emoji} Booking ${i + 1}/30: ${status} - ${randomService.name} with ${randomStaff.name} on ${bookingDate.toLocaleDateString('vi-VN')} ${bookingDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      );
    } catch (error: any) {
      console.error(`⚠️ Error creating booking ${i + 1}:`, error.message);
    }
  }

  console.log('\n✅ Bookings seed completed!');
  console.log(`📊 Created: ${createdCount} bookings`);

  // Summary by status
  const statusCounts = await prisma.booking.groupBy({
    by: ['status'],
    where: { salonId: duckSalonId },
    _count: true,
  });

  console.log('\n📈 Booking status summary for Duck salon:');
  statusCounts.forEach((stat) => {
    console.log(`   ${stat.status}: ${stat._count} bookings`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

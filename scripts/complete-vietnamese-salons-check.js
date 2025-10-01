const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function completeVietnameseSalonsCheck() {
  try {
    console.log('🇻🇳 Complete check of Vietnamese salons with all data...\n');

    // Get the owner user
    const owner = await prisma.user.findUnique({
      where: { email: 'owner@vietnamesesalons.com' },
    });

    if (!owner) {
      console.log('❌ Owner user not found');
      return;
    }

    // Get all salons for this owner with all related data
    const salons = await prisma.salon.findMany({
      where: { ownerId: owner.id },
      include: {
        staff: true,
        services: true,
        subscription: true,
        bookings: {
          include: {
            user: true,
            service: true,
            staff: true,
          },
          orderBy: {
            dateTime: 'desc',
          },
        },
        reviews: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log(`🏪 Found ${salons.length} Vietnamese salons:\n`);

    let totalBookings = 0;
    let totalRevenue = 0;
    const today = new Date();

    for (const salon of salons) {
      console.log(`📍 ${salon.name}`);
      console.log(`   📍 Address: ${salon.address}`);
      console.log(`   📞 Phone: ${salon.phone}`);
      console.log(`   📧 Email: ${salon.email}`);
      console.log(`   🌐 Website: ${salon.website || 'N/A'}`);
      console.log(`   🖼️  Logo: ${salon.logo ? '✅ Added' : '❌ Missing'}`);
      console.log(`   📸 Photos: ${salon.photos.length} images`);
      console.log(`   👥 Staff: ${salon.staff.length} members`);
      console.log(`   💇 Services: ${salon.services.length} services`);
      console.log(`   💳 Subscription: ${salon.subscription?.type || 'None'}`);
      console.log(`   📅 Bookings: ${salon.bookings.length} total`);
      console.log(`   ⭐ Reviews: ${salon.reviews.length} reviews`);

      // Booking statistics
      const confirmedBookings = salon.bookings.filter(
        (b) => b.status === 'CONFIRMED',
      ).length;
      const completedBookings = salon.bookings.filter(
        (b) => b.status === 'COMPLETED',
      ).length;
      const canceledBookings = salon.bookings.filter(
        (b) => b.status === 'CANCELED',
      ).length;

      console.log(
        `   📊 Booking status: ${confirmedBookings} confirmed, ${completedBookings} completed, ${canceledBookings} canceled`,
      );

      // Revenue calculation (only completed bookings)
      const salonRevenue = salon.bookings
        .filter((b) => b.status === 'COMPLETED')
        .reduce((sum, booking) => sum + booking.service.price, 0);

      totalRevenue += salonRevenue;
      totalBookings += salon.bookings.length;

      console.log(
        `   💰 Revenue (completed): ${salonRevenue.toLocaleString()}đ`,
      );

      // Today's bookings
      const todayBookings = salon.bookings.filter(
        (booking) => booking.dateTime.toDateString() === today.toDateString(),
      );
      console.log(`   📅 Today's bookings: ${todayBookings.length}`);

      // Future bookings
      const futureBookings = salon.bookings.filter(
        (booking) => booking.dateTime > today && booking.status === 'CONFIRMED',
      );
      console.log(`   📅 Future bookings: ${futureBookings.length}`);

      // Recent bookings (last 5)
      console.log(`   📋 Recent bookings:`);
      salon.bookings.slice(0, 3).forEach((booking) => {
        console.log(
          `      📅 ${booking.dateTime.toLocaleDateString()} ${booking.dateTime.toLocaleTimeString()}`,
        );
        console.log(
          `         👤 ${booking.user.name} - ${booking.service.name} (${booking.service.price}đ)`,
        );
        console.log(
          `         👨‍💼 ${booking.staff.name} - Status: ${booking.status}`,
        );
      });

      console.log('─'.repeat(80));
    }

    // Overall statistics
    const allBookings = salons.flatMap((salon) => salon.bookings);
    const statusStats = allBookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    const todayBookings = allBookings.filter(
      (booking) => booking.dateTime.toDateString() === today.toDateString(),
    );

    const futureBookings = allBookings.filter(
      (booking) => booking.dateTime > today && booking.status === 'CONFIRMED',
    );

    const completedBookings = allBookings.filter(
      (booking) => booking.status === 'COMPLETED',
    );

    const totalStaff = salons.reduce(
      (sum, salon) => sum + salon.staff.length,
      0,
    );
    const totalServices = salons.reduce(
      (sum, salon) => sum + salon.services.length,
      0,
    );
    const salonsWithImages = salons.filter(
      (salon) => salon.logo && salon.photos.length > 0,
    ).length;

    console.log('\n📊 Overall Statistics:');
    console.log(`   🏪 Total salons: ${salons.length}`);
    console.log(`   👥 Total staff: ${totalStaff}`);
    console.log(`   💇 Total services: ${totalServices}`);
    console.log(`   📅 Total bookings: ${totalBookings}`);
    console.log(`   💰 Total revenue: ${totalRevenue.toLocaleString()}đ`);
    console.log(`   📊 Booking status breakdown:`, statusStats);
    console.log(`   📅 Today's bookings: ${todayBookings.length}`);
    console.log(`   📅 Future confirmed bookings: ${futureBookings.length}`);
    console.log(`   ✅ Completed bookings: ${completedBookings.length}`);
    console.log(
      `   🖼️  Salons with images: ${salonsWithImages}/${salons.length}`,
    );
    console.log(
      `   💳 Salons with subscription: ${salons.filter((s) => s.subscription).length}/${salons.length}`,
    );

    // Average booking value
    if (completedBookings.length > 0) {
      const avgBookingValue = totalRevenue / completedBookings.length;
      console.log(
        `   💵 Average booking value: ${avgBookingValue.toLocaleString()}đ`,
      );
    }

    // Busiest salon
    const busiestSalon = salons.reduce((busiest, salon) =>
      salon.bookings.length > busiest.bookings.length ? salon : busiest,
    );
    console.log(
      `   🏆 Busiest salon: ${busiestSalon.name} (${busiestSalon.bookings.length} bookings)`,
    );

    console.log('\n✅ All Vietnamese salons are fully set up with bookings!');
  } catch (error) {
    console.error('❌ Error checking salons:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeVietnameseSalonsCheck();

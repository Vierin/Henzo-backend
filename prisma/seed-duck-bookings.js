"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('📅 Adding 30 bookings to Duck salon...');
    const duckSalonId = 'cmgm9ksdm0003yx65szd0jxqj';
    const duckSalon = await prisma.salon.findUnique({
        where: { id: duckSalonId },
    });
    if (!duckSalon) {
        console.error('❌ Duck salon not found!');
        return;
    }
    console.log(`✅ Found: ${duckSalon.name}`);
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
    console.log(`📊 Found: ${services.length} services, ${staff.length} staff members`);
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
    const clients = [];
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
    console.log('\n📅 Creating bookings...\n');
    const now = new Date();
    const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED'];
    let createdCount = 0;
    for (let i = 0; i < 30; i++) {
        const randomService = services[Math.floor(Math.random() * services.length)];
        const randomStaff = staff[Math.floor(Math.random() * staff.length)];
        const randomClient = clients[Math.floor(Math.random() * clients.length)];
        let status;
        let bookingDate;
        let createdAt;
        if (i < 8) {
            status = 'COMPLETED';
            const daysAgo = Math.floor(Math.random() * 30) + 5;
            bookingDate = new Date(now);
            bookingDate.setDate(bookingDate.getDate() - daysAgo);
            bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);
            createdAt = new Date(bookingDate);
            createdAt.setDate(createdAt.getDate() - 3);
        }
        else if (i < 16) {
            status = 'CONFIRMED';
            const daysAhead = Math.floor(Math.random() * 14) + 1;
            bookingDate = new Date(now);
            bookingDate.setDate(bookingDate.getDate() + daysAhead);
            bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);
            createdAt = new Date(now);
            createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 48));
        }
        else if (i < 22) {
            status = 'PENDING';
            const hoursAhead = Math.floor(Math.random() * 72) + 24;
            bookingDate = new Date(now);
            bookingDate.setTime(bookingDate.getTime() + hoursAhead * 60 * 60 * 1000);
            bookingDate.setMinutes(0, 0, 0);
            createdAt = new Date(now);
            createdAt.setMinutes(createdAt.getMinutes() - Math.floor(Math.random() * 120));
        }
        else {
            status = 'CANCELED';
            const daysOffset = Math.floor(Math.random() * 20) - 10;
            bookingDate = new Date(now);
            bookingDate.setDate(bookingDate.getDate() + daysOffset);
            bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);
            createdAt = new Date(bookingDate);
            createdAt.setDate(createdAt.getDate() - 2);
        }
        const notes = Math.random() > 0.5
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
                    status: status,
                    notes: notes,
                    createdAt: createdAt,
                },
            });
            createdCount++;
            const emoji = status === 'COMPLETED'
                ? '✅'
                : status === 'CONFIRMED'
                    ? '📅'
                    : status === 'PENDING'
                        ? '⏳'
                        : '❌';
            console.log(`${emoji} Booking ${i + 1}/30: ${status} - ${randomService.name} with ${randomStaff.name} on ${bookingDate.toLocaleDateString('vi-VN')} ${bookingDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
        }
        catch (error) {
            console.error(`⚠️ Error creating booking ${i + 1}:`, error.message);
        }
    }
    console.log('\n✅ Bookings seed completed!');
    console.log(`📊 Created: ${createdCount} bookings`);
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
//# sourceMappingURL=seed-duck-bookings.js.map
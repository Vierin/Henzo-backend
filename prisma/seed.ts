import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🗑️ Clearing existing data...');
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.service.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.salon.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  console.log('👤 Creating users...');
  
  // Owners
  const owner1 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'salon1@henzo.app',
      name: 'Nguyen Van A',
      phone: '+84901234567',
      role: 'OWNER',
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'salon2@henzo.app',
      name: 'Tran Thi B',
      phone: '+84902345678',
      role: 'OWNER',
    },
  });

  const owner3 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'salon3@henzo.app',
      name: 'Le Van C',
      phone: '+84903456789',
      role: 'OWNER',
    },
  });

  // Clients
  const client1 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'client1@henzo.app',
      name: 'Pham Thi D',
      phone: '+84904567890',
      role: 'CLIENT',
    },
  });

  const client2 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'client2@henzo.app',
      name: 'Hoang Van E',
      phone: '+84905678901',
      role: 'CLIENT',
    },
  });

  const client3 = await prisma.user.create({
    data: {
      id: nanoid(),
      email: 'client3@henzo.app',
      name: 'Nguyen Thi F',
      phone: '+84906789012',
      role: 'CLIENT',
    },
  });

  // Create Salons
  console.log('💇 Creating salons...');

  const salon1 = await prisma.salon.create({
    data: {
      id: nanoid(),
      name: 'Beauty Salon Hanoi',
      description:
        'Premium beauty salon in the heart of Hanoi. We offer haircuts, coloring, and styling services.',
      address: '15 Hoan Kiem, Hanoi, Vietnam',
      phone: '+84901234567',
      email: 'info@beautysalon-hanoi.vn',
      website: 'https://beautysalon-hanoi.vn',
      instagram: '@beautysalonhanoi',
      logo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
      photos: [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
        'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800',
      ],
      workingHours: {
        monday: { open: '09:00', close: '20:00', closed: false },
        tuesday: { open: '09:00', close: '20:00', closed: false },
        wednesday: { open: '09:00', close: '20:00', closed: false },
        thursday: { open: '09:00', close: '20:00', closed: false },
        friday: { open: '09:00', close: '20:00', closed: false },
        saturday: { open: '09:00', close: '21:00', closed: false },
        sunday: { open: '10:00', close: '19:00', closed: false },
      },
      categoryIds: [1, 2, 3], // Hair, Nails, Makeup
      ownerId: owner1.id,
    },
  });

  const salon2 = await prisma.salon.create({
    data: {
      id: nanoid(),
      name: 'Nail Art Studio HCMC',
      description:
        'Professional nail art and manicure services in Ho Chi Minh City.',
      address: '234 Nguyen Hue, District 1, Ho Chi Minh City, Vietnam',
      phone: '+84902345678',
      email: 'contact@nailart-hcmc.vn',
      instagram: '@nailarthcmc',
      logo: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400',
      photos: [
        'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800',
        'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=800',
      ],
      workingHours: {
        monday: { open: '08:00', close: '19:00', closed: false },
        tuesday: { open: '08:00', close: '19:00', closed: false },
        wednesday: { open: '08:00', close: '19:00', closed: false },
        thursday: { open: '08:00', close: '19:00', closed: false },
        friday: { open: '08:00', close: '19:00', closed: false },
        saturday: { open: '08:00', close: '20:00', closed: false },
        sunday: { open: '09:00', close: '18:00', closed: false },
      },
      categoryIds: [2, 4], // Nails, Spa
      ownerId: owner2.id,
    },
  });

  const salon3 = await prisma.salon.create({
    data: {
      id: nanoid(),
      name: 'Spa & Wellness Da Nang',
      description: 'Relaxing spa and wellness center with traditional Vietnamese treatments.',
      address: '78 Bach Dang, Da Nang, Vietnam',
      phone: '+84903456789',
      email: 'info@spa-danang.vn',
      website: 'https://spa-danang.vn',
      logo: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400',
      photos: [
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
      ],
      workingHours: {
        monday: { open: '10:00', close: '21:00', closed: false },
        tuesday: { open: '10:00', close: '21:00', closed: false },
        wednesday: { open: '10:00', close: '21:00', closed: false },
        thursday: { open: '10:00', close: '21:00', closed: false },
        friday: { open: '10:00', close: '22:00', closed: false },
        saturday: { open: '10:00', close: '22:00', closed: false },
        sunday: { open: '10:00', close: '21:00', closed: false },
      },
      categoryIds: [4, 5], // Spa, Massage
      ownerId: owner3.id,
    },
  });

  // Create Staff
  console.log('👨‍💼 Creating staff...');

  const staff1_1 = await prisma.staff.create({
    data: {
      id: nanoid(),
      name: 'Mai Linh',
      email: 'mailinh@beautysalon-hanoi.vn',
      phone: '+84911111111',
      accessLevel: 'EMPLOYEE',
      salonId: salon1.id,
    },
  });

  const staff1_2 = await prisma.staff.create({
    data: {
      id: nanoid(),
      name: 'Thanh Tam',
      email: 'thanhtam@beautysalon-hanoi.vn',
      phone: '+84912222222',
      accessLevel: 'ADMIN',
      salonId: salon1.id,
    },
  });

  const staff2_1 = await prisma.staff.create({
    data: {
      id: nanoid(),
      name: 'Kim Anh',
      phone: '+84913333333',
      accessLevel: 'EMPLOYEE',
      salonId: salon2.id,
    },
  });

  const staff3_1 = await prisma.staff.create({
    data: {
      id: nanoid(),
      name: 'Huong Giang',
      phone: '+84914444444',
      accessLevel: 'EMPLOYEE',
      salonId: salon3.id,
    },
  });

  // Create Services
  console.log('✂️ Creating services...');

  // Salon 1 - Beauty Salon Hanoi
  const service1_1 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Haircut & Style',
      description: 'Professional haircut with styling',
      duration: 60,
      price: 150000,
      salonId: salon1.id,
      serviceCategoryId: 1, // Hair
    },
  });

  const service1_2 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Hair Coloring',
      description: 'Full hair coloring with premium products',
      duration: 120,
      price: 500000,
      salonId: salon1.id,
      serviceCategoryId: 1,
    },
  });

  const service1_3 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Makeup',
      description: 'Professional makeup for events',
      duration: 90,
      price: 300000,
      salonId: salon1.id,
      serviceCategoryId: 3, // Makeup
    },
  });

  // Salon 2 - Nail Art Studio
  const service2_1 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Manicure',
      description: 'Classic manicure with gel polish',
      duration: 45,
      price: 200000,
      salonId: salon2.id,
      serviceCategoryId: 2, // Nails
    },
  });

  const service2_2 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Pedicure',
      description: 'Relaxing pedicure with massage',
      duration: 60,
      price: 250000,
      salonId: salon2.id,
      serviceCategoryId: 2,
    },
  });

  const service2_3 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Nail Art Design',
      description: 'Custom nail art design',
      duration: 90,
      price: 400000,
      salonId: salon2.id,
      serviceCategoryId: 2,
    },
  });

  // Salon 3 - Spa & Wellness
  const service3_1 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Full Body Massage',
      description: 'Traditional Vietnamese massage',
      duration: 90,
      price: 350000,
      salonId: salon3.id,
      serviceCategoryId: 5, // Massage
    },
  });

  const service3_2 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Facial Treatment',
      description: 'Deep cleansing facial with organic products',
      duration: 75,
      price: 400000,
      salonId: salon3.id,
      serviceCategoryId: 4, // Spa
    },
  });

  const service3_3 = await prisma.service.create({
    data: {
      id: nanoid(),
      name: 'Hot Stone Massage',
      description: 'Relaxing hot stone therapy',
      duration: 120,
      price: 600000,
      salonId: salon3.id,
      serviceCategoryId: 5,
    },
  });

  // Link services to staff
  await prisma.service.update({
    where: { id: service1_1.id },
    data: { staff: { connect: [{ id: staff1_1.id }, { id: staff1_2.id }] } },
  });

  await prisma.service.update({
    where: { id: service1_2.id },
    data: { staff: { connect: [{ id: staff1_2.id }] } },
  });

  await prisma.service.update({
    where: { id: service2_1.id },
    data: { staff: { connect: [{ id: staff2_1.id }] } },
  });

  await prisma.service.update({
    where: { id: service3_1.id },
    data: { staff: { connect: [{ id: staff3_1.id }] } },
  });

  // Create Bookings
  console.log('📅 Creating bookings...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 30, 0, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(15, 0, 0, 0);

  await prisma.booking.create({
    data: {
      id: nanoid(),
      userId: client1.id,
      salonId: salon1.id,
      serviceId: service1_1.id,
      staffId: staff1_1.id,
      dateTime: tomorrow,
      status: 'CONFIRMED',
      notes: 'Please use organic products',
    },
  });

  await prisma.booking.create({
    data: {
      id: nanoid(),
      userId: client2.id,
      salonId: salon2.id,
      serviceId: service2_1.id,
      staffId: staff2_1.id,
      dateTime: nextWeek,
      status: 'CONFIRMED',
      notes: 'Light pink color please',
    },
  });

  await prisma.booking.create({
    data: {
      id: nanoid(),
      userId: client3.id,
      salonId: salon3.id,
      serviceId: service3_1.id,
      staffId: staff3_1.id,
      dateTime: yesterday,
      status: 'COMPLETED',
    },
  });

  // Create pending booking for testing auto-cancel
  const threeHoursAgo = new Date();
  threeHoursAgo.setHours(threeHoursAgo.getHours() - 4);

  await prisma.booking.create({
    data: {
      id: nanoid(),
      userId: client1.id,
      salonId: salon2.id,
      serviceId: service2_2.id,
      staffId: staff2_1.id,
      dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      status: 'PENDING',
      createdAt: threeHoursAgo, // Created 4 hours ago - should be auto-cancelled
    },
  });

  // Create Reviews
  console.log('⭐ Creating reviews...');

  await prisma.review.create({
    data: {
      id: nanoid(),
      userId: client3.id,
      salonId: salon3.id,
      rating: 5,
      comment: 'Amazing massage! Very relaxing and professional staff.',
    },
  });

  await prisma.review.create({
    data: {
      id: nanoid(),
      userId: client1.id,
      salonId: salon1.id,
      rating: 4,
      comment: 'Great haircut, will come back again!',
    },
  });

  await prisma.review.create({
    data: {
      id: nanoid(),
      userId: client2.id,
      salonId: salon2.id,
      rating: 5,
      comment: 'Best nail art in HCMC! Highly recommended.',
    },
  });

  console.log('✅ Database seeding completed!');
  console.log('\n📊 Summary:');
  console.log(`- Users: ${await prisma.user.count()}`);
  console.log(`- Salons: ${await prisma.salon.count()}`);
  console.log(`- Staff: ${await prisma.staff.count()}`);
  console.log(`- Services: ${await prisma.service.count()}`);
  console.log(`- Bookings: ${await prisma.booking.count()}`);
  console.log(`- Reviews: ${await prisma.review.count()}`);
  console.log('\n🔑 Test Credentials:');
  console.log('Owner 1: salon1@henzo.app');
  console.log('Owner 2: salon2@henzo.app');
  console.log('Owner 3: salon3@henzo.app');
  console.log('Client 1: client1@henzo.app');
  console.log('Client 2: client2@henzo.app');
  console.log('Client 3: client3@henzo.app');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


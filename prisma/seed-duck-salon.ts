import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🦆 Starting Duck salon seed...');

  const duckSalonId = 'cmgm9ksdm0003yx65szd0jxqj';

  // Find Duck salon
  const duckSalon = await prisma.salon.findUnique({
    where: {
      id: duckSalonId,
    },
  });

  if (!duckSalon) {
    console.error('❌ Duck salon not found!');
    return;
  }

  console.log(`✅ Found Duck salon: ${duckSalon.name} (ID: ${duckSalon.id})`);

  // Check if we already have staff
  const existingStaff = await prisma.staff.count({
    where: { salonId: duckSalon.id },
  });

  const existingServices = await prisma.service.count({
    where: { salonId: duckSalon.id },
  });

  console.log(
    `📊 Current data: ${existingStaff} staff, ${existingServices} services`,
  );

  // Create 10 staff members
  const staffNames = [
    { name: 'Anna Nguyen', email: 'anna@ducksalon.com', phone: '+84901234567' },
    { name: 'Minh Tran', email: 'minh@ducksalon.com', phone: '+84901234568' },
    { name: 'Linh Pham', email: 'linh@ducksalon.com', phone: '+84901234569' },
    { name: 'Hoa Le', email: 'hoa@ducksalon.com', phone: '+84901234570' },
    { name: 'Tuan Vo', email: 'tuan@ducksalon.com', phone: '+84901234571' },
    { name: 'Lan Hoang', email: 'lan@ducksalon.com', phone: '+84901234572' },
    { name: 'Duc Nguyen', email: 'duc@ducksalon.com', phone: '+84901234573' },
    { name: 'Mai Tran', email: 'mai@ducksalon.com', phone: '+84901234574' },
    { name: 'Khoa Pham', email: 'khoa@ducksalon.com', phone: '+84901234575' },
    { name: 'Thao Le', email: 'thao@ducksalon.com', phone: '+84901234576' },
  ];

  console.log('\n👥 Creating staff members...');
  const createdStaff = [];

  for (const staffData of staffNames) {
    try {
      const staff = await prisma.staff.upsert({
        where: {
          name_salonId: {
            name: staffData.name,
            salonId: duckSalon.id,
          },
        },
        update: {},
        create: {
          name: staffData.name,
          email: staffData.email,
          phone: staffData.phone,
          accessLevel: 'EMPLOYEE',
          salonId: duckSalon.id,
        },
      });
      createdStaff.push(staff);
      console.log(`  ✅ ${staff.name}`);
    } catch (error) {
      console.log(`  ⚠️ ${staffData.name} already exists or error`);
    }
  }

  // Create 15 services
  const services = [
    {
      name: 'Classic Haircut',
      description: 'Professional haircut with wash and styling',
      duration: 45,
      price: 150000,
      serviceCategoryId: 1, // Assuming 1 is haircut category
    },
    {
      name: 'Premium Hair Styling',
      description: 'Advanced styling with premium products',
      duration: 60,
      price: 250000,
      serviceCategoryId: 1,
    },
    {
      name: 'Hair Coloring',
      description: 'Full hair coloring service',
      duration: 120,
      price: 500000,
      serviceCategoryId: 2, // Hair coloring
    },
    {
      name: 'Highlights',
      description: 'Partial hair highlights',
      duration: 90,
      price: 400000,
      serviceCategoryId: 2,
    },
    {
      name: 'Balayage',
      description: 'Natural-looking balayage technique',
      duration: 150,
      price: 800000,
      serviceCategoryId: 2,
    },
    {
      name: 'Hair Treatment',
      description: 'Deep conditioning and repair treatment',
      duration: 45,
      price: 200000,
      serviceCategoryId: 3, // Hair treatment
    },
    {
      name: 'Keratin Treatment',
      description: 'Smoothing keratin treatment',
      duration: 180,
      price: 1200000,
      serviceCategoryId: 3,
    },
    {
      name: 'Hair Perm',
      description: 'Professional perm service',
      duration: 120,
      price: 600000,
      serviceCategoryId: 4, // Perming
    },
    {
      name: 'Manicure',
      description: 'Classic manicure with polish',
      duration: 45,
      price: 150000,
      serviceCategoryId: 5, // Nails
    },
    {
      name: 'Pedicure',
      description: 'Classic pedicure with polish',
      duration: 60,
      price: 200000,
      serviceCategoryId: 5,
    },
    {
      name: 'Gel Nails',
      description: 'Gel nail polish application',
      duration: 60,
      price: 250000,
      serviceCategoryId: 5,
    },
    {
      name: 'Facial Treatment',
      description: 'Deep cleansing facial',
      duration: 60,
      price: 300000,
      serviceCategoryId: 6, // Skincare
    },
    {
      name: 'Massage',
      description: 'Relaxing full body massage',
      duration: 90,
      price: 400000,
      serviceCategoryId: 7, // Massage
    },
    {
      name: 'Makeup Service',
      description: 'Professional makeup application',
      duration: 60,
      price: 350000,
      serviceCategoryId: 8, // Makeup
    },
    {
      name: 'Eyebrow Shaping',
      description: 'Professional eyebrow shaping and tinting',
      duration: 30,
      price: 100000,
      serviceCategoryId: 9, // Eyebrows
    },
  ];

  console.log('\n💇 Creating services...');
  const createdServices = [];

  for (const serviceData of services) {
    try {
      const service = await prisma.service.upsert({
        where: {
          name_salonId: {
            name: serviceData.name,
            salonId: duckSalon.id,
          },
        },
        update: {},
        create: {
          name: serviceData.name,
          description: serviceData.description,
          duration: serviceData.duration,
          price: serviceData.price,
          salonId: duckSalon.id,
          serviceCategoryId: serviceData.serviceCategoryId,
        },
      });
      createdServices.push(service);
      console.log(
        `  ✅ ${service.name} - ${service.price.toLocaleString('vi-VN')} VND`,
      );
    } catch (error) {
      console.log(`  ⚠️ ${serviceData.name} already exists or error`);
    }
  }

  // Assign staff to services (each service gets 2-4 random staff members)
  console.log('\n🔗 Assigning staff to services...');

  for (const service of createdServices) {
    // Get random 2-4 staff members
    const numStaff = Math.floor(Math.random() * 3) + 2; // 2-4
    const shuffled = [...createdStaff].sort(() => 0.5 - Math.random());
    const selectedStaff = shuffled.slice(0, numStaff);

    try {
      await prisma.service.update({
        where: { id: service.id },
        data: {
          staff: {
            connect: selectedStaff.map((s) => ({ id: s.id })),
          },
        },
      });
      console.log(
        `  ✅ ${service.name}: ${selectedStaff.map((s) => s.name).join(', ')}`,
      );
    } catch (error) {
      console.log(`  ⚠️ Error assigning staff to ${service.name}`);
    }
  }

  console.log('\n✅ Duck salon seed completed!');
  console.log(
    `📊 Created: ${createdStaff.length} staff, ${createdServices.length} services`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

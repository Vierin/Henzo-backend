import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🦆 Adding staff and services to Duck salon...');

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

  // Create 10 staff members
  console.log('\n👥 Creating 10 staff members...');

  const staffData = [
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

  const createdStaff: any[] = [];

  for (const staff of staffData) {
    try {
      const newStaff = await prisma.staff.create({
        data: {
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          accessLevel: 'EMPLOYEE',
          salonId: duckSalonId,
        },
      });
      createdStaff.push(newStaff);
      console.log(`  ✅ ${newStaff.name}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⚠️ ${staff.name} already exists`);
      } else {
        console.error(`  ❌ Error creating ${staff.name}:`, error.message);
      }
    }
  }

  // Create 15 services
  console.log('\n💇 Creating 15 services...');

  const servicesData = [
    {
      name: 'Classic Haircut',
      description: 'Professional haircut with wash and styling',
      duration: 45,
      price: 150000,
    },
    {
      name: 'Premium Hair Styling',
      description: 'Advanced styling with premium products',
      duration: 60,
      price: 250000,
    },
    {
      name: 'Hair Coloring',
      description: 'Full hair coloring service',
      duration: 120,
      price: 500000,
    },
    {
      name: 'Highlights',
      description: 'Partial hair highlights',
      duration: 90,
      price: 400000,
    },
    {
      name: 'Balayage',
      description: 'Natural-looking balayage technique',
      duration: 150,
      price: 800000,
    },
    {
      name: 'Hair Treatment',
      description: 'Deep conditioning and repair treatment',
      duration: 45,
      price: 200000,
    },
    {
      name: 'Keratin Treatment',
      description: 'Smoothing keratin treatment',
      duration: 180,
      price: 1200000,
    },
    {
      name: 'Hair Perm',
      description: 'Professional perm service',
      duration: 120,
      price: 600000,
    },
    {
      name: 'Manicure',
      description: 'Classic manicure with polish',
      duration: 45,
      price: 150000,
    },
    {
      name: 'Pedicure',
      description: 'Classic pedicure with polish',
      duration: 60,
      price: 200000,
    },
    {
      name: 'Gel Nails',
      description: 'Gel nail polish application',
      duration: 60,
      price: 250000,
    },
    {
      name: 'Facial Treatment',
      description: 'Deep cleansing facial',
      duration: 60,
      price: 300000,
    },
    {
      name: 'Massage',
      description: 'Relaxing full body massage',
      duration: 90,
      price: 400000,
    },
    {
      name: 'Makeup Service',
      description: 'Professional makeup application',
      duration: 60,
      price: 350000,
    },
    {
      name: 'Eyebrow Shaping',
      description: 'Professional eyebrow shaping and tinting',
      duration: 30,
      price: 100000,
    },
  ];

  const createdServices: any[] = [];

  for (const service of servicesData) {
    try {
      const newService = await prisma.service.create({
        data: {
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price,
          salonId: duckSalonId,
        },
      });
      createdServices.push(newService);
      console.log(
        `  ✅ ${newService.name} - ${newService.price.toLocaleString('vi-VN')} VND`,
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⚠️ ${service.name} already exists`);
      } else {
        console.error(`  ❌ Error creating ${service.name}:`, error.message);
      }
    }
  }

  // Get all staff for this salon (newly created or existing)
  const allStaff = await prisma.staff.findMany({
    where: { salonId: duckSalonId },
  });

  // Assign staff to services (each service gets 2-4 random staff)
  if (allStaff.length > 0 && createdServices.length > 0) {
    console.log('\n🔗 Assigning staff to services...');

    for (const service of createdServices) {
      const numStaff = Math.floor(Math.random() * 3) + 2; // 2-4
      const shuffled = [...allStaff].sort(() => 0.5 - Math.random());
      const selectedStaff = shuffled.slice(0, numStaff);

      try {
        await prisma.service.update({
          where: { id: service.id },
          data: {
            Staff: {
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
  }

  console.log('\n✅ Duck salon seed completed!');
  console.log(
    `📊 Total: ${allStaff.length} staff, ${createdServices.length} new services created`,
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

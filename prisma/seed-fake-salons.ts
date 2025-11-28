import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Creating 3 fake salons with services and staff...\n');

  // Get service categories for assignment
  const categories = await prisma.service_categories.findMany({
    take: 5,
  });

  if (categories.length === 0) {
    console.error('❌ No service categories found! Run seed-categories first.');
    return;
  }

  console.log(`✅ Found ${categories.length} service categories\n`);

  // Salon data
  const salonsData = [
    {
      name: 'Luxury Hair Studio',
      description: 'Premium hair salon specializing in cutting-edge styles and treatments',
      descriptionEn: 'Premium hair salon specializing in cutting-edge styles and treatments',
      descriptionVi: 'Tiệm làm tóc cao cấp chuyên về các kiểu tóc và phương pháp điều trị tiên tiến',
      descriptionRu: 'Премиальный салон красоты, специализирующийся на современных стрижках и уходе',
      address: '123 Le Loi Street, District 1, Ho Chi Minh City',
      phone: '+84901234501',
      email: 'info@luxuryhairstudio.vn',
      website: 'https://luxuryhairstudio.vn',
      instagram: '@luxuryhairstudio',
      latitude: 10.7769,
      longitude: 106.7009,
      categoryIds: [categories[0]?.id || 1], // Hair category
      logo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
      photos: [
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
        'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800',
        'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800',
      ],
      services: [
        { name: 'Premium Haircut', nameEn: 'Premium Haircut', nameVi: 'Cắt tóc cao cấp', nameRu: 'Премиум стрижка', description: 'Professional haircut with consultation', duration: 60, price: 200000, categoryId: categories[0]?.id },
        { name: 'Hair Coloring', nameEn: 'Hair Coloring', nameVi: 'Nhuộm tóc', nameRu: 'Окрашивание', description: 'Full hair coloring with premium dye', duration: 150, price: 800000, categoryId: categories[0]?.id },
        { name: 'Balayage Highlights', nameEn: 'Balayage Highlights', nameVi: 'Tóc balayage', nameRu: 'Балаяж', description: 'Natural-looking balayage technique', duration: 180, price: 1200000, categoryId: categories[0]?.id },
        { name: 'Keratin Treatment', nameEn: 'Keratin Treatment', nameVi: 'Dưỡng tóc keratin', nameRu: 'Кератиновое выпрямление', description: 'Smoothing keratin treatment', duration: 120, price: 1500000, categoryId: categories[0]?.id },
        { name: 'Hair Extensions', nameEn: 'Hair Extensions', nameVi: 'Nối tóc', nameRu: 'Наращивание волос', description: 'Professional hair extensions', duration: 240, price: 3000000, categoryId: categories[0]?.id },
        { name: 'Hair Perm', nameEn: 'Hair Perm', nameVi: 'Uốn tóc', nameRu: 'Химическая завивка', description: 'Long-lasting perm service', duration: 150, price: 900000, categoryId: categories[0]?.id },
        { name: 'Hair Treatment', nameEn: 'Hair Treatment', nameVi: 'Điều trị tóc', nameRu: 'Лечение волос', description: 'Deep conditioning treatment', duration: 60, price: 350000, categoryId: categories[0]?.id },
        { name: 'Bridal Hair', nameEn: 'Bridal Hair', nameVi: 'Tóc cô dâu', nameRu: 'Прическа невесты', description: 'Elegant bridal hairstyling', duration: 120, price: 1500000, categoryId: categories[0]?.id },
        { name: 'Men Haircut', nameEn: 'Men Haircut', nameVi: 'Cắt tóc nam', nameRu: 'Мужская стрижка', description: 'Classic men\'s haircut', duration: 45, price: 150000, categoryId: categories[0]?.id },
        { name: 'Beard Trim', nameEn: 'Beard Trim', nameVi: 'Cắt râu', nameRu: 'Стрижка бороды', description: 'Professional beard trimming', duration: 30, price: 100000, categoryId: categories[0]?.id },
        { name: 'Hair Wash & Style', nameEn: 'Hair Wash & Style', nameVi: 'Gội đầu và tạo kiểu', nameRu: 'Мытье и укладка', description: 'Wash and styling service', duration: 45, price: 180000, categoryId: categories[0]?.id },
        { name: 'Color Correction', nameEn: 'Color Correction', nameVi: 'Sửa màu tóc', nameRu: 'Коррекция цвета', description: 'Fix and correct hair color', duration: 180, price: 2000000, categoryId: categories[0]?.id },
      ],
      staff: [
        { name: 'Mai Nguyen', email: 'mai@luxuryhair.vn', phone: '+84901234511' },
        { name: 'Lan Tran', email: 'lan@luxuryhair.vn', phone: '+84901234512' },
        { name: 'Hoa Le', email: 'hoa@luxuryhair.vn', phone: '+84901234513' },
        { name: 'Thao Pham', email: 'thao@luxuryhair.vn', phone: '+84901234514' },
        { name: 'Anh Vo', email: 'anh@luxuryhair.vn', phone: '+84901234515' },
      ],
    },
    {
      name: 'Nail Art Paradise',
      description: 'Creative nail salon offering unique designs and premium nail care services',
      descriptionEn: 'Creative nail salon offering unique designs and premium nail care services',
      descriptionVi: 'Tiệm nail sáng tạo cung cấp thiết kế độc đáo và dịch vụ chăm sóc móng cao cấp',
      descriptionRu: 'Креативный маникюрный салон с уникальными дизайнами и премиальным уходом',
      address: '456 Nguyen Hue Boulevard, District 1, Ho Chi Minh City',
      phone: '+84901234502',
      email: 'info@nailartparadise.vn',
      website: 'https://nailartparadise.vn',
      instagram: '@nailartparadise',
      latitude: 10.7756,
      longitude: 106.7019,
      categoryIds: [categories[1]?.id || 2], // Nails category
      logo: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400',
      photos: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800',
        'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800',
        'https://images.unsplash.com/photo-1604654894192-7c5a0e4c0a5e?w=800',
      ],
      services: [
        { name: 'Classic Manicure', nameEn: 'Classic Manicure', nameVi: 'Manicure cổ điển', nameRu: 'Классический маникюр', description: 'Traditional manicure with polish', duration: 45, price: 200000, categoryId: categories[1]?.id },
        { name: 'Gel Manicure', nameEn: 'Gel Manicure', nameVi: 'Manicure gel', nameRu: 'Гелевый маникюр', description: 'Long-lasting gel polish', duration: 60, price: 300000, categoryId: categories[1]?.id },
        { name: 'French Manicure', nameEn: 'French Manicure', nameVi: 'Manicure Pháp', nameRu: 'Французский маникюр', description: 'Elegant French style', duration: 50, price: 250000, categoryId: categories[1]?.id },
        { name: 'Nail Art Design', nameEn: 'Nail Art Design', nameVi: 'Vẽ móng nghệ thuật', nameRu: 'Дизайн ногтей', description: 'Custom nail art design', duration: 90, price: 500000, categoryId: categories[1]?.id },
        { name: '3D Nail Art', nameEn: '3D Nail Art', nameVi: 'Nghệ thuật móng 3D', nameRu: '3D дизайн', description: 'Three-dimensional nail decorations', duration: 120, price: 800000, categoryId: categories[1]?.id },
        { name: 'Classic Pedicure', nameEn: 'Classic Pedicure', nameVi: 'Pedicure cổ điển', nameRu: 'Классический педикюр', description: 'Relaxing foot care', duration: 60, price: 250000, categoryId: categories[1]?.id },
        { name: 'Spa Pedicure', nameEn: 'Spa Pedicure', nameVi: 'Pedicure spa', nameRu: 'Спа педикюр', description: 'Luxury spa pedicure with massage', duration: 90, price: 400000, categoryId: categories[1]?.id },
        { name: 'Gel Pedicure', nameEn: 'Gel Pedicure', nameVi: 'Pedicure gel', nameRu: 'Гелевый педикюр', description: 'Gel polish for feet', duration: 75, price: 350000, categoryId: categories[1]?.id },
        { name: 'Nail Extension', nameEn: 'Nail Extension', nameVi: 'Nối móng', nameRu: 'Наращивание ногтей', description: 'Acrylic or gel extensions', duration: 120, price: 600000, categoryId: categories[1]?.id },
        { name: 'Nail Repair', nameEn: 'Nail Repair', nameVi: 'Sửa móng', nameRu: 'Ремонт ногтей', description: 'Fix broken or damaged nails', duration: 30, price: 150000, categoryId: categories[1]?.id },
        { name: 'Paraffin Treatment', nameEn: 'Paraffin Treatment', nameVi: 'Điều trị parafin', nameRu: 'Парафинотерапия', description: 'Moisturizing paraffin treatment', duration: 45, price: 200000, categoryId: categories[1]?.id },
        { name: 'Nail Removal', nameEn: 'Nail Removal', nameVi: 'Gỡ móng', nameRu: 'Снятие покрытия', description: 'Safe gel/acrylic removal', duration: 30, price: 100000, categoryId: categories[1]?.id },
      ],
      staff: [
        { name: 'Van Nguyen', email: 'van@nailart.vn', phone: '+84901234521' },
        { name: 'Huyen Tran', email: 'huyen@nailart.vn', phone: '+84901234522' },
        { name: 'Quynh Le', email: 'quynh@nailart.vn', phone: '+84901234523' },
        { name: 'My Pham', email: 'my@nailart.vn', phone: '+84901234524' },
      ],
    },
    {
      name: 'Relax Spa & Wellness',
      description: 'Tranquil spa offering massage, facial treatments, and body care services',
      descriptionEn: 'Tranquil spa offering massage, facial treatments, and body care services',
      descriptionVi: 'Spa yên tĩnh cung cấp massage, điều trị mặt và dịch vụ chăm sóc cơ thể',
      descriptionRu: 'Уютный спа-салон с массажем, уходом за лицом и телом',
      address: '789 Dong Khoi Street, District 1, Ho Chi Minh City',
      phone: '+84901234503',
      email: 'info@relaxspa.vn',
      website: 'https://relaxspa.vn',
      instagram: '@relaxspa',
      latitude: 10.7794,
      longitude: 106.6992,
      categoryIds: [categories[2]?.id || 3], // Spa/Massage category
      logo: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400',
      photos: [
        'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
        'https://images.unsplash.com/photo-1626383137804-ff908d2753a2?w=800',
        'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800',
      ],
      services: [
        { name: 'Swedish Massage', nameEn: 'Swedish Massage', nameVi: 'Massage Thụy Điển', nameRu: 'Шведский массаж', description: 'Classic relaxation massage', duration: 60, price: 400000, categoryId: categories[2]?.id },
        { name: 'Deep Tissue Massage', nameEn: 'Deep Tissue Massage', nameVi: 'Massage mô sâu', nameRu: 'Глубокий массаж', description: 'Therapeutic deep tissue work', duration: 90, price: 600000, categoryId: categories[2]?.id },
        { name: 'Hot Stone Massage', nameEn: 'Hot Stone Massage', nameVi: 'Massage đá nóng', nameRu: 'Массаж горячими камнями', description: 'Relaxing hot stone therapy', duration: 90, price: 700000, categoryId: categories[2]?.id },
        { name: 'Thai Massage', nameEn: 'Thai Massage', nameVi: 'Massage Thái', nameRu: 'Тайский массаж', description: 'Traditional Thai stretching massage', duration: 90, price: 550000, categoryId: categories[2]?.id },
        { name: 'Aromatherapy Massage', nameEn: 'Aromatherapy Massage', nameVi: 'Massage tinh dầu', nameRu: 'Ароматерапия', description: 'Massage with essential oils', duration: 75, price: 500000, categoryId: categories[2]?.id },
        { name: 'Facial Treatment', nameEn: 'Facial Treatment', nameVi: 'Điều trị mặt', nameRu: 'Уход за лицом', description: 'Deep cleansing facial', duration: 60, price: 450000, categoryId: categories[2]?.id },
        { name: 'Anti-Aging Facial', nameEn: 'Anti-Aging Facial', nameVi: 'Mặt chống lão hóa', nameRu: 'Антивозрастной уход', description: 'Rejuvenating facial treatment', duration: 90, price: 800000, categoryId: categories[2]?.id },
        { name: 'Body Scrub', nameEn: 'Body Scrub', nameVi: 'Tẩy da chết', nameRu: 'Скраб для тела', description: 'Exfoliating body treatment', duration: 45, price: 350000, categoryId: categories[2]?.id },
        { name: 'Body Wrap', nameEn: 'Body Wrap', nameVi: 'Bọc cơ thể', nameRu: 'Обертывание', description: 'Detoxifying body wrap', duration: 60, price: 500000, categoryId: categories[2]?.id },
        { name: 'Foot Reflexology', nameEn: 'Foot Reflexology', nameVi: 'Bấm huyệt chân', nameRu: 'Рефлексотерапия стоп', description: 'Therapeutic foot massage', duration: 60, price: 300000, categoryId: categories[2]?.id },
        { name: 'Back & Shoulder Massage', nameEn: 'Back & Shoulder Massage', nameVi: 'Massage lưng và vai', nameRu: 'Массаж спины и плеч', description: 'Targeted back and shoulder relief', duration: 45, price: 350000, categoryId: categories[2]?.id },
        { name: 'Couple Massage', nameEn: 'Couple Massage', nameVi: 'Massage đôi', nameRu: 'Массаж для двоих', description: 'Romantic couple massage session', duration: 90, price: 1200000, categoryId: categories[2]?.id },
      ],
      staff: [
        { name: 'Dung Nguyen', email: 'dung@relaxspa.vn', phone: '+84901234531' },
        { name: 'Bich Tran', email: 'bich@relaxspa.vn', phone: '+84901234532' },
        { name: 'Nga Le', email: 'nga@relaxspa.vn', phone: '+84901234533' },
        { name: 'Huong Pham', email: 'huong@relaxspa.vn', phone: '+84901234534' },
        { name: 'Linh Vo', email: 'linh@relaxspa.vn', phone: '+84901234535' },
        { name: 'Minh Hoang', email: 'minh@relaxspa.vn', phone: '+84901234536' },
      ],
    },
  ];

  for (let i = 0; i < salonsData.length; i++) {
    const salonData = salonsData[i];
    console.log(`\n🏢 Creating salon ${i + 1}/3: ${salonData.name}`);

    // Create owner
    const owner = await prisma.user.upsert({
      where: { email: `owner${i + 1}@fakesalon.vn` },
      update: {},
      create: {
        email: `owner${i + 1}@fakesalon.vn`,
        name: `Salon Owner ${i + 1}`,
        phone: salonData.phone,
        role: 'OWNER',
      },
    });

    // Create salon
    const salon = await prisma.salon.create({
      data: {
        name: salonData.name,
        description: salonData.description,
        descriptionEn: salonData.descriptionEn,
        descriptionVi: salonData.descriptionVi,
        descriptionRu: salonData.descriptionRu,
        address: salonData.address,
        phone: salonData.phone,
        email: salonData.email,
        website: salonData.website,
        instagram: salonData.instagram,
        latitude: salonData.latitude,
        longitude: salonData.longitude,
        categoryIds: salonData.categoryIds,
        ownerId: owner.id,
        logo: salonData.logo,
        photos: salonData.photos,
        workingHours: {
          monday: { open: '09:00', close: '20:00', closed: false },
          tuesday: { open: '09:00', close: '20:00', closed: false },
          wednesday: { open: '09:00', close: '20:00', closed: false },
          thursday: { open: '09:00', close: '20:00', closed: false },
          friday: { open: '09:00', close: '20:00', closed: false },
          saturday: { open: '09:00', close: '21:00', closed: false },
          sunday: { open: '10:00', close: '18:00', closed: false },
        },
      },
    });

    console.log(`  ✅ Salon created: ${salon.name} (${salon.id})`);

    // Create staff
    console.log(`  👥 Creating ${salonData.staff.length} staff members...`);
    const createdStaff: any[] = [];

    for (const staffData of salonData.staff) {
      try {
        const staff = await prisma.staff.create({
          data: {
            name: staffData.name,
            email: staffData.email,
            phone: staffData.phone,
            accessLevel: 'EMPLOYEE',
            salonId: salon.id,
          },
        });
        createdStaff.push(staff);
        console.log(`    ✅ ${staff.name}`);
      } catch (error: any) {
        console.log(`    ⚠️ ${staffData.name} - ${error.message}`);
      }
    }

    // Create services
    console.log(`  💇 Creating ${salonData.services.length} services...`);
    const createdServices: any[] = [];

    for (const serviceData of salonData.services) {
      try {
        const service = await prisma.service.create({
          data: {
            name: serviceData.name,
            nameEn: serviceData.nameEn,
            nameVi: serviceData.nameVi,
            nameRu: serviceData.nameRu,
            description: serviceData.description,
            duration: serviceData.duration,
            price: serviceData.price,
            salonId: salon.id,
            serviceCategoryId: serviceData.categoryId,
          },
        });
        createdServices.push(service);
        console.log(`    ✅ ${service.name} - ${serviceData.price.toLocaleString()} VND`);
      } catch (error: any) {
        console.log(`    ⚠️ ${serviceData.name} - ${error.message}`);
      }
    }

    // Assign staff to services (each service gets 2-4 random staff)
    if (createdStaff.length > 0 && createdServices.length > 0) {
      console.log(`  🔗 Assigning staff to services...`);
      for (const service of createdServices) {
        const numStaff = Math.floor(Math.random() * 3) + 2; // 2-4 staff per service
        const shuffled = [...createdStaff].sort(() => 0.5 - Math.random());
        const selectedStaff = shuffled.slice(0, Math.min(numStaff, createdStaff.length));

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
            `    ✅ ${service.name}: ${selectedStaff.map((s) => s.name).join(', ')}`,
          );
        } catch (error: any) {
          console.log(`    ⚠️ Error assigning staff to ${service.name}: ${error.message}`);
        }
      }
    }

    console.log(`  ✅ Salon ${salonData.name} completed!`);
  }

  console.log('\n✅ All salons created successfully!');
  console.log('\n📊 Summary:');
  const totalSalons = await prisma.salon.count();
  const totalServices = await prisma.service.count();
  const totalStaff = await prisma.staff.count();
  console.log(`  - Salons: ${totalSalons}`);
  console.log(`  - Services: ${totalServices}`);
  console.log(`  - Staff: ${totalStaff}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


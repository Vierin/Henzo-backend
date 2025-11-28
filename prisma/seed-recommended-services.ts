import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const recommendedServices = [
  // Hair Services
  {
    nameEn: 'Haircut',
    nameVi: 'Cắt tóc',
    nameRu: 'Стрижка',
    categoryId: null,
    priority: 100,
  },
  {
    nameEn: 'Hair Color',
    nameVi: 'Nhuộm tóc',
    nameRu: 'Окрашивание волос',
    categoryId: null,
    priority: 95,
  },
  {
    nameEn: 'Hair Styling',
    nameVi: 'Tạo kiểu tóc',
    nameRu: 'Укладка волос',
    categoryId: null,
    priority: 90,
  },
  {
    nameEn: 'Hair Extensions',
    nameVi: 'Nối tóc',
    nameRu: 'Наращивание волос',
    categoryId: null,
    priority: 85,
  },
  {
    nameEn: 'Hair Treatment',
    nameVi: 'Điều trị tóc',
    nameRu: 'Лечение волос',
    categoryId: null,
    priority: 80,
  },
  // Nail Services
  {
    nameEn: 'Gel Nails',
    nameVi: 'Sơn gel',
    nameRu: 'Гель-маникюр',
    categoryId: null,
    priority: 100,
  },
  {
    nameEn: 'Manicure',
    nameVi: 'Làm móng tay',
    nameRu: 'Маникюр',
    categoryId: null,
    priority: 95,
  },
  {
    nameEn: 'Pedicure',
    nameVi: 'Làm móng chân',
    nameRu: 'Педикюр',
    categoryId: null,
    priority: 90,
  },
  {
    nameEn: 'Nail Art',
    nameVi: 'Vẽ móng nghệ thuật',
    nameRu: 'Дизайн ногтей',
    categoryId: null,
    priority: 85,
  },
  // Beauty Services
  {
    nameEn: 'Facial',
    nameVi: 'Chăm sóc da mặt',
    nameRu: 'Уход за лицом',
    categoryId: null,
    priority: 95,
  },
  {
    nameEn: 'Eyelash Extension',
    nameVi: 'Nối mi',
    nameRu: 'Наращивание ресниц',
    categoryId: null,
    priority: 90,
  },
  {
    nameEn: 'Eyebrow Shaping',
    nameVi: 'Tạo dáng lông mày',
    nameRu: 'Коррекция бровей',
    categoryId: null,
    priority: 85,
  },
  {
    nameEn: 'Waxing',
    nameVi: 'Tẩy lông',
    nameRu: 'Депиляция',
    categoryId: null,
    priority: 80,
  },
  // Massage & Spa
  {
    nameEn: 'Massage',
    nameVi: 'Massage',
    nameRu: 'Массаж',
    categoryId: null,
    priority: 100,
  },
  {
    nameEn: 'Body Scrub',
    nameVi: 'Tẩy tế bào chết',
    nameRu: 'Скрабирование тела',
    categoryId: null,
    priority: 85,
  },
  {
    nameEn: 'Hot Stone Massage',
    nameVi: 'Massage đá nóng',
    nameRu: 'Массаж горячими камнями',
    categoryId: null,
    priority: 80,
  },
  // Additional Services
  {
    nameEn: 'Hair Wash',
    nameVi: 'Gội đầu',
    nameRu: 'Мытье головы',
    categoryId: null,
    priority: 75,
  },
  {
    nameEn: 'Hair Perm',
    nameVi: 'Uốn tóc',
    nameRu: 'Химическая завивка',
    categoryId: null,
    priority: 75,
  },
  {
    nameEn: 'Lash Lift',
    nameVi: 'Làm cong mi',
    nameRu: 'Ламинирование ресниц',
    categoryId: null,
    priority: 75,
  },
  // Men's Services / Barber
  {
    nameEn: "Men's Haircut",
    nameVi: 'Cắt tóc nam',
    nameRu: 'Мужская стрижка',
    categoryId: null,
    priority: 100,
  },
  {
    nameEn: 'Beard Trim',
    nameVi: 'Cắt râu',
    nameRu: 'Стрижка бороды',
    categoryId: null,
    priority: 95,
  },
  {
    nameEn: 'Hot Towel Shave',
    nameVi: 'Cạo râu bằng khăn nóng',
    nameRu: 'Бритье горячим полотенцем',
    categoryId: null,
    priority: 90,
  },
  {
    nameEn: 'Hair Fade',
    nameVi: 'Cắt tóc fade',
    nameRu: 'Стрижка fade',
    categoryId: null,
    priority: 90,
  },
  {
    nameEn: 'Hair & Beard Combo',
    nameVi: 'Combo tóc và râu',
    nameRu: 'Комбо стрижка + борода',
    categoryId: null,
    priority: 95,
  },
  {
    nameEn: 'Classic Shave',
    nameVi: 'Cạo râu cổ điển',
    nameRu: 'Классическое бритье',
    categoryId: null,
    priority: 85,
  },
  {
    nameEn: 'Mustache Trim',
    nameVi: 'Cắt ria mép',
    nameRu: 'Стрижка усов',
    categoryId: null,
    priority: 85,
  },
  {
    nameEn: 'Undercut',
    nameVi: 'Cắt tóc undercut',
    nameRu: 'Стрижка андеркат',
    categoryId: null,
    priority: 80,
  },
  {
    nameEn: 'Full Beard Grooming',
    nameVi: 'Chăm sóc râu đầy đủ',
    nameRu: 'Полный уход за бородой',
    categoryId: null,
    priority: 85,
  },
];

async function seed() {
  console.log('🌱 Seeding recommended services...');

  // Delete all and create fresh
  await prisma.recommendedService.deleteMany({});

  await prisma.recommendedService.createMany({
    data: recommendedServices,
    skipDuplicates: true,
  });

  console.log(`✅ Seeded ${recommendedServices.length} recommended services`);
}

seed()
  .catch((e) => {
    console.error('❌ Error seeding recommended services:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

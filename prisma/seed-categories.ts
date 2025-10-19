import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏷️  Seeding service categories and synonyms...');

  // Service categories data
  const categories = [
    {
      nameEn: 'Haircut & Styling',
      nameVn: 'Cắt tóc & Tạo kiểu',
      synonyms: [
        // English synonyms
        { keyword: 'haircut', language: 'en', weight: 1.0 },
        { keyword: 'hairstyle', language: 'en', weight: 1.0 },
        { keyword: 'styling', language: 'en', weight: 0.9 },
        { keyword: 'trim', language: 'en', weight: 0.8 },
        { keyword: 'cut', language: 'en', weight: 0.9 },
        { keyword: 'hair', language: 'en', weight: 0.7 },
        { keyword: 'barber', language: 'en', weight: 0.8 },
        // Vietnamese synonyms
        { keyword: 'cắt tóc', language: 'vi', weight: 1.0 },
        { keyword: 'tạo kiểu', language: 'vi', weight: 1.0 },
        { keyword: 'uốn tóc', language: 'vi', weight: 0.8 },
        { keyword: 'tóc', language: 'vi', weight: 0.7 },
      ],
    },
    {
      nameEn: 'Hair Coloring',
      nameVn: 'Nhuộm tóc',
      synonyms: [
        // English
        { keyword: 'coloring', language: 'en', weight: 1.0 },
        { keyword: 'dyeing', language: 'en', weight: 1.0 },
        { keyword: 'color', language: 'en', weight: 0.9 },
        { keyword: 'dye', language: 'en', weight: 0.9 },
        { keyword: 'highlights', language: 'en', weight: 0.9 },
        { keyword: 'balayage', language: 'en', weight: 0.9 },
        { keyword: 'ombre', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'nhuộm', language: 'vi', weight: 1.0 },
        { keyword: 'nhuộm tóc', language: 'vi', weight: 1.0 },
        { keyword: 'đổi màu', language: 'vi', weight: 0.9 },
        { keyword: 'highlight', language: 'vi', weight: 0.8 },
      ],
    },
    {
      nameEn: 'Hair Treatment',
      nameVn: 'Dưỡng tóc',
      synonyms: [
        // English
        { keyword: 'treatment', language: 'en', weight: 1.0 },
        { keyword: 'conditioning', language: 'en', weight: 0.9 },
        { keyword: 'repair', language: 'en', weight: 0.9 },
        { keyword: 'keratin', language: 'en', weight: 0.9 },
        { keyword: 'smoothing', language: 'en', weight: 0.8 },
        { keyword: 'deep conditioning', language: 'en', weight: 0.9 },
        // Vietnamese
        { keyword: 'dưỡng', language: 'vi', weight: 1.0 },
        { keyword: 'dưỡng tóc', language: 'vi', weight: 1.0 },
        { keyword: 'phục hồi', language: 'vi', weight: 0.9 },
        { keyword: 'ủ tóc', language: 'vi', weight: 0.9 },
      ],
    },
    {
      nameEn: 'Perming',
      nameVn: 'Uốn tóc',
      synonyms: [
        // English
        { keyword: 'perm', language: 'en', weight: 1.0 },
        { keyword: 'perming', language: 'en', weight: 1.0 },
        { keyword: 'curling', language: 'en', weight: 0.9 },
        { keyword: 'wave', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'uốn', language: 'vi', weight: 1.0 },
        { keyword: 'uốn tóc', language: 'vi', weight: 1.0 },
        { keyword: 'uốn xoăn', language: 'vi', weight: 0.9 },
      ],
    },
    {
      nameEn: 'Nails',
      nameVn: 'Làm móng',
      synonyms: [
        // English
        { keyword: 'nails', language: 'en', weight: 1.0 },
        { keyword: 'manicure', language: 'en', weight: 1.0 },
        { keyword: 'pedicure', language: 'en', weight: 1.0 },
        { keyword: 'nail art', language: 'en', weight: 0.9 },
        { keyword: 'gel nails', language: 'en', weight: 0.9 },
        { keyword: 'acrylic', language: 'en', weight: 0.8 },
        { keyword: 'polish', language: 'en', weight: 0.7 },
        // Vietnamese
        { keyword: 'móng', language: 'vi', weight: 1.0 },
        { keyword: 'làm móng', language: 'vi', weight: 1.0 },
        { keyword: 'móng tay', language: 'vi', weight: 0.9 },
        { keyword: 'móng chân', language: 'vi', weight: 0.9 },
        { keyword: 'sơn móng', language: 'vi', weight: 0.8 },
      ],
    },
    {
      nameEn: 'Skincare & Facial',
      nameVn: 'Chăm sóc da & Massage mặt',
      synonyms: [
        // English
        { keyword: 'facial', language: 'en', weight: 1.0 },
        { keyword: 'skincare', language: 'en', weight: 1.0 },
        { keyword: 'skin care', language: 'en', weight: 1.0 },
        { keyword: 'face', language: 'en', weight: 0.8 },
        { keyword: 'cleansing', language: 'en', weight: 0.8 },
        { keyword: 'hydrating', language: 'en', weight: 0.8 },
        { keyword: 'anti-aging', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'chăm sóc da', language: 'vi', weight: 1.0 },
        { keyword: 'làm sạch da', language: 'vi', weight: 0.9 },
        { keyword: 'massage mặt', language: 'vi', weight: 0.9 },
        { keyword: 'mặt', language: 'vi', weight: 0.7 },
      ],
    },
    {
      nameEn: 'Massage & Spa',
      nameVn: 'Massage & Spa',
      synonyms: [
        // English
        { keyword: 'massage', language: 'en', weight: 1.0 },
        { keyword: 'spa', language: 'en', weight: 1.0 },
        { keyword: 'body massage', language: 'en', weight: 0.9 },
        { keyword: 'relaxing', language: 'en', weight: 0.8 },
        { keyword: 'hot stone', language: 'en', weight: 0.8 },
        { keyword: 'aromatherapy', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'massage', language: 'vi', weight: 1.0 },
        { keyword: 'mát xa', language: 'vi', weight: 1.0 },
        { keyword: 'spa', language: 'vi', weight: 1.0 },
        { keyword: 'thư giãn', language: 'vi', weight: 0.8 },
      ],
    },
    {
      nameEn: 'Makeup',
      nameVn: 'Trang điểm',
      synonyms: [
        // English
        { keyword: 'makeup', language: 'en', weight: 1.0 },
        { keyword: 'make-up', language: 'en', weight: 1.0 },
        { keyword: 'cosmetics', language: 'en', weight: 0.8 },
        { keyword: 'beauty', language: 'en', weight: 0.7 },
        { keyword: 'wedding makeup', language: 'en', weight: 0.9 },
        { keyword: 'party makeup', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'trang điểm', language: 'vi', weight: 1.0 },
        { keyword: 'make up', language: 'vi', weight: 1.0 },
        { keyword: 'cô dâu', language: 'vi', weight: 0.9 },
        { keyword: 'tiệc', language: 'vi', weight: 0.8 },
      ],
    },
    {
      nameEn: 'Eyebrows & Lashes',
      nameVn: 'Lông mày & Lông mi',
      synonyms: [
        // English
        { keyword: 'eyebrows', language: 'en', weight: 1.0 },
        { keyword: 'brows', language: 'en', weight: 1.0 },
        { keyword: 'lashes', language: 'en', weight: 1.0 },
        { keyword: 'eyelashes', language: 'en', weight: 1.0 },
        { keyword: 'eyebrow shaping', language: 'en', weight: 0.9 },
        { keyword: 'eyebrow tinting', language: 'en', weight: 0.9 },
        { keyword: 'lash extensions', language: 'en', weight: 0.9 },
        { keyword: 'microblading', language: 'en', weight: 0.9 },
        // Vietnamese
        { keyword: 'lông mày', language: 'vi', weight: 1.0 },
        { keyword: 'chân mày', language: 'vi', weight: 1.0 },
        { keyword: 'lông mi', language: 'vi', weight: 1.0 },
        { keyword: 'nối mi', language: 'vi', weight: 0.9 },
        { keyword: 'phun mày', language: 'vi', weight: 0.9 },
      ],
    },
    {
      nameEn: 'Waxing & Hair Removal',
      nameVn: 'Wax & Triệt lông',
      synonyms: [
        // English
        { keyword: 'waxing', language: 'en', weight: 1.0 },
        { keyword: 'wax', language: 'en', weight: 1.0 },
        { keyword: 'hair removal', language: 'en', weight: 1.0 },
        { keyword: 'brazilian', language: 'en', weight: 0.8 },
        { keyword: 'bikini wax', language: 'en', weight: 0.8 },
        { keyword: 'laser', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'wax', language: 'vi', weight: 1.0 },
        { keyword: 'triệt lông', language: 'vi', weight: 1.0 },
        { keyword: 'nhổ lông', language: 'vi', weight: 0.9 },
      ],
    },
    {
      nameEn: 'Body Care',
      nameVn: 'Chăm sóc cơ thể',
      synonyms: [
        // English
        { keyword: 'body care', language: 'en', weight: 1.0 },
        { keyword: 'body treatment', language: 'en', weight: 0.9 },
        { keyword: 'scrub', language: 'en', weight: 0.9 },
        { keyword: 'body wrap', language: 'en', weight: 0.8 },
        { keyword: 'exfoliation', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'chăm sóc cơ thể', language: 'vi', weight: 1.0 },
        { keyword: 'tắm trắng', language: 'vi', weight: 0.9 },
        { keyword: 'tẩy da chết', language: 'vi', weight: 0.9 },
      ],
    },
    {
      nameEn: 'Bridal & Events',
      nameVn: 'Cô dâu & Sự kiện',
      synonyms: [
        // English
        { keyword: 'bridal', language: 'en', weight: 1.0 },
        { keyword: 'wedding', language: 'en', weight: 1.0 },
        { keyword: 'bride', language: 'en', weight: 1.0 },
        { keyword: 'event', language: 'en', weight: 0.9 },
        { keyword: 'party', language: 'en', weight: 0.8 },
        // Vietnamese
        { keyword: 'cô dâu', language: 'vi', weight: 1.0 },
        { keyword: 'đám cưới', language: 'vi', weight: 1.0 },
        { keyword: 'sự kiện', language: 'vi', weight: 0.9 },
        { keyword: 'tiệc', language: 'vi', weight: 0.8 },
      ],
    },
  ];

  console.log('\n📦 Creating categories and synonyms...\n');

  for (const category of categories) {
    try {
      // Create or update category
      const createdCategory = await prisma.serviceCategory.upsert({
        where: { nameEn: category.nameEn },
        update: {
          nameVn: category.nameVn,
        },
        create: {
          nameEn: category.nameEn,
          nameVn: category.nameVn,
        },
      });

      console.log(`✅ ${category.nameEn} / ${category.nameVn}`);

      // Create synonyms for this category
      for (const synonym of category.synonyms) {
        try {
          await prisma.service_synonyms.upsert({
            where: {
              category_id_keyword_language: {
                category_id: createdCategory.id,
                keyword: synonym.keyword,
                language: synonym.language,
              },
            },
            update: {
              weight: synonym.weight,
            },
            create: {
              category_id: createdCategory.id,
              keyword: synonym.keyword,
              language: synonym.language,
              weight: synonym.weight,
            },
          });
        } catch (error: any) {
          // Ignore duplicate errors
          if (error.code !== 'P2002') {
            console.error(
              `  ⚠️ Error creating synonym "${synonym.keyword}":`,
              error.message,
            );
          }
        }
      }

      console.log(
        `   → Added ${category.synonyms.length} synonyms (${category.synonyms.filter((s) => s.language === 'en').length} EN, ${category.synonyms.filter((s) => s.language === 'vi').length} VI)\n`,
      );
    } catch (error: any) {
      console.error(
        `❌ Error with category ${category.nameEn}:`,
        error.message,
      );
    }
  }

  // Summary
  const totalCategories = await prisma.serviceCategory.count();
  const totalSynonyms = await prisma.service_synonyms.count();

  console.log('\n✅ Seeding completed!');
  console.log(
    `📊 Total: ${totalCategories} categories, ${totalSynonyms} synonyms`,
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




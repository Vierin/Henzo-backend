"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🏷️  Seeding service categories, subcategories and tags...');
    const category1 = {
        nameEn: 'Haircut',
        nameVn: 'Dịch vụ tóc',
        nameRu: 'Прическа',
        subcategories: [
            { nameEn: 'Haircut', nameRu: 'Стрижка', nameVi: 'Cắt tóc' },
            { nameEn: 'Styling', nameRu: 'Укладка', nameVi: 'Tạo kiểu' },
            { nameEn: 'Hair Coloring', nameRu: 'Окрашивание', nameVi: 'Nhuộm tóc' },
            {
                nameEn: 'Lightening / Blonde',
                nameRu: 'Осветление / блонд',
                nameVi: 'Tẩy tóc / Tóc vàng',
            },
            { nameEn: 'Toning', nameRu: 'Тонирование', nameVi: 'Tông màu' },
            {
                nameEn: 'Hair Polishing',
                nameRu: 'Полировка волос',
                nameVi: 'Đánh bóng tóc',
            },
            {
                nameEn: 'Hair Care & Restoration',
                nameRu: 'Уходы и восстановление',
                nameVi: 'Chăm sóc & Phục hồi tóc',
            },
            {
                nameEn: 'Curling / Perming / Bio-perming',
                nameRu: 'Кудри / завивка / биозавивка',
                nameVi: 'Uốn tóc / Tạo xoăn',
            },
            {
                nameEn: 'Barbering (Beard/Mustache)',
                nameRu: 'Барберинг (борода/усы)',
                nameVi: 'Cắt râu / ria mép',
            },
            {
                nameEn: 'Keratin / Botox / Nanoplasty',
                nameRu: 'Кератин / ботокс / нанопластика',
                nameVi: 'Keratin / Botox / Nanoplasty',
            },
            {
                nameEn: "Children's Haircut",
                nameRu: 'Детская стрижка',
                nameVi: 'Cắt tóc trẻ em',
            },
        ],
        tags: [
            { nameEn: "men's", nameRu: 'мужская', nameVi: 'nam giới' },
            { nameEn: "women's", nameRu: 'женская', nameVi: 'nữ giới' },
            { nameEn: "children's", nameRu: 'детская', nameVi: 'trẻ em' },
            { nameEn: 'short hair', nameRu: 'короткие волосы', nameVi: 'tóc ngắn' },
            {
                nameEn: 'medium hair',
                nameRu: 'средние волосы',
                nameVi: 'tóc trung bình',
            },
            { nameEn: 'long hair', nameRu: 'длинные волосы', nameVi: 'tóc dài' },
            { nameEn: 'coloring', nameRu: 'окрашивание', nameVi: 'nhuộm màu' },
            { nameEn: 'blonde', nameRu: 'блонд', nameVi: 'tóc vàng' },
            { nameEn: 'balayage', nameRu: 'шатуш', nameVi: 'balayage' },
            { nameEn: 'ombre', nameRu: 'омбре', nameVi: 'ombre' },
            { nameEn: 'tone', nameRu: 'тон', nameVi: 'tông màu' },
            { nameEn: 'toning', nameRu: 'тонирование', nameVi: 'tông màu' },
            { nameEn: 'styling', nameRu: 'укладка', nameVi: 'tạo kiểu' },
            { nameEn: 'curls', nameRu: 'локоны', nameVi: 'xoăn' },
            { nameEn: 'straightening', nameRu: 'выпрямление', nameVi: 'duỗi tóc' },
            { nameEn: 'fade', nameRu: 'fade', nameVi: 'fade' },
            { nameEn: 'beard', nameRu: 'борода', nameVi: 'râu' },
            { nameEn: 'mustache', nameRu: 'усы', nameVi: 'ria mép' },
        ],
    };
    const category2 = {
        nameEn: 'Nails (Manicure / Pedicure)',
        nameVn: 'Làm móng (Manicure / Pedicure)',
        nameRu: 'Ногти (Маникюр / Педикюр)',
        subcategories: [
            {
                nameEn: 'Classic Manicure',
                nameRu: 'Маникюр классический',
                nameVi: 'Manicure cổ điển',
            },
            {
                nameEn: 'Hardware Manicure',
                nameRu: 'Маникюр аппаратный',
                nameVi: 'Manicure máy',
            },
            {
                nameEn: 'Combined Manicure',
                nameRu: 'Маникюр комбинированный',
                nameVi: 'Manicure kết hợp',
            },
            { nameEn: 'Pedicure', nameRu: 'Педикюр', nameVi: 'Pedicure' },
            {
                nameEn: 'Nail Design',
                nameRu: 'Дизайн ногтей',
                nameVi: 'Thiết kế móng',
            },
            {
                nameEn: 'Nail Strengthening',
                nameRu: 'Укрепление ногтей',
                nameVi: 'Củng cố móng',
            },
            {
                nameEn: 'Nail Extension',
                nameRu: 'Наращивание ногтей',
                nameVi: 'Nối móng',
            },
            {
                nameEn: 'Nail Polish Removal',
                nameRu: 'Снятие покрытия',
                nameVi: 'Gỡ sơn móng',
            },
        ],
        tags: [
            { nameEn: "women's", nameRu: 'женский', nameVi: 'nữ giới' },
            { nameEn: "men's", nameRu: 'мужской', nameVi: 'nam giới' },
            { nameEn: 'hardware', nameRu: 'аппаратный', nameVi: 'máy' },
            { nameEn: 'combined', nameRu: 'комбинированный', nameVi: 'kết hợp' },
            { nameEn: 'gel polish', nameRu: 'гель-лак', nameVi: 'gel polish' },
            { nameEn: 'strengthening', nameRu: 'укрепление', nameVi: 'củng cố' },
            { nameEn: 'extension', nameRu: 'наращивание', nameVi: 'nối móng' },
            { nameEn: 'french', nameRu: 'френч', nameVi: 'french' },
            { nameEn: 'design', nameRu: 'дизайн', nameVi: 'thiết kế' },
            { nameEn: 'ombre', nameRu: 'омбре', nameVi: 'ombre' },
            { nameEn: 'solid color', nameRu: 'однотонный', nameVi: 'màu đơn' },
        ],
    };
    const category3 = {
        nameEn: 'Eyebrows & Eyelashes',
        nameVn: 'Lông mày & Lông mi',
        nameRu: 'Брови и ресницы',
        subcategories: [
            {
                nameEn: 'Eyebrow Shaping',
                nameRu: 'Коррекция бровей',
                nameVi: 'Tạo dáng lông mày',
            },
            {
                nameEn: 'Eyebrow Coloring',
                nameRu: 'Окрашивание бровей',
                nameVi: 'Nhuộm lông mày',
            },
            {
                nameEn: 'Eyebrow Lamination',
                nameRu: 'Ламинирование бровей',
                nameVi: 'Lamin lông mày',
            },
            {
                nameEn: 'Eyelash Lamination',
                nameRu: 'Ламинирование ресниц',
                nameVi: 'Lamin lông mi',
            },
            {
                nameEn: 'Eyelash Extension',
                nameRu: 'Наращивание ресниц',
                nameVi: 'Nối lông mi',
            },
            {
                nameEn: 'Eyelash Removal',
                nameRu: 'Снятие ресниц',
                nameVi: 'Gỡ lông mi',
            },
        ],
        tags: [
            { nameEn: 'dye', nameRu: 'краска', nameVi: 'nhuộm' },
            { nameEn: 'henna', nameRu: 'хна', nameVi: 'henna' },
            {
                nameEn: 'long-lasting styling',
                nameRu: 'долговременная укладка',
                nameVi: 'tạo kiểu lâu dài',
            },
            { nameEn: 'lamination', nameRu: 'ламинирование', nameVi: 'lamin' },
            { nameEn: '2D', nameRu: '2D', nameVi: '2D' },
            { nameEn: '3D', nameRu: '3D', nameVi: '3D' },
            { nameEn: 'classic', nameRu: 'классика', nameVi: 'cổ điển' },
            { nameEn: 'volume', nameRu: 'объем', nameVi: 'độ dày' },
            {
                nameEn: 'natural effect',
                nameRu: 'естественный эффект',
                nameVi: 'hiệu ứng tự nhiên',
            },
            { nameEn: 'thick', nameRu: 'густые', nameVi: 'dày' },
            { nameEn: 'shaping', nameRu: 'коррекция', nameVi: 'tạo dáng' },
        ],
    };
    const category4 = {
        nameEn: 'Cosmetology',
        nameVn: 'Thẩm mỹ',
        nameRu: 'Косметология',
        subcategories: [
            {
                nameEn: 'Facial Cleansing',
                nameRu: 'Чистка лица',
                nameVi: 'Làm sạch da mặt',
            },
            { nameEn: 'Peeling', nameRu: 'Пилинг', nameVi: 'Tẩy da chết' },
            {
                nameEn: 'Facial Massage',
                nameRu: 'Массаж лица',
                nameVi: 'Massage mặt',
            },
            {
                nameEn: 'Laser Hair Removal',
                nameRu: 'Лазерная эпиляция',
                nameVi: 'Triệt lông laser',
            },
            {
                nameEn: 'Photoepilation',
                nameRu: 'Фотоэпиляция',
                nameVi: 'Triệt lông ánh sáng',
            },
            {
                nameEn: 'Facial Treatments',
                nameRu: 'Уходовые процедуры',
                nameVi: 'Chăm sóc da mặt',
            },
            { nameEn: 'RF Lifting', nameRu: 'RF-лифтинг', nameVi: 'RF lifting' },
            { nameEn: 'Microcurrents', nameRu: 'Микротоки', nameVi: 'Dòng điện nhỏ' },
            { nameEn: 'Darsonval', nameRu: 'Дарсонваль', nameVi: 'Darsonval' },
        ],
        tags: [
            {
                nameEn: 'deep cleansing',
                nameRu: 'глубокая чистка',
                nameVi: 'làm sạch sâu',
            },
            {
                nameEn: 'ultrasonic cleansing',
                nameRu: 'ультразвуковая чистка',
                nameVi: 'làm sạch siêu âm',
            },
            { nameEn: 'acne', nameRu: 'акне', nameVi: 'mụn' },
            { nameEn: 'anti-aging', nameRu: 'анти-эйдж', nameVi: 'chống lão hóa' },
            { nameEn: 'rejuvenation', nameRu: 'омоложение', nameVi: 'trẻ hóa' },
            { nameEn: 'moisturizing', nameRu: 'увлажнение', nameVi: 'dưỡng ẩm' },
            {
                nameEn: 'problem skin',
                nameRu: 'проблемная кожа',
                nameVi: 'da có vấn đề',
            },
            {
                nameEn: 'sensitive skin',
                nameRu: 'чувствительная кожа',
                nameVi: 'da nhạy cảm',
            },
            { nameEn: 'laser', nameRu: 'лазер', nameVi: 'laser' },
            { nameEn: 'photo', nameRu: 'фото', nameVi: 'ánh sáng' },
            { nameEn: 'RF', nameRu: 'RF', nameVi: 'RF' },
            { nameEn: 'massage', nameRu: 'массаж', nameVi: 'massage' },
        ],
    };
    const category5 = {
        nameEn: 'Massage',
        nameVn: 'Massage',
        nameRu: 'Массаж',
        subcategories: [
            {
                nameEn: 'Classic Massage',
                nameRu: 'Классический массаж',
                nameVi: 'Massage cổ điển',
            },
            {
                nameEn: 'Relaxation Massage',
                nameRu: 'Релаксационный',
                nameVi: 'Massage thư giãn',
            },
            {
                nameEn: 'Sports Massage',
                nameRu: 'Спортивный',
                nameVi: 'Massage thể thao',
            },
            {
                nameEn: 'Lymphatic Drainage',
                nameRu: 'Лимфодренажный',
                nameVi: 'Massage dẫn lưu bạch huyết',
            },
            {
                nameEn: 'Anti-cellulite Massage',
                nameRu: 'Антицеллюлитный',
                nameVi: 'Massage chống cellulite',
            },
            {
                nameEn: 'Back Massage',
                nameRu: 'Массаж спины',
                nameVi: 'Massage lưng',
            },
            {
                nameEn: 'Neck & Shoulder Massage',
                nameRu: 'Массаж шейно-воротниковой зоны',
                nameVi: 'Massage cổ vai',
            },
            {
                nameEn: 'Full Body Massage',
                nameRu: 'Массаж всего тела',
                nameVi: 'Massage toàn thân',
            },
            {
                nameEn: 'Thai Massage',
                nameRu: 'Тайский массаж',
                nameVi: 'Massage Thái',
            },
            {
                nameEn: 'Deep Tissue Massage',
                nameRu: 'Глубокий тканевый',
                nameVi: 'Massage mô sâu',
            },
        ],
        tags: [
            { nameEn: 'relaxing', nameRu: 'расслабляющий', nameVi: 'thư giãn' },
            { nameEn: 'therapeutic', nameRu: 'лечебный', nameVi: 'điều trị' },
            { nameEn: 'back', nameRu: 'для спины', nameVi: 'lưng' },
            {
                nameEn: 'anti-cellulite',
                nameRu: 'антицеллюлитный',
                nameVi: 'chống cellulite',
            },
            {
                nameEn: 'lymphatic drainage',
                nameRu: 'лимфодренаж',
                nameVi: 'dẫn lưu bạch huyết',
            },
            { nameEn: 'sports', nameRu: 'спортивный', nameVi: 'thể thao' },
            { nameEn: 'deep tissue', nameRu: 'глубокие ткани', nameVi: 'mô sâu' },
            { nameEn: 'acupressure', nameRu: 'точечный', nameVi: 'bấm huyệt' },
            { nameEn: 'full body', nameRu: 'общий', nameVi: 'toàn thân' },
            { nameEn: 'local', nameRu: 'локальный', nameVi: 'cục bộ' },
        ],
    };
    const categories = [category1, category2, category3, category4, category5];
    console.log('\n📦 Creating categories, subcategories and tags...\n');
    for (const categoryData of categories) {
        try {
            const category = await prisma.service_categories.upsert({
                where: { name_en: categoryData.nameEn },
                update: {
                    name_vn: categoryData.nameVn,
                    name_ru: categoryData.nameRu,
                },
                create: {
                    name_en: categoryData.nameEn,
                    name_vn: categoryData.nameVn,
                    name_ru: categoryData.nameRu,
                },
            });
            console.log(`✅ ${categoryData.nameEn} / ${categoryData.nameVn} / ${categoryData.nameRu}`);
        }
        catch (error) {
            console.error(`❌ Error with category ${categoryData.nameEn}:`, error.message);
        }
    }
    const totalCategories = await prisma.service_categories.count();
    console.log('\n✅ Seeding completed!');
    console.log(`📊 Total: ${totalCategories} categories`);
}
main()
    .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-categories.js.map
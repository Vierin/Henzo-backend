const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error(
    'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminProperly() {
  try {
    console.log('🔧 Creating admin account properly...');

    const adminEmail = 'ivanvierin@gmail.com';
    const adminPassword = '123123';
    const adminName = 'Ivan Vierin';
    const adminPhone = '536560643';

    // 1. Сначала создаем пользователя в Supabase Auth
    console.log('📧 Creating user in Supabase Auth...');

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true, // Подтверждаем email сразу
        user_metadata: {
          name: adminName,
          phone: adminPhone,
          role: 'ADMIN',
        },
      });

    if (authError) {
      console.error(
        '❌ Failed to create user in Supabase Auth:',
        authError.message,
      );
      return;
    }

    console.log('✅ User created in Supabase Auth:', authUser.user.id);

    // 2. Создаем пользователя в нашей базе данных
    console.log('💾 Creating user in database...');

    const dbUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        role: 'ADMIN',
        name: adminName,
        phone: adminPhone,
      },
      create: {
        id: authUser.user.id,
        email: adminEmail,
        name: adminName,
        phone: adminPhone,
        role: 'ADMIN',
      },
    });

    console.log('✅ User created/updated in database:', dbUser.id);

    // 3. Проверяем результат
    console.log('\n📊 Admin account created successfully:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Name: ${adminName}`);
    console.log(`   Phone: ${adminPhone}`);
    console.log(`   Role: ADMIN`);
    console.log(`   Supabase ID: ${authUser.user.id}`);
    console.log(`   Database ID: ${dbUser.id}`);

    // 4. Проверяем, что пользователь может войти
    console.log('\n🔍 Testing login...');

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

    if (loginError) {
      console.error('❌ Login test failed:', loginError.message);
    } else {
      console.log('✅ Login test successful!');
      console.log(
        `   Session ID: ${loginData.session?.access_token?.substring(0, 20)}...`,
      );
    }

    console.log('\n🎉 Admin account is ready!');
    console.log('You can now login with:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем создание админ аккаунта
createAdminProperly();

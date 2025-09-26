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

async function fixAdminRole() {
  try {
    console.log('🔧 Fixing admin user role...');

    // Находим админ пользователя в базе данных
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: 'ivanvierin@gmail.com' }, { email: 'admin@henzo.com' }],
      },
    });

    if (!dbUser) {
      console.log('❌ Admin user not found in database');
      return;
    }

    console.log(`📧 Found admin user: ${dbUser.email} (${dbUser.id})`);
    console.log(`🔑 Current role in database: ${dbUser.role}`);

    // Обновляем метаданные в Supabase Auth
    const { data, error } = await supabase.auth.admin.updateUserById(
      dbUser.id,
      {
        user_metadata: {
          name: dbUser.name,
          phone: dbUser.phone,
          role: dbUser.role, // Устанавливаем правильную роль
        },
      },
    );

    if (error) {
      console.error('❌ Failed to update user metadata:', error.message);
      return;
    }

    console.log('✅ Successfully updated user metadata in Supabase Auth');
    console.log(`🔑 Role set to: ${dbUser.role}`);

    // Проверяем обновление
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.admin.getUserById(dbUser.id);

    if (getUserError) {
      console.error('❌ Failed to verify update:', getUserError.message);
      return;
    }

    console.log('\n📊 Verification:');
    console.log(`   Email: ${user.email}`);
    console.log(
      `   Role in metadata: ${user.user_metadata?.role || 'Not set'}`,
    );
    console.log(`   Name: ${user.user_metadata?.name || 'Not set'}`);
    console.log(`   Phone: ${user.user_metadata?.phone || 'Not set'}`);

    console.log(
      '\n🎉 Admin user role fixed! You can now try logging in again.',
    );
  } catch (error) {
    console.error('❌ Error fixing admin role:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем исправление
fixAdminRole();

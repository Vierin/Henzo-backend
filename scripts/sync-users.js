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

async function syncUsersFromSupabase() {
  try {
    console.log('🔄 Starting user synchronization from Supabase Auth...');

    // Получаем всех пользователей из Supabase Auth
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      throw new Error(`Failed to fetch users from Supabase: ${error.message}`);
    }

    console.log(`📊 Found ${users.length} users in Supabase Auth`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Проверяем, существует ли пользователь в нашей базе данных
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (existingUser) {
          console.log(`⏭️  User already exists: ${user.email} (${user.id})`);
          skippedCount++;
          continue;
        }

        // Определяем роль из метаданных пользователя
        const userRole = user.user_metadata?.role || 'CLIENT';

        // Создаем пользователя в нашей базе данных
        const newUser = await prisma.user.create({
          data: {
            id: user.id,
            email: user.email || '',
            name:
              user.user_metadata?.name || user.user_metadata?.full_name || null,
            phone: user.user_metadata?.phone || null,
            role: userRole,
          },
        });

        console.log(`✅ Created user: ${newUser.email} (${newUser.id})`);
        syncedCount++;

        // Если это админ email, обновляем роль
        if (
          user.email === 'ivanvierin@gmail.com' ||
          user.email === 'admin@henzo.com'
        ) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          });
          console.log(`🔑 Updated role to ADMIN for: ${user.email}`);
        }
      } catch (userError) {
        console.error(
          `❌ Failed to sync user ${user.email}:`,
          userError.message,
        );
        errorCount++;
      }
    }

    console.log('\n📈 Synchronization Summary:');
    console.log(`✅ Synced: ${syncedCount} users`);
    console.log(`⏭️  Skipped: ${skippedCount} users (already exist)`);
    console.log(`❌ Errors: ${errorCount} users`);

    if (errorCount === 0) {
      console.log('\n🎉 All users synchronized successfully!');
    } else {
      console.log(
        `\n⚠️  ${errorCount} users failed to sync. Check the errors above.`,
      );
    }
  } catch (error) {
    console.error('❌ Synchronization failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем синхронизацию
syncUsersFromSupabase();

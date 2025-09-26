const { createClient } = require('@supabase/supabase-js');

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

async function resetAdminPassword() {
  try {
    console.log('🔧 Resetting admin password...');

    // Находим админ пользователя
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers();

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    const adminUser = users.find(
      (user) =>
        user.email === 'ivanvierin@gmail.com' ||
        user.email === 'admin@henzo.com',
    );

    if (!adminUser) {
      console.log('❌ Admin user not found in Supabase Auth');
      return;
    }

    console.log(`📧 Found admin user: ${adminUser.email} (${adminUser.id})`);

    // Устанавливаем новый пароль
    const newPassword = 'admin123'; // Простой пароль для тестирования

    const { data, error: updateError } =
      await supabase.auth.admin.updateUserById(adminUser.id, {
        password: newPassword,
      });

    if (updateError) {
      console.error('❌ Failed to update password:', updateError.message);
      return;
    }

    console.log('✅ Successfully updated admin password');
    console.log(`🔑 New password: ${newPassword}`);
    console.log('\n📝 You can now login with:');
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('\n⚠️  Remember to change this password after first login!');
  } catch (error) {
    console.error('❌ Error resetting admin password:', error.message);
  }
}

// Запускаем сброс пароля
resetAdminPassword();

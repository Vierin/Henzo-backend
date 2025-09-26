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

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user status...');

    // Проверяем в нашей базе данных
    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: 'ivanvierin@gmail.com' }, { email: 'admin@henzo.com' }],
      },
    });

    if (dbUser) {
      console.log('✅ Admin user found in database:');
      console.log(`   Email: ${dbUser.email}`);
      console.log(`   ID: ${dbUser.id}`);
      console.log(`   Role: ${dbUser.role}`);
      console.log(`   Name: ${dbUser.name || 'Not set'}`);
    } else {
      console.log('❌ Admin user not found in database');
    }

    // Проверяем в Supabase Auth
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

    if (adminUser) {
      console.log('\n✅ Admin user found in Supabase Auth:');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   ID: ${adminUser.id}`);
      console.log(
        `   Email Confirmed: ${adminUser.email_confirmed_at ? 'Yes' : 'No'}`,
      );
      console.log(`   Created: ${adminUser.created_at}`);
      console.log(`   Last Sign In: ${adminUser.last_sign_in_at || 'Never'}`);
      console.log(
        `   Role in metadata: ${adminUser.user_metadata?.role || 'Not set'}`,
      );

      if (!adminUser.email_confirmed_at) {
        console.log('\n⚠️  Email is not confirmed! This might be the issue.');
        console.log(
          '   The user needs to click the confirmation link in their email.',
        );
      }

      if (!adminUser.last_sign_in_at) {
        console.log('\n⚠️  User has never signed in!');
        console.log(
          '   Make sure the password is set correctly in Supabase Auth dashboard.',
        );
      }
    } else {
      console.log('\n❌ Admin user not found in Supabase Auth');
      console.log(
        '   You need to create the user in Supabase Auth dashboard first.',
      );
    }

    console.log('\n📝 Next steps:');
    console.log('1. Go to Supabase Auth dashboard');
    console.log('2. Check if the admin user exists and is confirmed');
    console.log('3. If not confirmed, resend confirmation email');
    console.log('4. If password is not set, set it in the Auth dashboard');
    console.log('5. Make sure the user is not blocked');
  } catch (error) {
    console.error('❌ Error checking admin user:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем проверку
checkAdminUser();

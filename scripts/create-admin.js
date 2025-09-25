const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email);
      return;
    }

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@henzo.com',
        name: 'Henzo Admin',
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin user created successfully:');
    console.log('📧 Email:', admin.email);
    console.log('👤 Name:', admin.name);
    console.log('🔑 Role:', admin.role);
    console.log('🆔 ID:', admin.id);

    console.log('\n📝 Next steps:');
    console.log(
      '1. Go to Supabase Auth and create a user with email: admin@henzo.com',
    );
    console.log('2. Set the password for the admin account');
    console.log('3. The user will be automatically linked via email');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();

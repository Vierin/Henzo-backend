const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testReminders() {
  try {
    console.log('🧪 Testing reminder system...');

    // Test the reminder endpoint
    const response = await fetch('http://localhost:3001/reminders/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log('📧 Test result:', result);

    if (result.success) {
      console.log('✅ Reminder system is working correctly!');
    } else {
      console.log('❌ Reminder system has issues:', result.message);
    }
  } catch (error) {
    console.error('❌ Error testing reminders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testReminders();

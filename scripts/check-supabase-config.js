const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSupabaseConfig() {
  try {
    console.log('🔍 Checking Supabase configuration...');
    console.log(`📡 Supabase URL: ${supabaseUrl}`);

    // Проверяем настройки проекта
    const { data: project, error: projectError } = await supabase
      .from('_supabase_config')
      .select('*')
      .limit(1);

    if (projectError) {
      console.log('⚠️  Could not fetch project config (this is normal)');
    }

    console.log('\n📝 Current configuration issues and solutions:');
    console.log('\n1. 🔗 Site URL Configuration:');
    console.log('   Go to Supabase Dashboard > Authentication > URL Configuration');
    console.log('   Set Site URL to: http://localhost:3000 (for development)');
    console.log('   Or your production domain for production');
    
    console.log('\n2. 🔄 Redirect URLs:');
    console.log('   Add these redirect URLs in Supabase Dashboard > Authentication > URL Configuration:');
    console.log('   - http://localhost:3000/reset-password');
    console.log('   - http://localhost:3000/auth/callback');
    console.log('   - https://yourdomain.com/reset-password (for production)');
    console.log('   - https://yourdomain.com/auth/callback (for production)');

    console.log('\n3. 📧 Email Templates:');
    console.log('   Go to Supabase Dashboard > Authentication > Email Templates');
    console.log('   Check "Reset Password" template');
    console.log('   Make sure the redirect URL is: {{ .SiteURL }}/reset-password');

    console.log('\n4. 🛠️  Manual Fix for Reset Password:');
    console.log('   The issue is likely in the email template configuration.');
    console.log('   The template should use: {{ .SiteURL }}/reset-password');
    console.log('   Not just: /reset-password');

    console.log('\n5. 🔧 Alternative: Use custom email template');
    console.log('   You can create a custom email template with proper URL handling.');

    // Проверяем текущие настройки Auth
    console.log('\n📊 Current Auth Settings:');
    console.log('   (These need to be configured in Supabase Dashboard)');
    console.log('   - Site URL: Should be set to your frontend URL');
    console.log('   - Redirect URLs: Should include /reset-password and /auth/callback');
    console.log('   - Email Templates: Should use {{ .SiteURL }} for proper URL generation');

  } catch (error) {
    console.error('❌ Error checking Supabase config:', error.message);
  }
}

// Запускаем проверку
checkSupabaseConfig();

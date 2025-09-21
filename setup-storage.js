const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  try {
    console.log('Setting up Supabase Storage...');

    // Create salon-files bucket if it doesn't exist
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      throw listError;
    }

    const salonFilesBucket = buckets.find(
      (bucket) => bucket.name === 'salon-files',
    );

    if (!salonFilesBucket) {
      console.log('Creating salon-files bucket...');
      const { data, error } = await supabase.storage.createBucket(
        'salon-files',
        {
          public: true,
          fileSizeLimit: 2097152, // 2MB
          allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
          ],
        },
      );

      if (error) {
        throw error;
      }

      console.log('✅ salon-files bucket created successfully');
    } else {
      console.log('✅ salon-files bucket already exists');
    }

    // Set up RLS policies
    console.log('Setting up RLS policies...');

    // Allow authenticated users to upload files
    const { error: uploadPolicyError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO storage.policies (name, bucket_id, definition, check_expression)
        VALUES (
          'Allow authenticated users to upload salon files',
          'salon-files',
          'auth.role() = ''authenticated''',
          'auth.role() = ''authenticated'''
        )
        ON CONFLICT (name) DO NOTHING;
      `,
    });

    if (
      uploadPolicyError &&
      !uploadPolicyError.message.includes('already exists')
    ) {
      console.warn('Warning setting upload policy:', uploadPolicyError.message);
    }

    // Allow public access to read files
    const { error: readPolicyError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO storage.policies (name, bucket_id, definition, check_expression)
        VALUES (
          'Allow public access to read salon files',
          'salon-files',
          'true',
          'true'
        )
        ON CONFLICT (name) DO NOTHING;
      `,
    });

    if (
      readPolicyError &&
      !readPolicyError.message.includes('already exists')
    ) {
      console.warn('Warning setting read policy:', readPolicyError.message);
    }

    console.log('✅ Storage setup completed successfully');
  } catch (error) {
    console.error('❌ Error setting up storage:', error);
    process.exit(1);
  }
}

setupStorage();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStoragePolicies() {
  try {
    console.log('Checking Supabase Storage policies...');

    // Check if salon-files bucket exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      throw listError;
    }

    const salonFilesBucket = buckets.find(
      (bucket) => bucket.name === 'salon-files',
    );

    if (salonFilesBucket) {
      console.log('✅ salon-files bucket exists');
      console.log('Bucket details:', {
        name: salonFilesBucket.name,
        public: salonFilesBucket.public,
        fileSizeLimit: salonFilesBucket.file_size_limit,
        allowedMimeTypes: salonFilesBucket.allowed_mime_types,
      });
    } else {
      console.log('❌ salon-files bucket does not exist');
    }

    // Try to check RLS status
    try {
      const { data, error } = await supabase.rpc('exec', {
        sql: `
          SELECT schemaname, tablename, rowsecurity 
          FROM pg_tables 
          WHERE tablename = 'objects' AND schemaname = 'storage';
        `,
      });

      if (data && data.length > 0) {
        console.log('RLS Status:', data[0]);
      }
    } catch (e) {
      console.log('Could not check RLS status via RPC');
    }

    // Try to check existing policies
    try {
      const { data, error } = await supabase.rpc('exec', {
        sql: `
          SELECT policyname, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'objects' AND schemaname = 'storage';
        `,
      });

      if (data && data.length > 0) {
        console.log('Existing policies:', data);
      } else {
        console.log('No policies found for storage.objects');
      }
    } catch (e) {
      console.log('Could not check policies via RPC');
    }
  } catch (error) {
    console.error('❌ Error checking storage:', error);
  }
}

checkStoragePolicies();

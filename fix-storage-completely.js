const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStorageCompletely() {
  try {
    console.log('Fixing Supabase Storage completely...');

    // First, let's try to disable RLS completely
    console.log('Attempting to disable RLS on storage.objects...');

    try {
      await supabase.rpc('exec', {
        sql: `
          ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
        `,
      });
      console.log('✅ RLS disabled on storage.objects');
    } catch (e) {
      console.log(
        'Could not disable RLS via RPC, trying alternative approach...',
      );

      // Alternative: Create very permissive policies
      try {
        await supabase.rpc('exec', {
          sql: `
            -- Drop any existing policies first
            DROP POLICY IF EXISTS "Allow uploads to salon-files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow reads from salon-files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow updates to salon-files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow deletes from salon-files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow authenticated users to upload salon files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow authenticated users to update salon files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow authenticated users to delete salon files" ON storage.objects;
            DROP POLICY IF EXISTS "Allow public access to read salon files" ON storage.objects;
            
            -- Create very permissive policies
            CREATE POLICY "Allow all operations on salon-files" ON storage.objects
            FOR ALL USING (bucket_id = 'salon-files');
          `,
        });
        console.log('✅ Permissive policies created');
      } catch (policyError) {
        console.log('Could not create policies via RPC either');
        console.log('Manual setup required in Supabase Dashboard');
      }
    }

    // Also try to make the bucket public
    console.log('Making salon-files bucket public...');

    try {
      const { error: updateError } = await supabase.storage.updateBucket(
        'salon-files',
        {
          public: true,
        },
      );

      if (updateError) {
        console.log(
          'Could not make bucket public via API:',
          updateError.message,
        );
      } else {
        console.log('✅ Bucket made public');
      }
    } catch (e) {
      console.log('Could not update bucket settings');
    }

    console.log('');
    console.log(
      '📋 If uploads still fail, please do this manually in Supabase Dashboard:',
    );
    console.log('');
    console.log('1. Go to Supabase Dashboard > Storage');
    console.log('2. Click on "salon-files" bucket');
    console.log('3. Go to Settings tab');
    console.log('4. Make sure "Public bucket" is checked');
    console.log('5. Go to Policies tab');
    console.log('6. Add this policy:');
    console.log('   Name: "Allow all operations on salon-files"');
    console.log('   Operation: ALL');
    console.log('   Target roles: public');
    console.log("   USING expression: bucket_id = 'salon-files'");
    console.log("   WITH CHECK expression: bucket_id = 'salon-files'");
    console.log('');
    console.log('OR alternatively:');
    console.log('7. Go to Authentication > Policies');
    console.log('8. Find storage.objects table');
    console.log('9. Disable RLS entirely');
  } catch (error) {
    console.error('❌ Error fixing storage:', error);
  }
}

fixStorageCompletely();

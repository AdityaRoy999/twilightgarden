
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpload() {
  console.log("Testing upload to Supabase Storage...");
  const { data, error } = await supabase.storage
    .from('app-updates')
    .upload('test_diagnostic.txt', 'This is a test upload from diagnostic script.', {
      upsert: true
    });

  if (error) {
    console.error("Diagnostic Upload Failed:", error);
    if (error.originalError) {
      console.error("Original Error:", error.originalError);
    }
  } else {
    console.log("Diagnostic Upload Successful:", data);
  }
}

testUpload();

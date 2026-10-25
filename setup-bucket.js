import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Checking buckets...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing:", listError);
    return;
  }

  const exists = buckets.find(b => b.name === 'app-updates');
  if (exists) {
    console.log("Bucket 'app-updates' already exists.");
  } else {
    console.log("Creating bucket 'app-updates'...");
    const { data, error } = await supabase.storage.createBucket('app-updates', { public: true });
    if (error) console.error("Error creating bucket:", error);
    else console.log("Success:", data);
  }
}
main();

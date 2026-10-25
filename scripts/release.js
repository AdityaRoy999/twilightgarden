import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase URL or Service Role Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const gradlePath = path.resolve(__dirname, '../android/app/build.gradle');
const changelogPath = path.resolve(__dirname, '../changelog.md');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runRelease() {
  console.log("🚀 Starting Automatic Release Process...");

  // 1. Read build.gradle
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');

  // 2. Extract and bump versionCode
  const versionCodeMatches = gradleContent.match(/versionCode\s+(\d+)/);
  if (!versionCodeMatches) {
    console.error("❌ Could not find versionCode in build.gradle");
    process.exit(1);
  }

  const currentVersionCode = parseInt(versionCodeMatches[1], 10);
  const newVersionCode = currentVersionCode + 1;
  const autoVersionName = `1.0.${newVersionCode}`;

  // INTERACTIVE SECTION
  console.log(`\n--- Release Configuration ---`);
  const inputVersionName = await ask(`Version Name [${autoVersionName}]: `);
  const newVersionName = inputVersionName || autoVersionName;

  console.log(`\nEnter Changelogs (Type changes. Press Enter twice when done):`);
  let changelogEntries = [];
  while (true) {
    const line = await ask("> ");
    if (!line) break;
    changelogEntries.push(line);
  }
  const fullChangelog = changelogEntries.map(e => `• ${e}`).join('\n');

  rl.close();

  if (changelogEntries.length === 0) {
    console.log("⚠️ No changelog entries provided.");
  }

  console.log(`\n⬆️ Bumping version from ${currentVersionCode} to ${newVersionCode} (${newVersionName})...\n`);

  // Replace version codes in gradle
  gradleContent = gradleContent.replace(/versionCode\s+(\d+)/, `versionCode ${newVersionCode}`);
  gradleContent = gradleContent.replace(/versionName\s+"([^"]+)"/, `versionName "${newVersionName}"`);

  fs.writeFileSync(gradlePath, gradleContent, 'utf8');

  // 4. Update changelog.md
  const dateStr = new Date().toLocaleDateString();
  const mdEntry = `\n## [${newVersionName}] - ${dateStr}\n${fullChangelog || '• General improvements and bug fixes.'}\n`;

  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, `# Changelog\n\nAll notable changes to Twilight Garden will be documented in this file.\n${mdEntry}`, 'utf8');
  } else {
    const existingContent = fs.readFileSync(changelogPath, 'utf8');
    // Insert new entry after the main header
    const updatedContent = existingContent.replace('# Changelog\n', `# Changelog\n${mdEntry}`);
    fs.writeFileSync(changelogPath, updatedContent, 'utf8');
  }

  // 3. Build Web App & Sync to Android
  console.log("🛠️ Building Vite project and syncing to Capacitor...");
  try {
    execSync('npm run build', { stdio: 'inherit' });
    execSync('npx cap sync android', { stdio: 'inherit' });
  } catch (e) {
    console.error("❌ Failed to build or sync web project", e);
    process.exit(1);
  }

  // 4. Build APK using Gradle
  console.log("📦 Compiling Android APK...");
  const androidDir = path.resolve(__dirname, '../android');
  try {
    const buildEnv = { ...process.env };

    if (process.platform === 'win32') {
      // Use Android Studio's bundled JRE if JAVA_HOME isn't already perfectly configured for Gradle
      const asJbrPath = 'C:\\Program Files\\Android\\Android Studio\\jbr';
      if (fs.existsSync(asJbrPath)) {
        buildEnv.JAVA_HOME = asJbrPath;
      }

      execSync(`powershell.exe -Command ".\\gradlew.bat assembleDebug"`, {
        cwd: androidDir,
        stdio: 'inherit',
        env: buildEnv
      });
    } else {
      execSync(`./gradlew assembleDebug`, {
        cwd: androidDir,
        stdio: 'inherit',
        env: buildEnv
      });
    }
  } catch (e) {
    console.error("❌ Gradle APK build failed!", e);
    process.exit(1);
  }

  const apkFilename = 'twilight-debug.apk';
  const apkFilePath = path.resolve(androidDir, `app/build/outputs/apk/debug/${apkFilename}`);

  if (!fs.existsSync(apkFilePath)) {
    console.error("❌ APK file not found at expected path:", apkFilePath);
    process.exit(1);
  }

  // 5. Upload to Supabase Storage
  console.log("☁️ Uploading APK to Supabase Storage...");
  const fileBuffer = fs.readFileSync(apkFilePath);
  const storagePath = `updates/twilight-v${newVersionCode}.apk`;

  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('app-updates')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/vnd.android.package-archive',
      upsert: true
    });

  if (uploadError) {
    console.error("❌ Supabase upload failed:", uploadError);
    process.exit(1);
  }

  // 6. Get public URL
  const { data: publicUrlData } = supabase
    .storage
    .from('app-updates')
    .getPublicUrl(storagePath);

  const apk_url = publicUrlData.publicUrl;
  console.log(`✅ Upload successful: ${apk_url}`);

  // 7. Insert Row into app_updates table
  console.log("📝 Registering update in database...");
  const { error: dbError } = await supabase
    .from('app_updates')
    .insert([{
      version_code: newVersionCode,
      version_name: newVersionName,
      apk_url: apk_url,
      changelog: fullChangelog || 'General improvements and bug fixes.',
      force_update: false,
      message: `Automatic release build v${newVersionName}`
    }]);

  if (dbError) {
    console.error("❌ Failed to insert DB record:", dbError);
    process.exit(1);
  }

  // 8. Cleanup old versions
  console.log("🧹 Cleaning up old APK versions...");
  const { data: oldUpdates, error: fetchError } = await supabase
    .from('app_updates')
    .select('id, version_code')
    .lt('version_code', newVersionCode);

  if (fetchError) {
    console.error("⚠️ Failed to fetch old updates for cleanup:", fetchError);
  } else if (oldUpdates && oldUpdates.length > 0) {
    // Delete files from storage
    const filesToDelete = oldUpdates.map(update => `updates/twilight-v${update.version_code}.apk`);
    const { error: stError } = await supabase.storage.from('app-updates').remove(filesToDelete);

    if (stError) {
      console.error("⚠️ Error deleting old APKs from storage:", stError);
    } else {
      console.log(`✅ Deleted ${filesToDelete.length} old APK file(s) from storage.`);
    }

    // Delete rows from DB
    const idsToDelete = oldUpdates.map(u => u.id);
    const { error: dbDelError } = await supabase.from('app_updates').delete().in('id', idsToDelete);

    if (dbDelError) {
      console.error("⚠️ Error deleting old DB records:", dbDelError);
    } else {
      console.log(`✅ Deleted ${idsToDelete.length} old DB record(s).`);
    }
  } else {
    console.log("✨ No old updates found to clean up.");
  }

  console.log(`🎉 Success! Version ${newVersionName} is now live & will hit user devices automatically!`);
}

runRelease();

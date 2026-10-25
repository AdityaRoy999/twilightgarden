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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options = {}) => {
      // 5 minute timeout for large installer uploads
      return fetch(url, { ...options, signal: AbortSignal.timeout(300_000) });
    }
  }
});

const packageJsonPath = path.resolve(__dirname, '../package.json');
const tauriConfPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json');
const cargoTomlPath = path.resolve(__dirname, '../src-tauri/Cargo.toml');
const changelogPath = path.resolve(__dirname, '../changelog.md');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runDesktopRelease() {
  console.log("🚀 Starting Automatic Desktop Release Process (Tauri)...");

  // Require signing password
  let signingPassword = await ask("Enter Tauri Signing Password for twilight.key: ");
  signingPassword = signingPassword ? signingPassword.trim() : "";

  if (!signingPassword) {
    console.error("❌ A signing password is required to build the Tauri updater!");
    process.exit(1);
  }

  const privateKeyPath = path.resolve(__dirname, '../twilight.key');
  if (!fs.existsSync(privateKeyPath)) {
     console.error(`❌ Private key not found at ${privateKeyPath}`);
     process.exit(1);
  }
  const privateKeyContent = fs.readFileSync(privateKeyPath, 'utf8').trim();

  // Set environment variables directly for execSync
  const buildEnv = {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: privateKeyContent,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: signingPassword
  };

  // 1. Read current version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version || '0.1.0';

  console.log(`\n--- Release Configuration ---`);
  console.log(`Current Version: ${currentVersion}`);

  const versionParts = currentVersion.split('.');
  const nextPatch = `${versionParts[0]}.${versionParts[1]}.${parseInt(versionParts[2]) + 1}`;

  const inputVersion = await ask(`New Version [${nextPatch}]: `);
  const newVersion = inputVersion || nextPatch;

  console.log(`\nEnter Changelogs (Type changes. Press Enter twice when done):`);
  let changelogEntries = [];
  while (true) {
    const line = await ask("> ");
    if (!line) break;
    changelogEntries.push(line);
  }
  const fullChangelog = changelogEntries.map(e => `• ${e}`).join('\n');
  const releaseNotes = fullChangelog || 'General improvements and bug fixes.';

  rl.close();

  // 2. Bump versions across files
  console.log(`\n⬆️ Bumping version from ${currentVersion} to ${newVersion}...`);

  // package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // tauri.conf.json
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

  // Cargo.toml
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);

  // changelog.md
  const dateStr = new Date().toLocaleDateString();
  const mdEntry = `\n## Desktop [${newVersion}] - ${dateStr}\n${releaseNotes}\n`;
  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, `# Changelog\n\nAll notable changes to Twilight Garden will be documented in this file.\n${mdEntry}`, 'utf8');
  } else {
    const existingContent = fs.readFileSync(changelogPath, 'utf8');
    const updatedContent = existingContent.replace('# Changelog\n', `# Changelog\n${mdEntry}`);
    fs.writeFileSync(changelogPath, updatedContent, 'utf8');
  }

  // 3. Build Web App & Tauri App
  console.log("🛠️ Building Vite project and Compiling Tauri App...");
  try {
    execSync('npm run build', { stdio: 'inherit' });
    execSync('npm run tauri build', { stdio: 'inherit', env: buildEnv });
  } catch (e) {
    console.error("❌ Failed to build Tauri project", e);
    process.exit(1);
  }

  // 4. Locate Build output (NSIS or MSI updater .zip and .sig)
  // Tauri v2 places the updater zip inside the specific bundle folder, e.g., bundle/nsis or bundle/msi
  const bundleBaseDir = path.resolve(__dirname, '../src-tauri/target/release/bundle');

  function findUpdaterFiles(dir) {
    let installerPath = null;
    let sigPath = null;

    if (!fs.existsSync(dir)) return { installerPath, sigPath };

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findUpdaterFiles(fullPath);
        if (found.installerPath) installerPath = found.installerPath;
        if (found.sigPath) sigPath = found.sigPath;
      } else {
        // Only match files for the CURRENT version being built
        if (!entry.name.includes(newVersion)) continue;

        // Tauri v2 on Windows packages .exe and signs it directly as .exe.sig
        if (fullPath.endsWith('-setup.exe') || fullPath.endsWith('.msi')) {
           if (!fullPath.endsWith('.sig')) {
              installerPath = fullPath;
           }
        }
        if (fullPath.endsWith('.exe.sig') || fullPath.endsWith('.msi.sig')) {
          sigPath = fullPath;
          if (fullPath.endsWith('.exe.sig')) {
             installerPath = fullPath.replace('.sig', '');
          }
        }
      }
    }
    return { installerPath, sigPath };
  }

  const { installerPath, sigPath } = findUpdaterFiles(bundleBaseDir);

  if (!installerPath || !sigPath) {
    console.error("❌ Could not find the installer and .sig updater bundles in the target/release/bundle directory! Ensure your signing keys are perfectly correct.");
    process.exit(1);
  }

  const zipFile = path.basename(installerPath);
  const zipPath = installerPath;

  const signature = fs.readFileSync(sigPath, 'utf8');

  // 5. Upload installer ZIP to Supabase Storage
  console.log(`☁️ Uploading ${zipFile} to Supabase Storage...`);
  const zipBuffer = fs.readFileSync(zipPath);
  const storageZipPath = `desktop-releases/${newVersion}/${zipFile}`;

  const { error: uploadError } = await supabase
    .storage
    .from('desktop-updates') // The bucket used in tauri.conf.json endpoints
    .upload(storageZipPath, zipBuffer, {
      contentType: 'application/zip',
      upsert: true
    });

  if (uploadError) {
    console.error("❌ Supabase upload failed:", uploadError);
    process.exit(1);
  }

  const { data: publicUrlData } = supabase
    .storage
    .from('desktop-updates')
    .getPublicUrl(storageZipPath);

  const installerUrl = publicUrlData.publicUrl;
  console.log(`✅ Upload successful: ${installerUrl}`);

  // 6. Generate and upload updater.json
  console.log(`📝 Generating and uploading updater.json...`);
  const updaterJson = {
    version: newVersion,
    notes: releaseNotes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: signature,
        url: installerUrl
      }
      // Add macOS/Linux targets here in the future if building for them
    }
  };

  const updaterJsonBuffer = Buffer.from(JSON.stringify(updaterJson, null, 2), 'utf8');
  const { error: jsonUploadError } = await supabase
    .storage
    .from('desktop-updates')
    .upload('updater.json', updaterJsonBuffer, {
      contentType: 'application/json',
      upsert: true
    });

  if (jsonUploadError) {
    console.error("❌ Failed to upload updater.json:", jsonUploadError);
    process.exit(1);
  }

  // 7. Insert Row into desktop_updates table
  console.log("📝 Registering update in database...");
  const { error: dbError } = await supabase
    .from('desktop_updates')
    .insert([{
      version: newVersion,
      signature: signature,
      installer_url: installerUrl,
      changelog: releaseNotes,
      force_update: false
    }]);

  if (dbError) {
    console.error("❌ Failed to insert DB record:", dbError);
    process.exit(1);
  }

  // 8. Cleanup old versions in Database
  console.log("🧹 Cleaning up old Desktop versions...");
  const { data: oldUpdates, error: fetchError } = await supabase
    .from('desktop_updates')
    .select('id, version')
    .neq('version', newVersion);

  if (fetchError) {
    console.error("⚠️ Failed to fetch old updates for cleanup:", fetchError);
  } else if (oldUpdates && oldUpdates.length > 0) {

    // Attempt to list and delete all files in the old version's folder
    for (const old of oldUpdates) {
      console.log(`🧹 Cleaning up Storage for old version ${old.version}...`);
      const oldFolder = `desktop-releases/${old.version}`;

      const { data: listData, error: listError } = await supabase.storage.from('desktop-updates').list(oldFolder);

      if (!listError && listData && listData.length > 0) {
        const filesToRemove = listData.map(file => `${oldFolder}/${file.name}`);
        await supabase.storage.from('desktop-updates').remove(filesToRemove);
      }
    }

    // Delete rows from DB
    const idsToDelete = oldUpdates.map(u => u.id);
    const { error: dbDelError } = await supabase.from('desktop_updates').delete().in('id', idsToDelete);

    if (dbDelError) {
      console.error("⚠️ Error deleting old DB records:", dbDelError);
    } else {
      console.log(`✅ Deleted ${idsToDelete.length} old DB record(s).`);
    }
  } else {
    console.log("✨ No old updates found to clean up.");
  }

  console.log(`🎉 Success! Desktop Version ${newVersion} is now live via Auto-Updater!`);
}

runDesktopRelease();

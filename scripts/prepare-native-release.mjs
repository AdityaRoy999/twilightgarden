import fs from "node:fs";
const version = process.env.RELEASE_VERSION;
if (!version) {
  console.log("Standalone build: keeping the existing application version.");
  process.exit(0);
}
if (
  !/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version) ||
  version === "0.0.0"
)
  throw new Error(
    "Release version must be numeric major.minor.patch, each part 0–999, above 0.0.0.",
  );
const buildNumber = Number(process.env.GITHUB_RUN_NUMBER || 1);
if (
  !Number.isSafeInteger(buildNumber) ||
  buildNumber < 1 ||
  buildNumber > 2100000000
)
  throw new Error("Invalid native build number.");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = version;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
if (process.env.NATIVE_PLATFORM === "ios") {
  const file = "ios/App/App.xcodeproj/project.pbxproj";
  let text = fs.readFileSync(file, "utf8");
  if (
    !text.includes("MARKETING_VERSION =") ||
    !text.includes("CURRENT_PROJECT_VERSION =")
  )
    throw new Error("iOS version settings were not found.");
  text = text
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};`,
    );
  fs.writeFileSync(file, text);
}
if (
  process.env.NATIVE_PLATFORM === "android" &&
  fs.existsSync("android/app/build.gradle")
) {
  const file = "android/app/build.gradle";
  let text = fs.readFileSync(file, "utf8");
  if (!/versionCode\s+\d+/.test(text) || !/versionName\s+"[^"]+"/.test(text))
    throw new Error("Android version settings were not found.");
  text = text
    .replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
  fs.writeFileSync(file, text);
}
console.log(
  `Stamped ${process.env.NATIVE_PLATFORM}: ${version} (${buildNumber}). Changes exist only in the CI checkout.`,
);

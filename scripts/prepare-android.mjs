import fs from "node:fs";
const path = "android/app/src/main/AndroidManifest.xml";
let xml = fs.readFileSync(path, "utf8");
for (const permission of [
  "CAMERA",
  "RECORD_AUDIO",
  "MODIFY_AUDIO_SETTINGS",
  "POST_NOTIFICATIONS",
]) {
  if (!xml.includes(`android.permission.${permission}`))
    xml = xml.replace(
      "</manifest>",
      `    <uses-permission android:name="android.permission.${permission}" />\n</manifest>`,
    );
}
// Match the same callback scheme used by the iPhone/web authentication flow.
if (!xml.includes('android:scheme="com.twilight.garden"'))
  xml = xml.replace(
    "</activity>",
    `<intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="com.twilight.garden"/></intent-filter></activity>`,
  );
fs.writeFileSync(path, xml, "utf8");

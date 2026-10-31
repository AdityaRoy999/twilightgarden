import { aws, outputs } from "./aws.mjs";
const email = process.argv[2];
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error("Usage: npm run admin:invite -- your-admin@example.com");
const o = outputs();
try {
  aws([
    "cognito-idp",
    "admin-create-user",
    "--user-pool-id",
    o.UserPoolId,
    "--username",
    email,
    "--user-attributes",
    `Name=email,Value=${email}`,
    "Name=email_verified,Value=true",
    "--desired-delivery-mediums",
    "EMAIL",
    "--region",
    o.Region,
  ]);
} catch {
  throw new Error(
    "Could not create the user. Check AWS permissions; if it already exists, add it to admins manually as described in DEPLOY.md.",
  );
}
aws([
  "cognito-idp",
  "admin-add-user-to-group",
  "--user-pool-id",
  o.UserPoolId,
  "--username",
  email,
  "--group-name",
  "admins",
  "--region",
  o.Region,
]);
console.log(
  `Invitation sent to ${email}. On first login, set a new password and configure an authenticator app.`,
);

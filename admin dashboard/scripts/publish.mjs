import { writeFileSync, existsSync } from "node:fs";
import { aws, outputs } from "./aws.mjs";
const o = outputs();
if (!existsSync("dist/index.html"))
  throw new Error("Build the frontend first: npm run build");
// Public configuration only. Tokens and integration secrets never enter the bundle.
writeFileSync(
  "dist/config.json",
  JSON.stringify(
    {
      mode: "live",
      apiUrl: o.ApiUrl,
      authDomain: o.AuthDomain,
      clientId: o.ClientId,
      region: o.Region,
    },
    null,
    2,
  ),
);
// No recursive deletion: stale hashed assets remain usable by open browser tabs.
aws([
  "s3",
  "sync",
  "dist",
  `s3://${o.SiteBucket}`,
  "--exclude",
  "index.html",
  "--exclude",
  "config.json",
  "--cache-control",
  "public,max-age=31536000,immutable",
  "--region",
  o.Region,
]);
for (const name of ["config.json", "index.html"])
  aws([
    "s3",
    "cp",
    `dist/${name}`,
    `s3://${o.SiteBucket}/${name}`,
    "--cache-control",
    "no-store,max-age=0",
    "--content-type",
    name.endsWith(".json") ? "application/json" : "text/html",
    "--region",
    o.Region,
  ]);
aws([
  "cloudfront",
  "create-invalidation",
  "--distribution-id",
  o.DistributionId,
  "--paths",
  "/",
  "/index.html",
  "/config.json",
]);
console.log(
  `Published: ${o.SiteUrl}\nCloudFront invalidation may take a few minutes.`,
);

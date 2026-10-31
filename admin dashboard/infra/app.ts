import { App } from "aws-cdk-lib";
import { ControlStack } from "./stack";
const app = new App();
new ControlStack(app, "TwilightControl", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "ap-south-1",
  },
});

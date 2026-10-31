import { describe, it, expect } from "vitest";
import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { ControlStack } from "../infra/stack";
describe("AWS security configuration", () => {
  it("synthesizes private hosting, invite-only MFA, protected routes, bounded compute, and retained data", () => {
    const app = new App();
    const stack = new ControlStack(app, "Test", {
      env: { account: "111111111111", region: "ap-south-1" },
    });
    const t = Template.fromStack(stack);
    t.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    t.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
      MfaConfiguration: "ON",
      EnabledMfas: ["SOFTWARE_TOKEN_MFA"],
    });
    t.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      AllowedOAuthFlows: ["code"],
    });
    t.hasResourceProperties("AWS::ApiGatewayV2::Route", {
      AuthorizationType: "JWT",
      AuthorizationScopes: ["twilight-admin/control"],
    });
    t.hasResourceProperties("AWS::Lambda::Function", {
      ReservedConcurrentExecutions: 2,
      Timeout: 25,
      Architectures: ["arm64"],
    });
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      DeletionProtectionEnabled: true,
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    });
    t.hasResource("AWS::SecretsManager::Secret", { DeletionPolicy: "Retain" });
    expect(Object.keys(t.findResources("AWS::EC2::Instance"))).toHaveLength(0);
    expect(Object.keys(t.findResources("AWS::EC2::NatGateway"))).toHaveLength(
      0,
    );
    t.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ResponseHeadersPolicyId: Match.anyValue(),
          TargetOriginId: Match.anyValue(),
        },
      },
    });
  }, 60000);
});

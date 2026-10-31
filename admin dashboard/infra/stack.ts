import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamo from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import * as api from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cw from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { fileURLToPath } from "node:url";
import path from "node:path";
export class ControlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const repo =
      this.node.tryGetContext("repo") || "AdityaRoy999/twilightgarden";
    const branch = this.node.tryGetContext("branch") || "main";
    const email = this.node.tryGetContext("alertEmail") as string | undefined;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
      throw new Error("repo must be owner/repository");
    if (branch !== "main")
      throw new Error(
        "This dashboard only dispatches the protected main branch.",
      );
    const site = new s3.Bucket(this, "Site", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const securityHeaders = new cf.ResponseHeadersPolicy(this, "Headers", {
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cf.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cf.HeadersReferrerPolicy.NO_REFERRER,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.execute-api.${this.region}.amazonaws.com https://*.auth.${this.region}.amazoncognito.com; base-uri 'self'; frame-ancestors 'none'; form-action 'none'; object-src 'none'`,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
            override: true,
          },
        ],
      },
    });
    const distribution = new cf.Distribution(this, "Cdn", {
      defaultRootObject: "index.html",
      priceClass: cf.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        responseHeadersPolicy: securityHeaders,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });
    const siteOrigin = `https://${distribution.distributionDomainName}`;
    const pool = new cognito.UserPool(this, "Admins", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 14,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(2),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const resource = pool.addResourceServer("ControlScope", {
      identifier: "twilight-admin",
      scopes: [
        {
          scopeName: "control",
          scopeDescription: "Use the private operations console",
        },
      ],
    });
    const client = pool.addClient("WebClient", {
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.minutes(30),
      idTokenValidity: cdk.Duration.minutes(30),
      refreshTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.resourceServer(resource, {
            scopeName: "control",
            scopeDescription: "Use the private operations console",
          }),
        ],
        callbackUrls: [`${siteOrigin}/`],
        logoutUrls: [`${siteOrigin}/`],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });
    const domain = pool.addDomain("Domain", {
      cognitoDomain: {
        domainPrefix: `twilight-control-${this.account}-${this.region}`,
      },
    });
    new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      groupName: "admins",
      userPoolId: pool.userPoolId,
      description: "Invited dashboard administrators",
    });
    const table = new dynamo.Table(this, "Operations", {
      partitionKey: { name: "pk", type: dynamo.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      encryption: dynamo.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: "ttl",
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const secret = new secrets.Secret(this, "Integrations", {
      description:
        "Twilight Control GitHub credentials and optional Vercel deploy hook. Edit values in Secrets Manager.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ githubToken: "REPLACE_ME" }),
        generateStringKey: "bootstrapNonce",
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const root = path.dirname(fileURLToPath(import.meta.url));
    const fn = new nodejs.NodejsFunction(this, "ApiHandler", {
      entry: path.join(root, "../backend/handler.ts"),
      depsLockFilePath: path.join(root, "../package-lock.json"),
      projectRoot: path.join(root, ".."),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(25),
      reservedConcurrentExecutions:
        Number(this.node.tryGetContext("reservedConcurrency") ?? 2) ||
        undefined,
      logGroup,
      bundling: { minify: true, sourceMap: false, externalModules: [] },
      environment: {
        TABLE_NAME: table.tableName,
        INTEGRATION_SECRET_ARN: secret.secretArn,
        GITHUB_REPO: repo,
        BUILD_BRANCH: branch,
        SITE_ORIGIN: siteOrigin,
        PRODUCTION_URL:
          this.node.tryGetContext("productionUrl") ||
          "https://twilight-mocha.vercel.app/",
      },
    });
    table.grantReadWriteData(fn);
    secret.grantRead(fn);
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:GetMetricData"],
        resources: ["*"],
      }),
    );
    const authorizer = new HttpJwtAuthorizer(
      "AdminJwt",
      pool.userPoolProviderUrl,
      { jwtAudience: [client.userPoolClientId] },
    );
    const http = new api.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: [siteOrigin],
        allowMethods: [api.CorsHttpMethod.GET, api.CorsHttpMethod.POST],
        allowHeaders: ["Authorization", "Content-Type"],
        maxAge: cdk.Duration.hours(1),
      },
    });
    http.addRoutes({
      path: "/{proxy+}",
      methods: [api.HttpMethod.GET, api.HttpMethod.POST],
      integration: new HttpLambdaIntegration("AdminIntegration", fn),
      authorizer,
      authorizationScopes: ["twilight-admin/control"],
    });
    const stage = http.defaultStage!.node.defaultChild as api.CfnStage;
    stage.defaultRouteSettings = {
      throttlingRateLimit: 2,
      throttlingBurstLimit: 5,
    };
    const errorAlarm = new cw.Alarm(this, "ApiErrorAlarm", {
      metric: fn.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });
    if (email) {
      const topic = new sns.Topic(this, "Alerts");
      topic.addSubscription(new subscriptions.EmailSubscription(email));
      errorAlarm.addAlarmAction(new actions.SnsAction(topic));
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: `TwilightControl-${this.region}`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          costTypes: { includeCredit: false, includeRefund: false },
          budgetLimit: { amount: 10, unit: "USD" },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "ACTUAL",
              threshold: 50,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ address: email, subscriptionType: "EMAIL" }],
          },
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "ACTUAL",
              threshold: 100,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ address: email, subscriptionType: "EMAIL" }],
          },
        ],
      });
    }
    for (const [key, value] of Object.entries({
      SiteUrl: siteOrigin,
      SiteBucket: site.bucketName,
      DistributionId: distribution.distributionId,
      ApiUrl: http.apiEndpoint,
      UserPoolId: pool.userPoolId,
      ClientId: client.userPoolClientId,
      AuthDomain: domain.baseUrl(),
      SecretArn: secret.secretArn,
      TableName: table.tableName,
      FunctionName: fn.functionName,
      Region: this.region,
    }))
      new cdk.CfnOutput(this, key, { value });
    cdk.Tags.of(this).add("Project", "TwilightControl");
    cdk.Tags.of(this).add("ManagedBy", "CDK");
  }
}

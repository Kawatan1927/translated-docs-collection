---

# AWS CDK の権限

AWS コンストラクトライブラリは、アクセスと権限管理のための一般的で広く実装されているイディオムをいくつか使用します。IAM モジュールは、これらのイディオムを利用するために必要なツールを提供します。

## デプロイと IAM

AWS CDK は、AWS CloudFormation を利用して変更をデプロイします。すべてのデプロイメントでは、開発者や自動システムなどのアクターが AWS CloudFormation のデプロイを開始します。この際、アクターは 1 つ以上の IAM アイデンティティ（ユーザーまたはロール）を引き受け、必要に応じてロールを AWS CloudFormation に渡します。

たとえば、AWS IAM Identity Center を使用してユーザーとして認証する場合、シングルサインオンプロバイダーが短期間有効なセッション資格情報を供給し、事前定義された IAM ロールとしての動作が許可されます。詳細は [Understand IAM Identity Center authentication in the AWS SDKs and Tools Reference Guide](#) を参照してください。

## プリンシパル

IAM プリンシパルは、AWS API を呼び出すことができる、ユーザー、サービス、またはアプリケーションなどの認証済み AWS エンティティを表します。AWS コンストラクトライブラリでは、AWS リソースへのアクセスを許可するために、柔軟な方法でプリンシパルを指定することがサポートされています。

セキュリティの文脈では、「プリンシパル」とは認証済みのユーザーなどのエンティティを指します。グループやロールなどのオブジェクトは、ユーザーやその他の認証済みエンティティを間接的に識別するものであり、直接的なプリンシパルではありません。

たとえば、IAM グループを作成して、そのグループ（およびそのメンバー）に Amazon RDS テーブルへの書き込みアクセスを付与することができますが、グループ自体は単一のエンティティを表さないため、プリンシパルとはみなされません（また、グループにログインすることはできません）。

CDK の IAM ライブラリでは、プリンシパルを直接または間接的に識別するクラスは IPrincipal インターフェースを実装しており、これによりアクセスポリシー内でオブジェクトを相互に利用可能となります。ただし、すべてのオブジェクトがセキュリティ上の意味でのプリンシパルであるわけではありません。これらのオブジェクトには、以下が含まれます。

- Role、User、Group などの IAM リソース
- サービスプリンシパル（例: `new iam.ServicePrincipal('service.amazonaws.com')`）
- フェデレーテッドプリンシパル（例: `new iam.FederatedPrincipal('cognito-identity.amazonaws.com')`）
- アカウントプリンシパル（例: `new iam.AccountPrincipal('0123456789012')`）
- カノニカルユーザープリンシパル（例: `new iam.CanonicalUserPrincipal('79a59d[...]7ef2be')`）
- AWS Organizations プリンシパル（例: `new iam.OrganizationPrincipal('org-id')`）
- 任意の ARN プリンシパル（例: `new iam.ArnPrincipal(res.arn)`）
- 複数のプリンシパルを信頼するための `iam.CompositePrincipal(principal1, principal2, ...)`

## Grant（権限付与）

リソース（例: Amazon S3 バケットや Amazon DynamoDB テーブル）を表すすべてのコンストラクトには、他のエンティティに対してアクセス権を付与するためのメソッドが用意されています。これらのメソッドはすべて、`grant` で始まる名前になっています。

たとえば、Amazon S3 バケットには、エンティティに対して読み取りアクセスまたは読み書きアクセスを有効にする `grantRead` と `grantReadWrite`（Python: `grant_read`, `grant_read_write`）というメソッドがあります。エンティティは、これらの操作に必要な具体的な S3 IAM 権限を知る必要はありません。

`grant` メソッドの第一引数は常に IGrantable 型です。このインターフェースは、権限を付与できるエンティティ、すなわち IAM の Role、User、Group などの役割を持つリソースを表します。

他のエンティティにも権限を付与することが可能です。たとえば、後述する例では、CodeBuild プロジェクトに対して Amazon S3 バケットへのアクセス権を付与する方法を示しています。一般に、関連するロールはアクセスを付与されるエンティティの `role` プロパティ経由で取得されます。

実行ロールを使用するリソース（例: `lambda.Function`）も IGrantable を実装しているため、ロール自体にアクセス権を付与するのではなく、直接リソースに権限を付与することができます。例えば、`bucket` が Amazon S3 バケットで、`function` が Lambda 関数の場合、以下のコードは関数に対してバケットの読み取りアクセス権を付与します。

```typescript
bucket.grantRead(function);
```

場合によっては、スタックがデプロイされる際に権限を適用する必要があります。たとえば、AWS CloudFormation カスタムリソースに対して他のリソースへのアクセス権を付与する場合、そのカスタムリソースはデプロイ時に呼び出されるため、指定された権限がデプロイ時に適用されている必要があります。

また、あるサービスが渡されたロールに適切なポリシーが適用されているかを検証するケースもあります。（いくつかの AWS サービスは、ポリシーが設定されていないことを防ぐためにこれを行います。）このような場合、権限の適用が遅れるとデプロイが失敗する可能性があります。

他のリソースが作成される前に権限付与の設定を強制的に適用するために、`grant` 自体に依存関係を追加することが可能です。たとえば、以下のコードでは、`grant` メソッドの戻り値である `iam.Grant` オブジェクトに依存関係を追加しています。

```typescript
const grant = bucket.grantRead(lambda);
const custom = new CustomResource(...);
custom.node.addDependency(grant);
```

## ロール

IAM パッケージには、IAM ロールを表す `Role` コンストラクトが含まれています。以下のコードは、Amazon EC2 サービスを信頼する新しいロールを作成する例です。

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';

const role = new iam.Role(this, 'Role', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'), // 必須
});
```

ロールに権限を追加するには、ロールの `addToPolicy` メソッド（Python: `add_to_policy`）を呼び出し、追加するルールを定義した `PolicyStatement` を渡します。このステートメントは、ロールのデフォルトポリシーに追加され、存在しない場合は新規作成されます。

以下の例では、CodeBuild サービスが許可された場合に、アクション `ec2:SomeAction` および `s3:AnotherAction` を、バケットと別のロール（Python: `other_role`）に対して拒否する Deny ポリシーステートメントをロールに追加しています。

```typescript
role.addToPolicy(new iam.PolicyStatement({
  effect: iam.Effect.DENY,
  resources: [bucket.bucketArn, otherRole.roleArn],
  actions: ['ec2:SomeAction', 's3:AnotherAction'],
  conditions: {
    StringEquals: {
      'ec2:AuthorizedService': 'codebuild.amazonaws.com',
    },
  },
}));
```

上記の例では、`addToPolicy` の呼び出しとともにインラインで新しい `PolicyStatement` を作成しています。既存のポリシーステートメントや変更済みのステートメントを渡すことも可能です。`PolicyStatement` オブジェクトには、プリンシパル、リソース、条件、アクションを追加するための多数のメソッドが用意されています。

もし、あるコンストラクトが正常に機能するためにロールを必要とする場合は、以下のいずれかを行います。

- コンストラクトオブジェクトの生成時に既存のロールを渡す
- コンストラクトが適切なサービスプリンシパルを信頼する新しいロールを作成する（例えば CodeBuild プロジェクト）

```typescript
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

// someRole が条件によって Role オブジェクトを返すか、または undefined を返す関数だと仮定
const someRole: iam.IRole | undefined = roleOrUndefined();

const project = new codebuild.Project(this, 'Project', {
  // someRole が undefined の場合、Project は codebuild.amazonaws.com を信頼する新しいデフォルトロールを作成する
  role: someRole,
});
```

作成後、ロール（渡されたロールまたはコンストラクトが作成したデフォルトロール）は、`role` プロパティとして利用可能ですが、このプロパティは外部リソースには提供されません。そのため、これらのコンストラクトには `addToRolePolicy`（Python: `add_to_role_policy`）メソッドが用意されています。このメソッドは、コンストラクトが外部リソースである場合には何も行わず、そうでなければロールの `addToPolicy`（Python: `add_to_policy`）メソッドを呼び出します。

以下の例では、CDK アプリケーションにインポートされたプロジェクトに対して `addToRolePolicy` を呼び出しています。

```typescript
// project は CDK アプリケーションにインポートされたもの
const project = codebuild.Project.fromProjectName(this, 'Project', 'ProjectName');

// project はインポートされたため、project.role は undefined となり、この呼び出しは効果を持ちません
project.addToRolePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  // ... その他のポリシー定義
}));
```

## リソースポリシー

Amazon S3 バケットや IAM ロールなど、AWS の一部リソースはリソースポリシーを持っています。これらのコンストラクトには、`addToResourcePolicy`（Python: `add_to_resource_policy`）メソッドが用意されており、`PolicyStatement` を引数として受け取ります。リソースポリシーに追加されるすべてのポリシーステートメントは、少なくとも 1 つのプリンシパルを指定する必要があります。

以下の例では、Amazon S3 バケット `bucket` が、自身に対して `s3:SomeAction` の権限を持つロールを許可しています。

```typescript
bucket.addToResourcePolicy(new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['s3:SomeAction'],
  resources: [bucket.bucketArn],
  principals: [role],
}));
```

## 外部 IAM オブジェクトの利用

AWS CDK アプリの外部で IAM ユーザー、プリンシパル、グループ、またはロールを定義している場合、その IAM オブジェクトを CDK アプリ内で利用することができます。その場合は、ARN や名前を使用して参照を作成します（ユーザー、グループ、ロールには名前を使用）。返される参照は、前述のように権限付与やポリシーステートメントの作成に利用できます。

- ユーザーの場合は、`User.fromUserArn()` または `User.fromUserName()` を使用します。`User.fromUserAttributes()` も利用可能ですが、現在は `User.fromUserArn()` と同じ機能を提供します。
- プリンシパルの場合は、`ArnPrincipal` オブジェクトを生成します。
- グループの場合は、`Group.fromGroupArn()` または `Group.fromGroupName()` を使用します。
- ロールの場合は、`Role.fromRoleArn()` または `Role.fromRoleName()` を使用します。

また、ポリシー（マネージドポリシーを含む）も、以下のメソッドを使用して同様に利用可能です。これらのオブジェクトの参照は、IAM ポリシーが必要な箇所でどこでも使用できます。

- `Policy.fromPolicyName`
- `ManagedPolicy.fromManagedPolicyArn`
- `ManagedPolicy.fromManagedPolicyName`
- `ManagedPolicy.fromAwsManagedPolicyName`

**注意:** 外部 AWS リソースへの参照と同様に、外部の IAM オブジェクトは CDK アプリ内で変更することはできません。

---
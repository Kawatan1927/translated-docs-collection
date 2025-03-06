# AWS CDK コンストラクト

コンストラクトは、AWS Cloud Development Kit (AWS CDK) アプリケーションの基本的な構成要素です。コンストラクトは、1 つまたは複数の AWS CloudFormation リソースとその設定を表す、アプリケーション内のコンポーネントです。あなたはコンストラクトをインポートして設定することで、アプリケーションを一部分ずつ構築していきます。

---

## コンストラクトのインポートと利用

コンストラクトは、AWS コンストラクトライブラリから CDK アプリケーションへインポートするクラスです。また、自作のコンストラクトやサードパーティーが作成したコンストラクトを利用・配布することも可能です。

コンストラクトは Construct Programming Model (CPM) の一部であり、CDK for Terraform (CDKtf)、CDK for Kubernetes (CDK8s)、Projen などの他のツールでも利用できます。

多数のサードパーティーも、AWS CDK と互換性のあるコンストラクトを公開しています。詳細は [Construct Hub](https://constructs.dev/) をご参照ください。

---

## コンストラクトのレベル

AWS コンストラクトライブラリのコンストラクトは、抽象度の違いにより 3 つのレベルに分類されます。抽象度が高いほど設定が容易になり、専門知識の必要性が低くなります。一方、抽象度が低いと柔軟なカスタマイズが可能ですが、専門知識が必要です。

### レベル 1 (L1) コンストラクト

- **概要:**  
  L1 コンストラクト（CFN リソースとも呼ばれる）は最も低いレベルのコンストラクトで、抽象化は一切行われません。各 L1 コンストラクトは、単一の AWS CloudFormation リソースに直接対応しています。
- **利用シーン:**  
  AWS CloudFormation に精通しており、リソースのプロパティ定義を完全に制御したい場合に適しています。
- **命名規則:**  
  AWS コンストラクトライブラリ内の L1 コンストラクトは、`Cfn` で始まる名前になっており、例えば `CfnBucket` は AWS::S3::Bucket リソースに対応する L1 コンストラクトです。
- **更新:**  
  L1 コンストラクトは、AWS CloudFormation リソース仕様から生成されるため、CloudFormation に存在するリソースは AWS CDK 上でも L1 コンストラクトとして利用可能です。新しいリソースやプロパティは、最大で 1 週間ほどかかる場合があります。

### レベル 2 (L2) コンストラクト

- **概要:**  
  L2 コンストラクト（キュレーション済みコンストラクトとも呼ばれる）は、CDK チームによって丁寧に開発され、最も広く利用されるタイプのコンストラクトです。
- **特徴:**  
  L1 コンストラクトに比べ、直感的な意図に基づく API により高い抽象度が提供されます。適切なデフォルト値、ベストプラクティスのセキュリティポリシーが組み込まれており、多くのボイラープレートコードや接合ロジックを自動生成してくれます。
- **例:**  
  `s3.Bucket` クラスは、Amazon S3 バケットリソースの L2 コンストラクトの例です。
- **安定性:**  
  AWS コンストラクトライブラリに含まれる L2 コンストラクトは、安定版として本番環境での利用が推奨されます。実験的な L2 コンストラクトは、別モジュールで提供されます。

### レベル 3 (L3) コンストラクト

- **概要:**  
  L3 コンストラクト（パターンとも呼ばれる）は、最も高い抽象化レベルを提供します。
- **特徴:**  
  1 つの L3 コンストラクトは、特定のタスクやサービスを実現するために連携して動作する複数のリソースの集まりを含むことができます。意見を反映したデフォルトの設定が提供され、最小限の入力とコードで複数のリソースを迅速に作成・設定することが可能です。
- **例:**  
  `ecsPatterns.ApplicationLoadBalancedFargateService` クラスは、Amazon ECS クラスター上で動作する AWS Fargate サービスを、アプリケーションロードバランサーで前面に出す L3 コンストラクトの例です。
- **提供状況:**  
  本番利用可能な L3 コンストラクトは AWS コンストラクトライブラリに含まれ、開発中のものは別モジュールで提供されます。

---

## コンストラクトの定義

### コンポジション

コンポジションは、高レベルの抽象化をコンストラクトで定義するための主要なパターンです。高レベルのコンストラクトは、任意の数の低レベルコンストラクトから構成できます。下から上へ積み上げる視点では、デプロイしたい個々の AWS リソースを整理するためにコンストラクトを使用します。必要な抽象化レベルに合わせて、複数のレベルでコンポジションを行えます。

- **再利用:**  
  再利用可能なコンポーネントを定義し、他のコードと同様に共有することができます。たとえば、あるチームが Amazon DynamoDB テーブルのベストプラクティス（バックアップ、グローバルレプリケーション、自動スケーリング、モニタリングなど）を実装するコンストラクトを定義し、社内または公開で共有することが可能です。
- **アップデート:**  
  ライブラリが更新されると、開発者は新バージョンの改善やバグ修正の恩恵を受けられます。

### 初期化

コンストラクトは、`Construct` ベースクラスを継承するクラスとして実装されます。コンストラクトの初期化時には、通常、以下の 3 つの引数を渡します。

- **scope:**  
  コンストラクトの親（またはオーナー）を指定します。これはスタックまたは他のコンストラクトになり、コンストラクトツリー内での位置を決定します。通常は `this`（Python では `self`）を渡します。

- **id:**  
  スコープ内で一意でなければならない識別子です。これはコンストラクト内で定義される全要素の名前空間として機能し、リソース名や AWS CloudFormation の論理 ID 生成に利用されます。

- **props:**  
  コンストラクトの初期設定を定義するプロパティのセット（またはキーワード引数）です。高レベルコンストラクトでは多くのデフォルト値が用意されており、すべてのプロパティがオプションの場合は省略可能です。

### コンフィギュレーション

ほとんどのコンストラクトは、3 番目の引数（または Python ではキーワード引数）として `props` を受け取ります。例えば、AWS Key Management Service (AWS KMS) 暗号化と静的ウェブサイトホスティングが有効なバケットを定義する場合、以下のように記述できます。

```typescript
new s3.Bucket(this, 'MyEncryptedBucket', {
  encryption: s3.BucketEncryption.KMS,
  websiteIndexDocument: 'index.html'
});
```

### コンストラクトとの相互作用

コンストラクトは `Construct` クラスを拡張したクラスです。インスタンス化後、コンストラクトオブジェクトはそのコンストラクトと対話したり、システムの他の部分に参照として渡したりするための各種メソッドやプロパティを公開します。

AWS CDK フレームワークは、コンストラクトの API に特に制限を設けていません。ライブラリ作成者は自由に API を定義できますが、AWS コンストラクトライブラリに含まれるコンストラクト（例: `s3.Bucket`）は共通のガイドラインやパターンに従っており、全 AWS リソースで一貫した体験が提供されます。

- **権限の付与:**  
  多くの AWS コンストラクトには、IAM 権限を特定のプリンシパルに付与するための `grant` 系メソッドが用意されています。例えば、以下の例では、`raw-data` という S3 バケットに対して、IAM グループ `data-science` に読み取り権限を付与しています。

  ```typescript
  const rawData = new s3.Bucket(this, 'raw-data');
  const dataScience = new iam.Group(this, 'data-science');
  rawData.grantRead(dataScience);
  ```

- **属性の設定:**  
  AWS コンストラクトは、他の場所から供給されたデータを用いてリソースの属性（ARN、名前、URL など）を設定することが一般的です。例えば、以下のコードでは、AWS Lambda 関数が Amazon SQS キューの URL を環境変数として設定しています。

  ```typescript
  const jobsQueue = new sqs.Queue(this, 'jobs');
  const createJobLambda = new lambda.Function(this, 'create-job', {
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('./create-job-lambda-code'),
    environment: {
      QUEUE_URL: jobsQueue.queueUrl
    }
  });
  ```

詳細な API パターンについては、[Resources and the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/resources.html) を参照してください。

---

## App と Stack コンストラクト

AWS コンストラクトライブラリの `App` および `Stack` クラスは、他のコンストラクトとは異なり、単体で AWS リソースを構成しません。これらは他のコンストラクトにコンテキストを提供するために使用されます。AWS リソースを表す全てのコンストラクトは、直接または間接的に `Stack` コンストラクトのスコープ内で定義されなければなりません。`Stack` コンストラクトは `App` コンストラクトのスコープ内で定義されます。

CDK アプリやスタックの詳細については、それぞれ [AWS CDK apps](#) および [Introduction to AWS CDK stacks](#) を参照してください。

以下の例は、単一のスタックを含むアプリを定義し、その中で L2 コンストラクトを用いて Amazon S3 バケットリソースを構成する例です。

```typescript
import { App, Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

class HelloCdkStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'MyFirstBucket', {
      versioned: true
    });
  }
}

const app = new App();
new HelloCdkStack(app, "HelloCdkStack");
```

---

## コンストラクトの利用方法

### L1 コンストラクトの利用

L1 コンストラクトは、個々の AWS CloudFormation リソースに直接対応しており、リソースの必須設定を自ら定義する必要があります。以下の例では、`CfnBucket` L1 コンストラクトを使用してバケットオブジェクトを作成しています。

```typescript
const bucket = new s3.CfnBucket(this, "amzn-s3-demo-bucket", {
  bucketName: "amzn-s3-demo-bucket"
});
```

また、単純な Boolean、文字列、数値、コンテナ以外のプロパティは、言語ごとに異なる方法で扱われます。

```typescript
const bucket = new s3.CfnBucket(this, "amzn-s3-demo-bucket", {
  bucketName: "amzn-s3-demo-bucket",
  corsConfiguration: {
    corsRules: [{
      allowedOrigins: ["*"],
      allowedMethods: ["GET"]
    }]
  }
});
```

> **重要:**  
> L1 コンストラクトでは、L2 のプロパティ型は使用できません。利用する L1 コンストラクトに定義された型を必ず使用してください。

### L2 コンストラクトの利用

以下の例では、L2 コンストラクトである `Bucket` を利用して Amazon S3 バケットを定義しています。

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';

// "this" は HelloCdkStack を指す
new s3.Bucket(this, 'MyFirstBucket', {
  versioned: true
});
```

ここで指定した `MyFirstBucket` は、CloudFormation が生成するリソースの論理識別子であり、実際の物理名は `physicalName` 値として決定されます。

### サードパーティー製コンストラクトの利用

[Construct Hub](https://constructs.dev/) は、AWS、サードパーティー、オープンソースの CDK コミュニティが提供する追加のコンストラクトを探すためのリソースです。

### 自作コンストラクトの作成

既存のコンストラクトを利用するだけでなく、自作のコンストラクトを作成して、誰でも自分のアプリで利用できるようにすることが可能です。AWS CDK では、AWS コンストラクトライブラリのコンストラクトと同様に、自作コンストラクトも同等に扱われます。これらは、NPM、Maven、PyPI などを通じて公開されるサードパーティー製ライブラリと同様です。

新しいコンストラクトを宣言するには、`constructs` パッケージの `Construct` ベースクラスを拡張したクラスを作成し、初期化のパターンに従います。以下は、Amazon S3 バケットに対して、ファイルアップロード時に Amazon SNS の通知を送信するコンストラクトの例です。

```typescript
export interface NotifyingBucketProps {
  prefix?: string;
}

export class NotifyingBucket extends Construct {
  constructor(scope: Construct, id: string, props: NotifyingBucketProps = {}) {
    super(scope, id);
    const bucket = new s3.Bucket(this, 'bucket');
    const topic = new sns.Topic(this, 'topic');
    bucket.addObjectCreatedNotification(new s3notify.SnsDestination(topic), { prefix: props.prefix });
  }
}
```

上記の例では、`NotifyingBucket` コンストラクトは `Bucket` ではなく `Construct` を継承しています。これは、継承ではなくコンポジションにより、Amazon S3 バケットと Amazon SNS トピックをまとめているためです。一般的に、AWS CDK コンストラクトの開発では、コンポジションが継承よりも推奨されます。

通常、コンストラクトのコンストラクタは `scope`、`id`、`props` のシグネチャを持ち、`props` はオプション（デフォルト値 `{}` が設定される）です。例えば、`NotifyingBucket` のインスタンスは以下のように生成できます。

```typescript
// props を指定しない場合
new NotifyingBucket(this, 'MyNotifyingBucket');

// props を指定する場合（例えば、プレフィックスとして "images/" を指定）
new NotifyingBucket(this, 'MyNotifyingBucket', { prefix: 'images/' });
```

さらに、コンストラクトの利用者が内部の SNS トピックにアクセスできるように、プロパティやメソッドを公開することが推奨されます。以下の例では、`topic` プロパティを公開して、利用者が購読できるようにしています。

```typescript
export class NotifyingBucket extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: NotifyingBucketProps) {
    super(scope, id);
    const bucket = new s3.Bucket(this, 'bucket');
    this.topic = new sns.Topic(this, 'topic');
    bucket.addObjectCreatedNotification(new s3notify.SnsDestination(this.topic), { prefix: props.prefix });
  }
}
```

利用者は、以下のようにしてトピックに対して購読を追加できます。

```typescript
const queue = new sqs.Queue(this, 'NewImagesQueue');
const images = new NotifyingBucket(this, '/images');
images.topic.addSubscription(new sns_sub.SqsSubscription(queue));
```

---
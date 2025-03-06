# AWS CDKとは何か？

AWS Cloud Development Kit (AWS CDK) は、コードでクラウドインフラストラクチャを定義し、AWS CloudFormation を通じてプロビジョニングするためのオープンソースのソフトウェア開発フレームワークです。

AWS CDK は主に以下の2つの部分から構成されています。

## AWS CDK コンストラクトライブラリ

AWS CDK コンストラクトライブラリは、コンストラクトと呼ばれる事前に作成されたモジュール化・再利用可能なコードのコレクションです。これらを使用、修正、統合することで、迅速にインフラストラクチャを開発できます。ライブラリの目的は、AWS上でアプリケーションを構築する際に、AWSサービスを定義および統合するために必要な複雑さを軽減することです。

## AWS CDK コマンドラインインターフェイス (AWS CDK CLI)

AWS CDK CLI（または CDK ツールキット）は、CDK アプリと対話するためのコマンドラインツールです。これを利用して、AWS CDK プロジェクトの作成、管理、デプロイを行います。

---

# AWS CDK のサポート言語

AWS CDK は、TypeScript、JavaScript、Python、Java、C#/.Net、Go に対応しており、これらの言語を使って「コンストラクト」と呼ばれる再利用可能なクラウドコンポーネントを定義できます。これらをスタックやアプリケーションとして組み合わせ、最終的に AWS CloudFormation を通じてリソースのプロビジョニングや更新を行います。

---

# トピック一覧

- AWS CDK の利点
- AWS CDK の例
- AWS CDK の機能
- 次のステップ
- 詳細情報

---

# AWS CDK の利点

AWS CDK を使用すると、プログラミング言語の表現力を活かして、信頼性が高く、スケーラブルで、コスト効果の高いクラウドアプリケーションを開発できます。具体的な利点は以下の通りです。

## インフラストラクチャをコード（IaC）として開発・管理できる

- **インフラストラクチャをコードとして管理:**  
  インフラストラクチャをコード（IaC）として、プログラム的、記述的、宣言的な方法で作成、デプロイ、維持できます。これにより、開発者がコードを扱うのと同じようにインフラも管理でき、スケーラブルで構造化された運用が可能となります。  
  詳細は [Introduction to DevOps on AWS Whitepaper 内の Infrastructure as code](https://aws.amazon.com/jp/devops/whitepapers/) をご覧ください。

- **統合管理:**  
  AWS CDK を使用すると、インフラストラクチャ、アプリケーションコード、設定を一元管理でき、各マイルストーンで完全なクラウドデプロイ可能システムが確保されます。コードレビュー、単体テスト、ソースコントロールなどのソフトウェアエンジニアリングのベストプラクティスを取り入れることで、インフラの堅牢性が向上します。

## 一般目的のプログラミング言語でクラウドインフラを定義できる

- **好みの言語を使用:**  
  TypeScript、JavaScript、Python、Java、C#/.Net、Go のいずれかを用いてクラウドインフラを定義できます。パラメータ、条件分岐、ループ、構成、継承などのプログラミング要素を活用し、インフラの望ましい結果を定義します。

- **統一された言語環境:**  
  インフラとアプリケーションロジックの両方に同じプログラミング言語を使用するため、好みの統合開発環境（IDE）のシンタックスハイライトやインテリセンスなどの恩恵を受けることができます。

- **コード例:**  
  以下は、ECS クラスターを VPC と Fargate サービス構成でセットアップする AWS CDK のコードスニペットです。

  ```typescript
  export class MyEcsConstructStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
      super(scope, id, props);

      const vpc = new ec2.Vpc(this, "MyVpc", {
        maxAzs: 3 // デフォルトはリージョン内の全AZ
      });

      const cluster = new ecs.Cluster(this, "MyCluster", {
        vpc: vpc
      });

      // パブリックなロードバランサーを持つ Fargate サービスを作成
      new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
        cluster: cluster, // 必須
        cpu: 512, // デフォルトは 256
        desiredCount: 6, // デフォルトは 1
        taskImageOptions: { image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample") },
        memoryLimitMiB: 2048, // デフォルトは 512
        publicLoadBalancer: true // デフォルトは false
      });
    }
  }
  ```

  このクラスは500行以上の AWS CloudFormation テンプレートを生成し、デプロイ時には以下のような50以上のリソースが作成されます。

    - AWS::EC2::EIP
    - AWS::EC2::InternetGateway
    - AWS::EC2::NatGateway
    - AWS::EC2::Route
    - AWS::EC2::RouteTable
    - AWS::EC2::SecurityGroup
    - AWS::EC2::Subnet
    - AWS::EC2::SubnetRouteTableAssociation
    - AWS::EC2::VPCGatewayAttachment
    - AWS::EC2::VPC
    - AWS::ECS::Cluster
    - AWS::ECS::Service
    - AWS::ECS::TaskDefinition
    - AWS::ElasticLoadBalancingV2::Listener
    - AWS::ElasticLoadBalancingV2::LoadBalancer
    - AWS::ElasticLoadBalancingV2::TargetGroup
    - AWS::IAM::Policy
    - AWS::IAM::Role
    - AWS::Logs::LogGroup

## AWS CloudFormation を通じたインフラのデプロイ

- **統合されたデプロイ:**  
  AWS CDK は AWS CloudFormation と連携しており、インフラのプロビジョニングや更新を一貫性のある方法で行います。CloudFormation はAWSのマネージドサービスであり、豊富なリソースとプロパティの構成オプションを提供します。  
  CloudFormation を使用することで、エラー時のロールバックを含む予測可能で反復可能なインフラデプロイが可能となります。

## コンストラクトを利用した迅速なアプリケーション開発

- **再利用可能なコンポーネント:**  
  再利用可能なコンポーネント（コンストラクト）を使い、または共有することで、開発を加速できます。
    - **低レベルコンストラクト:** 個々の AWS CloudFormation リソースとそのプロパティを定義
    - **高レベルコンストラクト:** 安全なデフォルト値を持つ大規模なアプリケーションコンポーネントを素早く定義し、コード量を削減

- **カスタムコンストラクト:**  
  自社固有のユースケースに合わせたコンストラクトを作成し、組織内または公開で共有することも可能です。

---

# AWS CDK の例

以下は、AWS CDK コンストラクトライブラリを使用して、Amazon Elastic Container Service (Amazon ECS) のサービスを AWS Fargate ランチタイプで作成する例です。詳細は [Example: Create an AWS Fargate service using the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/ecs_example.html) を参照してください。

```typescript
export class MyEcsConstructStack extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 3 // デフォルトはリージョン内の全AZ
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc
    });

    // パブリックなロードバランサーを持つ Fargate サービスを作成
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
      cluster: cluster, // 必須
      cpu: 512, // デフォルトは 256
      desiredCount: 6, // デフォルトは 1
      taskImageOptions: { image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample") },
      memoryLimitMiB: 2048, // デフォルトは 512
      publicLoadBalancer: true // デフォルトは false
    });
  }
}
```

このコードにより、500行以上の AWS CloudFormation テンプレートが生成され、デプロイ時には上記のような多様なリソース（EC2、ECS、IAM など）が作成されます。

---

# AWS CDK の機能

## AWS CDK GitHub リポジトリ

- **公式リポジトリ:**  
  公式の AWS CDK GitHub リポジトリは [aws-cdk](https://github.com/aws/aws-cdk) です。ここでは、イシューの投稿、ライセンスの確認、リリースのトラッキングなどが行えます。

- **コミュニティへの貢献:**  
  AWS CDK はオープンソースプロジェクトであるため、より良いツールにするための貢献を奨励しています。詳細は [Contributing to the AWS Cloud Development Kit (AWS CDK)](https://github.com/aws/aws-cdk/blob/main/CONTRIBUTING.md) を参照してください。

## AWS CDK API リファレンス

- **API ドキュメント:**  
  AWS CDK コンストラクトライブラリは、CDK アプリケーションの定義やコンストラクトの追加のための API を提供します。詳細は [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/latest/) をご覧ください。

## コンストラクトプログラミングモデル (CPM)

- **拡張された概念:**  
  コンストラクトプログラミングモデル (CPM) は、AWS CDK の背後にある概念をさらに拡張したもので、以下のツールが CPM を使用しています:
    - CDK for Terraform (CDKtf)
    - CDK for Kubernetes (CDK8s)
    - Projen（プロジェクト構成の作成ツール）

## コンストラクトハブ

- **オンラインレジストリ:**  
  コンストラクトハブは、オープンソースの AWS CDK ライブラリを見つけ、公開、共有するためのオンラインレジストリです。

---

# 次のステップ

AWS CDK の使用を開始するには、[Getting started with the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) をご覧ください。

---

# 詳細情報

AWS CDK についてさらに学ぶためのリソースは以下の通りです。

- **AWS CDK コア概念:**  
  AWS CDK の重要な概念や用語について学ぶ。

- **AWS CDK ワークショップ:**  
  ハンズオン形式で AWS CDK を学び、実際に使用するワークショップ。

- **AWS CDK パターン:**  
  AWS の専門家によって作成された、AWS CDK 用のオープンソースサーバーレスアーキテクチャパターンのコレクション。

- **AWS CDK コード例:**  
  AWS CDK プロジェクトの例が集められた GitHub リポジトリ。

- **cdk.dev:**  
  AWS CDK に関するコミュニティ主導のハブ（Slack ワークスペースも含む）。

- **Awesome CDK:**  
  AWS CDK のオープンソースプロジェクト、ガイド、ブログ、その他リソースのキュレーションリストを提供する GitHub リポジトリ。

- **AWS ソリューションズ コンストラクト:**  
  本番環境にすぐに組み込める、検証済みの IaC パターン。

- **AWS Developer Tools Blog:**  
  AWS CDK に関連するブログ記事。

- **AWS CDK on Stack Overflow:**  
  Stack Overflow で「aws-cdk」タグが付いた質問。

- **AWS Cloud9 用 AWS CDK チュートリアル:**  
  AWS Cloud9 開発環境で AWS CDK を使用するためのチュートリアル。

さらに、AWS CDK に関連するツールやトピックを学ぶためには、以下も参考にしてください。

- **AWS CloudFormation の概念:**  
  AWS CDK は AWS CloudFormation を利用しているため、主要な CloudFormation の概念について理解することを推奨します。

- **AWS 用語集:**  
  AWS 全体で使用される主要な用語の定義。

- **サーバーレスアプリケーションの開発・デプロイを簡素化するツール:**
    - **AWS Serverless Application Model:** サーバーレスアプリケーションのビルドと実行を簡素化するオープンソースのツール。
    - **AWS Chalice:** Python でサーバーレスアプリを作成するためのフレームワーク。

---
# AWS CDK ブートストラッピング

ブートストラッピングとは、AWS Cloud Development Kit (AWS CDK) を利用するために、AWS 環境を準備するプロセスのことです。CDK スタックを AWS 環境にデプロイする前に、その環境をブートストラップする必要があります。

---

## ブートストラッピングとは？

ブートストラッピングは、AWS CDK が利用する特定の AWS リソースを環境内にプロビジョニングすることで、環境を準備します。これらのリソースは一般に「ブートストラップリソース」と呼ばれ、以下のものが含まれます。

- **Amazon S3 バケット:**  
  CDK プロジェクトのファイル（例: AWS Lambda 関数コードやアセット）を保存するために使用されます。

- **Amazon ECR リポジトリ:**  
  主に Docker イメージを保存するために使用されます。

- **AWS IAM ロール:**  
  AWS CDK によるデプロイメントを実行するために必要な権限を付与するために設定されます。詳細は [IAM roles created during bootstrapping](#) をご参照ください。

---

## ブートストラッピングの仕組み

CDK が利用するリソースとその設定は、AWS CloudFormation テンプレートとして定義されています。このテンプレートは CDK チームによって作成・管理されており、最新のテンプレートは [bootstrap-template.yaml](https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk/lib/api/bootstrap/bootstrap-template.yaml) をご参照ください。

環境をブートストラップするには、AWS CDK コマンドラインインターフェイス (CLI) の `cdk bootstrap` コマンドを使用します。CDK CLI はテンプレートを取得し、AWS CloudFormation を通じて「ブートストラップスタック」としてデプロイします。デフォルトでは、このスタックの名前は `CDKToolkit` です。このテンプレートをデプロイすることで、CloudFormation により環境内に必要なリソースがプロビジョニングされ、ブートストラップスタックは AWS CloudFormation コンソールに表示されます。

また、`cdk bootstrap` コマンドのオプションやテンプレートのカスタマイズにより、ブートストラッピングを調整することも可能です。

---

## 注意点

AWS の各環境は独立しているため、AWS CDK を利用する各環境について、事前にブートストラッピングを実施する必要があります。

---

## 詳細情報

環境のブートストラッピング手順の詳細については、[Bootstrap your environment for use with the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html) をご参照ください。
# AWS CDK スタックの概要

AWS CDK スタックは、デプロイの最小単位です。スタックは、CDK コンストラクトを使用して定義された AWS リソースの集まりを表します。CDK アプリをデプロイすると、CDK スタック内のリソースは AWS CloudFormation スタックとしてまとめてデプロイされます。AWS CloudFormation スタックの詳細については、[Managing AWS resources as a single unit with AWS CloudFormation stacks](https://docs.aws.amazon.com/cloudformation/latest/userguide/cfn-console-stacks.html) をご参照ください。

スタックは、Stack コンストラクトを拡張または継承することで定義されます。以下の例は、スタックファイルと呼ばれる別ファイルで CDK スタックを定義する一般的なパターンです。ここでは、Stack クラスを拡張し、scope、id、props を受け取るコンストラクタを定義し、受け取った引数を使用して基底クラスの Stack コンストラクタを super で呼び出しています。

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyCdkStack extends cdk.Stack { 
  constructor(scope: Construct, id: string, props?: cdk.StackProps) { 
    super(scope, id, props); 
    
    // ここにコンストラクトを定義します

  }
}
```

前述の例ではスタックのみを定義していますが、スタックを作成するには、CDK アプリのコンテキスト内でインスタンス化する必要があります。一般的なパターンとして、CDK アプリを定義し、スタックを初期化するアプリケーションファイル（エントリポイント）を別に作成します。

以下は、`MyCdkStack` という名前の CDK スタックを作成する例です。ここでは、CDK アプリを作成し、そのコンテキスト内で `MyCdkStack` をインスタンス化しています。

```typescript
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyCdkStack } from '../lib/my-cdk-stack';

const app = new cdk.App();
new MyCdkStack(app, 'MyCdkStack', {
});
```

また、次の例は 2 つのスタックを含む CDK アプリを作成する例です。

```typescript
const app = new App();

new MyFirstStack(app, 'stack1');
new MySecondStack(app, 'stack2');

app.synth();
```

---

## スタック API について

Stack オブジェクトは、以下のような豊富な API を提供します。

- **`Stack.of(construct)`**
    - 静的メソッドで、指定したコンストラクトが定義されているスタックを返します。再利用可能なコンストラクト内からスタックにアクセスする場合に有用です。スタックが見つからない場合はエラーとなります。

- **`stack.stackName` (Python: `stack_name`)**
    - スタックの物理名を返します。すべての AWS CDK スタックは、合成時に AWS CDK によって解決される物理名を持ちます。

- **`stack.region` および `stack.account`**
    - それぞれ、このスタックがデプロイされる AWS リージョンおよびアカウントを返します。これらのプロパティは以下のいずれかを返します:
        - スタック定義時に明示的に指定されたアカウントまたはリージョン
        - AWS CloudFormation の疑似パラメータに解決される文字列トークン（スタックが環境に依存しない場合）

  環境の決定方法については、[Environments for the AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/environments.html) を参照してください。

- **`stack.addDependency(otherStack)` (Python: `stack.add_dependency(other_stack)`)**
    - 2 つのスタック間に明示的な依存関係を定義します。複数のスタックを同時にデプロイする際に、`cdk deploy` コマンドはこの順序を尊重します。

- **`stack.tags`**
    - スタックレベルのタグを追加または削除するための TagManager を返します。このタグマネージャーは、スタック内のすべてのリソースおよび、CloudFormation 経由で作成されたスタック自体にタグ付けを行います。

- **`stack.partition`, `stack.urlSuffix` (Python: `url_suffix`), `stack.stackId` (Python: `stack_id`), `stack.notificationArn` (Python: `notification_arn`)**
    - それぞれ、AWS CloudFormation の疑似パラメータ（例: `{ "Ref": "AWS::Partition" }`）に解決されるトークンを返します。これらのトークンは、クロススタック参照を識別するために特定のスタックオブジェクトに関連付けられています。

- **`stack.availabilityZones` (Python: `availability_zones`)**
    - このスタックがデプロイされる環境で利用可能なアベイラビリティゾーンのセットを返します。環境に依存しないスタックの場合、常に 2 つのアベイラビリティゾーンの配列が返されます。環境固有のスタックの場合、AWS CDK は指定されたリージョンで利用可能な正確なアベイラビリティゾーンのセットをクエリします。

- **`stack.parseArn(arn)` および `stack.formatArn(comps)` (Python: `parse_arn`, `format_arn`)**
    - Amazon Resource Name (ARN) を操作するために使用できます。

- **`stack.toJsonString(obj)` (Python: `to_json_string`)**
    - 任意のオブジェクトを JSON 文字列にフォーマットします。オブジェクト内のトークン、属性、参照はデプロイ時に解決されます。

- **`stack.templateOptions` (Python: `template_options`)**
    - スタックに適用する AWS CloudFormation テンプレートのオプション（Transform、Description、Metadata など）を指定するために使用します。

---

## スタックの操作

スタックは、AWS 環境（特定の AWS アカウントおよびリージョン）に AWS CloudFormation スタックとしてデプロイされます。

`cdk synth` コマンドを複数スタックを含むアプリで実行すると、クラウドアセンブリには各スタックインスタンスごとに個別のテンプレートが生成されます。同じクラスのインスタンスであっても、AWS CDK はそれらを個別のテンプレートとして出力します。

特定のスタックのテンプレートを合成するには、スタック名を指定して `cdk synth` コマンドを実行します。例えば、`stack1` のテンプレートを合成するには次のように実行します:

```bash
$ cdk synth stack1
```

このアプローチは、AWS CloudFormation テンプレートが通常、複数回デプロイされ、CloudFormation パラメータでパラメータ化される使い方とは概念的に異なります。AWS CloudFormation パラメータは AWS CDK 内で定義可能ですが、デプロイ時にのみ解決されるため、コード内でその値を取得することはできません。

たとえば、パラメータ値に基づいてリソースを条件付きで含める場合、AWS CloudFormation の条件を設定し、リソースにタグ付けする必要があります。AWS CDK は、合成時に具体的なテンプレートが解決されるアプローチを取るため、if 文を使用してリソースを定義するかどうか、または特定の動作を適用するかを決定できます。

> **注意:**  
> AWS CDK は、プログラミング言語の自然な使用法を可能にするため、できる限り合成時に解決を行います。

また、スタックは他のコンストラクトと同様にグループ化して構成できます。以下のコードは、コントロールプレーン、データプレーン、モニタリングの 3 つのスタックから構成されるサービスの例です。このサービスコンストラクトは、ベータ環境と本番環境の 2 つで定義されています。

```typescript
import { App, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface EnvProps {
  prod: boolean;
}

// これらのスタックは、関連するリソース群を宣言していると仮定します
class ControlPlane extends Stack {}
class DataPlane extends Stack {}
class Monitoring extends Stack {}

class MyService extends Construct {

  constructor(scope: Construct, id: string, props?: EnvProps) {
    super(scope, id);
  
    // prod 引数を用いて、サービスの構成を変更することも可能
    new ControlPlane(this, "cp");
    new DataPlane(this, "data");
    new Monitoring(this, "mon");
  }
}

const app = new App();
new MyService(app, "beta");
new MyService(app, "prod", { prod: true });

app.synth();
```

この AWS CDK アプリは、最終的に環境ごとに 3 つずつ、計 6 つのスタックから構成されます。例えば、`cdk ls` コマンドを実行すると、以下のような出力が得られます:

```
betacpDA8372D3
betadataE23DB2BA
betamon632BD457
prodcp187264CE
proddataF7378CE5
prodmon631A1083
```

AWS CloudFormation スタックの物理名は、スタックのコンストラクトツリー内のパスに基づいて AWS CDK によって自動的に決定されます。デフォルトでは、スタックの名前は Stack オブジェクトのコンストラクト ID から派生しますが、`stackName` プロパティ（Python では `stack_name`）を使用して明示的に指定することも可能です。

```typescript
new MyStack(this, 'not:a:stack:name', { stackName: 'this-is-stack-name' });
```

---

## ネストされたスタックの利用

ネストされたスタックとは、親スタック内に作成する CDK スタックのことです。ネストされたスタックは、`NestedStack` コンストラクトを使用して作成します。

ネストされたスタックを利用することで、複数のスタックにまたがるリソースを整理することができます。また、ネストされたスタックは、AWS CloudFormation の 500 リソース制限を回避する手段としても利用可能です。ネストされたスタックは、それを含むスタック内では 1 つのリソースとしてカウントされますが、500 までのリソース（さらにネストされたスタックを含む）を含むことができます。

ネストされたスタックのスコープは、`Stack` または `NestedStack` コンストラクトでなければなりません。ネストされたスタックは、親スタック内に字句的に宣言される必要はなく、インスタンス化時に親スタックをスコープとして渡すだけで構いません。それ以外の点では、ネストされたスタック内でのコンストラクトの定義は通常のスタックと同じです。

合成時に、ネストされたスタックは独自の AWS CloudFormation テンプレートに合成され、デプロイ時に AWS CDK のスタッジバケットへアップロードされます。ネストされたスタックは親スタックに束縛され、独立したデプロイメント成果物としては扱われません。`cdk list` コマンドには表示されず、`cdk deploy` で個別にデプロイすることもできません。

親スタックとネストされたスタック間の参照は、他のクロススタック参照と同様に、生成された AWS CloudFormation テンプレート内でスタックパラメータおよび出力に自動的に変換されます。

> **警告:**  
> ネストされたスタックの場合、セキュリティ姿勢の変更はデプロイ前に表示されません。これらの情報はトップレベルのスタックのみで表示されます。

---
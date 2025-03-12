### Trusted Language Extensions を使用して Amazon RDS for PostgreSQL に UUIDv7 を実装する
**著者:** Anthony Leung  
**投稿日:** 2024年7月25日  
**カテゴリ:** Amazon RDS、Intermediate (200)、オープンソース、RDS for PostgreSQL

---

#### はじめに
ユニバーサリ一意識別子（UUID）は、中央の管理者を必要とせず一意であることを保証するために設計された128ビットの値です。これにより、特に分散システムにおいてデータベースの主キーとして最適な選択肢となります。従来、UUIDの生成方法として最も一般的だったのは UUID Version 4（UUIDv4）であり、これはランダムに生成されるため実装が容易でした。

しかし、主キーの選択はワークロードパターンに応じたアプリケーションのパフォーマンスに影響を与えます。UUIDv4は便利な反面、そのランダム性がデータのアクセスや挿入時に最適でないパフォーマンスを引き起こす可能性があります。理想的には、よくアクセスされるデータは B-tree などのデータベースインデックス上で近接して配置されることで、連続したクエリ時にディスクからの読み込みを避け、キャッシュヒット率を向上させることが望まれます。UUIDv4 のランダムな分布はこの「時間的局所性」の問題を引き起こし、全体のパフォーマンスに悪影響を及ぼす可能性があります。

この問題を解決する一つの方法は、共通してアクセスされるデータをまとめる主キーとして、タイムスタンプを利用することです。多くのアプリケーションでは、同じ時刻に作成されたデータをまとめてクエリする傾向があるためです。

#### UUIDv7 の登場
UUID Version 7（UUIDv7）は、UUIDv4 のランダム性の問題を改善するために導入されました。UUIDv7 は、先頭48ビットにミリ秒精度のUnixタイムスタンプをエンコードするため、時間に基づいた連続性を持ち、UUIDv4 の持つ時間的局所性の欠点を解消します。データの挿入が作成順にクラスタ化され、特定の時間に関連するデータの取得も容易になります。

現時点で PostgreSQL は UUIDv1、UUIDv3、UUIDv4、UUIDv5 の生成をネイティブにサポートしていますが、執筆時点では UUIDv7 のサポートはありません。しかし、Trusted Language Extensions for PostgreSQL（pg_tle）を利用することで、今日から UUIDv7 の機能を追加することが可能です。さらに、将来的に PostgreSQL が UUIDv7 をネイティブにサポートした場合でも、この実装は従来のバージョンと新しいバージョンの双方で動作します。

Trusted Language Extensions（pg_tle）は、PostgreSQL 上で安全に高パフォーマンスな拡張機能を構築するためのオープンソース開発キットです。開発者は PL/Rust、JavaScript、Perl、PL/pgSQL などの信頼された言語を利用して高性能なデータベース拡張機能を作成できます。本記事では、信頼された言語として PL/Rust を用い、UUIDv7 を生成する Trusted Language Extension（TLE）の作成およびインストール方法を解説するとともに、その内部実装について詳しく説明します。

#### ソリューション概要
Amazon RDS for PostgreSQL は、Trusted Language Extensions および PL/Rust 拡張機能をサポートしています。PL/Rust を使用すると、Rust 言語による安全かつ高性能なデータベース関数の作成が可能です。本例では、以下のユースケースをカバーする3つの PL/Rust 関数を含む UUIDv7 TLE をインストールします。

- **UUIDv7 の生成**
- **ユーザー指定のタイムスタンプから UUIDv7 の生成**
- **UUIDv7 から PostgreSQL のタイムスタンプ（timestamptz 型）へのタイムスタンプ抽出**

これらの3つのデータベース関数は TLE にパッケージ化され、TLE をインストールすればすぐに UUIDv7 を利用開始できます。

Amazon RDS for PostgreSQL は、PL/pgSQL、PL/Perl、PL/v8（JavaScript）、PL/Tcl など、他の信頼されたプログラミング言語もサポートしています。

#### 前提条件
本記事の例を実行するには、PostgreSQL 16.1 以降、15.2 以降、14.9 以降、または 13.12 以降を実行している RDS for PostgreSQL インスタンスまたは Multi-AZ DB クラスターのプロビジョニングが必要です。さらに、DB パラメータグループの `shared_preload_libraries` パラメータに pg_tle と plrust を追加し、対象の PostgreSQL インスタンスに割り当てる必要があります。AWS CLI を使用して以下のようにパラメータグループを作成・変更することができます。

```bash
REGION="us-east-1"

aws rds create-db-parameter-group \
  --db-parameter-group-name pg16-plrust \
  --db-parameter-group-family postgres16 \
  --description "Parameter group that contains PL/Rust settings for PostgreSQL 16" \
  --region "${REGION}"

aws rds modify-db-parameter-group \
  --db-parameter-group-name pg16-plrust \
  --parameters "ParameterName='shared_preload_libraries',ParameterValue='pg_tle,plrust',ApplyMethod=pending-reboot" \
  --region "${REGION}"
```

既存のデータベースインスタンスの `shared_preload_libraries` を変更した場合、インスタンスの再起動後に反映されます。AWS マネジメントコンソールから直接パラメータグループを変更することも可能です。カスタムパラメータグループを用いてインスタンスを作成すれば、インスタンス利用可能時に pg_tle と plrust を直ちに利用できます。詳細は「DB パラメータグループの操作」を参照してください。

#### UUIDv7 Trusted Language Extension のインストール
Trusted Language Extensions のオープンソース GitHub リポジトリでは、拡張機能のインストール方法を提供しています。UUIDv7 拡張を pg_tle に登録した後、以下のコマンドで対象データベースに拡張が存在するか確認できます。

```sql
SELECT * FROM pgtle.available_extensions();
```

以下のような出力が得られるはずです。

```
   name   | default_version |        comment
---------+-----------------+-----------------------
 uuid_v7 |       1.0       | extension for uuid v7
(1 row)
```

次に、対象データベースで plrust 拡張をインストールします。

```sql
CREATE EXTENSION plrust;
```

実行結果は以下のようになります。

```
CREATE EXTENSION
```

最後に、対象データベースで UUIDv7 拡張をインストールします。

```sql
CREATE EXTENSION uuid_v7;
```

実行結果は以下の通りです。

```
CREATE EXTENSION
```

これで、uuid_v7 拡張の利用が可能となります。

#### UUIDv7 の生成
以下のコマンドで UUIDv7 を生成できます。

```sql
SELECT generate_uuid_v7();
```

実行結果は次のようになります（一例）。

```
           generate_uuid_v7
--------------------------------------
 018d803a-da84-77f3-839d-24347c51137e
(1 row)
```

※ UUIDv7 はランダムかつ一意、かつ時間に基づくため、環境によって異なる値が生成されます。

#### 指定したタイムスタンプから UUIDv7 の生成
過去または未来のタイムスタンプに関連するデータ用に、指定したタイムスタンプから UUIDv7 を生成することも可能です。以下のコマンドを実行します。

```sql
SELECT timestamptz_to_uuid_v7('2024-02-07 20:29:26.776+00');
```

実行結果例は以下の通りです。

```
        timestamptz_to_uuid_v7
--------------------------------------
 018d8542-d778-7c51-bdb9-0ba5e494f3ef
(1 row)
```

※ 環境により異なる UUIDv7 が生成されます。

#### UUIDv7 からタイムスタンプの抽出
UUIDv7 からタイムスタンプを抽出するには、次のコマンドを使用します。

```sql
SELECT uuid_v7_to_timestamptz('018d8542-d778-72fe-9e66-8c8878dc53b5');
```

実行結果例は以下の通りです。

```
   uuid_v7_to_timestamptz
----------------------------
 2024-02-07 20:29:26.776+00
(1 row)
```

#### 拡張機能の内部実装の詳細
ここでは、拡張機能の内部実装について詳しく見ていきます。前述の通り、本拡張は UUIDv7 の生成および、与えられた UUIDv7 からタイムスタンプを抽出する3つの関数を提供します。本ソリューションでは、メモリ安全性と C 言語に匹敵するパフォーマンスを持つ Rust 言語を採用しています。PL/Rust の詳細については [PL/Rust ガイド] を参照してください。

##### generate_uuid_v7 関数の詳細
全ての UUID は128ビット長です。UUIDv7 は、先頭48ビットにミリ秒精度の Unix タイムスタンプをエンコードし、残りのビットには UUID のバージョンやバリアント、及び一意性を担保するためのランダムなビットが格納されます。完全な実装は GitHub リポジトリで公開されています。

まず、PL/Rust 関数内で使用する依存関係を宣言します。本関数では Rust の `rand` クレートを使用してランダムなビットを生成し、UUIDv7 にエンコードしています。

```toml
[dependencies]
rand = "0.8.5"
```

次に、固定サイズ16の u8 の配列を表す Rust の型エイリアス `UuidBytes` を定義します。

```rust
type UuidBytes = [u8; 16];
```

続いて、UUIDv7 を生成するために現在のタイムスタンプを取得します。pgrx フレームワークが提供する `clock_timestamp` API を使用すると、PostgreSQL の `clock_timestamp` と同等のタイムスタンプ（Datum 型）が取得できます。

```rust
let now = pgrx::clock_timestamp();
```

取得した Datum 型のタイムスタンプから、1970-01-01 00:00:00 UTC からの秒数（エポック）を抽出し、1,000 を掛けることでミリ秒単位の u64 型のタイムスタンプに変換します。

```rust
let epoch_in_millis_numeric: AnyNumeric = now
    .extract_part(DateTimeParts::Epoch)
    .expect("Unable to extract epoch from clock timestamp")
    * 1000;

let epoch_in_millis_normalized = epoch_in_millis_numeric.floor().normalize().to_owned();
let millis = epoch_in_millis_normalized
    .parse::<u64>()
    .expect("Unable to convert from timestamp from type AnyNumeric to u64");
```

ランダムなバイト列を生成するため、`rand` クレートを用いて16バイトのランダムな u8 配列を返すヘルパーメソッドを定義します。実際にはそのうち10バイトのみが必要です。

```rust
fn rng_bytes() -> [u8; 16] {
    rand::random()
}
```

次に、タイムスタンプを UUID の先頭48ビットにエンコードできるよう、u32 と u16 に分割します。また、UUID の各フィールドにバージョンとバリアントを設定します。以下の実装は、Rust の `uuid` クレートを参照しています。

```rust
fn encode_unix_timestamp_millis(millis: u64, random_bytes: &[u8; 10]) -> (u32, u16, u16, [u8; 8]) {
    let millis_high = ((millis >> 16) & 0xFFFF_FFFF) as u32;
    let millis_low = (millis & 0xFFFF) as u16;
    let random_and_version =
        (random_bytes[1] as u16 | ((random_bytes[0] as u16) << 8) & 0x0FFF) | (0x7 << 12);
    let mut d4 = [0; 8];
    d4[0] = (random_bytes[2] & 0x3F) | 0x80;
    d4[1] = random_bytes[3];
    d4[2] = random_bytes[4];
    d4[3] = random_bytes[5];
    d4[4] = random_bytes[6];
    d4[5] = random_bytes[7];
    d4[6] = random_bytes[8];
    d4[7] = random_bytes[9];
    (millis_high, millis_low, random_and_version, d4)
}
```

続いて、これまでの各コンポーネントを組み合わせ、16バイトの UUID を生成します。こちらも `uuid` クレートを参照した実装です。

```rust
fn generate_uuid_bytes_from_fields(d1: u32, d2: u16, d3: u16, d4: &[u8; 8]) -> UuidBytes {
    [
        (d1 >> 24) as u8,
        (d1 >> 16) as u8,
        (d1 >> 8) as u8,
        d1 as u8,
        (d2 >> 8) as u8,
        d2 as u8,
        (d3 >> 8) as u8,
        d3 as u8,
        d4[0],
        d4[1],
        d4[2],
        d4[3],
        d4[4],
        d4[5],
        d4[6],
        d4[7],
    ]
}
```

最後に、pgrx が提供する `UUID::from_bytes` API を利用して、`UuidBytes` から UUID を構築します。

##### uuid_v7_to_timestamptz 関数の詳細
次に、`uuid_v7_to_timestamptz` 関数について見ていきます。完全な実装は GitHub リポジトリで確認できますが、本関数は UUID を引数として受け取り、対応するタイムスタンプを PostgreSQL の `timestamptz` 型で返します。

UUID は16バイトの配列（128ビット）として表現されます。UUIDv7 ではタイムスタンプが先頭48ビットにエンコードされているため、最初の6バイトを取得し、ビッグエンディアン形式のバイト配列から u64 型に変換します。この値は 1970-01-01 00:00:00 UTC からのミリ秒数を表します。

ここで、PostgreSQL の `to_timestamp` 関数を使用して `timestamptz` 型に変換します。pgrx フレームワークは Rust 用に同等の `to_timestamp` 関数を提供しており、ミリ秒単位の値を秒単位に変換するために 1000 で割ります。

```sql
CREATE FUNCTION uuid_v7_to_timestamptz(uuid UUID)
RETURNS timestamptz
as $$
    // UUID のタイムスタンプは先頭48ビットにエンコードされています。
    // 先頭6バイトをビッグエンディアン形式で u64 に変換し、ミリ秒を取得します。
    let uuid_bytes = uuid.as_bytes();
    let mut timestamp_bytes = [0u8; 8];
    timestamp_bytes[2..].copy_from_slice(&uuid_bytes[0..6]);
    let millis = u64::from_be_bytes(timestamp_bytes);

    // PostgreSQL の to_timestamp 関数は double 型を受け取り、
    // pgrx::to_timestamp は f64 型を受け取ります。
    // したがって、ミリ秒単位の値を 1000 で割り、秒単位に変換します。
    let epoch_in_seconds_with_precision = millis as f64 / 1000 as f64;

    Ok(Some(pgrx::to_timestamp(epoch_in_seconds_with_precision)))
$$ LANGUAGE plrust
STRICT VOLATILE;
```

##### timestamptz_to_uuid_v7 関数の詳細
最後に、`timestamptz_to_uuid_v7` 関数について説明します。本関数は PostgreSQL の `timestamptz` 型のタイムスタンプを受け取り、対応する UUIDv7 を返します。実装の詳細は GitHub リポジトリにて確認できますが、基本的な実装は `generate_uuid_v7` 関数と同様で、唯一の違いは、現在時刻ではなく、引数で渡されたタイムスタンプを用いて UUIDv7 を生成する点です。

#### パフォーマンス比較
ここでは、PL/pgSQL、PL/Rust、そしてオープンソースの pg_uuidv7 拡張（C実装）を用いて UUIDv7 を生成する際のパフォーマンスを比較します。

テストには pgbench を用い、1クライアントで30秒間、各実装における UUIDv7 生成のトランザクション毎秒（TPS）を測定しました。

**PL/pgSQL 実装の場合:**

```
scaling factor: 1
query mode: simple
number of clients: 1
number of threads: 1
maximum number of tries: 1
duration: 30 s
number of transactions actually processed: 133893
number of failed transactions: 0 (0.000%)
latency average = 0.225 ms
initial connection time = 3.123 ms
tps = 4443.079779 (without initial connection time)
```

**pg_uuidv7 拡張（C実装）の場合:**

```
scaling factor: 1
query mode: simple
number of clients: 1
number of threads: 1
maximum number of tries: 1
duration: 30 s
number of transactions actually processed: 191788
number of failed transactions: 0 (0.000%)
latency average = 0.157 ms
initial connection time = 3.108 ms
tps = 6353.201681 (without initial connection time)
```

**PL/Rust を使用した generate_uuid_v7 関数の場合:**

```
scaling factor: 1
query mode: simple
number of clients: 1
number of threads: 1
maximum number of tries: 1
duration: 30 s
number of transactions actually processed: 203792
number of failed transactions: 0 (0.000%)
latency average = 0.147 ms
initial connection time = 3.031 ms
tps = 6793.741512 (without initial connection time)
```

この実験結果から、PL/pgSQL を用いた場合は PL/Rust に比べ約30% TPS が低く、PL/Rust の実装は C で実装された pg_uuidv7 拡張と同等のパフォーマンスを示していることが分かります。

#### クリーンアップ
UUIDv7 拡張をアンインストールするには、以下のコマンドを実行します。

```sql
DROP EXTENSION uuid_v7 CASCADE;
```

実行結果は以下の通りです。

```
DROP EXTENSION
```

不要になった RDS for PostgreSQL インスタンスは削除可能です。

#### 結論
本記事では、UUIDv7 のサポート不足から生じる課題と、Trusted Language Extensions for PostgreSQL（pg_tle）を活用して UUIDv7 を利用可能にする方法について解説しました。また、提供される各機能の詳細やその実装方法、その背景にある考え方について掘り下げ、さらに異なる言語で実装した場合のパフォーマンス比較を行いました。結果として、pg_tle と PL/Rust を用いた本実装は、C で実装された pg_uuidv7 拡張と同等のパフォーマンスを実現していることが示されました。

#### 著者について
Anthony Leung は AWS のマネージド PostgreSQL に注力するソフトウェア開発エンジニアです。彼は Amazon RDS for PostgreSQL で提供されている複数の機能の開発に携わっています。


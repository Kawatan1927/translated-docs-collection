## `errors` – パッケージ例外
このモジュールは、データベースエラーを表現し、検査するためのオブジェクトを提供します。

### DB-API 例外
DB-API に準拠し、Psycopg によって発生するすべての例外は、以下のクラスから派生します。

```
Exception
│__ Warning
│__ Error
    │__ InterfaceError
    │__ DatabaseError
        │__ DataError
        │__ OperationalError
        │__ IntegrityError
        │__ InternalError
        │__ ProgrammingError
        │__ NotSupportedError
```
これらのクラスは、このモジュール (`errors`) および `psycopg` のルートモジュールの両方から利用できます。

---

## `psycopg.Error` 例外
Psycopg が発生させるすべてのエラーの基本例外クラス。

この例外は、他のすべてのエラー例外の基底クラスです。一つの `except` 文で全エラーをキャッチしたい場合に使用できます。

この例外は、pickle 可能であることが保証されています。

#### `diag`
エラーの詳細を調査するための `Diagnostic` オブジェクト。

#### `sqlstate: str | None = None`
サーバーから受け取ったエラーコード。

この属性は、SQLSTATE 例外クラスのクラス属性としても利用できます。

#### `pgconn: pq.PGconn | None`
接続試行中に発生したエラーの際の接続オブジェクト。

接続はすでに閉じられ、BAD 状態になりますが、例えば `needs_password` や `used_password` 属性を確認することで、正確に何が問題だったのかを調べるのに役立ちます。この接続で操作を行おうとすると `OperationalError` が発生します。

**バージョン 3.1 で追加。**

#### `pgresult: pq.PGresult | None`
失敗したクエリの実行後に発生した例外の際の結果オブジェクト。

**バージョン 3.1 で追加。**

---

## `psycopg.Warning` 例外
重要な警告に対して発生する例外。

DB-API 互換性のために定義されていますが、Psycopg では発生しません。

---

## `psycopg.InterfaceError` 例外
データベースそのものではなく、データベースインターフェースに関するエラー。

---

## `psycopg.DatabaseError` 例外
データベース関連のエラーが発生した場合に発生する例外。

---

## `psycopg.DataError` 例外
処理中のデータに問題がある場合に発生するエラー。

例: 0 での除算、数値の範囲外の値、など。

---

## `psycopg.OperationalError` 例外
データベースの運用に関するエラー。

これらのエラーは必ずしもプログラマーが制御できるものではありません。例えば、予期しない切断、データソース名が見つからない、トランザクションを処理できなかった、メモリ割り当てエラーが発生した場合などです。

---

## `psycopg.IntegrityError` 例外
データベースのリレーショナル整合性が損なわれた場合に発生するエラー。

例: 外部キー制約違反。

---

## `psycopg.InternalError` 例外
データベースが内部エラーを検出した場合に発生するエラー。

例: カーソルが無効になった、トランザクションが同期していない、など。

---

## `psycopg.ProgrammingError` 例外
プログラミングエラーが発生した場合に発生する例外。

例: テーブルが見つからない、すでに存在する、SQL 文の構文エラー、パラメータの数が間違っている、など。

---

## `psycopg.NotSupportedError` 例外
データベースがサポートしていないメソッドまたは API を使用した場合に発生する例外。

---

## その他の Psycopg 独自のエラー

### `psycopg.errors.ConnectionTimeout`
`connect()` メソッドのタイムアウト時に発生する例外。

`connect_timeout` が指定され、有効な時間内に接続が確立できなかった場合に発生します。

`OperationalError` のサブクラス。

---

### `psycopg.errors.CancellationTimeout`
`cancel_safe()` メソッドのタイムアウト時に発生する例外。

`OperationalError` のサブクラス。

---

### `psycopg.errors.PipelineAborted`
現在のパイプラインが中断された状態で操作を試みた場合に発生する例外。

`OperationalError` のサブクラス。

---

## エラー診断 (`Diagnostic` クラス)
データベースのエラーレポートの詳細情報を取得するためのクラス。

このオブジェクトは、`Error.diag` 属性として利用でき、また `add_notice_handler()` で登録されたコールバック関数に渡されます。

このクラスの属性は、`PQresultErrorField()` 関数から取得できる情報を提供します。例えば、`severity` 属性は `PG_DIAG_SEVERITY` コードを返します。各属性の意味については PostgreSQL のドキュメントを参照してください。

### 利用可能な属性
- `column_name`
- `constraint_name`
- `context`
- `datatype_name`
- `internal_position`
- `internal_query`
- `message_detail`
- `message_hint`
- `message_primary`
- `schema_name`
- `severity`
- `severity_nonlocalized`
- `source_file`
- `source_function`
- `source_line`
- `sqlstate`
- `statement_position`
- `table_name`

各属性の値は、サーバーから送信されたエラーに対してのみ利用可能です。すべてのエラー、すべてのサーバーバージョンで利用できるわけではありません。

---

## SQLSTATE 例外
データベースサーバーからのエラー（例: 接続失敗などのクライアント側エラーではないもの）には、通常 5 文字のエラーコード (`SQLSTATE`) があります。これは `Error.diag.sqlstate` 属性で取得できます。

Psycopg では、各 SQLSTATE に対して異なるクラスを用意しており、データベースの特定の状況に応じたエラーハンドリングを簡単に行うことができます。

**例**
```python
try:
    cur.execute("LOCK TABLE mytable IN ACCESS EXCLUSIVE MODE NOWAIT")
except psycopg.errors.LockNotAvailable:
    locked = True
```
例外クラスの名前は、PostgreSQL の公式ドキュメントにある「条件名」から CamelCase に変換されています。例えば、エラーコード `22012` (`division_by_zero`) は `DivisionByZero` クラスとして利用できます。

バージョン 3.1.4 では、PostgreSQL 15 で追加された例外をサポート。

---

## `psycopg.errors.lookup(sqlstate: str)`
エラーコードまたは定数名を検索し、対応する例外クラスを返します。

**使用例**
```python
try:
    cur.execute("LOCK TABLE mytable IN ACCESS EXCLUSIVE MODE NOWAIT")
except psycopg.errors.lookup("UNDEFINED_TABLE"):
    missing = True
except psycopg.errors.lookup("55P03"):
    locked = True
```
エラーコード (`55P03` など) や定数名 (`UNDEFINED_TABLE` など) から、対応する例外を取得できます。

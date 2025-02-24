# 接続クラス

**Connection** クラスと **AsyncConnection** クラスは、PostgreSQL データベースセッションの主要なラッパーです。これらは、psql セッションに似た役割を果たします。

psql と比較した場合の違いのひとつとして、通常、**Connection** はトランザクションを自動的に処理します。つまり、明示的にコミットするまで、他のセッションからは変更内容が見えなくなります。詳細については、「トランザクション管理」をご参照ください。

---

## The Connection クラス

```python
class psycopg.Connection
```

データベースへの接続をラップするクラスです。

このクラスは DBAPI 準拠のインターフェースを実装しており、従来型のブロッキングプログラム（必要に応じてスレッドや Eventlet/gevent を利用して同時実行性を確保する場合）を書くときに使用します。もし、あなたのプログラムが asyncio を使用している場合は、代わりに **AsyncConnection** を使うとよいでしょう。

接続はコンテキストマネージャとして振る舞います。すなわち、`with` ブロックを抜ける際に、現在のトランザクションがコミットされ（例外発生時はロールバックされ）、接続が閉じられます。

### クラスメソッド `connect`

```python
classmethod connect(conninfo: str = '', *,
                   autocommit: bool = False,
                   prepare_threshold: int | None = 5,
                   context: Optional[AdaptContext] = None,
                   row_factory: Optional[RowFactory[Row]] = None,
                   cursor_factory: Cursor[+Row]] = None,
                   **kwargs: Optional[Union[str, int]]) → Self
```

データベースサーバーに接続し、新しい **Connection** インスタンスを返します。

#### パラメーター

- **conninfo**  
  接続先および接続方法を指定する接続文字列（`postgresql://` URL または `key=value` ペアのリスト）。

- **kwargs**  
  接続文字列を指定する追加パラメーター。これらは `conninfo` で指定されたものを上書きします。

- **autocommit**  
  `True` の場合、自動的にトランザクションを開始しません。詳細は「トランザクション管理」を参照してください。

- **row_factory**  
  フェッチしたデータの各レコードをどのような型で作成するかを指定する行ファクトリです（デフォルトは `tuple_row()` ）。詳細は「行ファクトリ」を参照してください。

- **cursor_factory**  
  接続の `cursor_factory` 属性の初期値です（Psycopg 3.1 から新機能）。

- **prepare_threshold**  
  接続の `prepare_threshold` 属性の初期値です（Psycopg 3.1 から新機能）。

さらに、より特殊な使い方として以下のパラメーターも指定できます:

- **context**  
  初期のアダプター設定をコピーするためのコンテキストです。これは、カスタマイズされたローダーやダンパーを持つ `AdaptersMap` であり、複数の接続を作成するためのテンプレートとして使用できます。詳細は「データ適応設定」を参照してください。

このメソッドは `psycopg.connect()` としてもエイリアスされています。

#### 関連項目

- 受け入れられる接続パラメーターの一覧
- 接続に影響を与える環境変数

*※ バージョン 3.1 から、`prepare_threshold` および `cursor_factory` パラメーターが追加されました。*

---

### メソッド `close() → None`

データベース接続を閉じます。

**注意**  
以下のように書くことで、`with` ブロックを抜けた際に自動的に接続が閉じられます:

```python
with psycopg.connect() as conn:
    ...
```

- **closed**  
  接続が閉じられている場合は `True`。

- **broken**  
  接続が中断された場合は `True`。  
  中断された接続は常に閉じられますが、`close()` や `with` ブロックなどの正常な方法で閉じられたわけではありません。

---

### メソッド `cursor()`

```python
cursor(*, binary: bool = False,
       row_factory: Optional[RowFactory] = None) → Cursor

cursor(name: str, *,
       binary: bool = False,
       row_factory: Optional[RowFactory] = None,
       scrollable: Optional[bool] = None,
       withhold: bool = False) → ServerCursor
```

接続に対してコマンドやクエリを送信するための新しいカーソルを返します。

#### パラメーター

- **name**  
  指定しない場合はクライアントサイドカーソルが作成され、指定した場合はサーバーサイドカーソルが作成されます。詳細は「カーソルの種類」を参照してください。

- **binary**  
  `True` の場合、データベースからバイナリ値を返します。クエリで返されるすべての型にはバイナリローダーが必要です。詳細は「バイナリパラメーターと結果」を参照してください。

- **row_factory**  
  指定された場合、接続に設定された `row_factory` を上書きします。詳細は「行ファクトリ」を参照してください。

- **scrollable**  
  サーバーサイドカーソル作成時に、その `scrollable` プロパティを指定します。

- **withhold**  
  サーバーサイドカーソル作成時に、その `withhold` プロパティを指定します。

#### 戻り値

`cursor_factory`（または名前が指定された場合は `server_cursor_factory`）で指定されたクラスのカーソルが返されます。

**注意**  
以下のように書くことで、`with` ブロックを抜けた際に自動的にカーソルが閉じられます:

```python
with conn.cursor() as cur:
    ...
```

- **cursor_factory: type[Cursor[Row]]**  
  `cursor()` や `execute()` によって返される型またはファクトリ関数です。  
  デフォルトは `psycopg.Cursor` です。

- **server_cursor_factory: type[ServerCursor[Row]]**  
  名前が指定された場合に `cursor()` が返す型またはファクトリ関数です。  
  デフォルトは `psycopg.ServerCursor` です。

- **row_factory: RowFactory[Row]**  
  `fetchone()` などのカーソルのフェッチメソッドが返す行の型を定義する行ファクトリです。  
  デフォルトは `tuple_row` で、これはフェッチメソッドが単純なタプルを返すことを意味します。  
  詳細は「行ファクトリ」を参照してください。

---

### メソッド `execute`

```python
execute(query: Query, params: Params | None = None, *,
        prepare: bool | None = None, binary: bool = False) → Cursor[Row]
```

指定されたクエリを実行し、その結果を読み込むためのカーソルを返します。

#### パラメーター

- **query**  
  実行するクエリ（`str`、`bytes`、`sql.SQL`、または `sql.Composed` のいずれか）。

- **params**  
  クエリに渡すパラメーター（シーケンスまたはマッピング）。必要な場合に指定します。

- **prepare**  
  クエリの準備済みステートメントを強制（`True`）または禁止（`False`）します。デフォルト（`None`）の場合は自動的に準備されます。詳細は「準備済みステートメント」を参照してください。

- **binary**  
  `True` の場合、カーソルはデータベースからバイナリ値を返します。クエリで返されるすべての型にはバイナリローダーが必要です。詳細は「バイナリパラメーターと結果」を参照してください。

このメソッドは単に `Cursor` インスタンスを作成し、指定されたクエリを `execute()` して返します。

詳細なクエリ実行方法については、「SQL クエリへのパラメーターの渡し方」をご覧ください。

---

### メソッド `pipeline()`

```python
pipeline() → Iterator[Pipeline]
```

接続をパイプラインモードに切り替えるコンテキストマネージャです。

このメソッドはコンテキストマネージャとして呼び出す必要があり、以下のように使用します:

```python
with conn.pipeline() as p:
    ...
```

ブロックの終了時に同期ポイントが確立され、接続は通常モードに戻ります。

パイプラインブロック内から再帰的に呼び出すことも可能です。最も内側のブロックが終了した際に同期ポイントが確立されますが、外側のブロックが終了するまでパイプラインモードは継続されます。

詳細は「パイプラインモードのサポート」を参照してください。

*※ バージョン 3.1 から追加されました。*

---

## トランザクション管理メソッド

詳細は「トランザクション管理」をご覧ください。

### メソッド `commit() → None`

現在のトランザクションの変更をデータベースにコミットします。

### メソッド `rollback() → None`

現在のトランザクションを開始時の状態にロールバックします。

### メソッド `transaction`

```python
transaction(savepoint_name: str | None = None,
            force_rollback: bool = False) → Iterator[Transaction]
```

新しいトランザクションまたはネストされたトランザクションのコンテキストブロックを開始します。

#### パラメーター

- **savepoint_name**  
  ネストされたトランザクションを管理するためのセーブポイント名。`None` の場合は自動的に名前が選ばれます。

- **force_rollback**  
  エラーがなくても（たとえば、ノーオペレーションのプロセスを試す場合など）ブロック終了時にトランザクションをロールバックします。

#### 戻り値

- **Transaction** オブジェクト

**注意**  
以下のように呼び出す必要があります:

```python
with conn.transaction():
    ...
```

または、トランザクションオブジェクトとやり取りする必要がある場合は:

```python
with conn.transaction() as tx:
    ...
```

トランザクションブロック内では `commit()` や `rollback()` を直接呼び出すことはできません。

---

### プロパティおよび設定メソッド

- **autocommit**  
  接続のオートコミット状態です。  
  同期接続の場合は書き込み可能ですが、非同期接続の場合は読み取り専用となり、`await set_autocommit(value)` を使用する必要があります。

- **set_autocommit(value: bool) → None**  
  オートコミットの setter のメソッド版です。  
  *※ バージョン 3.2 から追加されました。*

以下の 3 つのプロパティは、新規トランザクションの特性を制御します。詳細は「トランザクション特性」を参照してください。

- **isolation_level**  
  新規トランザクションの分離レベル。  
  `None` の場合、サーバーの `default_transaction_isolation` 設定が使用されます。

- **set_isolation_level(value: psycopg.IsolationLevel | None) → None**  
  `isolation_level` の setter のメソッド版です。  
  *※ バージョン 3.2 から追加されました。*

- **read_only**  
  新規トランザクションの読み取り専用状態。  
  `None` の場合、サーバーの `default_transaction_read_only` 設定が使用されます。

- **set_read_only(value: bool | None) → None**  
  `read_only` の setter のメソッド版です。  
  *※ バージョン 3.2 から追加されました。*

- **deferrable**  
  新規トランザクションのデファラブル状態。  
  `None` の場合、サーバーの `default_transaction_deferrable` 設定が使用されます。

- **set_deferrable(value: bool | None) → None**  
  `deferrable` の setter のメソッド版です。  
  *※ バージョン 3.2 から追加されました。*

---

### 接続状態の確認および設定

- **pgconn: psycopg.pq.PGconn**  
  この **Connection** の内部で使用されている libpq の接続ラッパーです。  
  これを使用して、PostgreSQL に対して低レベルのコマンドを送信したり、Psycopg でラップされていない機能にアクセスすることができます。

- **info**  
  接続プロパティを確認するための **ConnectionInfo** 属性です。

- **prepare_threshold**  
  クエリが実行されるたびに準備（prepared statement）される回数を指定します。  
  `0` に設定すると、初回の実行からクエリが準備されます。  
  `None` に設定すると、接続で準備済みステートメントは無効になります。  
  デフォルト値: 5  
  詳細は「準備済みステートメント」を参照してください。

- **prepared_max**  
  接続上の準備済みステートメントの最大数です。  
  `None` の場合、準備済みステートメントの数に制限はありません。デフォルトは 100 です。  
  もし準備するクエリの数が多くなると、古いものから順に解放されます。  
  ミドルウェアなど、解放をサポートしない場合は `None` を指定すると有用です。  
  *※ バージョン 3.2 から、`None` の指定がサポートされました。*

---

### その他の便利なメソッド

#### `cancel_safe(*, timeout: float = 30.0) → None`

接続上の現在の操作をキャンセルします。

- **パラメーター**
    - **timeout**  
      キャンセル要求がタイムアウト秒数以内に成功しない場合、`CancellationTimeout` が発生します。

このメソッドは、libpq のバージョン 17 以降で利用可能な、より安全で改善されたキャンセル機能を活用した非ブロッキング版です。  
もし基盤の libpq がバージョン 17 より古い場合、このメソッドは従来の `cancel()` の実装にフォールバックします。

**注意**
- `has_cancel_safe` キャパビリティを使用することで、`cancel_safe()` がレガシーな libpq 関数にフォールバックしないかどうかを確認できます。
- libpq がバージョン 17 より古い場合、`timeout` パラメーターは効果がありません。
- シグナルハンドラとしてこのメソッドを使用しないでください。その場合は `cancel()` を使用してください。

*※ バージョン 3.2 から追加されました。*

---

#### `cancel() → None`

接続上の現在の操作をキャンセルします。

**警告**  
この `cancel()` メソッドは、PostgreSQL 17 以降では非推奨となった `PQcancel` 関数を使用して実装されており、以下の問題があります:

- 非同期接続の場合でもブロッキングする。
- 元の接続がセキュアであった場合でも、不正な接続を使用する可能性がある。

したがって、可能な場合は `cancel_safe()` を使用してください。

**注意**  
`cancel_safe()` とは異なり、この `cancel()` はシグナルハンドラ内から呼び出しても安全です。これが、このメソッドを使用する唯一のケースとなるでしょう。

---

#### `notifies(*, timeout: Optional[float] = None, stop_after: Optional[int] = None) → Generator[Notify]`

データベースから通知（NOTIFY）が届いた際に、`Notify` オブジェクトを順次返すジェネレーターです。

- **パラメーター**
    - **timeout**  
      通知を待つ最大時間（秒）。`None` の場合はタイムアウトなし。

    - **stop_after**  
      この数の通知を受け取った後に停止します。同時に複数の通知が届いた場合、この数より多く受け取ることもあります。

`LISTEN` を使用している接続では、他のセッションが `NOTIFY` を発行すると通知が受信されます。

*※ バージョン 3.2 から、`timeout` と `stop_after` パラメーターが追加されました。*

---

#### `add_notify_handler(callback: Callable[[Notify], None]) → None`

通知が受信された際に呼び出されるコールバックを登録します。

- **パラメーター**
    - **callback**  
      通知が受信された際に呼び出されるコールバック関数（引数は `Notify` オブジェクト）。

詳細は「非同期通知」を参照してください。

---

#### `remove_notify_handler(callback: Callable[[Notify], None]) → None`

以前に登録した通知用のコールバックを解除します。

- **パラメーター**
    - **callback**  
      削除する通知用コールバック関数。

---

#### `add_notice_handler(callback: Callable[[Diagnostic], None]) → None`

サーバーからの通知メッセージ（NOTICE）が届いた際に呼び出されるコールバックを登録します。

- **パラメーター**
    - **callback**  
      メッセージ受信時に呼び出されるコールバック関数（引数は `Diagnostic` オブジェクト）。

詳細は「サーバーメッセージ」を参照してください。

---

#### `remove_notice_handler(callback: Callable[[Diagnostic], None]) → None`

以前に登録した通知メッセージ用のコールバックを解除します。

- **パラメーター**
    - **callback**  
      削除する通知メッセージ用コールバック関数。

---

#### `fileno() → int`

接続のファイルディスクリプタを返します。

この関数を利用することで、`selectors` モジュールなどの、準備状態を待つファイルライクなオブジェクトとして接続を利用できます。

---

### 二相コミット（Two-Phase Commit）サポートメソッド

*※ バージョン 3.1 から追加されました。*

詳細は「二相コミットプロトコルのサポート」を参照してください。

#### `xid(format_id: int, gtrid: str, bqual: str) → Xid`

二相コミット用のトランザクション ID を作成し、その `format_id`、`gtrid`、`bqual` 属性を持つ `Xid` オブジェクトを返します。

引数の型や制約については、「二相コミットプロトコルのサポート」を参照してください。

---

#### `tpc_begin(xid: psycopg.Xid | str) → None`

指定されたトランザクション ID (`xid`) を使用して、二相コミット（TPC）トランザクションを開始します。

- **パラメーター**
    - **xid**  
      トランザクションの ID。`xid()` メソッドで返されたオブジェクトまたは単なる文字列を指定できます。文字列の場合は、その文字列が PostgreSQL のトランザクション ID として使用されます。詳細は `tpc_recover()` を参照してください。

このメソッドは、直前に `commit()` または `rollback()` が呼ばれており、現在トランザクションが存在しない状態（IDLE）で呼び出す必要があります。  
また、TPC トランザクション中は `commit()` や `rollback()` を直接呼び出すと `ProgrammingError` が発生します。

---

#### `tpc_prepare() → None`

`tpc_begin()` により開始されたトランザクションの第一段階を実行します。

このメソッドは、TPC トランザクション以外の状態で使用すると `ProgrammingError` が発生します。  
`tpc_prepare()` 呼び出し後は、`tpc_commit()` または `tpc_rollback()` が呼ばれるまで、文（ステートメント）の実行はできなくなります。

詳細は、PostgreSQL の `PREPARE TRANSACTION` コマンドを参照してください。

---

#### `tpc_commit`

```python
tpc_commit(xid: Optional[Union[Xid, str]] = None) → None
```

準備済みの二相トランザクションをコミットします。

- **パラメーター**
    - **xid**  
      トランザクションの ID。  
      引数なしで呼び出す場合、`tpc_prepare()` で準備されたTPCトランザクションをコミットします。  
      `tpc_prepare()` 以前に呼び出された場合は、単一段階のコミットが実行されます。  
      もしトランザクション ID を引数として指定する場合、データベースはそのトランザクションをコミットします。不正なトランザクション ID が指定された場合は `ProgrammingError` が発生します。この形式はトランザクション外で呼び出すべきで、リカバリー時に使用されます。

呼び出し後、TPCトランザクションは終了します。

詳細は PostgreSQL の `COMMIT PREPARED` コマンドを参照してください。

---

#### `tpc_rollback`

```python
tpc_rollback(xid: Optional[Union[Xid, str]] = None) → None
```

準備済みの二相トランザクションをロールバックします。

- **パラメーター**
    - **xid**  
      トランザクションの ID。  
      引数なしで呼び出す場合、TPCトランザクションをロールバックします（`tpc_prepare()` 前後どちらでも可）。  
      トランザクション ID を指定する場合、不正な ID が指定されると `ProgrammingError` が発生します。この形式はトランザクション外で呼び出すべきで、リカバリー時に使用されます。

呼び出し後、TPCトランザクションは終了します。

詳細は PostgreSQL の `ROLLBACK PREPARED` コマンドを参照してください。

---

#### `tpc_recover() → list[psycopg.Xid]`

保留中のトランザクションの一覧を、`Xid` オブジェクトのリストとして返します。  
これらは `tpc_commit()` や `tpc_rollback()` といったリカバリ操作に利用できます。

もし Psycopg 以外の方法で開始されたトランザクションの場合、返される `Xid` オブジェクトの `format_id` と `bqual` は `None` に、`gtrid` には PostgreSQL のトランザクション ID が格納されます。これらの `Xid` はリカバリーに使用可能です。  
Psycopg は、PostgreSQL JDBC ドライバーと同様のアルゴリズムを用いて XA トリプルを文字列にエンコードしているため、そのドライバーで開始されたトランザクションも正しく展開されます。

返される `Xid` には、サーバーから読み取った `prepared`、`owner`、`database` などの追加属性も含まれます。

詳細は、システムビュー `pg_prepared_xacts` を参照してください。

---

## The AsyncConnection クラス

```python
class psycopg.AsyncConnection
```

データベースへの接続をラップするクラスです。

このクラスは DBAPI に触発されたインターフェースを実装しており、ブロッキングメソッドはすべてコルーチンとして実装されています。  
（特に明記されていない場合、非ブロッキングメソッドは **Connection** クラスと共通です。）

以下のメソッドは、対応する **Connection** のメソッドと同じ動作をしますが、`await` キーワードを用いて呼び出す必要があります。

### クラスメソッド `connect`

```python
async classmethod connect(conninfo: str = '',
                           *,
                           autocommit: bool = False,
                           prepare_threshold: int | None = 5,
                           context: Optional[AdaptContext] = None,
                           row_factory: Optional[AsyncRowFactory[Row]] = None,
                           cursor_factory: AsyncCursor[+Row]] = None,
                           **kwargs: Optional[Union[str, int]]) → Self
```

データベースサーバーに接続し、新しい **AsyncConnection** インスタンスを返します.

*※ バージョン 3.1 から、ドメイン名の解決が非同期で自動的に行われるようになりました。以前のバージョンでは、`hostaddr` パラメーターを指定するか、`resolve_hostaddr_async()` 関数を使用しないと名前解決がブロッキングしていました。*

---

### メソッド `close() → None`

```python
async close() → None
```

データベース接続を閉じます。

**注意**  
非同期接続の場合も、`async with` を使用することで、ブロック終了時に自動的に接続を閉じることが可能ですが、非同期接続特有の注意点があるため、「async connections での with の使い方」を参照してください。

---

### メソッド `cursor()`

```python
cursor(*, binary: bool = False,
       row_factory: Optional[RowFactory] = None) → AsyncCursor

cursor(name: str, *,
       binary: bool = False,
       row_factory: Optional[RowFactory] = None,
       scrollable: Optional[bool] = None,
       withhold: bool = False) → AsyncServerCursor
```

接続に対してコマンドやクエリを送信するための新しい非同期カーソルを返します。

**注意**  
以下のように `async with` を使用することで、ブロック終了時に自動的にカーソルが閉じられます:

```python
async with conn.cursor() as cur:
    ...
```

- **cursor_factory: type[AsyncCursor[Row]]**  
  デフォルトは `psycopg.AsyncCursor` です。

- **server_cursor_factory: type[AsyncServerCursor[Row]]**  
  名前が指定された場合に使用されるデフォルトは `psycopg.AsyncServerCursor` です。

- **row_factory: AsyncRowFactory[Row]**

---

### メソッド `execute`

```python
async execute(query: Query,
              params: Params | None = None,
              *,
              prepare: bool | None = None,
              binary: bool = False) → AsyncCursor[Row]
```

指定されたクエリを実行し、その結果を非同期に読み込むためのカーソルを返します。

---

### メソッド `pipeline()`

```python
pipeline() → AsyncIterator[AsyncPipeline]
```

接続をパイプラインモードに切り替える非同期コンテキストマネージャです。

**注意**  
必ず以下のように `async with` を用いて呼び出してください:

```python
async with conn.pipeline() as p:
    ...
```

---

### メソッド `commit() → None`

```python
async commit() → None
```

現在のトランザクションの変更をデータベースにコミットします。

---

### メソッド `rollback() → None`

```python
async rollback() → None
```

現在のトランザクションを開始時の状態にロールバックします。

---

### メソッド `transaction`

```python
transaction(savepoint_name: str | None = None,
            force_rollback: bool = False) → AsyncIterator[AsyncTransaction]
```

新しいトランザクションまたはネストされたトランザクションの非同期コンテキストブロックを開始します。

#### パラメーター

- **savepoint_name**  
  ネストされたトランザクション用のセーブポイント名。`None` の場合は自動的に名前が選ばれます。

- **force_rollback**  
  エラーがなくてもブロック終了時にトランザクションをロールバックします。

#### 戻り値

- **AsyncTransaction** オブジェクト

**注意**  
以下のように `async with` を用いて呼び出してください:

```python
async with conn.transaction() as tx:
    ...
```

---

### 非同期キャンセルメソッド

#### `cancel_safe(*, timeout: float = 30.0) → None`

```python
async cancel_safe(*, timeout: float = 30.0) → None
```

接続上の現在の操作を非同期でキャンセルします。

- **パラメーター**
    - **timeout**  
      キャンセル要求が指定秒数以内に成功しなかった場合、`CancellationTimeout` が発生します。

このメソッドは、libpq のバージョン 17 以降で利用可能な、より安全で改善されたキャンセル機能を活用した非ブロッキング版です。  
基盤の libpq がバージョン 17 より古い場合、従来の `cancel()` の実装にフォールバックします。

*※ バージョン 3.2 から追加されました。*

---

#### `notifies`

```python
async notifies(*, timeout: Optional[float] = None,
               stop_after: Optional[int] = None) → AsyncGenerator[Notify]
```

データベースから通知（NOTIFY）が届いた際に、非同期に `Notify` オブジェクトを順次返すジェネレーターです。

- **パラメーター**
    - **timeout**  
      通知を待つ最大時間（秒）。`None` の場合はタイムアウトなし。

    - **stop_after**  
      指定した数の通知を受信した後に停止します。同時に複数の通知が届いた場合、指定数より多く受信する可能性があります。

*※ バージョン 3.2 から、`timeout` と `stop_after` パラメーターが追加されました。*

---

### 非同期設定メソッド

- **set_autocommit(value: bool) → None**  
  非同期接続のオートコミット状態を設定するメソッドです。

- **set_isolation_level(value: psycopg.IsolationLevel | None) → None**  
  非同期接続の `isolation_level` を設定するメソッドです。

- **set_read_only(value: bool | None) → None**  
  非同期接続の `read_only` 状態を設定するメソッドです。

- **set_deferrable(value: bool | None) → None**  
  非同期接続の `deferrable` 状態を設定するメソッドです。

---

### 非同期二相コミットメソッド

- **tpc_prepare() → None**  
  非同期で、`tpc_begin()` により開始されたトランザクションの第一段階を実行します。

- **tpc_commit(xid: Optional[Union[Xid, str]] = None) → None**  
  非同期で、準備済みの二相トランザクションをコミットします。

- **tpc_rollback(xid: Optional[Union[Xid, str]] = None) → None**  
  非同期で、準備済みの二相トランザクションをロールバックします。

- **tpc_recover() → list[psycopg.Xid]**  
  保留中の二相トランザクションの一覧を、`Xid` オブジェクトのリストとして非同期に返します。

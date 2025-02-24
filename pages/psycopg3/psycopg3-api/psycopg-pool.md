# psycopg_pool – コネクションプールの実装

コネクションプールとは、PostgreSQL の接続を限定された数だけ作成・維持するためのオブジェクトです。これにより、プログラムが動作中の接続を取得するまでの時間を短縮し、サーバー上のリソースを制御された量で、大量の同時実行スレッドやタスクが利用できるようになります。詳細および利用パターンについては「Connection pools」を参照してください。

このパッケージでは、いくつかのコネクションプールクラスが提供されています。

- **ConnectionPool**  
  同期的なコネクションプールで、`Connection` オブジェクトを返します。マルチスレッドアプリケーションで使用できます。

- **AsyncConnectionPool**  
  インターフェイスは `ConnectionPool` に似ていますが、ブロッキング関数の代わりに asyncio 関数を使用し、`AsyncConnection` インスタンスを返します。

- **NullConnectionPool**  
  `ConnectionPool` のサブクラスで、親クラスと同じインターフェイスを公開しますが、未使用の接続を内部状態に保持しません。詳細および関連ユースケースについては「Null connection pools」を参照してください。

- **AsyncNullConnectionPool**  
  `NullConnectionPool` と同様の動作をしますが、`AsyncConnectionPool` と同じ非同期インターフェイスを持ちます。

> **注記**  
> psycopg_pool パッケージはメインの psycopg パッケージとは別に配布されています。利用するには、`pip install "psycopg[pool]"` または `pip install psycopg_pool` を実行してください。接続プールのインストール方法については「Installing the connection pool」をご覧ください。

> バージョン番号は psycopg_pool パッケージのものを指し、psycopg のものではありません。

---

## ConnectionPool クラス

```python
class psycopg_pool.ConnectionPool(
    conninfo: str = '',
    *,
    connection_class: type[~CT] = <class 'psycopg.Connection'>,
    kwargs: ~typing.Optional[dict[str, typing.Any]] = None,
    min_size: int = 4,
    max_size: ~typing.Optional[int] = None,
    open: ~typing.Optional[bool] = None,
    configure: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    check: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    reset: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    name: ~typing.Optional[str] = None,
    timeout: float = 30.0,
    max_waiting: int = 0,
    max_lifetime: float = 3600.0,
    max_idle: float = 600.0,
    reconnect_timeout: float = 300.0,
    reconnect_failed: ~typing.Optional[~typing.Callable[[~psycopg_pool.pool.ConnectionPool[~typing.Any]], None]] = None,
    num_workers: int = 3
)
```

このクラスは、`Connection` インスタンス（またはそのサブクラス）を提供するコネクションプールを実装しています。コンストラクタは多くの引数を持ちますが、基本となるのは `conninfo` と `min_size` のみで、他の引数は意味のあるデフォルト値が設定されており、後で必要に応じて調整できるようになっています。

### パラメータ

- **conninfo (str)**  
  接続文字列です。詳細は `connect()` を参照してください。

- **connection_class (type, default: Connection)**  
  提供する接続のクラスです。`Connection` のサブクラスである必要があります。

- **kwargs (dict)**  
  `connect()` に渡す追加の引数です。これはプールのコンストラクタのひとつの dict 引数として渡され、`connect()` のキーワードパラメータとして展開されます。

- **min_size (int, default: 4)**  
  プールが保持する接続の最小数です。接続が失われた（クローズ、破損）場合、プールは積極的に新しい接続を作成し、`min_size` を下回らないようにします。

- **max_size (int, default: None)**  
  プールが保持する接続の最大数です。`None` または `min_size` と等しい場合、プールは成長も縮小もしません。`min_size` より大きい場合、同時に `min_size` を超える接続要求があった際にプールは拡大し、一定期間以上使用されなかった追加の接続は `max_idle` 秒後に縮小されます。

- **open (bool, default: True)**  
  True の場合、初期化時に必要な接続を作成し、プールを開きます。False の場合は、`open()` メソッドが呼ばれるか、プールのコンテキストマネージャに入るときにプールが開かれます。詳細は `open()` メソッドのドキュメントを参照してください。

- **configure (Callable[[Connection], None])**  
  接続作成後に接続を設定するためのコールバックです。例えば、アダプターの設定などに利用できます。内部クエリ（データベースの状態確認など）で接続を使用する場合、関数を抜ける前にトランザクションを終了していることを確認してください。

- **check (Callable[[Connection], None])**  
  プールから接続を取得する際に、その接続が正常に動作しているかを確認するためのコールバックです。コールバックは `getconn()` または `connection()` のたびに呼ばれ、例外が発生しなかった場合のみクライアントに接続が渡されます。デフォルトでは、接続に対して何もチェックは行いません。シンプルなチェックを行いたい場合は、プールの static メソッド `check_connection()` を指定することができます。

- **reset (Callable[[Connection], None])**  
  接続がプールに返された後にリセットするためのコールバックです。接続は必ず「アイドル状態」（トランザクションがない状態）で `reset()` に渡されます。`reset()` を抜けるとき、接続はアイドル状態でなければならず、そうでない場合は接続が破棄されます。

- **name (str)**  
  プールに付ける任意の名前です。例えば、複数のプールを使用している場合、ログで識別するために役立ちます。指定しなかった場合は、`pool-1`, `pool-2` のように自動で順番に名前が付けられます。

- **timeout (float, default: 30秒)**  
  クライアントがプールから接続を受け取るために待機できる最大時間（秒）です（`connection()` または `getconn()` を使用する場合）。なお、これらのメソッドではタイムアウトのデフォルト値を上書きすることができます。

- **max_waiting (int, default: 0)**  
  プールに接続待ちとしてキューイングできるリクエストの最大数です。これを超えると新しいリクエストは `TooManyRequests` 例外を発生させます。0 はキューの制限がないことを意味します。

- **max_lifetime (float, default: 1時間)**  
  プール内の接続の最大寿命（秒）です。これより長く使用された接続はクローズされ、新しい接続と交換されます。この値は、同時に大量の接続が切断されるのを避けるため、10% のランダムな値が減算されます。

- **max_idle (float, default: 10分)**  
  未使用状態の接続がプールに滞留できる最大時間（秒）です。これは、`min_size` を超える接続に対してのみ適用され、`max_size` によってプールが拡大できる場合に、アイドル状態が一定時間続くと接続はクローズされます。

- **reconnect_timeout (float, default: 5分)**  
  プールが接続を作成する際の最大試行時間（秒）です。接続試行が失敗した場合、プールは指数バックオフとランダムな要素を用いて再接続を試みます。再試行が続き、`reconnect_timeout` 秒を超えた場合、接続試行は中止され、`reconnect_failed()` コールバックが呼び出されます。

- **reconnect_failed (Callable[[ConnectionPool], None])**  
  新しい接続の作成試行が `reconnect_timeout` 秒以上失敗した場合に呼び出されるコールバックです。たとえば、このコールバック内でプログラムを終了（`sys.exit()` の実行など）させることが可能です。デフォルトでは何もしません：接続数が `min_size` を下回った場合は、新たな接続試行が再開されます。

- **num_workers (int, default: 3)**  
  プールの状態を維持するために使用されるバックグラウンドワーカースレッドの数です。バックグラウンドワーカーは、例えば新しい接続の作成や、プールに返却された接続のクリーンアップに利用されます。

> **変更履歴**
> - バージョン 3.1 で、コンストラクタに `open` パラメータが追加されました。
> - バージョン 3.2 で、コンストラクタに `check` パラメータが追加されました。
> - バージョン 3.2 で、このクラスはジェネリックになり、`connection_class` により型変数が提供されるようになりました（Generic pool types を参照）。

> **警告**  
> 現時点では、`open` パラメータのデフォルト値は True ですが、将来的には False に変更される予定です。  
> プールをコンストラクタで開いている（つまり、プールをコンテキストマネージャとして使用せずに暗黙的に開いている）と期待する場合は、明示的に `open=True` を指定してください。  
> psycopg_pool 3.2 以降、暗黙的なオープンを期待してプールを使用すると、`open` が指定されていない場合に警告が発生します。

---

### connection(timeout: float | None = None) → Iterator[CT]

プールから接続を取得するためのコンテキストマネージャです。

- 利用可能な接続があれば即座に返し、なければ `timeout`（または `self.timeout`）秒まで待機し、その間に接続が取得できなかった場合は `PoolTimeout` 例外を発生させます。
- コンテキストを抜けると、接続はプールに返却されます。通常の接続コンテキストの動作（成功時はコミット、エラー時はロールバック）が適用されます。接続が正常な状態でなくなった場合、新しい接続に置き換えられます。

```python
with my_pool.connection() as conn:
    conn.execute(...)
# ここで接続はプールに返却される
```

> **変更履歴**  
> バージョン 3.2 で、返される接続の型が `connection_class` で定義された型として注釈付けされるようになりました（Generic pool types を参照）。

---

### open(wait: bool = False, timeout: float = 30.0) → None

プールを開いて、接続の確立およびクライアントからの接続要求の受付を開始します。

- `wait` が False の場合、直ちに返り、バックグラウンドワーカーが `min_size` > 0 の場合にプールを埋める処理を行います。
- `wait` が True の場合、指定された `timeout` 秒以内に要求された数の接続が準備完了するまで待機します（詳細は `wait()` を参照）。

すでに開いているプール（すでに `open()` が呼ばれている、もしくはプールのコンテキストマネージャに入っている、またはコンストラクタで `open=True` として初期化された場合）に対して再度 `open()` を呼ぶのは安全ですが、一度閉じたプールを再度開くことは現在のところできません。

> **新規追加（バージョン 3.1）**

---

### close(timeout: float = 5.0) → None

プールを閉じ、新たなクライアントからの接続要求を受け付けなくなります。

- すでに待機している、または将来的なクライアントからの接続要求は、`PoolClosed` 例外を発生させて失敗します。
- 現在使用中の接続は、プールに返却されるまで閉じられません。

タイムアウト（秒）を指定すると、その時間内にワーカーの処理が終了するのを待ちます。タイムアウトが経過した場合でもプールは閉じられ、終了時に警告が出る可能性があります。

> **注記**  
> プールはコンテキストマネージャとしても使用できます。この場合、ブロックに入る際に（必要ならば）プールが開かれ、ブロックを抜ける際に閉じられます。

---

### wait(timeout: float = 30.0) → None

作成後、プールが完全に（`min_size` の接続で）満たされるのを待機します。

指定された `timeout` 秒以内に準備が整わなければ、プールを閉じ `PoolTimeout` 例外を発生させます。

このメソッドの呼び出しは必須ではなく、プール作成直後にすぐ利用することも可能です。最初のクライアントは、接続が準備でき次第サービスされます。環境が正しく設定されていない場合に、プログラムを存続させるのではなく終了させたい場合などに、このメソッドを使用できます。

---

### 属性

- **name (str)**  
  作成時に設定されたプールの名前。指定されなかった場合は自動生成（例: pool-1, pool-2）されます。

- **min_size, max_size**  
  プールの現在の最小サイズおよび最大サイズです。実行時にサイズを変更する場合は `resize()` を使用してください。

---

### resize(min_size: int, max_size: Optional[int] = None) → None

実行中にプールのサイズを変更します。

---

### check() → None

プール内の現在の接続状態を検証します。

- 各接続に対してテストを行い、動作している場合はプールに返却し、そうでない場合は破棄して新たな接続を作成します。

---

### static check_connection(conn: CT) → None

接続が正常に動作しているかを検証するシンプルなチェック関数です。

- 接続が正常な場合は何もせず、問題がある場合は例外を発生させます。

この関数は内部的に `check()` で使用されていますが、プール作成時のチェックコールバックとしてクライアント側で使用することもできます。

> **新規追加（バージョン 3.2）**

---

### get_stats() → dict[str, int]

プールの使用状況に関する現在の統計情報を返します。

---

### pop_stats() → dict[str, int]

プールの使用状況に関する現在の統計情報を返します。  
呼び出し後、すべてのカウンターがゼロにリセットされます。  
詳細は「Pool stats」に記載されているメトリクスを参照してください。

---

#### 利用上の注意（使用頻度が低い機能）

- **getconn(timeout: Optional[float] = None) → CT**  
  プールから接続を取得します。  
  通常はコンテキストマネージャとして `connection()` を使用することが推奨されます。  
  この関数を使用する場合、使用後に対応する `putconn()` を必ず呼び出してください。これを怠るとプールが枯渇してしまいます。

- **putconn(conn: CT) → None**  
  接続をプールに返却します。  
  `getconn()` とペアで使用してください。コンテキストマネージャ（`connection()`）を使用している場合は、これらの関数を直接使用する必要はありません。

---

## プール例外

- **class psycopg_pool.PoolTimeout**  
  許容時間内にプールが接続を提供できなかった場合に発生する例外です。  
  `OperationalError` のサブクラスです。

- **class psycopg_pool.PoolClosed**  
  閉じたプールから接続を取得しようとした場合に発生する例外です。  
  `OperationalError` のサブクラスです。

- **class psycopg_pool.TooManyRequests**  
  接続を待機するキューにリクエストが多すぎる場合に発生する例外です。  
  `OperationalError` のサブクラスです。

---

## AsyncConnectionPool クラス

`AsyncConnectionPool` は、`ConnectionPool` クラスに非常に似たインターフェイスを持っていますが、ブロッキング関数が非同期の coroutine として実装されています。  
このクラスは、`AsyncConnection` のインスタンス（または `connection_class` パラメータで指定されたサブクラス）を返します。

以下は、`ConnectionPool` と署名が異なる関数およびパラメータの一覧です。

```python
class psycopg_pool.AsyncConnectionPool(
    conninfo: str = '',
    *,
    connection_class: type[~ACT] = <class 'psycopg.AsyncConnection'>,
    kwargs: ~typing.Optional[dict[str, typing.Any]] = None,
    min_size: int = 4,
    max_size: ~typing.Optional[int] = None,
    open: ~typing.Optional[bool] = None,
    configure: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    check: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    reset: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    name: ~typing.Optional[str] = None,
    timeout: float = 30.0,
    max_waiting: int = 0,
    max_lifetime: float = 3600.0,
    max_idle: float = 600.0,
    reconnect_timeout: float = 300.0,
    reconnect_failed: ~typing.Optional[~typing.Union[
        ~typing.Callable[[~psycopg_pool.pool_async.AsyncConnectionPool[~typing.Any]], None],
        ~typing.Callable[[~psycopg_pool.pool_async.AsyncConnectionPool[~typing.Any]], ~collections.abc.Awaitable[None]]
    ]] = None,
    num_workers: int = 3
)
```

### パラメータの違い

- **connection_class (type, default: AsyncConnection)**  
  提供する接続のクラスです。`AsyncConnection` のサブクラスである必要があります。

- **check (async Callable[[Connection], None])**  
  プールから接続を取得する際に、その接続が正常に動作しているかを非同期にチェックするためのコールバックです。

- **configure (async Callable[[AsyncConnection], None])**  
  接続作成後に接続を設定するための非同期コールバックです。

- **reset (async Callable[[AsyncConnection], None])**  
  接続がプールに返却された後にリセットするための非同期コールバックです。

- **reconnect_failed**  
  `reconnect_timeout` 秒以上、新しい接続作成の試行が失敗した場合に呼び出されるコールバックです。  
  このパラメータは、同期版と同様に動作しますが、非同期（async）で定義することも可能です。

> **変更履歴**
> - バージョン 3.2 で、コンストラクタに `check` パラメータが追加されました。
> - バージョン 3.2 で、`reconnect_failed` パラメータは非同期で指定することも可能になりました。

> **警告**  
> 非同期プールをコンストラクタで開く（`open=True` とする）ことは、将来的にエラーとなる可能性があります。  
> 現在は `open=True` がデフォルトですが、将来的にはこのデフォルトが False に変更されるため、今後も期待通りに動作させるためには、コンストラクタで `open=False` を明示し、`await pool.open()` を呼び出すか、もしくはプールのコンテキストマネージャを使用してください。

```python
pool = AsyncConnectionPool(..., open=False)
await pool.open()
```

または、

```python
async with AsyncConnectionPool(..., open=False) as pool:
    ...
```

psycopg_pool 3.2 以降、非同期プールをコンストラクタで開くと警告が発生します。

---

### connection(timeout: float | None = None) → AsyncIterator[ACT]

プールから接続を取得するための非同期コンテキストマネージャです。

- 利用可能な接続があれば即座に返し、なければ `timeout`（または `self.timeout`）秒まで待機し、その間に接続が取得できなかった場合は `PoolTimeout` 例外を発生させます。
- コンテキストを抜けると、接続はプールに返却されます。通常の接続コンテキストの動作（成功時はコミット、エラー時はロールバック）が適用され、接続が正常でなくなった場合は新しい接続に置き換えられます。

```python
async with my_pool.connection() as conn:
    await conn.execute(...)
# ここで接続はプールに返却される
```

---

### async open(wait: bool = False, timeout: float = 30.0) → None

プールを開いて、接続の確立およびクライアントからの接続要求の受付を開始します。

- `wait` が False の場合、直ちに返り、バックグラウンドワーカーが `min_size` > 0 の場合にプールを埋める処理を行います。
- `wait` が True の場合、指定された `timeout` 秒以内に要求された数の接続が準備完了するまで待機します（詳細は `wait()` を参照）。

すでに開いているプールに対して再度 `open()` を呼ぶのは安全ですが、一度閉じたプールを再度開くことは現在のところできません。

> **新規追加（バージョン 3.1）**

---

### async close(timeout: float = 5.0) → None

プールを閉じ、新たなクライアントからの接続要求を受け付けなくします。

- 待機中のクライアントおよび将来のクライアントは、`PoolClosed` 例外が発生します。
- 現在使用中の接続は、プールに返却されるまで閉じられません。

指定したタイムアウト秒数だけスレッドの終了を待ちます。タイムアウトが経過してもプールは閉じられ、終了時に警告が出る場合があります。

> **注記**  
> プールは非同期コンテキストマネージャとしても使用でき、ブロックに入る際に（必要ならば）プールが開かれ、ブロックを抜ける際に閉じられます。

---

### async wait(timeout: float = 30.0) → None

プールが完全に（`min_size` の接続で）満たされるのを待機します。

指定された `timeout` 秒以内に準備が整わなければ、プールを閉じ `PoolTimeout` 例外を発生させます。

このメソッドの呼び出しは必須ではなく、プール作成直後にすぐ利用することも可能です。最初のクライアントは、接続が準備でき次第サービスされます。環境が正しく設定されていない場合に、プログラムを存続させるのではなく終了させたい場合などに、このメソッドを使用できます。

---

### async resize(min_size: int, max_size: Optional[int] = None) → None

実行中にプールのサイズを変更します。

---

### async check() → None

プール内の現在の接続状態を検証します。

各接続に対してテストを行い、正常であればプールに返却し、問題があれば破棄して新たな接続を作成します。

---

### async static check_connection(conn: ACT) → None

接続が正常に動作しているかを検証するシンプルな非同期チェック関数です。

- 接続が正常な場合は何もせず、問題がある場合は例外を発生させます。

この関数は内部的に `check()` で使用されるほか、プール作成時のチェックコールバックとしてクライアント側で利用することもできます。

> **新規追加（バージョン 3.2）**

---

### async getconn(timeout: Optional[float] = None) → ACT

プールから接続を非同期に取得します。

通常は、コンテキストマネージャとして `connection()` を使用することが推奨されます。  
この関数を使用する場合、使用後に対応する `putconn()` を必ず呼び出してください。これを怠るとプールが枯渇します。

---

### async putconn(conn: ACT) → None

接続をプールに返却します。  
`getconn()` とペアで使用してください。コンテキストマネージャ（`connection()`）を使用している場合は、これらの関数を直接使用する必要はありません。

---

## Null コネクションプール

> **新規追加（バージョン 3.1）**

`NullConnectionPool` は、事前に接続を作成せず、未使用の接続を内部状態に保持しない `ConnectionPool` のサブクラスです。  
インターフェイスは親クラスと完全に互換性がありますが、動作には以下の違いがあります。

```python
class psycopg_pool.NullConnectionPool(
    conninfo: str = '',
    *,
    connection_class: type[~CT] = <class 'psycopg.Connection'>,
    kwargs: ~typing.Optional[dict[str, typing.Any]] = None,
    min_size: int = 0,
    max_size: ~typing.Optional[int] = None,
    open: ~typing.Optional[bool] = None,
    configure: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    check: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    reset: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.CT], None]] = None,
    name: ~typing.Optional[str] = None,
    timeout: float = 30.0,
    max_waiting: int = 0,
    max_lifetime: float = 3600.0,
    max_idle: float = 600.0,
    reconnect_timeout: float = 300.0,
    reconnect_failed: ~typing.Optional[~typing.Callable[[~psycopg_pool.pool.ConnectionPool[~typing.Any]], None]] = None,
    num_workers: int = 3
)
```

その他のコンストラクタパラメータは `ConnectionPool` と同じです。

### 主な違い

- **min_size (int, default: 0)**  
  常に 0 となり、変更できません。

- **max_size (int, default: None)**  
  `None` または 0 の場合、リクエストごとに新しい接続を作成します（最大数の制限はありません）。  
  もし正の値が指定されている場合、`max_size` を超える接続は作成せず、待機しているクライアントはキューイングされます。

- **reset (Callable[[Connection], None])**  
  キューに待機しているクライアントが存在する場合にのみ呼ばれ、既にオープンしている接続に対して実行されます。待機しているクライアントがいない場合、接続はクローズされ破棄されます。

- **max_idle**  
  無視されます。Null プールはアイドル状態の接続を保持しないためです。

---

### wait(timeout: float = 30.0) → None

テスト用に接続を作成します。

この関数の呼び出しにより、データベースとの接続性が期待通りに動作しているか確認できますが、作成された接続はプールに保持されません。

指定した `timeout` 秒以内に準備が整わなければ、プールを閉じ `PoolTimeout` 例外を発生させます。

---

### resize(min_size: int, max_size: Optional[int] = None) → None

実行時にプールのサイズを変更します。  
変更できるのは `max_size` のみであり、`min_size` は 0 のままでなければなりません。

---

### check() → None

操作は何も行いません。  
Null プールは内部状態に接続を保持しないため、チェックする接続が存在しません。

---

## AsyncNullConnectionPool クラス

`AsyncNullConnectionPool` は、`AsyncConnectionPool` のサブクラスであり、動作は `NullConnectionPool` と同様です。  
インターフェイスは親クラスである `AsyncConnectionPool` と同じです。

```python
class psycopg_pool.AsyncNullConnectionPool(
    conninfo: str = '',
    *,
    connection_class: type[~ACT] = <class 'psycopg.AsyncConnection'>,
    kwargs: ~typing.Optional[dict[str, typing.Any]] = None,
    min_size: int = 0,
    max_size: ~typing.Optional[int] = None,
    open: ~typing.Optional[bool] = None,
    configure: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    check: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    reset: ~typing.Optional[~typing.Callable[[~psycopg_pool.abc.ACT], ~collections.abc.Awaitable[None]]] = None,
    name: ~typing.Optional[str] = None,
    timeout: float = 30.0,
    max_waiting: int = 0,
    max_lifetime: float = 3600.0,
    max_idle: float = 600.0,
    reconnect_timeout: float = 300.0,
    reconnect_failed: ~typing.Optional[~typing.Union[
        ~typing.Callable[[~psycopg_pool.pool_async.AsyncConnectionPool[~typing.Any]], None],
        ~typing.Callable[[~psycopg_pool.pool_async.AsyncConnectionPool[~typing.Any]], ~collections.abc.Awaitable[None]]
    ]] = None,
    num_workers: int = 3
)
```

動作は、上記の `NullConnectionPool` と同様です。

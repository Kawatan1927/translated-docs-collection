## コネクションプール

コネクションプールとは、接続の集合を管理し、接続を必要とする関数でそれらを利用できるようにするオブジェクトです。新しい接続を確立するのにかかる時間が比較的長い場合があるため、接続をオープンに保つことでレイテンシを低減できます。

このページでは、Psycopg のコネクションプールの動作に関する基本的な概念について説明します。詳細なプール操作については、ConnectionPool オブジェクトの API を参照してください。

> **注記**  
> コネクションプールのオブジェクトは、メインの psycopg パッケージとは別のパッケージに含まれています。psycopg_pool パッケージを利用するには、  
> `pip install "psycopg[pool]"` または `pip install psycopg_pool`  
> を実行してください。詳しくは「Installing the connection pool」を参照してください。

---

## 基本的なコネクションプールの使用方法

`ConnectionPool` オブジェクトは、複数のスレッドから接続を要求するために利用できます。シンプルで安全な使用方法のひとつは、コンテキストマネージャとして使う方法です。`with` ブロック内で、`connection()` メソッドを使ってプールから接続を要求し、その接続もコンテキストマネージャとして利用できます。

```python
with ConnectionPool(...) as pool:
    with pool.connection() as conn:
        conn.execute("SELECT something FROM somewhere ...")

        with conn.cursor() as cur:
            cur.execute("SELECT something else...")
    # `connection()` コンテキストの終了時には、
    # トランザクションがコミット（正常終了の場合）またはロールバック（例外発生時）され、
    # 接続がプールに返却されます

# プールのコンテキスト終了時には、プールが使用していた全リソースが解放されます
```

`connection()` コンテキストは、`Connection` オブジェクトのコンテキストと同様に動作します。すなわち、ブロックの終了時にトランザクションがオープンな場合、正常終了ならコミット、例外発生ならロールバックされます。詳細は「Transaction contexts」を参照してください。

プールは、あらかじめ設定された最小接続数（min_size）と最大接続数（max_size）の範囲内で、一定数の接続を管理します。プール内部に利用可能な接続が存在すれば、それは即座に `connection()` を呼び出した側に提供されます。もし接続がすぐに用意できない場合は、呼び出し側はキューに入れられ、利用可能になり次第接続が渡されます。

もしアプリケーションがスレッドではなく非同期コードを利用している場合は、`AsyncConnectionPool` を利用し、対応するメソッドに対して `async` および `await` を使います。

```python
async with AsyncConnectionPool(...) as pool:
    async with pool.connection() as conn:
        await conn.execute("SELECT something FROM somewhere ...")

        async with conn.cursor() as cur:
            await cur.execute("SELECT something else...")
```

---

## プールの起動チェック

プールがオープンになると、min_size の接続がまだすべて確立されていなくても、新たなクライアントの要求を受け付けるようになります。しかし、もしアプリケーションの設定が誤っていてデータベースサーバーに接続できない場合、クライアントはブロック状態となり、最終的に `PoolTimeout` で失敗します。

アプリケーションの早い段階で環境が正しく設定されているか確認したい場合は、プールをオープンにした後で `wait()` メソッドを使用できます。これにより、min_size の接続が取得されるまでブロックし、タイムアウト内に取得できなければ `PoolTimeout` で失敗します。

```python
with ConnectionPool(...) as pool:
    pool.wait()
    use_the(pool)
```

---

## 接続のライフサイクル

プールが新たな接続を必要とする場合（プールがオープンになった直後、既存の接続が閉じられた場合、あるいは急激な負荷増加により新しい接続が必要になった場合）、バックグラウンドのプールワーカーが非同期に接続の準備を行います。

1. **接続の作成**  
   ワーカーは、`conninfo`、`kwargs`、および `ConnectionPool` コンストラクタに渡された `connection_class` の各パラメータに基づいて接続を作成します（内部では、`connection_class(conninfo, **kwargs)` のような処理が行われます）。

2. **接続の設定**  
   もし `configure` コールバックが指定されていれば、新しい接続を引数としてこのコールバックが呼ばれ、接続アダプタの設定などが行われます。

3. **接続の準備完了**  
   接続の準備が完了すると、その接続はプール内部に保存されるか、既にキューに待機しているクライアントがいれば、そのクライアントに渡されます。

4. **クライアントからの要求時**  
   クライアントが接続を要求（通常は `connection()` コンテキストに入る）すると、以下の処理が行われます:
    - プール内に利用可能な接続があれば、即座にクライアントに提供される。
    - 利用可能な接続がなければ、クライアントはキューに入れられ、他のクライアントから返却されるか新たに作成された接続が利用可能になった時点で提供される。
    - もし `check` コールバックが指定されていれば、接続をクライアントに渡す前にこのチェックが実施され、チェックに失敗した場合は新しい接続が取得される。

5. **クライアントの利用終了時**  
   クライアントが接続の使用を終える（通常は `connection()` コンテキストの終了時）と、以下の処理が行われます:
    - オープンなトランザクションがあれば、ブロックが正常終了した場合はコミット、例外発生時はロールバックされる。
    - もし `reset` コールバックが指定されていれば、接続はそのコールバックに渡され、アプリケーション固有の後処理が実行される。
    - このプロセス中に、接続が破損状態であることが判明した場合や、プール作成時に設定された `max_lifetime` を超えていた場合、その接続は破棄され、ワーカーによって新しい接続が要求される。
    - 最終的に、接続はプールに返却されるか、キューに待機しているクライアントがあれば、その最初のクライアントに渡される。

---

## プールを作成するその他の方法

プールをコンテキストマネージャとして利用するのは必須ではありません。プールは、コンテキストパターンを使用せずに作成・利用することも可能です。ただし、コンテキストマネージャを使用するのが最も安全なリソース管理方法です。

プール作成時に、`open` パラメータが True であれば、接続プロセスが即座に開始されます。たとえば、シンプルなプログラムではグローバルオブジェクトとしてプールを作成し、コードの他の部分から利用することができます。

```python
# プログラム内のモジュール db.py
from psycopg_pool import ConnectionPool

pool = ConnectionPool(..., open=True, ...)
# プールはすぐに接続を開始します。
```

別のモジュールからは、

```python
from .db import pool

def my_function():
    with pool.connection() as conn:
        conn.execute(...)
```

このパターンでは、プールはインポート時点で接続プロセスを開始します。もしそれが早すぎる場合、すなわちアプリケーションが完全に準備されるまで接続を開始したくない場合は、クローズ状態のプールを作成し、必要になったときに `open()` メソッドを呼び出すことができます。

また、プールをコンテキストマネージャとして使用しない場合、プログラム終了時に `close()` メソッドを呼び出すことが推奨されます。一部の Python バージョンでは、これを行わないとプログラム終了が遅延する場合があるためです。簡単な方法としては、`atexit` モジュールを利用する方法があります。

```python
import atexit
atexit.register(pool.close)
```

他のフレームワークでは適切なフックが提供されている場合もあります。たとえば、FastAPI では以下のようにライフスパン関数を用いて管理できます。

```python
pool = AsyncConnectionPool(..., open=False, ...)

from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    await pool.open()
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)
```

---

## 警告

- 現在、`open` パラメータのデフォルトは True ですが、これは最適な選択ではないことが判明しており、将来のリリースではデフォルトが False に変更される可能性があります。したがって、作成時にプールが自動的にオープンされることに依存している場合は、明示的に `open=True` を指定してください。

- 非同期プールについては、コンストラクタ内でのオープンは非推奨となっており、将来的に削除される予定です。`AsyncConnectionPool` を使用する場合は、必ず `await pool.open()` を呼ぶか、もしくは `async with ... as pool` の形式で明示的に利用してください。

---

## Null コネクションプール

（バージョン 3.1 新機能）

場合によっては、アプリケーションの設定パラメータとして「コネクションプールを使用するか否か」を選択できるようにしたいことがあります。たとえば、アプリケーションの「大規模インスタンス」を展開する際には、専用の接続をいくつか確保できるためプールを利用したい一方、ロードバランサーの背後や PgBouncer などの外部のコネクションプールプロセスを利用して展開する場合は、プールを使用しない選択も考えられます。

プールを使用するか否かを切り替えるには、コードの変更が必要になります。なぜなら、`ConnectionPool` の API は通常の `connect()` 関数とは異なり、またプールは追加の接続設定（`configure` パラメータなど）を実施する可能性があるため、その処理を別のコードパスで実行する必要があるからです。

psycopg_pool 3.1 パッケージでは、`NullConnectionPool` クラスが導入されました。このクラスは `ConnectionPool` と同じインターフェイス（ほぼ同じ動作）を持ちますが、事前に接続を作成しません。接続が返却された場合、待機中のクライアントがいなければ、その接続は直ちにクローズされ、プール内に保持されません。

Null プールは、単なる設定上の利便性にとどまらず、クライアントプログラムによるサーバーへのアクセスを制御するためにも利用できます。たとえば、`max_size` を 0 より大きい値に設定した場合、プールは同時に作成される接続数が `max_size` を超えないように制御します。もしさらに多くのクライアントが接続を要求した場合、基本的なプールと同様にキューに入れられ、前のクライアントが接続の使用を終えたタイミングで接続が提供されます。また、タイムアウトや max_waiting などのクライアント要求を調整するための仕組みも尊重されます。

> **注記**  
> キューに待機しているクライアントには、前のクライアントが接続の使用を終えたタイミングで、
> （必要に応じてプールがアイドル状態に戻り `reset()` が呼ばれた後で）既に確立された接続が渡されます。  
> 通常、（キューイングされない限り）各クライアントには新しい接続が提供されるため、接続確立の時間は待機するクライアントが負担します。バックグラウンドワーカーは通常、新しい接続の確立に関与しません。

---

## プールの接続数とサイズの管理

プールは、固定サイズ（`max_size` を指定しない、または `max_size` が `min_size` と等しい場合）または動的サイズ（`max_size` > `min_size` の場合）で運用することができます。いずれの場合も、プールが作成されるとすぐにバックグラウンドで `min_size` の接続が確保されようとします。

もし接続の作成に失敗した場合は、指数バックオフ方式により再試行が行われ、試行間の時間が次第に長くなります。この再試行は、`reconnect_timeout` で指定された最大時間に達するまで続けられます。最大時間に達した場合、プールは（もし設定されていれば）`reconnect_failed()` 関数を呼び出し、その後新たな接続試行を開始します。`reconnect_failed()` を利用すれば、アラートを送信したりプログラムを中断してインフラ全体の再起動を促すことも可能です。

もし同時に `min_size` を超える接続が要求された場合、新たな接続が作成され、最大 `max_size` まで増加します。なお、接続は常にバックグラウンドワーカーによって作成され、接続を要求したスレッドが直接作成するわけではありません。たとえば、あるクライアントが新しい接続を要求し、前のクライアントが作業を終了して接続を返却する前に新しい接続が準備中であれば、待機中のクライアントにはその返却された接続が提供されます。これは、接続確立にかかる時間が接続利用時間よりも支配的なシナリオにおいて特に有用です（詳しくは関連の分析を参照してください）。

また、プールが `min_size` を上回って成長した後、利用状況が低下すれば、一定時間（プール作成時に指定した `max_idle`）以上使用されない接続が順次クローズされ、プールのサイズが縮小されます。

---

## プールの適切なサイズとは？

これは非常に重要な疑問ですが、正解は状況に依存します。おそらく、あなたが想像するほど大きくする必要はないでしょう。参考までに、関連する分析記事などを確認してみてください。

有用な方法として、`get_stats()` メソッドを利用してプログラムの動作状況を監視し、設定パラメータを調整することが考えられます。また、プールのサイズは実行時に `resize()` メソッドで変更することも可能です。

---

## 接続の品質

（バージョン 3.2 新機能）

プールは内部で保持している接続の状態を積極的にチェックしません。つまり、サーバーとの通信が途絶えたり、接続が何らかの理由でクローズされた場合（例えば、アイドル状態が一定時間続いた結果、サーバー側の idle_session_timeout により切断された場合など）、アプリケーションに破損状態の接続が提供される可能性があります。

もし、プールが常に正常な接続をクライアントに提供するよう、接続状態のチェックを行いたい場合は、`check` コールバックを設定することができます。このコールバックは、接続の品質を検証するための何らかの操作を実施し、例外を発生させずに終了した場合、その接続がクライアントに渡されます。ただし、チェックのためのネットワーク遅延が発生する可能性もあります。

シンプルな実装例として、静的メソッド `ConnectionPool.check_connection` が用意されており、以下のように利用できます。

```python
with ConnectionPool(
    ..., check=ConnectionPool.check_connection, ...
) as pool:
    ...
```

---

## プール操作のロギング

プールは、`logging` モジュールを使用して、主要な操作を `psycopg.pool` ロガーに記録します。プールの動作をデバッグする場合は、このロガーの INFO レベル以上のログを出力するよう設定すると良いでしょう。

例えば、次のスクリプトは：

```python
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from psycopg_pool import ConnectionPool

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logging.getLogger("psycopg.pool").setLevel(logging.INFO)

pool = ConnectionPool(min_size=2)
pool.wait()
logging.info("pool ready")

def square(n):
    with pool.connection() as conn:
        time.sleep(1)
        rec = conn.execute("SELECT %s * %s", (n, n)).fetchone()
        logging.info(f"The square of {n} is {rec[0]}.")

with ThreadPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(square, n) for n in range(4)]
    for future in as_completed(futures):
        future.result()
```

上記のスクリプトを実行すると、以下のようなログが出力される可能性があります：

```
2023-09-20 11:02:39,718 INFO psycopg.pool: waiting for pool 'pool-1' initialization
2023-09-20 11:02:39,720 INFO psycopg.pool: adding new connection to the pool
2023-09-20 11:02:39,720 INFO psycopg.pool: adding new connection to the pool
2023-09-20 11:02:39,720 INFO psycopg.pool: pool 'pool-1' is ready to use
2023-09-20 11:02:39,720 INFO root: pool ready
2023-09-20 11:02:39,721 INFO psycopg.pool: connection requested from 'pool-1'
2023-09-20 11:02:39,721 INFO psycopg.pool: connection given by 'pool-1'
2023-09-20 11:02:39,721 INFO psycopg.pool: connection requested from 'pool-1'
2023-09-20 11:02:39,721 INFO psycopg.pool: connection given by 'pool-1'
2023-09-20 11:02:39,721 INFO psycopg.pool: connection requested from 'pool-1'
2023-09-20 11:02:39,722 INFO psycopg.pool: connection requested from 'pool-1'
2023-09-20 11:02:40,724 INFO root: The square of 0 is 0.
2023-09-20 11:02:40,724 INFO root: The square of 1 is 1.
2023-09-20 11:02:40,725 INFO psycopg.pool: returning connection to 'pool-1'
2023-09-20 11:02:40,725 INFO psycopg.pool: connection given by 'pool-1'
2023-09-20 11:02:40,725 INFO psycopg.pool: returning connection to 'pool-1'
2023-09-20 11:02:40,726 INFO psycopg.pool: connection given by 'pool-1'
2023-09-20 11:02:41,728 INFO root: The square of 3 is 9.
2023-09-20 11:02:41,729 INFO root: The square of 2 is 4.
2023-09-20 11:02:41,729 INFO psycopg.pool: returning connection to 'pool-1'
2023-09-20 11:02:41,730 INFO psycopg.pool: returning connection to 'pool-1'
```

※ 注意：生成されるメッセージは将来的に変更される可能性があり、安定したインターフェースとは見なさないでください。

---

## プールの統計情報

プールは、`get_stats()` または `pop_stats()` メソッドを利用して、利用状況に関する情報を返すことができます。両メソッドは同じ値を返しますが、`pop_stats()` は呼び出し後にカウンターをリセットします。これらの値は、Graphite や Prometheus などの監視システムに送信することが可能です。

以下は提供されるべき指標ですが、あくまで目安であり、将来的に変更される可能性があります。また、値が 0 のキーは返されない場合があります。

| 指標                | 意味                                                                 |
|---------------------|----------------------------------------------------------------------|
| **pool_min**        | 現在の min_size の値                                                 |
| **pool_max**        | 現在の max_size の値                                                 |
| **pool_size**       | プールが現在管理している接続数（プール内、クライアントに渡されている、準備中のものを含む） |
| **pool_available**  | プール内でアイドル状態にある接続数                                   |
| **requests_waiting**| 接続を受け取るためにキューに待機しているリクエスト数                  |
| **usage_ms**        | プール外で接続が使用された合計時間（ミリ秒単位）                      |
| **requests_num**    | プールに対して要求された接続の総数                                   |
| **requests_queued** | プール内にすぐに接続が用意できなかったためにキューに入れられたリクエストの数 |
| **requests_wait_ms**| キューで待機しているクライアントの合計待機時間（ミリ秒単位）           |
| **requests_errors** | エラー（タイムアウト、キュー満杯など）となった接続要求の数             |
| **returns_bad**     | 異常な状態でプールに返却された接続の数                                |
| **connections_num** | サーバーへの接続試行回数                                              |
| **connections_ms**  | サーバーとの接続確立に費やされた合計時間（ミリ秒単位）                 |
| **connections_errors** | 接続試行に失敗した回数                                            |
| **connections_lost**| check() または check コールバックにより破損状態と判断された接続の数     |

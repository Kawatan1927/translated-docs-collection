## 基本的なモジュールの使用方法

基本的な Psycopg の使い方は、DB-API プロトコルを実装しているすべてのデータベースアダプタに共通です。組み込みの sqlite3 や psycopg2 など、他のデータベースアダプタもほぼ同じ操作パターンを持っています。

## Psycopg 3 の主なオブジェクト

以下は、基本的なコマンドを示す対話型セッションの例です：

```python
# 注意: モジュール名は psycopg であり、psycopg3 ではありません
import psycopg

# 既存のデータベースに接続
with psycopg.connect("dbname=test user=postgres") as conn:

    # データベース操作を行うためのカーソルを開く
    with conn.cursor() as cur:

        # コマンドを実行：これにより新しいテーブルが作成されます
        cur.execute("""
            CREATE TABLE test (
                id serial PRIMARY KEY,
                num integer,
                data text)
            """)

        # クエリのプレースホルダーにデータを渡し、Psycopg が正しい変換を実施します（SQLインジェクション対策済み！）
        cur.execute(
            "INSERT INTO test (num, data) VALUES (%s, %s)",
            (100, "abc'def"))

        # データベースにクエリを実行し、Pythonオブジェクトとしてデータを取得
        cur.execute("SELECT * FROM test")
        cur.fetchone()
        # 結果は (1, 100, "abc'def") となります

        # また、cur.fetchmany() や cur.fetchall() を使って複数のレコードをリストとして返すことも可能ですし、
        # カーソルを直接反復処理することもできます
        for record in cur:
            print(record)

        # データベースへの変更を永続化
        conn.commit()
```

上記の例では、主なオブジェクトとメソッドがどのように関連しているかを確認できます：

- **connect() 関数**  
  新しいデータベースセッションを作成し、Connection インスタンスを返します。  
  **AsyncConnection.connect()** は asyncio 用の接続を作成します。

- **Connection クラス**  
  データベースセッションをカプセル化します。  
  主な機能は以下の通りです：
    - `cursor()` メソッドを使用して、新しい Cursor インスタンスを生成し、データベースコマンドやクエリを実行できる。
    - `commit()` や `rollback()` メソッドを使用してトランザクションを終了する。

- **Cursor クラス**  
  データベースとの対話を可能にします：
    - `execute()` や `executemany()` といったメソッドを使用してデータベースにコマンドを送信する。
    - 反復処理や `fetchone()`, `fetchmany()`, `fetchall()` といったメソッドを使用してデータを取得する。

これらのオブジェクトをコンテキストマネージャ（すなわち `with` を使用）として利用すると、ブロックの終了時に自動的に閉じられ、リソースが解放されます（これは psycopg2 とは異なる挙動です）。

### 参照

重要なトピックとしては、以下のものがあります：

- SQL クエリへのパラメータの渡し方
- 基本的な Python 型のアダプテーション
- トランザクション管理

## ショートカット

上記のパターンは psycopg2 ユーザーにはお馴染みかもしれません。しかし、Psycopg 3 ではこのパターンをさらに簡潔にするいくつかの拡張が提供されています：

- **Connection オブジェクトの `execute()` メソッド**  
  これは、カーソルを作成し、その `execute()` メソッドを呼び出し、カーソルを返すという処理と同等です。

  ```python
  # Psycopg 2 の場合
  cur = conn.cursor()
  cur.execute(...)
  
  # Psycopg 3 の場合
  cur = conn.execute(...)
  ```

- **Cursor.execute() メソッドは self を返す**  
  これにより、`fetchone()` などのフェッチ操作を `execute()` の呼び出しと連鎖して使用することが可能です：

  ```python
  # Psycopg 2 の場合
  cur.execute(...)
  record = cur.fetchone()

  cur.execute(...)
  for record in cur:
      ...

  # Psycopg 3 の場合
  record = cur.execute(...).fetchone()

  for record in cur.execute(...):
      ...
  ```

- これらを組み合わせると、シンプルなケースでは接続の作成から結果の使用までを一つの式で済ませることができます：

  ```python
  print(psycopg.connect(DSN).execute("SELECT now()").fetchone()[0])
  # 出力例: 2042-07-12 18:15:10.706497+01:00
  ```

## Connection コンテキスト

Psycopg 3 の Connection はコンテキストマネージャとして使用できます：

```python
with psycopg.connect() as conn:
    ...  # 接続を使用する

# ブロックを抜けると接続は自動的に閉じられます
```

ブロックを抜ける際、もしトランザクションがオープン状態であればコミットされます。ブロック内で例外が発生した場合はロールバックされます。いずれの場合も、接続は閉じられます。これは、以下のコードとほぼ同等です：

```python
conn = psycopg.connect()
try:
    ...  # 接続を使用する
except BaseException:
    conn.rollback()
else:
    conn.commit()
finally:
    conn.close()
```

**注意**  
この挙動は psycopg2 とは異なります。psycopg2 では、明示的な `close()` が呼ばれず、接続が複数の `with` ブロックで使用されることが可能でした。この挙動は標準的ではなく、意外性があると考えられていたため、より明示的な `transaction()` ブロックに置き換えられています。

また、上記のパターンは最も一般的な使用法を示していますが、`connect()` はブロック内に入らない「未入室の」接続を返すため、コードのスコープに関係なく接続を使用することができ、必要に応じて `commit()`, `rollback()`, `close()` を自由に呼び出す責任は開発者側にあります。

**警告**  
接続を単にスコープから外すと、`with` ブロックを使用した場合と使用しなかった場合で挙動が異なります：

- `with` ブロックを使用しない場合、サーバーは接続を INTRANS 状態で検出し、現在のトランザクションをロールバックします；
- `with` ブロックを使用した場合、明示的な COMMIT が実行され、操作が確定します。

一連の操作を実行し結果をコミットするのが通常のケースであるならば、`with` ブロックを使用すべきです。もし接続のライフサイクルやトランザクションパターンをより細かく制御する必要がある場合は、`with` ブロックを使わない方法が適しているかもしれません。

非同期接続（AsyncConnection）もコンテキストマネージャとして使用可能ですが、`async with` を使用する際にはその特有の挙動に注意してください（詳細は非同期接続に関するドキュメントを参照）。

## psycopg をプログラムに適応する

上記の使用パターンは、アダプタのデフォルトの振る舞いを示すものです。Psycopg は、Python プログラムと PostgreSQL データベース間のスムーズな統合を実現するために、いくつかの方法でカスタマイズ可能です：

- プログラムが並行処理を行っており、スレッドやプロセスの代わりに asyncio をベースとしている場合は、非同期接続やカーソルを利用できます。
- カーソルが返すオブジェクト（タプルではなく）をカスタマイズしたい場合は、行ファクトリーを指定できます。
- Python の値と PostgreSQL の型を相互にマッピングする基本的な型変換以外のカスタマイズが必要な場合、型の設定を行うことができます。

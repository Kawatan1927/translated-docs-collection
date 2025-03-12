# COPY TO と COPY FROM の使用

Psycopg は PostgreSQL の COPY プロトコルを操作することを可能にします。  
COPY はデータをデータベースにロードする（あるいは、ある種の SQL の工夫によりデータを変更する）最も効率的な方法のひとつです。

COPY は、`Cursor.copy()` メソッドを用い、`COPY ... FROM STDIN` や `COPY ... TO STDOUT` の形式のクエリを渡し、得られる Copy オブジェクトを `with` ブロック内で管理することでサポートされます。

```python
with cursor.copy("COPY table_name (col1, col2) FROM STDIN") as copy:
    # write()/write_row() を使用して 'copy' オブジェクトにデータを渡す
```

psycopg.sql モジュールのオブジェクトを使用することで、COPY 文を動的に構成することもできます。

```python
with cursor.copy(
    sql.SQL("COPY {} TO STDOUT").format(sql.Identifier("table_name"))
) as copy:
    # read()/read_row() を使用して 'copy' オブジェクトからデータを読み出す
```

### バージョン 3.1 からの変更点
`execute()` と同様に、`copy()` にパラメータを渡すことも可能になりました:

```python
with cur.copy("COPY (SELECT * FROM table_name LIMIT %s) TO STDOUT", (3,)) as copy:
    # 3 件を超えるレコードは存在しないと期待する
```

接続は通常のトランザクションの挙動に従うため、接続が autocommit モードでない場合、COPY 操作の終了後にも保留中の変更をコミットする必要があり、またロールバックも可能です。詳細は[トランザクション管理](#)を参照してください。

---

## 行単位でのデータ書き込み

COPY 操作を利用することで、任意の Python のイテラブル（タプルのリストやシーケンスのイテラブル）からデータをデータベースにロードできます。Python の値は通常のクエリ時と同様に適応されます。  
このような操作を行うには、`Cursor.copy()` を使用して `COPY ... FROM STDIN` を実行し、`with` ブロック内で得られるオブジェクトに対して `write_row()` を使用します。ブロックを抜けると操作が完了します。

```python
records = [(10, 20, "hello"), (40, None, "world")]

with cursor.copy("COPY sample (col1, col2, col3) FROM STDIN") as copy:
    for record in records:
        copy.write_row(record)
```

ブロック内で例外が発生した場合、操作は中断され、これまでに挿入されたレコードは破棄されます。

COPY 操作で行単位の読み書きを行う場合、FORMAT CSV、DELIMITER、NULL などの COPY オプションは指定してはいけません。これらの詳細はそのままにしておいてください。

---

## 行単位でのデータ読み込み

逆に、`COPY ... TO STDOUT` 操作から行を読み出すことも可能です。これは通常のクエリ処理よりも利用頻度は低いですが、`rows()` を使って行を反復処理できます。  
現在の PostgreSQL は COPY TO において完全な型情報を提供しないため、返される行はフォーマットに応じて文字列またはバイト列の未解析データとなります。

```python
with cur.copy("COPY (VALUES (10::int, current_date)) TO STDOUT") as copy:
    for row in copy.rows():
        print(row)  # 未解析のデータが返される例: ('10', '2046-12-24')
```

読み込み前に `set_types()` を使用することで結果を改善できますが、型情報は自分で指定する必要があります。

```python
with cur.copy("COPY (VALUES (10::int, current_date)) TO STDOUT") as copy:
    copy.set_types(["int4", "date"])
    for row in copy.rows():
        print(row)  # (10, datetime.date(2046, 12, 24))
```

---

## ブロック単位でのコピー

すでに COPY に適した形式でフォーマットされているデータ（例えば、以前の COPY TO 操作からのファイルなど）は、`Copy.write()` を使用してデータベースにロードすることができます。

```python
with open("data", "r") as f:
    with cursor.copy("COPY data FROM STDIN") as copy:
        while data := f.read(BLOCK_SIZE):
            copy.write(data)
```

この場合、入力データが `copy()` の操作が期待するものと互換性がある限り、任意の COPY オプションとフォーマットを使用することができます。  
データは、COPY が FORMAT TEXT の場合は str として、FORMAT TEXT および FORMAT BINARY の場合は bytes として渡すことができます。

COPY 形式のデータを生成するには、`COPY ... TO STDOUT` 文を使用し、得られる Copy オブジェクトを反復処理することで、バイト列オブジェクトのストリームを生成できます。

```python
with open("data.out", "wb") as f:
    with cursor.copy("COPY table_name TO STDOUT") as copy:
        for data in copy:
            f.write(data)
```

---

## バイナリコピー

バイナリコピーは、COPY 文に `FORMAT BINARY` を指定することでサポートされます。  
`write_row()` を使用してバイナリデータをインポートするには、データベースに渡されるすべての型にバイナリダンパーが登録されている必要があります。  
ただし、`write()` を使用してブロック単位でコピーする場合はこの限りではありません。

> **警告**  
> PostgreSQL はバイナリモードでデータをロードする際に非常に厳格であり、キャストルールは適用されません。  
> 例えば、整数カラムに 100 を渡すと、Psycopg がそれを smallint として渡すため、サイズが一致せずサーバーが拒否する可能性があります。

この問題は、Copy オブジェクトの `set_types()` メソッドを使用し、ロードする型を慎重に指定することで回避できます。

参照: バイナリパラメータと結果についての詳細情報は、バイナリクエリに関する項目を参照してください。

---

## 非同期コピーのサポート

非同期操作は、上記と同様のパターンでサポートされており、AsyncConnection から取得したオブジェクトを使用します。  
例えば、`f` が非同期の `read()` メソッドをサポートし、COPY データを返すオブジェクトである場合、完全に非同期なコピー操作は以下のように実装できます。

```python
async with cursor.copy("COPY data FROM STDIN") as copy:
    while data := await f.read():
        await copy.write(data)
```

AsyncCopy オブジェクトのドキュメントには、非同期メソッドのシグネチャや、同期版の Copy オブジェクトとの違いが記載されています。

参照: 非同期操作の使用方法については、非同期オブジェクトに関する項目を参照してください。

---

## 例: サーバ間でテーブルをコピーする

テーブル、またはテーブルの一部をサーバ間でコピーするには、2 つの異なる接続上で 2 つの COPY 操作を使用し、1 つから読み込み、もう 1 つに書き込みを行います。

```python
with psycopg.connect(dsn_src) as conn1, psycopg.connect(dsn_tgt) as conn2:
    with conn1.cursor().copy("COPY src TO STDOUT (FORMAT BINARY)") as copy1:
        with conn2.cursor().copy("COPY tgt FROM STDIN (FORMAT BINARY)") as copy2:
            for data in copy1:
                copy2.write(data)
```

通常、`FORMAT BINARY` を使用するとパフォーマンスが向上しますが、これはソースとターゲットのスキーマが完全に同一である場合にのみ機能します。  
テーブルが互換性がある（例えば、整数フィールドを bigint の宛先フィールドにコピーする場合など）だけであれば、BINARY オプションを省略してテキストベースのコピーを実行するべきです。  
詳細は[バイナリコピー](#)を参照してください。

同じパターンは、非同期オブジェクトを使用して非同期コピーを実行するために適用することもできます。

### New – Trusted Language Extensions for PostgreSQL on Amazon Aurora and Amazon RDS
**著者:** Channy Yun (윤석찬)  
**投稿日:** 2022年11月30日  
**カテゴリ:** Amazon Aurora, Amazon RDS, Announcements, AWS re:Invent, Launch, News, Open Source, PostgreSQL compatible, RDS for PostgreSQL

---

#### はじめに
PostgreSQL は、その拡張可能な設計により、多くの企業やスタートアップにとって最も好まれるオープンソースのリレーショナルデータベースとなっています。開発者が PostgreSQL を利用する理由のひとつは、好みのプログラミング言語で拡張機能を構築し、データベースに機能を追加できる点にあります。

すでに、Amazon Aurora PostgreSQL-Compatible Edition および Amazon RDS for PostgreSQL では、PostgreSQL 拡張機能をインストールして利用できます。たとえば、データベースのアクティビティをログするための `pgAudit` 拡張など、85 を超える拡張機能がサポートされています。こうした拡張機能を利用するワークロードは多い一方で、顧客からは「自分たちが選んだ拡張機能を構築・実行できる柔軟性がほしい」という声も寄せられていました。

本日、当社は新たなオープンソース開発キットである **Trusted Language Extensions for PostgreSQL (pg_tle)** の一般提供を開始したことを発表します。pg_tle を利用することで、開発者は PostgreSQL 上で安全に実行できる高性能な拡張機能を構築できます。また、pg_tle は、拡張機能のインストール権限や実行権限の制御をデータベース管理者に委ねることで、アプリケーション開発者が必要と判断した段階で迅速に新機能を提供できる仕組みを提供します。

Trusted Language Extensions の開発には、JavaScript、Perl、PL/pgSQL などの信頼された言語を利用します。これらの言語は、ファイルシステムへの直接アクセスを制限し、不要な特権昇格を防ぐなどの安全性を備えています。Amazon Aurora PostgreSQL-Compatible Edition 14.5 および Amazon RDS for PostgreSQL 14.5 以降のバージョンでは、信頼された言語で書かれた拡張機能を簡単にインストールできます。

pg_tle は GitHub 上で Apache License 2.0 の下で公開されているオープンソースプロジェクトです。ロードマップへのコメントや提案を通じ、複数のプログラミング言語に対応するための改善にご協力いただければ、PostgreSQL の優れた機能をより活用しやすい拡張機能の構築が実現します。

ここから、pg_tle を用いて Amazon Aurora および Amazon RDS 向けの新しい PostgreSQL 拡張機能を構築する方法を見ていきます。

---

### Trusted Language Extensions for PostgreSQL のセットアップ

Amazon Aurora または Amazon RDS for PostgreSQL で pg_tle を利用するには、PostgreSQL の `shared_preload_libraries` 設定で pg_tle を読み込むパラメータグループを作成する必要があります。以下の手順で設定を行います。

1. **パラメータグループの作成**  
   Amazon RDS コンソールの左側ナビゲーションから「パラメータグループ」を選択し、「パラメータグループの作成」をクリックします。
    - **パラメータグループファミリー:** Amazon RDS for PostgreSQL の場合は `postgres14`（Aurora PostgreSQL-Compatible クラスターの場合は `aurora-postgresql14` を選択）
    - **グループ名:** `pg_tle`  
      「作成」をクリックしてパラメータグループを作成します。

2. **パラメータの編集**  
   作成した `pg_tle` パラメータグループを選択し、アクションメニューから「編集」を選びます。検索ボックスに `shared_preload_library` と入力し、編集画面で値に `pg_tle` を追加して「変更の保存」をクリックします。

3. **AWS CLI での操作例**  
   以下のコマンドでも同様の操作が可能です。

   ```bash
   $ aws rds create-db-parameter-group \
      --region us-east-1 \
      --db-parameter-group-name pgtle \
      --db-parameter-group-family aurora-postgresql14 \
      --description "pgtle group"

   $ aws rds modify-db-parameter-group \
      --region us-east-1 \
      --db-parameter-group-name pgtle \
      --parameters "ParameterName=shared_preload_libraries,ParameterValue=pg_tle,ApplyMethod=pending-reboot"
   ```

4. **パラメータグループの適用**  
   作成した `pgtle` パラメータグループを対象のデータベースインスタンスに適用します。たとえば、データベースインスタンス名が `testing-pgtle` の場合、以下のコマンドを実行します（この操作によりインスタンスが再起動されます）。

   ```bash
   $ aws rds modify-db-instance \
      --region us-east-1 \
      --db-instance-identifier testing-pgtle \
      --db-parameter-group-name pgtle-pg \
      --apply-immediately
   ```

5. **pg_tle ライブラリの確認**  
   PostgreSQL インスタンス上で以下のコマンドを実行し、`pg_tle` が読み込まれているか確認します。

   ```sql
   SHOW shared_preload_libraries;
   ```

   出力に `pg_tle` が表示されれば成功です。

6. **拡張機能の作成**  
   次に、現在のデータベースで pg_tle 拡張機能を作成します。

   ```sql
   CREATE EXTENSION pg_tle;
   ```

   新しい拡張機能を作成する場合は、主要ユーザー（例：`postgres`）に対して以下のコマンドで `pgtle_admin` ロールを付与してください。

   ```sql
   GRANT pgtle_admin TO postgres;
   ```

これで pg_tle の利用準備が整いました。

---

### PostgreSQL 拡張機能の構築例 – パスワードチェックフック

本例では、ユーザーが一般的なパスワード辞書に含まれるパスワードを設定しないように検証する拡張機能を構築します。多くの組織では、特にデータベースユーザーに対してパスワードの複雑性に関するルールがあり、PostgreSQL は `check_password_hook` を利用してその制約を補助できます。

#### 拡張機能の作成
以下の SQL コマンドは、PL/pgSQL を用いてパスワードチェックフックを構築し、最も一般的なパスワード 10 件の辞書に基づいてチェックを行う拡張機能 `my_password_check_rules` をインストールします。

```sql
SELECT pgtle.install_extension (
  'my_password_check_rules',
  '1.0',
  'Do not let users use the 10 most commonly used passwords',
$_pgtle_$
  CREATE SCHEMA password_check;
  REVOKE ALL ON SCHEMA password_check FROM PUBLIC;
  GRANT USAGE ON SCHEMA password_check TO PUBLIC;

  CREATE TABLE password_check.bad_passwords (plaintext) AS
  VALUES
    ('123456'),
    ('password'),
    ('12345678'),
    ('qwerty'),
    ('123456789'),
    ('12345'),
    ('1234'),
    ('111111'),
    ('1234567'),
    ('dragon');
  CREATE UNIQUE INDEX ON password_check.bad_passwords (plaintext);

  CREATE FUNCTION password_check.passcheck_hook(
      username text,
      password text,
      password_type pgtle.password_types,
      valid_until timestamptz,
      valid_null boolean
  )
  RETURNS void AS $$
    DECLARE
      invalid bool := false;
    BEGIN
      IF password_type = 'PASSWORD_TYPE_MD5' THEN
        SELECT EXISTS(
          SELECT 1
          FROM password_check.bad_passwords bp
          WHERE ('md5' || md5(bp.plaintext || username)) = password
        ) INTO invalid;
        IF invalid THEN
          RAISE EXCEPTION 'password must not be found on a common password dictionary';
        END IF;
      ELSIF password_type = 'PASSWORD_TYPE_PLAINTEXT' THEN
        SELECT EXISTS(
          SELECT 1
          FROM password_check.bad_passwords bp
          WHERE bp.plaintext = password
        ) INTO invalid;
        IF invalid THEN
          RAISE EXCEPTION 'password must not be found on a common password dictionary';
        END IF;
      END IF;
    END
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  GRANT EXECUTE ON FUNCTION password_check.passcheck_hook TO PUBLIC;

  SELECT pgtle.register_feature('password_check.passcheck_hook', 'passcheck');
$_pgtle_$ );
```

#### フックの有効化
このパスワードチェックフックを有効にするため、`pgtle.enable_password_check` 設定パラメータをオンにします。以下の AWS CLI コマンドで設定できます。

```bash
$ aws rds modify-db-parameter-group \
    --region us-east-1 \
    --db-parameter-group-name pgtle \
    --parameters "ParameterName=pgtle.enable_password_check,ParameterValue=on,ApplyMethod=immediate"
```

変更が反映されるまで数分かかる場合があります。設定確認は以下の SQL コマンドで行います。

```sql
SHOW pgtle.enable_password_check;
```

出力例:

```
 pgtle.enable_password_check
-----------------------------
 on
```

#### 拡張機能の動作確認
現在のデータベースに拡張機能を作成し、辞書にあるパスワードを設定しようとするとフックがエラーを返すことを確認します。

```sql
CREATE EXTENSION my_password_check_rules;

CREATE ROLE test_role PASSWORD '123456';
-- ERROR:  password must not be found on a common password dictionary

CREATE ROLE test_role;
SET SESSION AUTHORIZATION test_role;
SET password_encryption TO 'md5';
\password  -- 「password」を設定しようとすると
-- ERROR:  password must not be found on a common password dictionary
```

#### フックの無効化および拡張機能の削除
フックを無効にするには、`pgtle.enable_password_check` の値を `off` に設定します。

```bash
$ aws rds modify-db-parameter-group \
    --region us-east-1 \
    --db-parameter-group-name pgtle \
    --parameters "ParameterName=pgtle.enable_password_check,ParameterValue=off,ApplyMethod=immediate"
```

また、以下のコマンドで拡張機能をアンインストールし、他ユーザーによる `CREATE EXTENSION` を防ぐことができます。

```sql
DROP EXTENSION my_password_check_rules;
SELECT pgtle.uninstall_extension('my_password_check_rules');
```

その他のサンプル拡張機能も GitHub 上で公開されています。ローカルの PostgreSQL で pg_tle を構築・テストする場合は、リポジトリをクローンしてソースコードからビルドしてください。

---

### コミュニティに参加しよう！
Trusted Language Extensions for PostgreSQL のコミュニティは誰でも参加可能です。ぜひお試しいただき、今後のリリースで追加してほしい機能などのフィードバックをお寄せください。新機能、サンプル拡張、追加ドキュメント、またはバグ報告など、どんな貢献も歓迎します。

AWS クラウド上で pg_tle を利用する方法の詳細については、Amazon Aurora PostgreSQL-Compatible Edition および Amazon RDS for PostgreSQL のドキュメントをご参照ください。  
フィードバックは AWS re:Post for PostgreSQL や通常の AWS サポート窓口を通じてお寄せください。

– Channy

**Channy Yun (윤석찬)**  
Channy は AWS クラウドのプリンシパルデベロッパーアドボケイトです。オープンなウェブに情熱を持ち、技術の学習や共有をコミュニティ主導で行うことを大切にしています。


# Tap-IN 開発者ノート

## Claude への指示

- 開発中に気づいたバグ・設計ミス・UXの問題・教訓は、メモリ（feedback または project タイプ）に記録すること
- 「なぜそうなったか」「次にどう防ぐか」まで含めて記録すること
- プロジェクトをまたいで活かせる知見は特に積極的に保存すること

## プロジェクト概要

美容院向け勤怠打刻Webアプリ。Next.js (App Router) + Tailwind CSS + Notion API。

---

## デザイン・実装規約（必ず守ること）

### カラーパレット
- **使う色**：白・黒・グレー・clock-blue（`#3498db`）のみ
- **避ける色**：赤・オレンジ・ベージュなどの暖色（エラー表示など機能的に必要な場合を除く）
- 薄塗りグレーは `bg-slate-*` を優先（`bg-gray-*` は暖色に見える場合あり）

### UI スタイル
- ミニマル & 洗練を重視。装飾的なアイコン・影は控えめ
- ローディング中は **「スピナー + NOTION 連携中」** をカード中央に配置（全ページ統一）
- モーダルは `framer-motion` の `AnimatePresence` + `scale 0.9→1` のアニメーションで統一
- ドロップダウンは **降順（`b.localeCompare(a)`）で全ページ統一**

### 実装ルール
- **ハードコード禁止**：Notion の select オプション・店舗名などは DB スキーマから動的取得
- **Notion プロパティ名は `lib/notion.ts` の `F` 定数で一元管理**
- **DB間で重複する概念は Relation で連携**（select の二重管理は NG）
- **silent catch 禁止**：`.catch(() => {})` は書かず、必ずエラー state を更新してユーザーに表示
- **自動リトライ**：`adminFetch` は 5xx で1回自動リトライ
- **未保存変更のガード**：編集中に別要素へ切替時は `confirm()` で確認

### UX ルール
- 破壊的操作（削除・全件上書きなど）は必ず確認ダイアログ or 明示的な「⚠️」表記
- ストアドロップダウンの候補は用途で分ける：
  - **閲覧系**（月次・公休・キャリア）→ 従業員がいる店舗のみ
  - **登録・設定系**（店舗別設定・従業員マスタ）→ 全店舗表示

### 参照すべきスキル
- `notion-integration-patterns.md` — Notion API 連携のベストプラクティス
- `api-error-handling-patterns.md` — エラーハンドリング全般

---

## セキュリティ設計

### 管理者認証の仕組み

```
[ブラウザ]                    [サーバー]                  [Notion]
    |                             |                           |
    | POST /api/admin/auth        |                           |
    | { password: "****" }  →    | ADMIN_PASSWORD(env)と照合 |
    |                        ←   | httpOnly cookie 発行       |
    |                             |                           |
    | GET /api/admin/tips         |                           |
    | (cookie自動送信)       →    | cookie検証                |
    |                        ←   | Notionから取得してレスポンス|
```

### ポイント

- **パスワードは環境変数 `ADMIN_PASSWORD` のみに存在**。フロントのコードには含まれない。
- **cookieには生パスワードを入れない**。`lib/adminAuth.ts` の `buildAdminToken()` で SHA-256（固定ソルト付き）にハッシュ化したものを保存。検証も同じハッシュ値で比較する。
- **APIルートはcookieを検証**。管理者画面を経由しない直接リクエストは403を返す。
- 全admin系APIは `verifyAdminCookie(req)`（NextRequest経由）または `isAdminAuthenticated()`（cookies()経由）のいずれかで認証チェック。生パスワード比較は禁止。
- cookieは `httpOnly`（JSから読めない）・`sameSite: strict`・`maxAge: 1日`。

### 残存リスク（許容済み・デモ段階）

| リスク | 内容 | 対応方針 |
|--------|------|---------|
| cookieの有効期限 | 現状は1日。長すぎると乗っ取りリスク | 本番時に短縮検討 |
| HTTPSのみ | VercelはHTTPS必須なので問題なし。ローカル開発はHTTP | ローカルは許容 |
| パスワード強度 | オーナーが設定。弱いパスワードは運用でカバー | 本番時に注意喚起 |

### 保護対象のAPIルート

`/api/admin/*` 配下はすべてcookie認証が必要。

| エンドポイント | 操作内容 |
|--------------|---------|
| GET /api/admin/tips | 保健師の一言 全件取得 |
| PATCH /api/admin/tips/[id] | 保健師の一言 更新 |
| GET /api/admin/employees | 従業員マスタ 取得 |
| GET /api/admin/payroll | 店舗別設定 取得 |
| GET /api/admin/store-settings | 店舗一覧 取得 |
| GET /api/admin/holiday | 公休・有給レコード 取得 |
| PATCH /api/admin/records/[pageId] | 月次レコード 更新 |

### 保護不要のAPIルート（従業員向け）

| エンドポイント | 理由 |
|--------------|------|
| GET /api/employees | 打刻画面で従業員リストを表示するため認証不要 |
| POST /api/timestamp | 打刻登録。認証なしだが悪用しても打刻ログが増えるだけ |
| GET /api/tips | 打刻画面で一言表示するため認証不要 |

---

## 環境変数

| 変数名 | 用途 |
|--------|------|
| NOTION_API_KEY | Notion APIキー |
| TIMELOG_DB_ID | 勤怠ログDB（打刻・公休・有給） |
| EMPLOYEE_DB_ID | 従業員マスタDB |
| STORE_SETTINGS_DB_ID | 店舗設定DB（店舗名・定休曜日・給与計算設定） |
| TIPS_DB_ID | 保健師の一言DB |
| OVERTIME_REQUEST_DB_ID | 時間外申請DB |
| ADMIN_PASSWORD | 管理者パスワード |
| ADMIN_TOKEN_SALT | 管理者cookieハッシュ用のソルト（公開リポジトリに置けないためコードから外出し） |

---

## 有給休暇残日数管理（**未実装・将来対応・フェーズ4以降**）

「従業員マスタDBに有給残日数の数値カラムを追加する」という案が出たが、**単純な数値カラムだけだと運用で必ず破綻する**ため一旦見送り。理由と将来設計のメモ：

### なぜ単純実装ではダメか（地雷リスト）

| 問題 | 内容 |
|------|------|
| 付与ロジック | 入社半年後に10日、勤続年数で増加（11→12→14→16→18→20日） |
| 基準日 | 各人入社日基準 vs 全員4/1統一 のどちらでも例外運用が出る |
| 時効消滅 | 2年で消える。前年度繰越分は今年度末でロスト |
| 比例付与 | 週5未満勤務は別テーブル |
| 取得との連動 | `公休設定` で「有給」を記録した時に自動減算するか別管理か |
| 年度リセット | 自動付与バッチが必要 |

### あるべき設計（実装する時の指針）

独立した1機能（新タブ「有給管理」）として設計する：
- 入社日と勤続年数から **付与日数を自動計算**
- `公休設定` で「有給」を記録 → **自動で残日数を減算**
- 年度切り替え時の **時効消滅・繰越処理**
- 残日数の **履歴ログを残す**（監査用）
- パート用の **比例付与テーブル** を別途持つ

→ Notion だけだと年度バッチ処理が厳しいので、Vercel Cron + API Route での実装も検討。

---

## 打刻画面の3層防御設計（**未実装・将来対応**）

打刻画面 `/` と `/api/employees` は現状 cookie 認証なしで公開されており、従業員名・店舗名が外部に晒されるリスクがある。将来的に以下の3層防御を実装する設計案：

### 設計概要

```
[NFC] → [スマホブラウザ] → [Vercelサーバー]
  ↓          ↓                  ↓
URL展開   localStorage/cookie  ?key= 検証
          で招待コード保持      ↓
                                Notion API
```

### 3層の役割

| 層 | 仕組み | 目的 |
|----|--------|------|
| **① URLキー（Secret URL）** | NFCタグから `https://tap-in/store/rommy?key=8x4n2f9k7m3q5w1z` 形式で起動 | URLを知らない人を弾く（物理媒体に縛る） |
| **② サーバー認証（Key Check）** | サーバー側で `?key=...` の値を検証。NGなら 404 | クローラーや推測アクセスを完全遮断 |
| **③ 招待コード認証（Code Auth + Device Memory）** | 初回のみ招待コード入力 → cookie発行（365日）→ 以降は自動通過 | デバイス単位の本人確認 + 体験を犠牲にしない |

### cookie 仕様（打刻画面用）

| 項目 | 値 |
|------|-----|
| httpOnly | true |
| secure | 有効 |
| sameSite | strict |
| maxAge | 365日 |

### 実装時の注意

- 招待コードを localStorage に**生で保存しない**（cookie で署名付きトークンを発行する）
- URLキーは半年〜1年でローテーション可能な仕組みにする（NFCタグ更新で対応）
- `Vercel Password Protection` との関係は要再検討（A: 併用 / B: 3層のみ / C: Vercel保護のみ）。現方針は **B案（3層のみ）** を想定

### 参考図

設計図は別途プロジェクト管理ツールに保管（FigJam等）。

---

## 公開アクセス制御（検索エンジン対策）

打刻ページや `/api/employees` は cookie 認証なしで公開されており、従業員名・店舗名が JS レンダリング後の DOM に出る。Googlebot は JS を実行するため、放置すると検索結果に従業員名が露出するリスクあり。多層防御：

| 層 | 実装 | 効果 |
|----|------|------|
| 1. `robots.txt` | `public/robots.txt` で全クローラー Disallow | お行儀のいいクローラーをブロック |
| 2. `X-Robots-Tag` ヘッダー | `next.config.ts` で全パスに `noindex, nofollow` | クロールされても検索結果に載せない |
| 3. Vercel Password Protection | デプロイ後にオーナーが手動設定（手順は `VERCEL_SETUP.md`） | 物理的にサイト全体を遮断（最強） |

**1・2はコード済み**。3はVercel管理画面でオーナーが設定する必要あり（端末ごとに初回パスワード1回のみで、以降はcookie記憶）。

## 今後の課題（本番移行時）

- [ ] パスワードをオーナーが変更できる仕組み
- [ ] 管理者セッションのログアウト機能
- [ ] APIレート制限（Notionへの過剰リクエスト防止）
- [ ] **Vercel Password Protection の設定**（`VERCEL_SETUP.md` 参照）

## ⚠ 本番前に必ず削除するデバッグ機能

### モック時刻機能（打刻時刻の偽装）

| ファイル | 該当箇所 |
|---------|---------|
| `components/DebugSettings.tsx` | テスト打刻時刻UI（管理画面デバッグタブ） |
| `app/page.tsx` | `localStorage.getItem("debug_mock_time")` をAPIに送る処理 |
| `app/api/timestamp/route.ts` | `mockTime` パラメーターの受け取り |
| `lib/notion.ts` | `registerTimestamp()` の `mockTime` 引数とその適用ロジック |

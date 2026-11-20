# FLIGHT OPS — 機材運用・発着ゲートボード（個人用 PWA）

`https://yokomizomasaharu-sketch.github.io/flight-ops/`

航空機の **発着時刻・ゲート・ターミナル・運航状況** と、**機体（レジ番）の運用（機材繰り）** を
iPhone のホーム画面から1タップで確認するための独立 PWA です。個人情報・予約情報は含みません。

---

## 1. 何が自動で取れて、何がリンクなのか（実測・2026-11-20）

### ライブ自動取得（アプリ内にボード表示）

| 空港 | 取得元（公式サイトの公開データ） | 取れる項目 |
|---|---|---|
| 羽田 HND | `POST https://www.tokyo-haneda.com/app/api/v2/flight/search`（国内/国際 × 出発/到着） | 定刻・変更時刻・行き先・便名（コードシェア含む）・ターミナル・**ゲート**・保安検査場・ステータス |
| 成田 NRT | `GET https://www.narita-airport.jp/api/bff/searchFlight/`（国内/国際 × 出発/到着、ページング） | 定刻・変更時刻・行き先・便名・ターミナル・**ゲート**・ステータス |
| 福岡 FUK | `GET https://www.fukuoka-airport.jp/api/flight_schedule/flight_schedule.json`（当日全便） | 定刻・実績/予測時刻・行き先・便名（コードシェア含む）・ターミナル・**ゲート（搭乗口）**・備考 |

- これらは GitHub Actions（`.github/workflows/snapshot.yml`）が **10分ごと**に取得し、`data` ブランチの
  `boards.json` として公開 → アプリが同じビルドから読む方式です（**約10分間隔のスナップショット**）。
- 空港公式サイトの JSON は `Access-Control-Allow-Origin` を返さないため、**ブラウザから直接 fetch はできません**。
  そこで取得だけを Actions（サーバー側）で行い、結果を静的 JSON として配信しています。

### リンク連携（自動取得できない空港・詳細）

| 対象 | 理由 | 対応 |
|---|---|---|
| 関西 KIX / 伊丹 ITM / 中部 NGO | 公式サイトが Akamai / Cloudflare で自動アクセスを遮断（HTTP 403） | 公式フライト情報＋Flightradar24（出発/到着）＋FlightAware へ 1 タップ直結 |
| 新千歳 CTS / 那覇 OKA / 桃園 TPE / 仁川 ICN ほか | 公式に当日ボードの JSON 公開がなく（または CORS 不可） | 同上 |
| 全世界 5,338 空港 | — | Flightradar24 の空港ボード（IATA から URL 自動生成）＋主要空港は FlightAware（ICAO） |
| 機体の現在位置（ADS-B） | 無料 ADS-B API（OpenSky / adsb.lol / airplanes.live）は CORS ヘッダを返さず、公開 CORS プロキシはレート制限で不安定 | Flightradar24 機体ページ・FlightAware・ADS-B Exchange へ直結 |
| 機材繰り（前便→当便→次便） | 航空会社・FR24 の内部 API は非公開 | FR24 機体ページ（その機体の当日全フライト）へ直結 |

### 機材（レジ番）照会だけはブラウザから直接ライブ取得

- `https://api.adsbdb.com/v0/aircraft/{レジ}` … 型式・運航者・ICAO24（**CORS 対応・APIキー不要**）
- `https://api.adsbdb.com/v0/callsign/{コールサイン}` … その便の運航区間（例 `SFJ25` → HND→KIX）
- 便名を入れると、レジ番の代わりに `IATA→ICAO`（NH→ANA）変換したコールサインで照会し、
  **羽田/成田/福岡の本日ボードを横断検索**して、その便の時刻・ゲートも表示します。

### 飛行履歴（どこからどこへ飛んだか）— 2026-11-20 追加・実測

- `https://api.flightradar24.com/common/v1/flight/list.json?query={レジ番}&fetchBy=reg&limit=100&page=1`
  … **`Access-Control-Allow-Origin: *` を返し、ブラウザから直接取得できる**（APIキー不要）。
  1機体あたり **直近7日・最大100便**（便名・出発地/到着地・定刻/実績/予定時刻・状態）が返ります。
  実測：JA01XJ=28便 / JA27MC=40便 / JA61AN=43便 / 東京→那覇の JL905=15便（いずれも最古=7日前）。
- `fetchBy=flight&query={便名}` … その便名を最近どの機材が飛んだか（使用機材・便ごとの発着地）。
- 制限（実測）：`page=2` 以降や `olderThenFlightId` / `date` を付けても **7日より前は返らない**（無料範囲外）。
  長期履歴は FR24 機体ページ（月別カレンダー）・FlightAware へ直結。
- ICAO24 hex（例 `8406E8`）は上記エンドポイントが非対応（`fetchBy=icao24` は 400）のため、
  adsbdb（hex でも照会可）でレジ番に解決してから履歴を引いています。
- CORS 実測で不可だったもの：OpenSky（本環境から TCP 到達不可／タイムアウト）、adsb.lol・adsb.fi・hexdb（reg 照会）・
  airplanes.live（要連絡・403）、adsbdb（履歴なし）。
- 補足：FR24 は `HeadlessChrome` の UA を Cloudflare で弾く（=ブラウザ実機・iPhone Safari では 200）。

---

## 2. 画面

1. **🛫 発着ボード** — お気に入り空港（HND/KIX/ITM/NRT/FUK/CTS/OKA/NGO…）をワンタップ切替、
   出発/到着 × 国内/国際、便名・行き先で絞り込み。行をタップで便の詳細（ゲート・ターミナル・
   FR24/FlightAware 直結・「この便を機材運用に登録」）。
2. **🛩️ 機材運用** — レジ番／ICAO24 hex／便名で検索 → 機体情報・**これまでの飛行履歴タイムライン**
   （日付・便名・出発→到着・状態、日別グルーピング、よく飛ぶ区間・訪問空港・平均遅延）・
   ボード横断・外部リンク。お気に入り機体の履歴は「お気に入りの飛行履歴」から1タップで再表示（15分キャッシュ）。
3. **🏢 リンク集** — 航空会社62社の運航状況、空港の公式フライト情報、FR24/FlightAware/ADS-B Exchange 等。

## 3. 構成

```
index.html / style.css / app.js        アプリ本体
airports_data.js                       世界5,338空港（OurAirports / public domain）
airlines_data.js                       航空会社62社（IATA/ICAO/公式サイト）
links_data.js                          空港公式リンク・ICAO・ツール
fonts/                                 JetBrains Mono / Inter（SIL OFL 1.1）
icons/                                 192 / 512 / maskable / apple-touch
manifest.json / sw.js / pwa.js         PWA（standalone・オフライン起動）
scripts/fetch_boards.py                公式ボード取得（Actions 実行）
.github/workflows/snapshot.yml         10分ごとの取得 → data ブランチへ push
data/boards.json                       同梱スナップショット（起動時・オフライン用フォールバック）
```

## 4. データの扱い

- 公開情報（各空港・航空会社の公式発表）のみ。**ユーザーの予約・個人情報は一切保存しません。**
- お気に入り空港・機体は端末の localStorage のみ。
- `noindex` + `robots.txt` で検索エンジンから除外。
- ゲートは変更されます。最終確認は各空港公式サイトで。

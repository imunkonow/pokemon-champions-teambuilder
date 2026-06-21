# ポケモンチャンピオンズ チームビルダー Webアプリ 設計書

> 作成: 2026-06-18 / 更新: 2026-06-18

## 目標

ポケモンチャンピオンズ風UIでチーム構築・戦術分析・ダメージ計算を行えるWebアプリ。

---

## 開発フェーズ概観

| フェーズ | 状態 | 内容 |
|---|---|---|
| **Prototype** | **実装済(2026-06-18 / 2026-06-21拡充)** | React(CDN+Babel classic runtime)単一HTML + data.js分離。Node不要でGitHub Pages配信。明るめ3カラム/技範囲/選出弱点/努力値入力など全機能動作。`index.html`+`data.js`+`style.css`。**2026-06-21**: data.jsを`DEX`マスタ方式に再構築(名前→[図鑑番号,[タイプ],[種族値]]からPOKEMON_TYPES/BASE_STATS/SPRITE_IDSを生成)し Season M-3 の235種を網羅。メガは`MEGA`(実数値変化27種)+`getTypes`/`getBase`の「メガ」strip流用。MOVE_TYPES 265技・メガストーン75/道具167。技重複警告・スマホ向けヘッダー(コンパクト固定枠+ポケ追加ボタン常設)追加。ローカル確認は`.claude/launch.json`(python http.server :3456) |
| **Static App** | **← 次** | Vite + React + TS + Tailwind へ移行(要Nodeインストール)。スマホレスポンシブ精緻化。localStorage継続 |
| **Full App** | 将来 | 全ポケモンデータ・EV入力・DB保存・認証など |

> 今は構想を練る段階。実装は Static App フェーズから始める。

---

## アーキテクチャ方針

### Prototype (現在)
- 静的HTMLファイルを直接開くだけ
- データはJSONをハードコードで持てばOK
- 動作確認・UI検討が目的

### Static App (次フェーズ)
| 項目 | 方針 |
|---|---|
| サーバー | **不要** (静的ファイルのみ) |
| データ永続化 | **localStorage** (チームデータ) + **JSONファイル** (マスタ) |
| レギュレーション更新 | **手動** (月1回。JSONを差し替えるだけ) |
| デプロイ | `file://` で直接開く / GitHub Pages (任意) |

### Full App (将来)
| 項目 | 方針 |
|---|---|
| ポケモンデータ | 全186種 + メガ、EV/IV自由入力、技全量 |
| 保存 | DB (SQLite or Supabase) で複数デバイス対応 |
| 認証 | 必要なら追加 |
| その他 | インポート/エクスポート、共有URL など |

---

## 技術スタック

```
Framework:  Vite + React + TypeScript
Styling:    Tailwind CSS
D&D:        @dnd-kit/core (ドラッグ&ドロップ)
永続化:      localStorage (チーム保存)
データ:      /public/data/*.json (ポケモンマスタ・レギュレーション)
ビルド出力:  dist/ → 静的ファイル一式
```

**Next.js は不要** (サーバー機能を使わないため Vite で十分)

---

## データ設計

### JSONファイル (静的マスタ、手動更新)

```
public/data/
├── pokemon.json          # 全ポケモン基本データ (種族値・タイプ・技リスト)
├── moves.json            # 技データ (威力・命中・タイプ・効果)
├── items.json            # アイテム一覧
└── regulation-mb.json    # M-B 使用可能ポケモンリスト + 禁止事項
```

```typescript
// pokemon.json の型
type PokemonMaster = {
  id: number
  name_ja: string
  dex_number: number
  types: Type[]
  base_stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  abilities: string[]
  mega_stone?: string
  learns: string[]          // 技IDリスト
}

// regulation-mb.json の型
type Regulation = {
  id: string                // 'M-B'
  valid_from: string        // '2026-06-17'
  valid_until: string       // '2026-09-02'
  allowed_dex: number[]     // 使用可能な図鑑番号
  banned_items: string[]    // ['mega-lucario-z', 'mega-garchomp-z']
  new_items: string[]       // ['life-orb', 'wide-lens', 'light-clay']
}
```

### localStorage (ユーザーデータ、自動保存)

```typescript
// チーム
type Team = {
  id: string
  name: string
  format: 'single' | 'double'
  regulation: string        // 'M-B'
  slots: (Build | null)[]   // 6枠
  notes: string
  updated_at: string
}

// 個体ビルド (ポケソルテキスト1件分)
type Build = {
  id: string
  pokemon_id: number
  item: string
  tera_type: string
  ability: string
  nature: string
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  moves: [string, string, string, string]
}
```

---

## 機能要件

### Phase 1 — MVP

| 機能 | 説明 |
|---|---|
| チーム構築UI | 6枠スロット、ポケモン選択パネル、D&D並び替え |
| ポケモン検索 | 名前・タイプ・世代フィルタ |
| 個体詳細ビュー | ポケソルテキスト形式で表示・編集 |
| レギュレーション適用 | M-B使用可能ポケモンのみ表示 |
| タイプ相性チェック | チーム全体の弱点・耐性ヒートマップ |
| チーム保存 | localStorage に自動保存、複数チーム管理 |

### Phase 2

| 機能 | 説明 |
|---|---|
| 素早さ調整計算 | 抜きたいSを入力→必要努力値を逆算。最速/準速/下降対応 |
| ダメージ計算 | 攻撃側・防御側のビルドを選択して計算。テラスタル・天候補正対応 |
| エクスポート | ポケソルテキスト形式でクリップボードコピー / JSONダウンロード |
| レギュレーション切替 | M-A ↔ M-B の切り替え |

### Phase 3

| 機能 | 説明 |
|---|---|
| ポケモンチャンピオンズ風UIデザイン | アプリの配色・レイアウトに寄せたデザイン |
| 天敵分析 | チームの弱点を突くポケモンを自動検出 |
| 選出パターン記録 | 対戦後の選出・勝敗をメモ、傾向集計 |

---

## 画面構成

```
/                     → チーム一覧 (ダッシュボード)
/team/new             → チーム構築
/team/:id             → チーム詳細・編集
/pokemon              → ポケモン一覧
/pokemon/:id          → ポケモン詳細 + 保存済み個体
/calc/damage          → ダメージ計算
/calc/speed           → 素早さ調整計算
/season               → レギュレーション情報 (JSONから表示)
```

---

## チーム構築UI レイアウト

```
┌─────────────────────────────────────────────┐
│  [Single ▼]  Team: "最終定跡"  [保存] [新規] │
├──────────────────────┬──────────────────────┤
│  チームスロット (6枠) │  ポケモン選択         │
│                      │  [🔍 検索___________] │
│  ┌───┐┌───┐┌───┐   │  [タイプ▼][世代▼]    │
│  │ 1 ││ 2 ││ 3 │   │                      │
│  │   ││   ││   │   │  ┌──┐┌──┐┌──┐...    │
│  └───┘└───┘└───┘   │  │  ││  ││  │       │
│  ┌───┐┌───┐┌───┐   │  └──┘└──┘└──┘       │
│  │ 4 ││ 5 ││ 6 │   │                      │
│  └───┘└───┘└───┘   │  [選択中: ガブリアス] │
│                      │  ＋ 個体選択 / 新規  │
├──────────────────────┴──────────────────────┤
│  タイプ相性チェック                          │
│  ほのお ●●○○  みず ●●●○  でんき ●○○○ ... │
└─────────────────────────────────────────────┘
```

---

## ダメージ計算式

```
基本ダメージ = floor(floor(floor(2×50/5+2) × 技威力 × A/D) / 50) + 2

補正の積 (順番に掛ける):
  × テラスタル補正 (一致1.5 or 2.0 / 非一致なし)
  × タイプ一致補正 (1.5)
  × タイプ相性 (0.25 / 0.5 / 1 / 2 / 4)
  × 天候補正 (1.5 / 0.5)
  × 乱数 (0.85〜1.00)

実数値の計算:
  攻撃・防御 = floor(floor((種族値×2+個体値+floor(努力値/4)) × 50/100) + 5) × 性格補正
  HP = floor(floor((種族値×2+個体値+floor(努力値/4)) × 50/100) + 50 + 10)
```

---

## 素早さ調整計算式

```
S実数値 = floor((種族値×2 + 個体値 + floor(努力値/4)) × 50/100 + 5) × 性格補正

逆算 (目標S実数値から必要努力値):
  必要EV = (ceil(目標 / 性格補正) - 5) * 100/50 - 種族値*2 - 個体値) * 4
  → 0〜252に丸め込み
```

---

## 初期データ取得方針

ポケモンマスタJSONの作成:
1. bulbapedia の種族値データ を手動コピー or 公開JSONを利用
   - 参考: https://pokeapi.co/ (無料API、初回取得のみ)
2. ポケモンチャンピオンズ固有の情報 (使用可能リスト等) は `regulation-mb.json` に手動記載
3. 以降のレギュレーション更新時: `regulation-*.json` を追加するだけ

---

## 実装優先順位

| # | Phase | タスク | 工数 |
|---|---|---|---|
| 1 | 1 | Vite + React + Tailwind セットアップ | 0.5h |
| 2 | 1 | pokemon.json 作成 (pokeapi.co から取得) | 1h |
| 3 | 1 | ポケモン一覧・検索コンポーネント | 1.5h |
| 4 | 1 | チーム構築UI (6スロット + 選択) | 2h |
| 5 | 1 | 個体ビルド編集フォーム | 1.5h |
| 6 | 1 | タイプ相性ヒートマップ | 1h |
| 7 | 1 | localStorage 保存・読込 | 0.5h |
| 8 | 2 | 素早さ調整計算 | 1h |
| 9 | 2 | ダメージ計算 | 2h |
| 10 | 3 | UIブラッシュアップ | 3h |

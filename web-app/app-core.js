// app-core.js — 共有ヘルパ・データ・計算・基本UI（OptSelect/MoveSelect/Slot/分析ビュー等）
// 注: index.html / damage.html / speed.html が fetch→連結→Babel変換する単一スコープの一部。編集時はこのファイルのみでよい。
const { useState, useMemo, useEffect, useRef } = React
const D = window.PCDATA
const { TYPE_COLORS, TYPES, EFF, POKEMON_TYPES, SPRITE_IDS, SHOWDOWN_NAMES, ALL_NATURES, NATURE_MOD, MOVE_TYPES, MOVE_POWER, THREATS, BASE_STATS, ITEMS, OWNED_MD_TEXT, TEMPLATES } = D

// ── ヘルパー ──
function parseStats(str){
  // テキスト由来のEVは従来式(classic 0-252)表記 → そのまま正準実努力値 rev に保持
  if(!str) return Array(6).fill(0).map(()=>({val:0,ev:0,rev:0}))
  const segs = str.split('-').map(seg=>{
    const m = seg.trim().match(/^(\d+)(?:\((\d+)\))?/)
    const ev = m && m[2] ? +m[2] : 0
    return m ? {val:+m[1], ev, rev:ev} : {val:0,ev:0,rev:0}
  })
  while(segs.length<6) segs.push({val:0,ev:0,rev:0})
  return segs.slice(0,6)
}
function statsToStr(stats){
  // 出力は従来式EV(=正準実努力値 rev)で揃える（ポケソルテキストは classic 表記）
  return stats.map(s=>{const r=statRealEV(s); return `${s.val||0}${r?`(${r})`:''}`}).join('-')
}
function parsePokeSol(text){
  const blocks = text.trim().split(/\n[ \t]*\n+/)
  const out=[]
  for(const block of blocks){
    const raw=block.trim(); if(!raw) continue
    const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean)
    if(!lines.length) continue
    const f=lines[0]
    if(f.startsWith('#')||f.startsWith('>')||f.startsWith('-')) continue
    const at=f.indexOf('@')
    const name=(at>=0?f.slice(0,at):f).trim()
    if(!name) continue
    const item=(at>=0?f.slice(at+1):'').trim()
    const p={id:Math.random().toString(36).slice(2),name,item,teraType:'',ability:'',nature:'',stats:Array(6).fill(0).map(()=>({val:0,ev:0})),moves:[],selected:false,raw}
    for(const ln of lines.slice(1)){
      if(ln.startsWith('テラスタイプ:')) p.teraType=ln.slice(7).trim()
      else if(ln.startsWith('特性:')) p.ability=ln.slice(3).trim()
      else if(ln.startsWith('性格:')) p.nature=ln.slice(3).trim()
      else if(/^\d/.test(ln)) p.stats=parseStats(ln)
      else if(ln.includes('/')) p.moves=ln.split('/').map(m=>m.trim()).filter(m=>m&&m!=='-')
    }
    out.push(p)
  }
  return out
}
function buildRaw(p){
  const L=[`${p.name} @ ${p.item||''}`.trim()]
  if(p.teraType) L.push(`テラスタイプ: ${p.teraType}`)
  if(p.ability) L.push(`特性: ${p.ability}`)
  if(p.nature) L.push(`性格: ${p.nature}`)
  const ss=statsToStr(p.stats); if(ss.replace(/[-0]/g,'')) L.push(ss)
  const mv=(p.moves||[]).filter(Boolean)
  if(mv.length) L.push(mv.join(' / '))
  return L.join('\n')
}
function getTypes(name){
  if(!name) return []
  if(POKEMON_TYPES[name]) return POKEMON_TYPES[name]
  const mega=name.replace(/^メガ/,'')            // 未登録メガはベース流用
  if(mega!==name && POKEMON_TYPES[mega]) return POKEMON_TYPES[mega]
  const keys=Object.keys(POKEMON_TYPES)
  const hit=keys.find(k=>name.startsWith(k)||k.startsWith(name.replace(/[（(].*[）)]/,'')))
  return hit?POKEMON_TYPES[hit]:[]
}
// 同一ポケ内で重複している技名の配列を返す
function findDupMoves(moves){
  const seen={}, dups=new Set()
  ;(moves||[]).forEach(m=>{ if(!m)return; if(seen[m])dups.add(m); seen[m]=1 })
  return [...dups]
}
function getSpriteUrl(name){
  if(SHOWDOWN_NAMES[name]) return `https://play.pokemonshowdown.com/sprites/gen6/${SHOWDOWN_NAMES[name]}.png`
  const id=SPRITE_IDS[name]
  if(id) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
  const base=name.replace(/^メガ/,'')
  if(SPRITE_IDS[base]) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${SPRITE_IDS[base]}.png`
  return null
}
function moveInfo(name){ return MOVE_TYPES[name] || null }
function movePow(name){ return (MOVE_POWER && MOVE_POWER[name]!=null) ? MOVE_POWER[name] : null }
// 画像フォールバック：Showdownが落ちてもPokeAPI(メガid→ベースid)へ自動切替、最後は非表示
function imgFallback(e,name){
  const img=e.target, tried=img.dataset.fb||''
  const ids=[]
  if(SPRITE_IDS[name]) ids.push(SPRITE_IDS[name])
  const base=(name||'').replace(/^メガ/,'').replace(/[（(].*[）)]/,'')
  if(SPRITE_IDS[base]) ids.push(SPRITE_IDS[base])
  for(const id of ids){
    const u=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    if(img.src!==u && !tried.includes(u)){ img.dataset.fb=tried+'|'+u; img.style.visibility=''; img.src=u; return }
  }
  img.style.visibility='hidden'
}

// 種族値取得（メガ無ければベース流用）
function getBase(name){
  if(!name) return null
  if(BASE_STATS[name]) return BASE_STATS[name]
  const b=name.replace(/^メガ/,'')
  return BASE_STATS[b] || null
}
// 性格補正倍率（statIdx: 0HP 1Atk 2Def 3SpA 4SpD 5Spe）
function natureMult(natureName, statIdx){
  if(statIdx===0) return 1
  const nm = NATURE_MOD[natureName]; if(!nm) return 1
  if(nm[0]+1===statIdx) return 1.1
  if(nm[1]+1===statIdx) return 0.9
  return 1
}
// 実数値計算（Lv50・個体値31）。realEV=従来式換算後の実努力値(0-256)
function calcStatFromReal(base, realEV, statIdx, natureName){
  const iv=31, lv=50
  const inner = Math.floor((2*base + iv + Math.floor((realEV||0)/4)) * lv/100)
  if(statIdx===0) return inner + lv + 10
  return Math.floor((inner + 5) * natureMult(natureName, statIdx))
}
function calcStat(base, ev, statIdx, natureName){ return calcStatFromReal(base, effEV(ev), statIdx, natureName) }
// stat の正準実努力値（rev があれば優先。無ければ現モードEVから換算）。モード切替で投資量がブレない基準値
function statRealEV(s){ return (s && s.rev!=null) ? s.rev : effEV(s ? (s.ev||0) : 0) }
// 種族値が分かるなら全実数値を再計算して stats に反映（実数値は正準 rev から算出）
function recalcStats(stats, name, nature){
  const base=getBase(name); if(!base) return stats
  return stats.map((s,i)=>({...s, val:calcStatFromReal(base[i], statRealEV(s), i, nature)}))
}

// ── データ ──
const OWNED = parsePokeSol(OWNED_MD_TEXT)
const uniq = a => [...new Set(a)].filter(Boolean)
const sortJa = a => [...a].sort((x,y)=>x.localeCompare(y,'ja'))
const ALL_NAMES   = sortJa(uniq([...Object.keys(POKEMON_TYPES), ...OWNED.map(p=>p.name)]))
const ALL_MOVES   = sortJa(uniq([...OWNED.flatMap(p=>p.moves), ...Object.keys(MOVE_TYPES)]))
const ALL_ITEMS   = sortJa(uniq([...ITEMS, ...OWNED.map(p=>p.item)]))
const ALL_ABIL    = sortJa(uniq(OWNED.map(p=>p.ability)))
const ALL_POKEMON_WITH_STATS = sortJa(Object.keys(BASE_STATS))
const ATK_ABILITIES = ['てきおうりょく','ちからずく','テクニシャン','はりきり','ちからもち','ヨガパワー','すなのちから','サンパワー','いろめがね','かたやぶり','トランジスタ','りゅうのあぎと','はがねつかい','フェアリースキン','スカイスキン','フリーズスキン','エレキスキン','ノーマルスキン','もうか(発動)','しんりょく(発動)','げきりゅう(発動)','むしのしらせ(発動)','もらいび(発動)']
const DEF_ABILITIES = ['マルチスケイル','ファントムガード','てんねん','ハードロック','フィルター','プリズムアーマー','ファーコート','こおりのりんぷん','あついしぼう','たいねつ','すいほう','ふしぎなまもり','ふゆう','よびみず','ちょすい','そうしょく','かんそうはだ','ちくでん','ひらいしん','でんきエンジン','もらいび']
// 技をタイプ別にグループ化（select の optgroup 用）
const MOVE_GROUPS = (()=>{
  const g={}
  ALL_MOVES.forEach(m=>{const mi=MOVE_TYPES[m]; const t=mi?mi[0]:'その他'; (g[t]=g[t]||[]).push(m)})
  const ordered=TYPES.filter(t=>g[t]).map(t=>[t,g[t]])
  if(g['その他']) ordered.push(['その他',g['その他']])
  return ordered
})()
const EV_LABELS   = ['HP','こうげき','ぼうぎょ','とくこう','とくぼう','すばやさ']
const EV_KEYS     = ['H','A','B','C','D','S']
// ── 努力値モード ──
// champ  : ポケチャン式（各ステ最大32 / 合計66）。能力値=floor((種2+個31+能力P×2)×50/100+5)×性格
//          → 能力P×2 が従来式の floor(EV/4) と同位置。1能力P=実数値+1（出典: yakkun.com/ch/stat_points.htm）
//          内部換算 conv:ev×8（clamp256）→ floor(conv/4)=ev×2 で真値一致（ev=32→64。旧clamp252はここで1ズレしていた）
// classic: 従来式換算（各ステ最大252 / 合計516）。チャンピオンズ実数値を従来努力値に当てはめると各ステ+1ぶん高く、合計は516になる（出典: yakkun.com/ch/stat_points.htm）
// conv: その値を実数値計算用(従来式EV相当)に換算 / inv: 実数値相当→このモードのEV値へ逆換算（モード切替時に投資量を保つ）
const EV_MODES = {
  champ:   {label:'ポケモンチャンピオンズ式', max:32,  total:66,  step:1,  preset:[0,2,4,8,12,16,20,24,28,32],
            conv:ev=>Math.min((ev||0)*8,256), inv:re=>Math.min(Math.round((re||0)/8),32)},
  classic: {label:'従来式 252',           max:252, total:516, step:4,  preset:[0,4,12,16,32,52,100,124,156,196,252],
            conv:ev=>Math.min(ev||0,252),       inv:re=>Math.min(Math.round((re||0)/4)*4,252)},
}
let EV_MODE = (localStorage.getItem('pc_evmode') in EV_MODES) ? localStorage.getItem('pc_evmode') : 'champ'
function evCfg(){ return EV_MODES[EV_MODE] || EV_MODES.champ }
function effEV(ev){ return evCfg().conv(ev) }   // 実数値計算用の換算後EV
const EV_DEFAULT  = 0   // 新規個体は全0スタート（合計66/516 内で割り振る）

// テキスト由来（所持md/インポート）のEVは従来式252表記。正準 rev を保ったまま現モードのEV値へ換算
function convEvsToMode(stats){
  const to=evCfg()
  return stats.map(s=>{ const rev=Math.min(s.rev!=null?s.rev:(s.ev||0),256); return {...s, rev, ev:to.inv(rev)} })
}
// テキスト由来の個体を現モードへ正規化（EV換算→実数値再計算）。実数値は変わらず合計のみ66式へ
function normFromText(p){
  const np=JSON.parse(JSON.stringify(p))
  np.stats=recalcStats(convEvsToMode(np.stats), np.name, np.nature)
  return np
}

// ── 相性計算 ──
function calcWeak(members){
  if(!members.length) return null
  return TYPES.map((atk,ai)=>{
    let x4=0,x2=0,half=0,x0=0
    for(const p of members){
      const tlist = getTypes(p.name)
      if(!tlist.length) continue
      let m=1
      for(const dt of tlist){const di=TYPES.indexOf(dt); if(di>=0) m*=EFF[ai][di]}
      if(m>=4)x4++; else if(m>=2)x2++; else if(m<=0)x0++; else if(m<1)half++
    }
    return {type:atk,x4,x2,half,x0}
  })
}
function calcCoverage(members){
  const atkTypes = uniq(members.flatMap(p=>(p.moves||[]).map(m=>{const mi=moveInfo(m); return mi&&mi[1]!=='sta'?mi[0]:null})))
  if(!atkTypes.length) return null
  return TYPES.map((def,di)=>{
    let best=0
    for(const at of atkTypes){const ai=TYPES.indexOf(at); if(ai>=0) best=Math.max(best,EFF[ai][di])}
    return {type:def,best,atkTypes}
  })
}

// ═══ App ═══
function App(){
  const [format,setFormat]=useState(()=>localStorage.getItem('pc_format')||'single')
  const [team,setTeam]=useState(()=>{
    try{const s=localStorage.getItem('pc_team'); if(s)return JSON.parse(s)}catch(e){}
    return Array(6).fill(null)
  })
  const [pool,setPool]=useState([])
  const [rightTab,setRightTab]=useState('all')
  const [anaTab,setAnaTab]=useState('teamWeak')
  const [modal,setModal]=useState(null)
  const [importText,setImportText]=useState('')
  const [evMode,setEvModeS]=useState(EV_MODE)
  const [view,setView]=useState('team')   // スマホ用セクション切替（目次）: team|ana|add
  const [help,setHelp]=useState(false)     // 使い方メニュー
  // 目次ナビ：スマホは該当セクションのみ表示、PCはアンカーへスクロール
  function goView(v){ setView(v); const el=document.getElementById('sec-'+v); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) }
  // ヘッダー/フッターのページナビ（構築/ダメージ/素早さ）→ ページ内の該当タブへ飛ぶ
  function jumpTo(key){
    if(key==='damage'||key==='speed'){ setView('ana'); setAnaTab(key); const el=document.getElementById('sec-ana'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) }
    else { setView('team'); const el=document.getElementById('sec-team'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) }
  }
  // 別ページ等からの #damage / #speed ディープリンクに対応
  useEffect(()=>{
    function applyHash(){ const h=(location.hash||'').replace('#',''); if(h==='team'||h==='damage'||h==='speed') jumpTo(h) }
    applyHash()
    window.addEventListener('hashchange',applyHash)
    return ()=>window.removeEventListener('hashchange',applyHash)
  },[])
  const navActive = (view==='ana' && (anaTab==='damage'||anaTab==='speed')) ? anaTab : 'team'

  useEffect(()=>{localStorage.setItem('pc_team',JSON.stringify(team))},[team])
  useEffect(()=>{localStorage.setItem('pc_format',format)},[format])

  // 努力値モード切替：正準実努力値 rev を基準に新モードのEV値へ換算（往復しても投資量がブレない）
  function setEvMode(m){
    if(!(m in EV_MODES)||m===EV_MODE)return
    const from=EV_MODES[EV_MODE], to=EV_MODES[m]
    EV_MODE=m; localStorage.setItem('pc_evmode',m); setEvModeS(m)
    setTeam(t=>t.map(p=>{
      if(!p)return p
      const stats=p.stats.map(s=>{ const rev=(s.rev!=null?s.rev:from.conv(s.ev||0)); return {...s, rev, ev:to.inv(rev)} })
      return {...p, stats:recalcStats(stats,p.name,p.nature)}
    }))
  }

  const maxSel = format==='single'?3:4
  const members = team.filter(Boolean)
  const selected = team.filter(p=>p&&p.selected)

  const dup = useMemo(()=>{
    const nameC={},itemC={},dp=new Set(),dit=new Set(),dn=[],din=[]
    team.forEach((p,i)=>{ if(!p)return; (nameC[p.name]=nameC[p.name]||[]).push(i); if(p.item)(itemC[p.item]=itemC[p.item]||[]).push(i) })
    for(const[k,v]of Object.entries(nameC))if(v.length>1){v.forEach(i=>dp.add(i));dn.push(k)}
    for(const[k,v]of Object.entries(itemC))if(v.length>1){v.forEach(i=>dit.add(i));din.push(k)}
    return {dp,dit,dn,din}
  },[team])

  function addToTeam(p){
    const i=team.indexOf(null)
    if(i<0){alert('チームが満員です（6枠）。');return}
    const selCnt=team.filter(x=>x&&x.selected).length
    const np={...JSON.parse(JSON.stringify(p)),id:Math.random().toString(36).slice(2),selected:selCnt<maxSel}
    setTeam(t=>t.map((x,j)=>j===i?np:x))
  }
  // 複数体をまとめて空き枠へ充填（提案の一括追加用）
  function addManyToTeam(builds){
    setTeam(t=>{
      const nt=[...t]; let selCnt=nt.filter(p=>p&&p.selected).length
      for(const p of builds){
        const idx=nt.indexOf(null); if(idx<0)break
        const np={...JSON.parse(JSON.stringify(p)),id:Math.random().toString(36).slice(2),selected:selCnt<maxSel}
        if(np.selected)selCnt++; nt[idx]=np
      }
      return nt
    })
  }
  // テンプレパーティを丸ごと投入（6枠を置き換え）
  function loadParty(memberTexts){
    const builds=(memberTexts||[]).map(t=>{const p=parsePokeSol(t)[0]; return p?normFromText(p):null}).filter(Boolean)
    if(!builds.length){alert('テンプレを解釈できませんでした。');return}
    if(team.some(Boolean) && !window.confirm('現在のチームをテンプレで置き換えますか？')) return
    setTeam(()=>{
      const nt=Array(6).fill(null)
      builds.slice(0,6).forEach((b,i)=>{ nt[i]={...b,id:Math.random().toString(36).slice(2),selected:i<maxSel} })
      return nt
    })
  }
  function removeSlot(i){setTeam(t=>t.map((x,j)=>j===i?null:x))}
  // ── 枠のドラッグ&ドロップ入れ替え ──
  const dragIdx=useRef(null)
  function onDragStartSlot(e,i){ dragIdx.current=i; e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain',String(i))}catch(_){} }
  function onDropSlot(e,i){
    e.preventDefault()
    let from=dragIdx.current
    if(from==null){ const d=+e.dataTransfer.getData('text/plain'); from=isNaN(d)?null:d }
    if(from==null||from===i)return
    setTeam(t=>{const n=[...t];[n[from],n[i]]=[n[i],n[from]];return n})
    dragIdx.current=null
  }
  function updateSlot(i,patch){
    setTeam(t=>t.map((x,j)=>{
      if(j!==i||!x)return x
      const np={...x,...patch}
      if('name'in patch||'nature'in patch) np.stats=recalcStats(np.stats,np.name,np.nature)
      np.raw=buildRaw(np)
      return np
    }))
  }
  function updateMove(i,k,v){
    setTeam(t=>t.map((x,j)=>{
      if(j!==i||!x)return x
      const moves=[...(x.moves||['','','',''])]; while(moves.length<4)moves.push('')
      moves[k]=v
      const np={...x,moves}; np.raw=buildRaw(np)
      return np
    }))
  }
  function toggleStar(i){
    setTeam(t=>{
      const cur=t[i]; if(!cur)return t
      const cnt=t.filter(p=>p&&p.selected).length
      if(!cur.selected && cnt>=maxSel){alert(`選出は${maxSel}体まで（${format==='single'?'シングル':'ダブル'}）`);return t}
      return t.map((x,j)=>j===i?{...x,selected:!x.selected}:x)
    })
  }
  function clearSelection(){ setTeam(t=>t.map(p=>p?{...p,selected:false}:p)) }
  function clearTeam(){ if(window.confirm('6体を全て削除しますか？'))setTeam(Array(6).fill(null)) }
  function removeByRaw(raw){ setTeam(t=>t.map(p=>p&&p.raw===raw?null:p)) }
  function saveDraft(draft,slot){
    const p={...draft}; p.raw=buildRaw(p)
    if(slot===null){
      const i=team.indexOf(null)
      if(i<0){alert('チームが満員です。');return}
      const selCnt=team.filter(x=>x&&x.selected).length
      p.id=Math.random().toString(36).slice(2); p.selected=selCnt<maxSel
      setTeam(t=>t.map((x,j)=>j===i?p:x))
    }else{
      setTeam(t=>t.map((x,j)=>j===slot?{...p,id:x.id,selected:x.selected}:x))
    }
    setModal(null)
  }
  function downloadTeam(){
    if(!members.length){alert('チームにポケモンがいません。');return}
    const text=members.map(buildRaw).join('\n\n')
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='team.txt'; a.click(); URL.revokeObjectURL(a.href)
  }
  // 解析→空き枠へ自動充填（6体入力で自動的に埋まる/最初maxSel体を自動選出）、あふれはpoolへ
  function doImport(text){
    const parsed=parsePokeSol(text)
    if(!parsed.length){alert('解析できませんでした。フォーマットを確認してください。');return 0}
    const emptyCount=team.filter(x=>x===null).length
    const toTeam=parsed.slice(0,emptyCount), toPool=parsed.slice(emptyCount)
    if(toTeam.length){
      setTeam(t=>{
        const nt=[...t]; let selCnt=nt.filter(p=>p&&p.selected).length
        for(const p of toTeam){
          const idx=nt.indexOf(null); if(idx<0)break
          const np={...normFromText(p),id:Math.random().toString(36).slice(2),selected:selCnt<maxSel}
          if(np.selected)selCnt++; nt[idx]=np
        }
        return nt
      })
    }
    if(toPool.length) setPool(pl=>{const add=toPool.filter(p=>!pl.some(x=>x.raw===p.raw)); return [...pl,...add]})
    return parsed.length
  }
  // 素早さビュー用：すばやさ努力値だけ変更して再計算
  function updateSpeedEv(i,ev){ updateStatEv(i,5,ev) }
  // 任意ステの努力値だけその場変更して実数値を再計算（素早さ/ダメージ調整で共用）
  function updateStatEv(i,statIdx,ev){
    setTeam(t=>t.map((x,j)=>{
      if(j!==i||!x)return x
      const stats=x.stats.map((s,k)=>k===statIdx?{...s,ev:(+ev||0),rev:effEV(+ev||0)}:s)
      const np={...x,stats:recalcStats(stats,x.name,x.nature)}; np.raw=buildRaw(np)
      return np
    }))
  }

  return (
    <div>
      <SiteHeader active={navActive} title="チームビルダー" onNav={jumpTo}
        onAdd={()=>setModal({mode:'add',slot:null,draft:blankDraft()})}
        onHelp={()=>setHelp(true)}
        onDownload={downloadTeam}
        extra={
          <span className="fmt-tog" title="ルール切替">
            <button className={'fmt-btn'+(format==='single'?' on':'')} onClick={()=>setFormat('single')} title="シングル 3/6選出">シングル</button>
            <button className={'fmt-btn'+(format==='double'?' on':'')} onClick={()=>setFormat('double')} title="ダブル 4/6選出">ダブル</button>
          </span>
        } />

      {/* 目次ナビ（スマホはセクション切替＝スクロール最小化／PCはアンカー移動） */}
      <nav className="secnav">
        <button className={'secnav-btn'+(view==='team'?' on':'')} onClick={()=>goView('team')}>🛡 構成</button>
        <button className={'secnav-btn'+(view==='ana'?' on':'')} onClick={()=>goView('ana')}>📊 分析</button>
        <button className={'secnav-btn'+(view==='add'?' on':'')} onClick={()=>goView('add')}>＋ 追加</button>
        <button className="secnav-btn help" onClick={()=>setHelp(true)}>❓ 使い方</button>
      </nav>

      <div className="layout" data-view={view}>
        <div className="main-col">
        <div className="panel sec-team" id="sec-team">
          <div className="panel-title">
            <span style={{display:'flex',alignItems:'center',gap:6}}>チーム構成 <Tip text="追加した最初の3〜4体は自動で選出マークが付きます（「選出」ボタンで解除/変更可）。持ち物・技はカード上のセレクトから直接編集。⠿をドラッグで枠を入れ替え。✏で性格・努力値まで詳しく編集。" /></span>
            <span style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span className="ev-mode-tog" title="努力値モード切替">
                {Object.entries(EV_MODES).map(([k,c])=>(
                  <button key={k} className={'ev-mode-btn'+(evMode===k?' on':'')} onClick={()=>setEvMode(k)}>{c.label}</button>
                ))}
              </span>
              <span style={{color:'var(--muted)',fontWeight:600}}>選出 {selected.length}/{maxSel}</span>
              {selected.length>0 && <button className="mini-btn" onClick={clearSelection} title="選出マークを全て解除">選出クリア</button>}
              {team.some(Boolean) && <button className="mini-btn" onClick={clearTeam} title="6体を全て空にする" style={{color:'var(--danger,#c0392b)'}}>チームクリア</button>}
            </span>
          </div>
          {(dup.dn.length||dup.din.length)?(
            <div className="dup-warning">
              {dup.dn.length?<div>⚠ 同じポケモン: {dup.dn.join(', ')}</div>:null}
              {dup.din.length?<div>⚠ 同じ持ち物: {dup.din.join(', ')}</div>:null}
            </div>
          ):null}
          <div className="team-grid">
            {team.map((p,i)=>(
              <Slot key={i} poke={p} idx={i} format={format}
                dupP={dup.dp.has(i)} dupI={dup.dit.has(i)}
                onStar={()=>toggleStar(i)} onRemove={()=>removeSlot(i)}
                onUpdate={patch=>updateSlot(i,patch)} onMove={(k,v)=>updateMove(i,k,v)}
                onEdit={()=>setModal({mode:'edit',slot:i,draft:cloneDraft(p)})}
                onAdd={()=>setModal({mode:'add',slot:null,draft:blankDraft()})}
                onDragStart={e=>onDragStartSlot(e,i)} onDrop={e=>onDropSlot(e,i)} />
            ))}
          </div>
        </div>

        <div className="panel sec-ana" id="sec-ana">
          <div className="panel-title"><span style={{display:'flex',alignItems:'center',gap:6}}>チーム分析 <Tip text="弱点指数=4倍×2+2倍の合計。低いほど弱点が少なく安定。技範囲タブは攻撃技で抜群を取れない『穴』を確認できます。" /></span></div>
          <div className="ana-tabs">
            <button className={'atab'+(anaTab==='teamWeak'?' active':'')} onClick={()=>setAnaTab('teamWeak')}>チーム弱点</button>
            <button className={'atab'+(anaTab==='selWeak'?' active':'')} onClick={()=>setAnaTab('selWeak')}>選出弱点</button>
            <button className={'atab'+(anaTab==='coverage'?' active':'')} onClick={()=>setAnaTab('coverage')}>技範囲</button>
            <button className={'atab'+(anaTab==='comp'?' active':'')} onClick={()=>setAnaTab('comp')}>相性補完</button>
            <button className={'atab'+(anaTab==='speed'?' active':'')} onClick={()=>setAnaTab('speed')}>素早さ</button>
            <button className={'atab'+(anaTab==='damage'?' active':'')} onClick={()=>setAnaTab('damage')}>ダメージ</button>
          </div>
          {anaTab==='teamWeak' && <WeakView members={members} label="チーム全体" />}
          {anaTab==='selWeak' && <WeakView members={selected} label="選出メンバー" emptyMsg="「選出」ボタンで選出ポケモンをマークしてください" />}
          {anaTab==='coverage' && <CoverageView all={members} sel={selected} />}
          {anaTab==='comp' && <ComplementView all={members} sel={selected} />}
          {anaTab==='speed' && <SpeedView team={team} evMode={evMode} onSpeedEv={updateSpeedEv} />}
          {anaTab==='damage' && <DamageView team={team} evMode={evMode} format={format} />}
        </div>
        </div>

        <aside className="side-col" id="sec-add">
        <div className="panel">
          <div className="panel-title"><span style={{display:'flex',alignItems:'center',gap:6}}>ポケモン追加 <Tip text="全ポケ=詳細入力して追加 / 所持=登録済みの個体から / インポート=ポケソルのテキストを貼り付け→空き枠へ自動充填(6体で自動的に埋まる)。" /></span></div>
          <button className="btn-add-new" onClick={()=>setModal({mode:'add',slot:null,draft:blankDraft()})}>＋ 詳細入力で追加</button>
          <div className="ptabs">
            <button className={'ptab'+(rightTab==='all'?' active':'')} onClick={()=>setRightTab('all')}>全ポケ</button>
            <button className={'ptab'+(rightTab==='mine'?' active':'')} onClick={()=>setRightTab('mine')}>所持</button>
            <button className={'ptab'+(rightTab==='tmpl'?' active':'')} onClick={()=>setRightTab('tmpl')}>テンプレ</button>
            <button className={'ptab'+(rightTab==='suggest'?' active':'')} onClick={()=>setRightTab('suggest')}>提案</button>
            <button className={'ptab'+(rightTab==='import'?' active':'')} onClick={()=>setRightTab('import')}>インポート</button>
          </div>
          {rightTab==='all' && <AllTab onPick={name=>setModal({mode:'add',slot:null,draft:blankDraft(name)})} />}
          {rightTab==='mine' && <MineTab team={team} onAdd={addToTeam} onRemove={removeByRaw} />}
          {rightTab==='tmpl' && <TemplatesTab format={format} onLoadParty={loadParty} />}
          {rightTab==='suggest' && <SuggestTab team={team} onAdd={addToTeam} onAddMany={addManyToTeam} />}
          {rightTab==='import' && <ImportTab pool={pool} team={team} text={importText} setText={setImportText}
            onParse={()=>{const n=doImport(importText); if(n)setImportText('')}}
            onAdd={addToTeam} doImport={doImport} />}
        </div>
        </aside>
      </div>

      {modal && <EditModal modal={modal} evMode={evMode} onClose={()=>setModal(null)} onSave={saveDraft}
        team={team} onAddToTeam={addToTeam} onAddMany={addManyToTeam} onRemoveRaw={removeByRaw}
        pool={pool} importText={importText} setImportText={setImportText} doImport={doImport}
        format={format} onLoadParty={loadParty} />}
      {help && <HelpModal onClose={()=>setHelp(false)} />}
      <SharedDatalists/>
      <SiteFooter active={navActive} onNav={jumpTo}/>
    </div>
  )
}

// ── 使い方ヒント（丸い?アイコン＋吹き出し） ──
function Tip({text}){
  return <span className="tip" tabIndex={0} role="button" aria-label="ヒント" data-tip={text} onClick={e=>e.stopPropagation()}>?</span>
}

// ── 使い方メニュー（全体ガイド） ──
function HelpModal({onClose}){
  const items=[
    ['🛡 構成','ポケモンを6枠に追加→最初の3〜4体は自動で選出マーク。カード上で持ち物・技を直接編集、⠿ドラッグで並べ替え、✏で性格・努力値まで編集。'],
    ['＋ 追加','「全ポケ」=詳細入力／「所持」=登録済み個体／「提案」=相性補完で候補／「インポート」=ポケソルのテキスト貼付で空き枠へ自動充填。ヘッダーの＋ポケモンからも同じ4タブが開けます。'],
    ['📊 分析 / 弱点','タイプ相性で被弾を集計。弱点指数=4倍×2+2倍の合計（低いほど安定）。「技範囲」で抜群を取れない穴、「相性補完」で後出しの噛み合いを確認。'],
    ['⚡ 素早さ','種族値10族ごとの最速ライン（横線）と代表ポケ(種族値つき)を重ねて、どの種族値を抜けるか一目で。補正1.1/1.0/0.9・スカーフ・S努力値・ランクを調整すると●実数値が即反映。'],
    ['🔥 ダメージ','「1vs1」=タイマン詳細、「1vs6」=攻撃側→チーム全6体の早見表。天候・持ち物(火力アイテム)・特性・努力値・テラスを設定。体力バーは実機同様 右→左に減少。'],
    ['🔁 努力値モード','「チャンピオンズ式(合計66)」と「従来式252」を切替可能。投資量は保持されるので往復しても値はブレません。'],
  ]
  return (
    <div className="overlay" onClick={e=>{if(e.target.className==='overlay')onClose()}}>
      <div className="modal help-modal">
        <div className="modal-head">
          <div className="modal-head-l"><div style={{fontSize:18,fontWeight:800,color:'var(--accent)'}}>❓ 使い方</div></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="help-list">
          {items.map(([h,b],i)=>(
            <div className="help-item" key={i}>
              <div className="help-h">{h}</div>
              <div className="help-b">{b}</div>
            </div>
          ))}
        </div>
        <div className="ana-note" style={{marginTop:6}}>出典: バトメモ(pamo3.com) / ポケモン徹底攻略(yakkun.com/ch)</div>
        <button className="modal-save" onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}

// ── 候補リストの共有datalist（同じ定数配列は1つを使い回してノード重複を避ける） ──
function sharedListId(options){
  if(options===ALL_ITEMS) return 'dl-items'
  if(options===ALL_NAMES) return 'dl-names'
  if(options===ALL_ABIL)  return 'dl-abil'
  return null
}
function SharedDatalists(){
  return (
    <>
      <datalist id="dl-items">{ALL_ITEMS.map(o=><option key={o} value={o}/>)}</datalist>
      <datalist id="dl-names">{ALL_NAMES.map(o=><option key={o} value={o}/>)}</datalist>
      <datalist id="dl-abil">{ALL_ABIL.map(o=><option key={o} value={o}/>)}</datalist>
      <datalist id="dl-moves">{ALL_MOVES.map(m=>{const mi=MOVE_TYPES[m];return <option key={m} value={m} label={mi?mi[0]:''}/>})}</datalist>
    </>
  )
}
// ── 絞り込みセレクト（input+datalist：打鍵で候補を絞れるコンボボックス。未登録値も自由入力可） ──
function OptSelect({value,onChange,options,placeholder,className,style}){
  const v=value||''
  const shared=sharedListId(options)
  const localId=useMemo(()=>'dl'+Math.random().toString(36).slice(2),[])
  const id=shared||localId
  return (
    <>
      <input className={(className||'')+' combo-in'} style={style} list={id} value={v} placeholder={placeholder||'—'}
        onClick={e=>e.stopPropagation()} onChange={e=>onChange(e.target.value)} />
      {!shared && <datalist id={localId}>{options.map(o=><option key={o} value={o}/>)}</datalist>}
    </>
  )
}
// ── 技セレクト（select+optgroup：タイプ別グループ。選択肢を常に表示） ──
function MoveSelect({value,onChange,className,placeholder,style}){
  const v=value||''
  return (
    <select className={className||''} style={style} value={v}
      onClick={e=>e.stopPropagation()} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder||'技を選択'}</option>
      {MOVE_GROUPS.map(([type,moves])=>(
        <optgroup key={type} label={type}>
          {moves.map(m=><option key={m} value={m}>{m}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function cloneDraft(p){ return JSON.parse(JSON.stringify(p)) }
function blankDraft(name=''){
  const stats=Array(6).fill(0).map(()=>({val:0,ev:EV_DEFAULT,rev:0}))
  return {name, item:'', teraType:getTypes(name)[0]||'', ability:'', nature:'',
    stats:recalcStats(stats,name,''), moves:['','','',''], selected:false}
}

// ── スロット ──
function Slot({poke,idx,format,dupP,dupI,onStar,onRemove,onUpdate,onMove,onEdit,onAdd,onDragStart,onDrop}){
  if(!poke){
    const label = format==='single' ? (idx<3?`枠 ${idx+1}`:`控え ${idx-2}`) : (idx<4?`枠 ${idx+1}`:`控え ${idx-3}`)
    return <div className="slot" onClick={onAdd} onDragOver={e=>e.preventDefault()} onDrop={onDrop}><div className="slot-empty"><span className="plus">＋</span><span>{label}</span></div></div>
  }
  const types=getTypes(poke.name)
  const url=getSpriteUrl(poke.name)
  const base=getBase(poke.name)
  const spe=poke.stats&&poke.stats[5]?(poke.stats[5].val||0):0
  const evParts=poke.stats?poke.stats.map((s,i)=>s.ev?EV_KEYS[i]+s.ev:null).filter(Boolean):[]
  const dupMv=findDupMoves(poke.moves)
  return (
    <div className={'slot filled'+(poke.selected?' selected':'')+(dupP?' dup-poke':'')+(dupI?' dup-item':'')}
         onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
      <div className="pcard">
        <span className="drag-handle" draggable onDragStart={onDragStart} title="ドラッグで枠を入れ替え">⠿</span>
        <button className={'sel-btn'+(poke.selected?' on':'')} onClick={onStar} title="選出メンバーに指定">{poke.selected?'★ 選出中':'選出'}</button>
        <div className="pcard-top">
          {url?<img className="pcard-sprite" src={url} alt="" onError={e=>imgFallback(e,poke.name)}/>:<div className="pcard-sprite-ph">🎮</div>}
          <div className="pcard-main">
            <div className="pname" onClick={onEdit} title="クリックで編集">{poke.name}</div>
            <div className="pitem">@ <OptSelect className="pitem-in" value={poke.item} options={ALL_ITEMS} placeholder="持ち物" onChange={v=>onUpdate({item:v})} /></div>
            <div className="ptypes">{types.map(t=><span key={t} className="type-badge" style={{background:TYPE_COLORS[t]||'#888'}}>{t}</span>)}</div>
          </div>
        </div>
        <div className="pmoves">
          {[0,1,2,3].map(k=>{
            const m=(poke.moves||[])[k]||''
            const mi=moveInfo(m)
            const col=mi?TYPE_COLORS[mi[0]]:'#cbd3e6'
            const isDup=m&&dupMv.includes(m)
            return <div key={k} className="pmove"><span className="mdot" style={{background:col}} title={mi?mi[0]:'タイプ未登録'}></span><MoveSelect className={'pmove-in'+(isDup?' dup-move':'')} value={m} placeholder={'技'+(k+1)} onChange={v=>onMove(k,v)} /></div>
          })}
        </div>
        {dupMv.length?<div className="dup-move-warn">⚠ 技が重複: {dupMv.join(', ')}</div>:null}
        {base&&spe?<div className="pspeed" title="すばやさ実数値（種族値）／こだわりスカーフ時(×1.5)">素早さ実数値 <b>{spe}</b> <span>(種{base[5]})</span> ／ (スカーフ) <b>{Math.floor(spe*1.5)}</b></div>:null}
        {evParts.length?<div className="pev">努力値 <b>{evParts.join(' / ')}</b></div>:null}
        <div className="pnature">{poke.nature||''}{poke.ability?' · '+poke.ability:''}{poke.teraType?' · テラ'+poke.teraType:''}</div>
        <div className="pcard-actions">
          <button className="mini-btn" onClick={onEdit}>✏ 編集</button>
          <button className="mini-btn rm" onClick={onRemove}>×</button>
        </div>
      </div>
    </div>
  )
}

// ── 弱点ビュー ──
function WeakView({members,label,emptyMsg}){
  const w=calcWeak(members)
  if(!w) return <div className="chart-empty">{emptyMsg||'チームにポケモンを追加すると表示されます'}</div>
  const totW = w.reduce((s,r)=>s+r.x4*2+r.x2,0)
  return (
    <div>
      <div className="ana-note">攻撃タイプ → {label}({members.length}体)の被弾。4=4倍 / 2=2倍 / ½=半減 / ✕=無効</div>
      <div className="ana-sum">
        <div className="sum-chip">弱点指数 <b>{totW}</b></div>
        <div className="sum-chip">4倍 <b>{w.reduce((s,r)=>s+r.x4,0)}</b></div>
        <div className="sum-chip">無効 <b>{w.reduce((s,r)=>s+r.x0,0)}</b></div>
      </div>
      {w.map(r=>(
        <div className="type-row" key={r.type}>
          <span className="type-label" style={{background:TYPE_COLORS[r.type]}}>{r.type}</span>
          <div className="dots">
            {Array(r.x4).fill(0).map((_,i)=><div key={'a'+i} className="wd wd-4">4</div>)}
            {Array(r.x2).fill(0).map((_,i)=><div key={'b'+i} className="wd wd-2">2</div>)}
            {Array(r.half).fill(0).map((_,i)=><div key={'c'+i} className="wd wd-h">½</div>)}
            {Array(r.x0).fill(0).map((_,i)=><div key={'d'+i} className="wd wd-0">✕</div>)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 技範囲ビュー ──
function CoverageView({all,sel}){
  const [scope,setScope]=useState('all')
  const members = scope==='sel'?sel:all
  const cov=calcCoverage(members)
  const atkTypes = cov?cov[0].atkTypes:[]
  return (
    <div>
      <div className="ana-tabs" style={{marginBottom:8}}>
        <button className={'atab'+(scope==='all'?' active':'')} onClick={()=>setScope('all')}>チーム全体</button>
        <button className={'atab'+(scope==='sel'?' active':'')} onClick={()=>setScope('sel')}>選出のみ</button>
      </div>
      {!cov ? <div className="chart-empty">攻撃技を持つポケモンを追加すると表示されます</div> : (
      <div>
        <div className="ana-note">攻撃技タイプ: {atkTypes.map(t=><span key={t} className="type-badge" style={{background:TYPE_COLORS[t],marginRight:3}}>{t}</span>)}</div>
        <div className="ana-note">各防御タイプへ取れる最大倍率（○=抜群を取れる / ✕=等倍以下しか無い穴）</div>
        {cov.map(r=>{
          let cls='wd ',txt
          if(r.best>=4){cls+='cov-x4';txt='×4'} else if(r.best>=2){cls+='cov-x2';txt='×2'}
          else if(r.best>=1){cls+='wd-0';txt='×1'} else if(r.best>0){cls+='cov-no';txt='½'} else {cls+='cov-no';txt='0'}
          return (
            <div className="type-row" key={r.type}>
              <span className="type-label" style={{background:TYPE_COLORS[r.type]}}>{r.type}</span>
              <div className="dots"><div className={cls} style={{minWidth:34}}>{txt}</div>
                {r.best>=2?<span style={{fontSize:10,color:'var(--good)',fontWeight:700}}>○ 抜群</span>:r.best<1?<span style={{fontSize:10,color:'var(--bad)',fontWeight:700}}>✕ 穴</span>:<span style={{fontSize:10,color:'var(--faint)'}}>等倍</span>}
              </div>
            </div>
          )
        })}
      </div>)}
    </div>
  )
}

// ── スコープ切替（全体/選出） ──
function ScopeTabs({scope,setScope}){
  return (
    <div className="ana-tabs" style={{marginBottom:8}}>
      <button className={'atab'+(scope==='all'?' active':'')} onClick={()=>setScope('all')}>チーム全体</button>
      <button className={'atab'+(scope==='sel'?' active':'')} onClick={()=>setScope('sel')}>選出のみ</button>
    </div>
  )
}

// ── 能力ランク増減（-6〜+6・スピードプラス風） 素早さ/ダメージ共用 ──
function RankStepper({rank,setRank,label}){
  const r=Math.max(-6,Math.min(6,rank|0))
  const ico=r>0?'🔼':r<0?'🔽':'±'
  return (
    <span className="rank-tog" title={(label||'能力ランク')+' -6〜+6'}>
      {label?<span className="rank-lab">{label}</span>:null}
      <button className="rank-btn" onClick={()=>setRank(Math.max(-6,r-1))} disabled={r<=-6}>−</button>
      <span className={'rank-val'+(r>0?' up':r<0?' dn':'')}>{ico}{r>0?'+'+r:r}</span>
      <button className="rank-btn" onClick={()=>setRank(Math.min(6,r+1))} disabled={r>=6}>＋</button>
    </span>
  )
}

// ── 相性補完（1対1：行のポケが列のポケの弱点をどれだけ受けられるか） ──
function typeMultOn(name, atkIdx){
  const tl=getTypes(name); if(!tl.length)return 1
  let m=1; for(const dt of tl){const di=TYPES.indexOf(dt); if(di>=0)m*=EFF[atkIdx][di]} return m
}
function weakTypesOf(name){ return TYPES.filter((t,i)=>typeMultOn(name,i)>=2) }
function complementScore(coverName,weakName){
  const w=weakTypesOf(weakName)
  let c=0; for(const t of w){const i=TYPES.indexOf(t); if(typeMultOn(coverName,i)<=0.5)c++}
  return {covered:c,total:w.length}
}
function ComplementView({all,sel}){
  const [scope,setScope]=useState('all')
  const members = scope==='sel'?sel:all
  return (
    <div>
      <ScopeTabs scope={scope} setScope={setScope}/>
      {members.length<2 ? <div className="chart-empty">2体以上で相性補完を表示します</div> : (
      <div>
        <div className="ana-note">行のポケが「列のポケの弱点」を半減/無効でカバーできる数。多いほど後出し補完◎（テラス前のタイプで判定）</div>
        <div className="comp-wrap">
          <table className="comp-table">
            <thead><tr><th></th>{members.map((p,j)=><th key={j} title={p.name}>{spriteIcon(p.name)}</th>)}</tr></thead>
            <tbody>
              {members.map((cov,i)=>(
                <tr key={i}>
                  <th title={cov.name}>{spriteIcon(cov.name)}</th>
                  {members.map((weak,j)=>{
                    if(i===j) return <td key={j} className="comp-self">―</td>
                    const {covered,total}=complementScore(cov.name,weak.name)
                    const ratio=total?covered/total:0
                    let cls='comp-cell '
                    if(!total)cls+='comp-na'; else if(ratio>=0.6)cls+='comp-hi'; else if(ratio>0)cls+='comp-mid'; else cls+='comp-lo'
                    return <td key={j} className={cls} title={cov.name+' は '+weak.name+' の弱点 '+total+' 中 '+covered+' を半減/無効'}>{total?covered:'–'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ana-note" style={{marginTop:8}}>色: <b style={{color:'var(--good)'}}>緑=補完◎</b> / 黄=一部 / 赤=カバー無し / 灰=列ポケに弱点なし</div>
      </div>)}
    </div>
  )
}
function spriteIcon(name){
  const url=getSpriteUrl(name)
  return url?<img className="comp-ico" src={url} alt={name} onError={e=>imgFallback(e,name)}/>:<span className="comp-ico-ph">🎮</span>
}

// 能力ランク倍率（-6〜+6・素早さ/攻撃/防御で共用）※ダメージ計算(app-damage)と素早さ(app-speed)の両方が使う共有ヘルパ
function rankMult(r){ r=Math.max(-6,Math.min(6,r|0)); return r>=0 ? (2+r)/2 : 2/(2-r) }

// ════════ サイト共通ナビ（ヘッダー＝ページ移動＋ハンバーガー / フッター＝スクロールで自動非表示）════════
// ページ別パス（チームは index.html / localStorage 'pc_team' を全ページで共有参照）
const SITE_PAGES = [
  {key:'team',   label:'構築',    icon:'🛡', href:'./index.html#team'},
  {key:'damage', label:'ダメージ', icon:'🔥', href:'./index.html#damage'},
  {key:'speed',  label:'素早さ',   icon:'⚡', href:'./index.html#speed'},
]
// 下スクロールで隠す（上スクロール/最上部で表示）＝モバイルのベストプラクティス
function useScrollHide(threshold=72){
  const [hidden,setHidden]=useState(false)
  useEffect(()=>{
    let last=window.scrollY, ticking=false
    function update(){
      const y=window.scrollY
      if(y>last+4 && y>threshold) setHidden(true)
      else if(y<last-4 || y<=threshold) setHidden(false)
      last=y; ticking=false
    }
    function onScroll(){ if(!ticking){ requestAnimationFrame(update); ticking=true } }
    window.addEventListener('scroll',onScroll,{passive:true})
    return ()=>window.removeEventListener('scroll',onScroll)
  },[threshold])
  return hidden
}
// テーマ（明/暗）— 全ページ共通。body[data-theme] と localStorage を同期
function useTheme(){
  const [theme,setTheme]=useState(()=>localStorage.getItem('pc_theme')||'light')
  useEffect(()=>{document.body.setAttribute('data-theme',theme);localStorage.setItem('pc_theme',theme)},[theme])
  return [theme,setTheme]
}
// チーム状態を localStorage と同期（ページ間共有。index/damage/speed が同じ 'pc_team' を読む）
function useStandaloneTeam(){
  const [team,setTeam]=useState(()=>{
    try{const s=localStorage.getItem('pc_team'); if(s)return JSON.parse(s)}catch(e){}
    return Array(6).fill(null)
  })
  useEffect(()=>{localStorage.setItem('pc_team',JSON.stringify(team))},[team])
  return [team,setTeam]
}
// ページ移動リンク（PC=ヘッダー横並び / モバイル=ハンバーガードロワー＆フッタータブ）
// onNav があれば同一ページ内ジャンプ（既定はページ遷移リンク。index 内ではタブ切替＋スクロール）
function PageNav({active,variant,onNav}){
  return (
    <nav className={'page-nav '+(variant||'')}>
      {SITE_PAGES.map(p=>(
        <a key={p.key} className={'page-link'+(active===p.key?' on':'')} href={p.href} title={p.label}
           onClick={onNav?(e=>{e.preventDefault(); onNav(p.key)}):undefined}>
          <span className="page-ico">{p.icon}</span><span className="page-lab">{p.label}</span>
        </a>
      ))}
    </nav>
  )
}
// サイトヘッダー（ブランド＋ページナビ＋ハンバーガー＋右側アクション差し込み）
function SiteHeader({active,title,onAdd,onHelp,onDownload,onNav,extra}){
  const [theme,setTheme]=useTheme()
  const [menu,setMenu]=useState(false)
  const navAndClose = onNav ? (k=>{setMenu(false);onNav(k)}) : null
  return (
    <header className="site-header">
      <div className="hdr-main">
        <button className="hamburger" onClick={()=>setMenu(m=>!m)} aria-label="メニュー" title="メニュー">☰</button>
        <h1 title={title||'ポケモンチャンピオンズ チームビルダー'}>⚔<span className="hdr-title-txt"> {title||'チームビルダー'}</span></h1>
        <PageNav active={active} variant="inline" onNav={onNav}/>
        <span className="reg-mini" title="レギュレーション M-B（2026-06-17〜09-02）">M-B</span>
      </div>
      <div className="hdr-actions">
        {extra}
        {onAdd && <button className="btn-add-hdr" onClick={onAdd} title="ポケモンを追加">＋<span className="hdr-add-txt"> ポケモン</span></button>}
        {onHelp && <button className="btn-ico" onClick={onHelp} title="使い方">？</button>}
        {onDownload && <button className="btn-ico" onClick={onDownload} title="チームをテキスト出力">⬇</button>}
        <button className="btn-ico" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} title="ダークモード切替">{theme==='dark'?'☀':'🌙'}</button>
      </div>
      {menu && (
        <div className="hdr-drawer" onClick={()=>setMenu(false)}>
          <div className="hdr-drawer-inner" onClick={e=>e.stopPropagation()}>
            <div className="drawer-h">メニュー</div>
            <PageNav active={active} variant="drawer" onNav={navAndClose}/>
            <div className="drawer-sep"></div>
            {onAdd && <button className="drawer-item" onClick={()=>{setMenu(false);onAdd()}}>＋ ポケモンを追加</button>}
            {onHelp && <button className="drawer-item" onClick={()=>{setMenu(false);onHelp()}}>？ 使い方</button>}
            {onDownload && <button className="drawer-item" onClick={()=>{setMenu(false);onDownload()}}>⬇ テキスト出力</button>}
            <button className="drawer-item" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☀ ライトモード':'🌙 ダークモード'}</button>
          </div>
        </div>
      )}
    </header>
  )
}
// サイトフッター（下スクロールで自動非表示のタブバー）
function SiteFooter({active,onNav}){
  const hidden=useScrollHide()
  return (
    <footer className={'site-footer'+(hidden?' hidden':'')}>
      {SITE_PAGES.map(p=>(
        <a key={p.key} className={'foot-link'+(active===p.key?' on':'')} href={p.href}
           onClick={onNav?(e=>{e.preventDefault(); onNav(p.key)}):undefined}>
          <span className="foot-ico">{p.icon}</span><span className="foot-lab">{p.label}</span>
        </a>
      ))}
    </footer>
  )
}
// 標準ページ枠（ヘッダー＋本文＋フッター）— damage.html / speed.html 用
function PageShell({active,title,children}){
  return (
    <div className="site-page">
      <SiteHeader active={active} title={title}/>
      <div className="page-body">{children}</div>
      <SiteFooter active={active}/>
    </div>
  )
}

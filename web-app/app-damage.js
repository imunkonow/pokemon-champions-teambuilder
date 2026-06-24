// app-damage.js — ダメージ計算ビュー（DamageView / 計算ヘルパ）
// ── ダメージ計算ヘルパ（Lv50・シングル・目安） ──
// 天候→攻撃タイプ倍率
function weatherAtkMult(w,t){
  if(w==='sunny'&&t==='ほのお')return 1.5; if(w==='sunny'&&t==='みず')return 0.5
  if(w==='rain'&&t==='みず')return 1.5;   if(w==='rain'&&t==='ほのお')return 0.5
  return 1
}
// 天候→防御側ステ倍率（砂嵐=岩特防×1.5 / 霰雪=氷特防×1.5）
function weatherDefMult(w,dTypes,cat){
  if(cat==='spe'&&w==='sand'&&dTypes.includes('いわ'))return 1.5
  if(cat==='spe'&&(w==='hail'||w==='snow')&&dTypes.includes('こおり'))return 1.5
  return 1
}
// 攻撃側特性ボーナス（aMult=攻撃実数値倍率 / powMult=威力倍率 / newType=技タイプ変更(スキン) / tinted=半減時×2 / adaptability=タイプ一致2.0 / moldBreaker=相手特性無視）
const SKIN_TYPE = {'フェアリースキン':'フェアリー','スカイスキン':'ひこう','フリーズスキン':'こおり','エレキスキン':'でんき','ノーマルスキン':'ノーマル'}
function atkAbilBonus(abil,cat,atkType,pow,w){
  switch(abil){
    case 'てきおうりょく': return {adaptability:true}
    case 'かたやぶり':     return {moldBreaker:true}
    case 'はりきり':       return cat==='phy'?{aMult:1.5}:{}
    case 'ちからもち': case 'ヨガパワー': return cat==='phy'?{aMult:2}:{}
    case 'サンパワー':     return (w==='sunny'&&cat==='spe')?{aMult:1.5}:{}
    case 'もうか(発動)':       return atkType==='ほのお'?{aMult:1.5}:{}
    case 'しんりょく(発動)':   return atkType==='くさ'?{aMult:1.5}:{}
    case 'げきりゅう(発動)':   return atkType==='みず'?{aMult:1.5}:{}
    case 'むしのしらせ(発動)': return atkType==='むし'?{aMult:1.5}:{}
    case 'もらいび(発動)':     return atkType==='ほのお'?{aMult:1.5}:{}
    case 'テクニシャン':   return pow<=60?{powMult:1.5}:{}
    case 'ちからずく':     return {powMult:1.3}
    case 'すなのちから':   return (w==='sand'&&['いわ','じめん','はがね'].includes(atkType))?{powMult:1.3}:{}
    case 'トランジスタ':   return atkType==='でんき'?{powMult:1.3}:{}
    case 'りゅうのあぎと': return atkType==='ドラゴン'?{powMult:1.5}:{}
    case 'はがねつかい':   return atkType==='はがね'?{powMult:1.5}:{}
    case 'いろめがね':     return {tinted:true}
    case 'フェアリースキン': case 'スカイスキン': case 'フリーズスキン': case 'エレキスキン':
      return atkType==='ノーマル'?{powMult:1.2,newType:SKIN_TYPE[abil]}:{}
    case 'ノーマルスキン': return {powMult:1.2,newType:'ノーマル'}
    default: return {}
  }
}
// 防御側特性ボーナス（immune=無効 / wonderGuard=抜群以外無効 / furCoat=物理被ダメ防御2倍 / multiscale=満タン時0.5 / halve=被ダメ0.5 / halveSpe=特殊被ダメ0.5 / resistSuper=抜群を0.75 / unaware=相手の能力ランク無視）
function defAbilBonus(abil,cat,atkType){
  switch(abil){
    case 'ふしぎなまもり': return {wonderGuard:true}
    case 'ファーコート':   return cat==='phy'?{furCoat:true}:{}
    case 'マルチスケイル': case 'ファントムガード': return {multiscale:true}
    case 'てんねん':       return {unaware:true}
    case 'ハードロック': case 'フィルター': case 'プリズムアーマー': return {resistSuper:true}
    case 'こおりのりんぷん': return cat==='spe'?{halveSpe:true}:{}
    case 'あついしぼう':   return (atkType==='ほのお'||atkType==='こおり')?{halve:true}:{}
    case 'たいねつ':       return atkType==='ほのお'?{halve:true}:{}
    case 'すいほう':       return atkType==='ほのお'?{halve:true}:{}
    case 'ふゆう':         return atkType==='じめん'?{immune:true}:{}
    case 'よびみず': case 'ちょすい': case 'かんそうはだ': return atkType==='みず'?{immune:true}:{}
    case 'そうしょく':     return atkType==='くさ'?{immune:true}:{}
    case 'ちくでん': case 'ひらいしん': case 'でんきエンジン': return atkType==='でんき'?{immune:true}:{}
    case 'もらいび':       return atkType==='ほのお'?{immune:true}:{}
    default: return {}
  }
}
// タイプ相性（攻撃タイプ→防御タイプ群）の積
function typeEffMult(atkType, defTypes){
  const ai=TYPES.indexOf(atkType); if(ai<0)return 1
  let m=1; for(const dt of (defTypes||[])){const di=TYPES.indexOf(dt); if(di>=0)m*=EFF[ai][di]} return m
}
// STAB倍率（テラス考慮：原色一致×1.5 / テラ一致×1.5 / 両一致×2.0）
function stabMult(atkPoke, moveType, atkTera){
  const orig=getTypes(atkPoke.name).includes(moveType)
  const tera=!!atkTera && atkTera===moveType
  if(orig&&tera)return 2.0
  if(orig||tera)return 1.5
  return 1.0
}
// 防御側タイプ（テラス指定があればそれで上書き）
function defenderTypes(defPoke, teraType){ return teraType ? [teraType] : getTypes(defPoke.name) }
// 攻撃側の攻撃実数値（物理=Atk/特殊=SpA）＋アイテム補正
function attackStat(atkPoke, cat){
  const idx=cat==='phy'?1:3
  let a=(atkPoke.stats&&atkPoke.stats[idx])?(atkPoke.stats[idx].val||0):0
  const it=atkPoke.item||''
  if(cat==='phy'&&it==='こだわりハチマキ') a=Math.floor(a*1.5)
  if(cat==='spe'&&it==='こだわりメガネ')   a=Math.floor(a*1.5)
  if(cat==='phy'&&it==='ちからのハチマキ') a=Math.floor(a*1.1)
  if(cat==='spe'&&it==='ものしりメガネ')   a=Math.floor(a*1.1)
  return a
}
// 防御側の防御実数値（物理=Def/特殊=SpD）＋アイテム補正
function defenseStat(defPoke, cat){
  const idx=cat==='phy'?2:4
  let d=(defPoke.stats&&defPoke.stats[idx])?(defPoke.stats[idx].val||0):0
  const it=defPoke.item||''
  if(cat==='spe'&&it==='とつげきチョッキ') d=Math.floor(d*1.5)
  if(it==='しんかのきせき') d=Math.floor(d*1.5)
  return d
}
// タイプ強化アイテム（一致タイプ技を ×1.2）
const TYPE_ITEM = {
  'もくたん':'ほのお','しんぴのしずく':'みず','りゅうのキバ':'ドラゴン','かたいいし':'いわ',
  'じしゃく':'でんき','とけないこおり':'こおり','どくバリ':'どく','やわらかいすな':'じめん',
  'するどいくちばし':'ひこう','のろいのおふだ':'ゴースト','シルクのスカーフ':'ノーマル',
  'メタルコート':'はがね','まがったスプーン':'エスパー','くろいメガネ':'あく','くろおび':'かくとう',
  'きせきのタネ':'くさ','ぎんのこな':'むし','ようせいのハネ':'フェアリー',
}
// 攻撃側アイテムのダメージ最終倍率（いのちのたま/たつじんのおび/タイプ強化）
function atkItemMult(atkPoke, eff, atkType){
  const it=atkPoke.item||''
  if(it==='いのちのたま') return 1.3
  if(it==='たつじんのおび'&&eff>=2) return 1.2
  if(TYPE_ITEM[it] && TYPE_ITEM[it]===atkType) return 1.2
  return 1
}
// 1発分のダメージ（rand=0.85〜1.00・能力ランク -6〜+6・天候・特性・性格補正倍率対応）
// atkNatMult/defNatMult = 攻撃/防御実数値への性格補正倍率(1.1|1.0|0.9)
function calcDamage(atkPoke, defPoke, move, atkTera, defTera, rand, atkRank, defRank, weather, atkAbil, defAbil, atkNatMult, defNatMult){
  const mi=moveInfo(move), pow=movePow(move)
  if(!mi||mi[1]==='sta'||!pow) return null
  const cat=mi[1]
  let atkType=mi[0]
  // 攻撃側特性（スキンは技タイプを変更）
  const atkB=atkAbilBonus(atkAbil||'',cat,atkType,pow,weather||'none')
  if(atkB.newType) atkType=atkB.newType
  const dTypes=defenderTypes(defPoke,defTera)
  const typeEff=typeEffMult(atkType,dTypes)
  // 防御側特性（かたやぶりなら無視）
  const defB=atkB.moldBreaker ? {} : defAbilBonus(defAbil||'',cat,atkType)
  if(defB.immune) return {dmg:0,eff:0,stab:1,item:1,pow,cat,atkType,immune:true}
  if(defB.wonderGuard&&typeEff<2) return {dmg:0,eff:typeEff,stab:1,item:1,pow,cat,atkType,immune:true}
  if(typeEff<=0) return {dmg:0,eff:0,stab:1,item:1,pow,cat,atkType}
  // 威力補正
  const finalPow = atkB.powMult ? Math.floor(pow*atkB.powMult) : pow
  // 攻撃実数値（性格補正→特性→ランク。てんねんは攻撃側ランクを無視）
  let A=attackStat(atkPoke,cat); if(!A) return null
  if(atkNatMult&&atkNatMult!==1) A=Math.floor(A*atkNatMult)
  if(atkB.aMult) A=Math.floor(A*atkB.aMult)
  const aRankUsed = defB.unaware ? 0 : (atkRank||0)
  A=Math.max(1,Math.floor(A*rankMult(aRankUsed)))
  // 防御実数値
  let Dd=defenseStat(defPoke,cat); if(!Dd) return null
  if(defNatMult&&defNatMult!==1) Dd=Math.floor(Dd*defNatMult)
  const wdf=weatherDefMult(weather||'none',dTypes,cat)
  if(wdf!==1) Dd=Math.floor(Dd*wdf)
  if(defB.furCoat) Dd=Dd*2  // ファーコート=防御×2
  Dd=Math.max(1,Math.floor(Dd*rankMult(defRank||0)))
  // STAB
  const stab = atkB.adaptability
    ? ((getTypes(atkPoke.name).includes(atkType)||(atkTera&&atkTera===atkType)) ? 2.0 : 1.0)
    : stabMult(atkPoke,atkType,atkTera)
  // アイテム・天候
  const item=atkItemMult(atkPoke,typeEff,atkType)
  const wm=weatherAtkMult(weather||'none',atkType)
  // base
  const base=Math.floor(Math.floor(Math.floor((2*50/5+2)*finalPow*A/Dd)/50)+2)
  let d=base
  d=Math.floor(d*stab)
  d=Math.floor(d*typeEff)
  d=Math.floor(d*wm)
  if(defB.multiscale) d=Math.floor(d*0.5)            // マルチスケイル（満タン前提）
  if(atkB.tinted&&typeEff<1) d=Math.floor(d*2)        // いろめがね
  if(defB.resistSuper&&typeEff>=2) d=Math.floor(d*0.75) // ハードロック等
  if(defB.halve) d=Math.floor(d*0.5)                  // あついしぼう/たいねつ/すいほう
  if(defB.halveSpe) d=Math.floor(d*0.5)               // こおりのりんぷん
  d=Math.floor(d*item)
  const dmg=Math.max(1,Math.floor(d*rand))
  return {dmg,eff:typeEff,stab,item,pow:finalPow,cat,atkType,wm}
}

// ── ダメージ計算ビュー（1対1・攻守とも「チーム/全ポケ」から選択・攻守入れ替え・天候/特性/性格補正対応）──
const WEATHER_OPTS=[['none','なし'],['sunny','晴れ'],['rain','雨'],['sand','砂嵐'],['hail','霰/雪']]
// 性格補正トグル（関係ステだけ 1.1/1.0/0.9）
function NatMultTog({mult,setMult,title}){
  return (
    <span className="nat-tog" title={title||'性格補正（関係ステのみ）'}>
      {[1.1,1.0,0.9].map(m=>(
        <button key={m} className={'nat-btn'+(mult===m?' on':'')} onClick={()=>setMult(m)}>{m.toFixed(1)}</button>
      ))}
    </span>
  )
}
// セレクタ値のパース（'team:idx' / 'all:name' / 'own:idx' / 'team6' / 'tmpl:idx'）
function parseDmgSel(sel){
  const c=(sel||'').indexOf(':')
  if(c<0) return {kind:sel||''}
  return {kind:sel.slice(0,c), val:sel.slice(c+1)}
}
// 全ポケ選択時の攻撃技を自動セット：タイプ一致(STAB)の最高威力技を物理/特殊寄りで拾うヒューリスティック
function autoMovesFor(name){
  const types=getTypes(name); if(!types.length) return ['','','','']
  const base=getBase(name)
  const cat=(base && base[1]>=base[3]) ? 'phy' : 'spe'
  const pickBest=(t,c)=>{ let best='',bp=-1; for(const mv in MOVE_TYPES){const inf=MOVE_TYPES[mv]; if(inf[0]!==t)continue; if(c&&inf[1]!==c)continue; const p=MOVE_POWER[mv]; if(p==null)continue; if(p>bp){bp=p;best=mv}} return best }
  const picks=[]
  for(const t of types){ const m=pickBest(t,cat); if(m&&!picks.includes(m))picks.push(m) }
  if(picks.length<2){ for(const t of types){ const m=pickBest(t,null); if(m&&!picks.includes(m))picks.push(m) } }
  return [...picks,'','','',''].slice(0,4)
}
function DamageView({team,evMode,format}){
  const cfg=EV_MODES[evMode]||EV_MODES.champ
  const fmt=format||localStorage.getItem('pc_format')||'single'
  const teamFilled=team.map((p,i)=>({p,i})).filter(x=>x.p)
  const owned=OWNED
  const tmpls=(typeof TEMPLATES!=='undefined'?TEMPLATES:[]).filter(t=>(t.format||'single')===fmt)

  // 攻撃側＝1個体 / 防御側＝1個体 or 「チーム全6体」「テンプレ全6体」
  const [atkSel,setAtkSel]=useState(()=>teamFilled[0]?('team:'+teamFilled[0].i):(ALL_POKEMON_WITH_STATS[0]?('all:'+ALL_POKEMON_WITH_STATS[0]):''))
  const [defSel,setDefSel]=useState(()=>teamFilled.length?'team6':(ALL_POKEMON_WITH_STATS[0]?('all:'+ALL_POKEMON_WITH_STATS[0]):''))
  // 攻撃側の調整値（選択で自動入力→手動上書き可）
  const [atkItem,setAtkItem]=useState(''); const [atkAbil,setAtkAbil]=useState(''); const [atkTeraType,setAtkTeraType]=useState('')
  const [atkEvA,setAtkEvA]=useState(0); const [atkEvC,setAtkEvC]=useState(0); const [atkNat,setAtkNat]=useState(1.0); const [atkRank,setAtkRank]=useState(0)
  const [moves,setMoves]=useState(['','','',''])
  // 防御側（単体時）の調整値
  const [defItem,setDefItem]=useState(''); const [defAbil,setDefAbil]=useState(''); const [defTeraType,setDefTeraType]=useState('')
  const [defEvH,setDefEvH]=useState(0); const [defEvB,setDefEvB]=useState(0); const [defEvD,setDefEvD]=useState(0); const [defNat,setDefNat]=useState(1.0); const [defRank,setDefRank]=useState(0)
  // 防御6体（チーム/テンプレ由来。1体ごとに削除/特性編集/追加・全クリア可）
  const [defList,setDefList]=useState([])
  // 条件
  const [weather,setWeather]=useState('none')
  const [spread,setSpread]=useState(false)   // ダブル：全体技 -25%
  const [resetTick,setResetTick]=useState(0) // クリア用

  // 選択個体から調整値を自動入力（特性も自動）
  function buildFromOwned(o){ const np=normFromText(o); return {item:o.item||'',ability:o.ability||'',tera:o.teraType||'',stats:np.stats,moves:o.moves||[]} }
  function seedSide(sel,isAtk){
    const s=parseDmgSel(sel)
    let src=null
    if(s.kind==='team'){ const p=team[+s.val]; if(p) src={item:p.item||'',ability:p.ability||'',tera:p.teraType||'',stats:p.stats,moves:p.moves||[]} }
    else if(s.kind==='own'){ const o=owned[+s.val]; if(o) src=buildFromOwned(o) }
    if(isAtk){
      if(src){ setAtkItem(src.item); setAtkAbil(ATK_ABILITIES.includes(src.ability)?src.ability:''); setAtkTeraType(src.tera)
        setAtkEvA(src.stats?.[1]?.ev||0); setAtkEvC(src.stats?.[3]?.ev||0); setMoves([...(src.moves||[]),'','','',''].slice(0,4)) }
      else { setAtkItem(''); setAtkAbil(''); setAtkTeraType(''); setAtkEvA(0); setAtkEvC(0)
        setMoves(s.kind==='all'?autoMovesFor(s.val):['','','','']) }   // 全ポケ選択時は攻撃技を自動セット
    }else{
      if(src){ setDefItem(src.item); setDefAbil(DEF_ABILITIES.includes(src.ability)?src.ability:''); setDefTeraType(src.tera)
        setDefEvH(src.stats?.[0]?.ev||0); setDefEvB(src.stats?.[2]?.ev||0); setDefEvD(src.stats?.[4]?.ev||0) }
      else { setDefItem(''); setDefAbil(''); setDefTeraType(''); setDefEvH(0); setDefEvB(0); setDefEvD(0) }
    }
  }
  useEffect(()=>{ seedSide(atkSel,true) },[atkSel,resetTick])
  useEffect(()=>{ seedSide(defSel,false) },[defSel,resetTick])

  function clearAll(){ setWeather('none'); setSpread(false); setAtkRank(0); setDefRank(0); setAtkNat(1.0); setDefNat(1.0); setResetTick(t=>t+1) }

  // 攻撃個体を解決
  function resolveAtk(){
    const s=parseDmgSel(atkSel)
    const nm = s.kind==='team'?(team[+s.val]?.name||'') : s.kind==='own'?(owned[+s.val]?.name||'') : s.val||''
    if(!nm) return null
    const base=getBase(nm), evMap={1:atkEvA,3:atkEvC}
    const stats = base ? base.map((b,i)=>({val:calcStat(b,evMap[i]||0,i,''),ev:evMap[i]||0})) : Array(6).fill(0).map((_,i)=>({val:0,ev:evMap[i]||0}))
    return {name:nm, item:atkItem, teraType:atkTeraType, stats, moves}
  }
  // 単体防御を解決
  function resolveDef(){
    const s=parseDmgSel(defSel)
    const nm = s.kind==='team'?(team[+s.val]?.name||'') : s.kind==='own'?(owned[+s.val]?.name||'') : s.val||''
    if(!nm) return null
    const base=getBase(nm), evMap={0:defEvH,2:defEvB,4:defEvD}
    const stats = base ? base.map((b,i)=>({val:calcStat(b,evMap[i]||0,i,''),ev:evMap[i]||0})) : Array(6).fill(0).map((_,i)=>({val:0,ev:evMap[i]||0}))
    return {name:nm, item:defItem, teraType:defTeraType, stats, abil:defAbil}
  }
  const A=resolveAtk()
  const aName=A?A.name:''
  const atkMoves=moves.filter(m=>m&&moveInfo(m)&&moveInfo(m)[1]!=='sta')
  const spLbl=fmt==='double'&&spread
  // ダブル全体技 -25%（ダメージにのみ適用）
  const sp=d=>spLbl?Math.floor(d*0.75):d

  // 防御側：6体（チーム/テンプレ）か単体か
  const defKind=parseDmgSel(defSel).kind
  const gridMode = defKind==='team6'||defKind==='tmpl'
  // 名前から防御個体を生成（0振りで実数値計算）
  function mkDefByName(name){ const base=getBase(name); const stats=base?base.map((b,i)=>({val:calcStat(b,0,i,''),ev:0})):Array(6).fill({val:0,ev:0}); return {name,item:'',teraType:'',stats,abil:''} }
  // 選択ソース(team6/tmpl)から防御リストを seed
  useEffect(()=>{
    if(defKind==='team6') setDefList(teamFilled.map(({p})=>({name:p.name,item:p.item||'',teraType:'',stats:p.stats,abil:DEF_ABILITIES.includes(p.ability)?p.ability:''})))
    else if(defKind==='tmpl'){ const t=tmpls[+parseDmgSel(defSel).val]; setDefList(t?(t.members||[]).map(txt=>{const mp=parsePokeSol(txt)[0]; if(!mp)return null; const np=normFromText(mp); return {name:np.name,item:np.item||'',teraType:'',stats:np.stats,abil:DEF_ABILITIES.includes(np.ability)?np.ability:''}}).filter(Boolean):[]) }
  },[defSel,resetTick])
  const removeDefender=j=>setDefList(l=>l.filter((_,k)=>k!==j))
  const setDefenderAbil=(j,v)=>setDefList(l=>l.map((d,k)=>k===j?{...d,abil:v}:d))
  const addDefender=name=>{ if(name) setDefList(l=>[...l,mkDefByName(name)]) }
  const clearDefenders=()=>setDefList([])
  const defenders=gridMode?defList:null
  // 攻守入れ替え（防御が単体のときのみ）
  function swap(){ if(gridMode)return; const a=atkSel; setAtkSel(defSel); setDefSel(a) }
  const Dp=gridMode?null:resolveDef()
  const dName=Dp?Dp.name:''
  const defHP=(Dp?.stats?.[0]?.val)||0

  // 共通：カテゴリ別グループselect（順=チーム>全ポケ>所持）
  const monOptions=(
    <>
      {teamFilled.length>0 && <optgroup label="チーム">{teamFilled.map(({p,i})=><option key={'t'+i} value={'team:'+i}>{p.name}</option>)}</optgroup>}
      <optgroup label="全ポケ">{ALL_POKEMON_WITH_STATS.map(n=><option key={'a'+n} value={'all:'+n}>{n}</option>)}</optgroup>
      {owned.length>0 && <optgroup label="所持">{owned.map((o,i)=><option key={'o'+i} value={'own:'+i}>{o.name}{o.item?' @'+o.item:''}</option>)}</optgroup>}
    </>
  )

  if(!teamFilled.length && !A && !defenders)
    return <div className="chart-empty">攻撃側に「全ポケ」からポケモンを選ぶか、チームにポケモンを追加するとダメージ計算ができます</div>

  return (
    <div>
      {/* 攻撃側／防御側セレクタ（常時表示・1リストでカテゴリ選択） */}
      <div className="dmg-head">
        <div className="dmg-side">
          <span className="dmg-role atk">攻撃</span>
          {spriteIcon(aName)}
          <select className="dmg-pick" value={atkSel} onChange={e=>setAtkSel(e.target.value)}>{monOptions}</select>
        </div>
        {!gridMode && <button className="dmg-swap" onClick={swap} title="攻守入れ替え">⇄</button>}
        <div className="dmg-side">
          <span className="dmg-role def">防御</span>
          {!gridMode && spriteIcon(dName)}
          <select className="dmg-pick" value={defSel} onChange={e=>setDefSel(e.target.value)}>
            {teamFilled.length>0 && <option value="team6">▼ チーム全6体</option>}
            {tmpls.map((t,i)=><option key={'tm'+i} value={'tmpl:'+i}>▼ テンプレ: {t.name}</option>)}
            {monOptions}
          </select>
        </div>
      </div>

      {/* 詳細設定（性格補正・特性・努力値・ランク・テラス・技） */}
      <div className={'dmg-ctrls'+(gridMode?' single':'')}>
        <div className="dmg-ctrl-col">
          <div className="dmg-ctrl-h">攻撃 {aName||'—'}</div>
          <div className="dmg-evs">
            <label className="dmg-ev"><span>A{atkEvA}</span><input type="range" min="0" max={cfg.max} step={cfg.step} value={atkEvA} onChange={e=>setAtkEvA(+e.target.value)}/></label>
            <label className="dmg-ev"><span>C{atkEvC}</span><input type="range" min="0" max={cfg.max} step={cfg.step} value={atkEvC} onChange={e=>setAtkEvC(+e.target.value)}/></label>
          </div>
          <div className="dmg-ev"><span>性格補正</span><NatMultTog mult={atkNat} setMult={setAtkNat} title="攻撃の関係ステに性格補正"/></div>
          <OptSelect className="dmg-nat" value={atkItem} options={ALL_ITEMS} placeholder="持ち物" onChange={setAtkItem}/>
          <select className="dmg-nat" value={atkAbil} onChange={e=>setAtkAbil(e.target.value)} title="攻撃側特性（選択個体から自動入力）">
            <option value="">特性なし</option>{ATK_ABILITIES.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <RankStepper rank={atkRank} setRank={setAtkRank} label="ランク"/>
          <select className="dmg-nat" value={atkTeraType} onChange={e=>setAtkTeraType(e.target.value)} title="テラスタイプ（空=なし）">
            <option value="">テラスなし</option>{TYPES.map(t=><option key={t} value={t}>テラス{t}</option>)}
          </select>
          {/* わざ選択（常に4枠・選択個体から自動入力＋手動変更可） */}
          <div className="dmg-custom-moves">
            {[0,1,2,3].map(k=>(
              <MoveSelect key={k} value={moves[k]||''} onChange={v=>setMoves(m=>{const nm=[...m];nm[k]=v;return nm})} placeholder={'技'+(k+1)}/>
            ))}
          </div>
        </div>
        {!gridMode &&
        <div className="dmg-ctrl-col">
          <div className="dmg-ctrl-h">防御 {dName||'—'} <span className="dmg-hp">HP{defHP}</span></div>
          <div className="dmg-evs">
            <label className="dmg-ev"><span>H{defEvH}</span><input type="range" min="0" max={cfg.max} step={cfg.step} value={defEvH} onChange={e=>setDefEvH(+e.target.value)}/></label>
            <label className="dmg-ev"><span>B{defEvB}</span><input type="range" min="0" max={cfg.max} step={cfg.step} value={defEvB} onChange={e=>setDefEvB(+e.target.value)}/></label>
            <label className="dmg-ev"><span>D{defEvD}</span><input type="range" min="0" max={cfg.max} step={cfg.step} value={defEvD} onChange={e=>setDefEvD(+e.target.value)}/></label>
          </div>
          <div className="dmg-ev"><span>性格補正</span><NatMultTog mult={defNat} setMult={setDefNat} title="防御の関係ステに性格補正"/></div>
          <OptSelect className="dmg-nat" value={defItem} options={ALL_ITEMS} placeholder="持ち物" onChange={setDefItem}/>
          <select className="dmg-nat" value={defAbil} onChange={e=>setDefAbil(e.target.value)} title="防御側特性（選択個体から自動入力）">
            <option value="">特性なし</option>{DEF_ABILITIES.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <RankStepper rank={defRank} setRank={setDefRank} label="ランク"/>
          <select className="dmg-nat" value={defTeraType} onChange={e=>setDefTeraType(e.target.value)} title="テラスタイプ（空=なし）">
            <option value="">テラスなし</option>{TYPES.map(t=><option key={t} value={t}>テラス{t}</option>)}
          </select>
        </div>}
      </div>

      {/* 条件バー：天候はランクの下に配置／ダブルは全体技-25%／クリア */}
      <div className="dmg-cond">
        <span className="dmg-cond-grp">
          <span className="dmg-section-lbl">天候</span>
          {WEATHER_OPTS.map(([w,lbl])=>(
            <button key={w} className={'nat-btn'+(weather===w?' on':'')} onClick={()=>setWeather(w)}>{lbl}</button>
          ))}
        </span>
        {fmt==='double' &&
          <label className="dmg-spread"><input type="checkbox" checked={spread} onChange={e=>setSpread(e.target.checked)}/>全体技 -25%（ダブル）</label>}
        <button className="mini-btn" onClick={clearAll} title="天候/ランク/性格補正をリセット" style={{marginLeft:'auto'}}>クリア</button>
      </div>

      {/* 結果 */}
      {!gridMode ? (
        !A ? <div className="chart-empty">攻撃側を選択してください</div>
        : !Dp ? <div className="chart-empty">防御側を選択してください</div>
        : !defHP ? <div className="chart-empty">防御側の種族値が未登録です</div>
        : !atkMoves.length ? <div className="chart-empty">攻撃技を選択してください</div>
        : (
        <div className="dmg-results">
          {atkMoves.map((mv,mi2)=>{
            const mi=moveInfo(mv)
            const loR=calcDamage(A,Dp,mv,atkTeraType,defTeraType,0.85,atkRank,defRank,weather,atkAbil,defAbil,atkNat,defNat)
            const hiR=calcDamage(A,Dp,mv,atkTeraType,defTeraType,1.00,atkRank,defRank,weather,atkAbil,defAbil,atkNat,defNat)
            if(!loR||!hiR) return (
              <div className="dmg-row" key={mv+mi2}><div className="dmg-r1"><span className="mdot" style={{background:mi?TYPE_COLORS[mi[0]]:'#ccc'}}></span><span className="dmg-mv">{mv}</span><span className="dmg-na">データ不足</span></div></div>
            )
            const immune=loR.immune||(loR.eff<=0&&loR.dmg===0)
            const loD=sp(loR.dmg), hiD=sp(hiR.dmg)
            const pctHi=defHP?hiD/defHP*100:0, pctLo=defHP?loD/defHP*100:0
            const cls=pctLo>=100?'k1':pctHi>=100?'kr':pctHi>=50?'kh':'kl'
            const remLo=Math.max(0,100-pctHi), remHi=Math.max(0,100-pctLo)
            const hpCls=remLo<=0?'hp-dead':remLo<50?'hp-warn':'hp-ok'
            const koTxt=immune?'無効':loD>=defHP?'確1':hiD>=defHP?'乱1':(defHP&&loD>0?Math.ceil(defHP/loD)+'発':'?')
            const effTxt=immune?'':loR.eff>=2?'抜群':(loR.eff>0&&loR.eff<1?'いまひとつ':'')
            return (
              <div className="dmg-row" key={mv+mi2}>
                <div className="dmg-r1">
                  <span className="mdot" style={{background:mi?TYPE_COLORS[mi[0]]:'#ccc'}}></span>
                  <span className="dmg-mv">{mv}</span>
                  {mi&&<span className="dmg-pow">威{loR.pow||movePow(mv)||'?'}/{mi[1]==='phy'?'物':'特'}</span>}
                  {spLbl&&<span className="dmg-pow" style={{color:'var(--warn)'}}>全体-25%</span>}
                  {effTxt&&<span className={'dmg-eff'+(loR.eff>=2?' se':' nv')}>{effTxt}</span>}
                  <span className={'dmg-ko '+(immune?'kl':cls)}>{koTxt}</span>
                </div>
                {!immune &&
                  <div className="dmg-r2">
                    <div className="dmg-bar" title={`残りHP ${remLo.toFixed(0)}〜${remHi.toFixed(0)}%`}>
                      <i className={'hp-min '+hpCls} style={{width:remLo+'%'}}></i>
                      <i className="hp-band" style={{width:Math.max(0,remHi-remLo)+'%'}}></i>
                    </div>
                    <span className="dmg-num"><b>{pctLo.toFixed(0)}〜{pctHi.toFixed(0)}%</b> ({loD}〜{hiD})</span>
                  </div>}
              </div>
            )
          })}
        </div>
      )) : (
        /* 6体グリッド：攻撃側の各技 × 防御6体（チーム/テンプレ） */
        !A ? <div className="chart-empty">攻撃側を選択してください</div>
        : !atkMoves.length ? <div className="chart-empty">攻撃技を選択してください</div>
        : (
        <div>
        <div className="dmg-def-edit">
          <span className="dmg-section-lbl">防御 {defList.length}体</span>
          <select className="dmg-nat dmg-def-add" value="" onChange={e=>{addDefender(e.target.value); e.target.value=''}} title="防御に1体追加">
            <option value="">＋ 防御を追加…</option>{monOptions}
          </select>
          {defList.length>0 && <button className="mini-btn rm" onClick={clearDefenders} title="防御を全て外す">全クリア</button>}
        </div>
        {!defList.length ? <div className="chart-empty">防御側が空です。「＋ 防御を追加」かテンプレ/チームを選び直してください</div> : (
        <div className="dmg-grid-wrap">
          <div className="dmg-grid-hdr">
            <div className="dmg-mv-lbl-cell">技 ＼ 防御</div>
            {defenders.map((d,j)=>(
              <div className="dmg-def-hdr-cell" key={j}>
                <button className="dmg-def-x" onClick={()=>removeDefender(j)} title="この防御を外す">×</button>
                {spriteIcon(d.name)}
                <span className="dmg-defname" title={d.name}>{d.name}</span>
                <span className="dmg-pct">HP{d.stats?.[0]?.val||0}</span>
                <select className="dmg-defabil" value={d.abil||''} onChange={e=>setDefenderAbil(j,e.target.value)} title="特性">
                  <option value="">特性なし</option>{DEF_ABILITIES.map(a=><option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            ))}
          </div>
          {atkMoves.map((mv,mi2)=>{
            const mi=moveInfo(mv)
            return (
              <div className="dmg-grid-row" key={mv+mi2}>
                <div className="dmg-mv-lbl-cell">
                  <span style={{display:'flex',alignItems:'center',gap:5}}><span className="mdot" style={{background:mi?TYPE_COLORS[mi[0]]:'#ccc'}}></span><b style={{fontSize:11}}>{mv}</b></span>
                  {mi&&<span className="dmg-absnum">威{movePow(mv)||'?'} / {mi[1]==='phy'?'物理':'特殊'}{spLbl?' / 全体-25%':''}</span>}
                </div>
                {defenders.map((d,j)=>{
                  const dHP=d.stats?.[0]?.val||0
                  const loR=calcDamage(A,d,mv,atkTeraType,'',0.85,atkRank,0,weather,atkAbil,d.abil,atkNat,1.0)
                  const hiR=calcDamage(A,d,mv,atkTeraType,'',1.00,atkRank,0,weather,atkAbil,d.abil,atkNat,1.0)
                  if(!loR||!hiR||!dHP) return <div className="dmg-cell dmg-na" key={j}>—</div>
                  const immune=loR.immune||(loR.eff<=0&&loR.dmg===0)
                  if(immune) return <div className="dmg-cell dmg-immune" key={j}>無効</div>
                  const loD=sp(loR.dmg), hiD=sp(hiR.dmg)
                  const pctHi=hiD/dHP*100, pctLo=loD/dHP*100
                  const cls=pctLo>=100?'k1':pctHi>=100?'kr':pctHi>=50?'kh':'kl'
                  const remLo=Math.max(0,100-pctHi)
                  const hpCls=remLo<=0?'hp-dead':remLo<50?'hp-warn':'hp-ok'
                  const koTxt=loD>=dHP?'確1':hiD>=dHP?'乱1':Math.ceil(dHP/loD)+'発'
                  return (
                    <div className="dmg-cell" key={j}>
                      <span className={'dmg-ko '+cls} style={{margin:0}}>{koTxt}</span>
                      <div className="dmg-bar" style={{width:'100%'}} title={`残りHP ${remLo.toFixed(0)}%〜`}>
                        <i className={'hp-min '+hpCls} style={{width:remLo+'%'}}></i>
                      </div>
                      <span className="dmg-pct">{pctLo.toFixed(0)}〜{pctHi.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        )}
        </div>
      ))}
    </div>
  )
}

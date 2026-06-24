// app-main.js — App本体（チーム構築/追加パネル/各タブ/編集モーダル）＋ render
// ── チーム自動提案（相性ベース）──
// チーム全体の弱点指数（4倍×2+2倍の合計。低いほど安定）
function teamWeakIndex(members){
  const w=calcWeak(members); if(!w) return 0
  return w.reduce((s,r)=>s+r.x4*2+r.x2,0)
}
// チームが「ネットで弱い」タイプ（弱点を取る数 > 半減/無効の数）
function teamWeakTypes(members){
  const w=calcWeak(members)||[]
  return w.filter(r=>(r.x4+r.x2)>(r.half+r.x0)).map(r=>r.type)
}
// 種族値から持ち物をヒューリスティック提案
function suggestItemFor(name){
  const b=getBase(name); if(!b) return 'いのちのたま'
  const [hp,atk,def,spa,spd,spe]=b
  const off=Math.max(atk,spa), bulk=hp+def+spd
  if(spe>=100 && off>=110) return 'こだわりスカーフ'
  if(off>=125) return atk>=spa ? 'こだわりハチマキ' : 'こだわりメガネ'
  if(bulk>=320) return 'たべのこし'
  if(off>=105) return 'いのちのたま'
  if(def+spd<=140) return 'きあいのタスキ'
  return 'オボンのみ'
}
// メガ/フォルム違いのベース名（重複ピック防止）
function baseName(n){ return n.replace(/^メガ/,'').replace(/[（(].*$/,'').trim() }
// 空き枠ぶん、相性補完が良い候補を貪欲法でピック（fixed=確定メンバー）
function suggestFill(poolNames, fixed, count){
  const members=fixed.map(m=>({name:m.name}))
  const used=new Set(members.map(m=>m.name))
  const usedBase=new Set(members.map(m=>baseName(m.name)))
  let megaUsed=members.some(m=>m.name.startsWith('メガ'))
  const picks=[]
  for(let s=0;s<count;s++){
    const weakTypes=teamWeakTypes(members)
    let best=null,bestScore=Infinity
    for(const nm of poolNames){
      if(used.has(nm)||usedBase.has(baseName(nm))) continue
      if(megaUsed && nm.startsWith('メガ')) continue   // 1チーム1メガ
      const tl=getTypes(nm); if(!tl.length) continue
      const newIdx=teamWeakIndex([...members,{name:nm}])
      // 現状の弱点タイプを半減/無効で受けられる数（多いほど加点）
      const rb=weakTypes.reduce((c,t)=>c+(typeMultOn(nm,TYPES.indexOf(t))<1?1:0),0)
      const score=newIdx-1.5*rb
      if(score<bestScore){bestScore=score;best=nm}
    }
    if(!best) break
    const covers=teamWeakTypes(members).filter(t=>typeMultOn(best,TYPES.indexOf(t))<1)
    picks.push({name:best, covers, item:suggestItemFor(best)})
    members.push({name:best}); used.add(best); usedBase.add(baseName(best))
    if(best.startsWith('メガ')) megaUsed=true
  }
  return picks
}

// ── チーム提案タブ ──
function SuggestTab({team,onAdd,onAddMany}){
  const [mode,setMode]=useState('mine')
  const members=team.filter(Boolean)
  const emptyCount=team.filter(x=>x===null).length
  const picks=useMemo(()=>{
    if(!emptyCount) return []
    const pool = mode==='mine' ? uniq(OWNED.map(p=>p.name)) : ALL_NAMES
    return suggestFill(pool, members, emptyCount)
  },[mode,team,emptyCount])
  const toBuild=pk=>{
    if(mode==='mine'){ const o=OWNED.find(p=>p.name===pk.name); if(o) return normFromText(o) }
    const b=blankDraft(pk.name); b.item=pk.item; return b
  }
  return (
    <div>
      <div className="ana-tabs" style={{marginBottom:8}}>
        <button className={'atab'+(mode==='mine'?' active':'')} onClick={()=>setMode('mine')}>所持から</button>
        <button className={'atab'+(mode==='all'?' active':'')} onClick={()=>setMode('all')}>全ポケから</button>
      </div>
      <div className="import-hint">現在のチーム({members.length}体)の弱点をタイプ相性で補完する候補を提案。{mode==='mine'?'所持個体':'全ポケ'}から選出。持ち物も提案（特性/技/努力値は将来対応）。</div>
      {!emptyCount ? <div className="li-empty">空き枠がありません（枠を空けると提案します）</div>
        : !picks.length ? <div className="li-empty">{mode==='mine'?'所持個体が足りません':'候補が見つかりません'}</div>
        : (<>
          <button className="btn-parse" style={{width:'100%',marginBottom:8}} onClick={()=>onAddMany(picks.map(toBuild))}>▶ 空き{emptyCount}枠に一括追加</button>
          <div className="list">
            {picks.map((pk,i)=>{
              const url=getSpriteUrl(pk.name), types=getTypes(pk.name)
              const o=mode==='mine'?OWNED.find(p=>p.name===pk.name):null
              const item=o?(o.item||pk.item):pk.item
              return (
                <div className="li" key={i} onClick={()=>onAdd(toBuild(pk))} title="クリックで追加">
                  {url?<img className="li-sprite" src={url} alt="" onError={e=>imgFallback(e,pk.name)}/>:<div className="li-sprite" style={{fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>🎮</div>}
                  <div className="li-info">
                    <div className="li-name">{i+1}. {pk.name}</div>
                    <div className="li-sub">@ {item||'—'}{pk.covers.length?<span style={{color:'var(--good)',fontWeight:700}}> ／ 補完 {pk.covers.join(' ')}</span>:''}</div>
                  </div>
                  <div className="li-types">{types.map(t=><span key={t} className="type-badge" style={{background:TYPE_COLORS[t],fontSize:8}}>{t}</span>)}</div>
                </div>
              )
            })}
          </div>
        </>)}
    </div>
  )
}

// ── テンプレパーティタブ（上位構築をそのまま投入／ポケモン名で検索） ──
function tmplMemberName(txt){ const p=parsePokeSol(txt)[0]; return p?p.name:'' }
function TemplatesTab({format,onLoadParty}){
  const [q,setQ]=useState('')
  const all=(TEMPLATES||[]).map(t=>({...t, names:(t.members||[]).map(tmplMemberName)}))
  const list=all.filter(t=>(t.format||'single')===format)
    .filter(t=>!q || t.name.includes(q) || t.names.some(n=>n.includes(q)))
  return (
    <div>
      <input className="search" placeholder="ポケモン名・構築名で検索..." value={q} onChange={e=>setQ(e.target.value)} />
      <div className="import-hint">最新レギュ({format==='single'?'シングル':'ダブル'})の上位構築テンプレ。「投入」で6体まとめてチームへ。出典: 徹底攻略 / バトルDB。</div>
      <div className="list">
        {!list.length?<div className="li-empty">{q?'該当なし':'テンプレ未登録（このルール）'}</div>:list.map((t,i)=>(
          <div className="tmpl-card" key={i}>
            <div className="tmpl-head">
              <div className="tmpl-name">{t.name}</div>
              <button className="btn-parse tmpl-load" onClick={()=>onLoadParty(t.members)}>▶ 投入</button>
            </div>
            <div className="tmpl-mons">
              {t.names.map((n,k)=>{const url=getSpriteUrl(n);return (
                <span className="tmpl-mon" key={k} title={n}>
                  {url?<img src={url} alt={n} onError={e=>imgFallback(e,n)}/>:<span className="tmpl-mon-ph">🎮</span>}
                  <span className="tmpl-mon-nm">{n}</span>
                </span>
              )})}
            </div>
            {t.note?<div className="tmpl-note">{t.note}</div>:null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 全ポケタブ ──
function AllTab({onPick}){
  const [q,setQ]=useState('')
  const list = q?ALL_NAMES.filter(n=>n.toLowerCase().includes(q.toLowerCase())):ALL_NAMES
  return (
    <div>
      <input className="search" placeholder="名前で絞り込み..." value={q} onChange={e=>setQ(e.target.value)} />
      <div className="list">
        {!list.length?<div className="li-empty">該当なし</div>:list.map(name=>{
          const url=getSpriteUrl(name), types=getTypes(name)
          return (
            <div className="li" key={name} onClick={()=>onPick(name)} title="クリックで詳細入力して追加">
              {url?<img className="li-sprite" src={url} alt="" onError={e=>imgFallback(e,name)}/>:<div className="li-sprite" style={{fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>🎮</div>}
              <div className="li-info"><div className="li-name">{name}</div></div>
              <div className="li-types">{types.map(t=><span key={t} className="type-badge" style={{background:TYPE_COLORS[t],fontSize:8}}>{t}</span>)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 所持タブ ──
function MineTab({team,onAdd,onRemove}){
  const [q,setQ]=useState('')
  const filtered = OWNED.filter(p=>!q||p.name.includes(q))
  const groups={}
  filtered.forEach(p=>{(groups[p.name]=groups[p.name]||[]).push(p)})
  const entries=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'ja'))  // あいうえお順
  return (
    <div>
      <input className="search" placeholder="名前で絞り込み..." value={q} onChange={e=>setQ(e.target.value)} />
      <div className="import-hint">クリックで追加 / 追加済み(✓)をもう一度クリックで枠から外す。</div>
      <div className="list">
        {!entries.length?<div className="li-empty">{q?'該当なし':'所持なし'}</div>:entries.map(([name,vs])=>{
          const url=getSpriteUrl(name)
          return (
            <div key={name}>
              <div className="gname">{url?<img src={url} alt="" onError={e=>imgFallback(e,name)}/>:null}{name} <span style={{color:'var(--faint)',fontWeight:600}}>({vs.length})</span></div>
              {vs.map((v,vi)=>{
                const inTeam=team.some(s=>s&&s.raw===v.raw)
                return (
                  <div key={vi} className={'li'+(inTeam?' in':'')} style={{marginLeft:8}} onClick={()=>inTeam?onRemove(v.raw):onAdd(normFromText(v))} title={inTeam?'もう一度クリックで枠から外す':'クリックで追加'}>
                    <div className="li-info">
                      <div className="li-sub">@ {v.item||'—'} ／ {v.nature||'—'}{inTeam?<span className="li-check"> ✓ 追加済(クリックで解除)</span>:''}</div>
                      <div className="li-sub" style={{color:'var(--faint)'}}>{v.moves.join(' / ')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── インポートタブ ──
function ImportTab({pool,team,text,setText,onParse,onAdd,doImport}){
  const fileRef=useRef()
  function onFile(e){
    const f=e.target.files[0]; if(!f)return
    const r=new FileReader()
    r.onload=ev=>{doImport(ev.target.result); e.target.value=''}
    r.readAsText(f,'UTF-8')
  }
  return (
    <div>
      <div className="import-hint">貼り付けて解析すると空き枠へ自動で入ります（6体で自動的に埋まる・最初の3〜4体は自動選出）。あふれた分は下から個別追加。</div>
      <textarea className="import-ta" value={text} onChange={e=>setText(e.target.value)}
        placeholder={"ポケモン @ アイテム\nテラスタイプ: XXX\n特性: XXX\n性格: XXX\nHP-Atk-Def-SpA-SpD-Spe\n技1 / 技2 / 技3 / 技4\n\n複数匹は空行で区切る"} />
      <div className="import-actions">
        <button className="btn-up" onClick={()=>fileRef.current.click()}>📁 TXT</button>
        <input ref={fileRef} type="file" accept=".txt" onChange={onFile} style={{display:'none'}} />
        <button className="btn-parse" onClick={onParse}>▶ 解析して追加</button>
      </div>
      <div className="list">
        {!pool.length?<div className="li-empty">解析した個体がここに並びます</div>:pool.map((p,i)=>{
          const inTeam=team.some(s=>s&&s.raw===p.raw), url=getSpriteUrl(p.name)
          return (
            <div key={i} className={'li'+(inTeam?' in':'')} onClick={()=>!inTeam&&onAdd(normFromText(p))} title={inTeam?'追加済み':'クリックで追加'}>
              {url?<img className="li-sprite" src={url} alt="" onError={e=>imgFallback(e,p.name)}/>:<div className="li-sprite" style={{fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'}}>🎮</div>}
              <div className="li-info"><div className="li-name">{p.name}{inTeam?<span className="li-check"> ✓</span>:''}</div><div className="li-sub">@ {p.item||'—'} ／ {p.nature||'—'}</div></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 編集モーダル ──
function EditModal({modal,evMode,onClose,onSave,team,onAddToTeam,onAddMany,onRemoveRaw,pool,importText,setImportText,doImport,format,onLoadParty}){
  const cfg=evCfg()
  const [d,setD]=useState(modal.draft)
  const [showRaw,setShowRaw]=useState(false)
  const [addTab,setAddTab]=useState('detail')   // 追加時タブ: detail|all|mine|tmpl|suggest|import
  const isAdd = modal.slot===null
  const set=(k,v)=>setD(p=>{
    const np={...p,[k]:v}
    if(k==='name'||k==='nature') np.stats=recalcStats(np.stats,np.name,np.nature)
    return np
  })
  const setMove=(i,v)=>setD(p=>({...p,moves:p.moves.map((m,j)=>j===i?v:m)}))
  const setStat=(i,k,v)=>setD(p=>{
    const stats=p.stats.map((s,j)=>j===i?{...s,[k]:(+v||0),...(k==='ev'?{rev:effEV(+v||0)}:{})}:s)
    return {...p, stats:(k==='ev'?recalcStats(stats,p.name,p.nature):stats)}
  })
  const base=getBase(d.name)
  const types=getTypes(d.name)
  const url=getSpriteUrl(d.name)
  const evTotal=d.stats.reduce((s,x)=>s+(x.ev||0),0)
  const tmpls = OWNED.filter(p=>p.name===d.name)
  const dupMv = findDupMoves(d.moves)

  function applyTmpl(idx){
    if(idx<0)return
    const t=tmpls[idx]
    setD(p=>({...p,item:t.item,teraType:t.teraType,ability:t.ability,nature:t.nature,
      stats:recalcStats(convEvsToMode(t.stats),p.name,t.nature),moves:[...t.moves,'','','',''].slice(0,4)}))
  }

  return (
    <div className="overlay" onClick={e=>{if(e.target.className==='overlay')onClose()}}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-head-l">
            {url?<img className="modal-sprite" src={url} alt="" onError={e=>imgFallback(e,d.name)}/>:<div className="pcard-sprite-ph" style={{width:56,height:56,fontSize:28}}>🎮</div>}
            <div style={{flex:1,minWidth:0}}>
              <OptSelect className="fin" value={d.name} options={ALL_NAMES} placeholder="ポケモンを選択" onChange={v=>set('name',v)} style={{fontSize:15,fontWeight:800}} />
              <div className="ptypes" style={{marginTop:4}}>{types.map(t=><span key={t} className="type-badge" style={{background:TYPE_COLORS[t]}}>{t}</span>)}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {isAdd && (
          <div className="ptabs modal-ptabs">
            <button className={'ptab'+(addTab==='detail'?' active':'')} onClick={()=>setAddTab('detail')}>詳細入力</button>
            <button className={'ptab'+(addTab==='all'?' active':'')} onClick={()=>setAddTab('all')}>全ポケ</button>
            <button className={'ptab'+(addTab==='mine'?' active':'')} onClick={()=>setAddTab('mine')}>所持</button>
            <button className={'ptab'+(addTab==='tmpl'?' active':'')} onClick={()=>setAddTab('tmpl')}>テンプレ</button>
            <button className={'ptab'+(addTab==='suggest'?' active':'')} onClick={()=>setAddTab('suggest')}>提案</button>
            <button className={'ptab'+(addTab==='import'?' active':'')} onClick={()=>setAddTab('import')}>インポート</button>
          </div>
        )}

        {isAdd && addTab!=='detail' ? (
          <div className="modal-addlist">
            {addTab==='all' && <AllTab onPick={name=>{setD(blankDraft(name));setAddTab('detail')}} />}
            {addTab==='mine' && <MineTab team={team} onAdd={p=>{onAddToTeam(p);onClose()}} onRemove={r=>{onRemoveRaw(r)}} />}
            {addTab==='tmpl' && <TemplatesTab format={format} onLoadParty={m=>{onLoadParty&&onLoadParty(m);onClose()}} />}
            {addTab==='suggest' && <SuggestTab team={team} onAdd={p=>{onAddToTeam(p);onClose()}} onAddMany={b=>{onAddMany(b);onClose()}} />}
            {addTab==='import' && <ImportTab pool={pool} team={team} text={importText} setText={setImportText}
              onParse={()=>{const n=doImport(importText); if(n){setImportText('');onClose()}}}
              onAdd={p=>{onAddToTeam(p);onClose()}} doImport={t=>doImport(t)} />}
          </div>
        ) : (
        <>
        {tmpls.length>0 && (
          <select className="tmpl-sel" defaultValue="-1" onChange={e=>applyTmpl(+e.target.value)}>
            <option value="-1">📋 所持テンプレから一括入力 ({tmpls.length}型)</option>
            {tmpls.map((t,i)=><option key={i} value={i}>@{t.item||'—'} / {t.nature||'—'} / {t.moves.slice(0,2).join('・')}…</option>)}
          </select>
        )}

        <div className="frow"><span className="fkey">持ち物</span><OptSelect className="fsel" value={d.item} options={ALL_ITEMS} placeholder="持ち物を選択" onChange={v=>set('item',v)} /></div>
        <div className="frow"><span className="fkey">テラス</span>
          <select className="fsel" value={d.teraType} onChange={e=>set('teraType',e.target.value)}>
            <option value="">—</option>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select></div>
        <div className="frow"><span className="fkey">特性</span><OptSelect className="fsel" value={d.ability} options={ALL_ABIL} placeholder="特性を選択" onChange={v=>set('ability',v)} /></div>
        <div className="frow"><span className="fkey">性格</span>
          <select className="fsel" value={d.nature} onChange={e=>set('nature',e.target.value)}>
            <option value="">—</option>{ALL_NATURES.map(n=>{const nm=NATURE_MOD[n];return <option key={n} value={n}>{n}{nm?` (+${EV_LABELS[nm[0]+1]}/-${EV_LABELS[nm[1]+1]})`:''}</option>})}
          </select></div>

        <div className="modal-sec">技</div>
        {dupMv.length?<div className="dup-move-warn" style={{margin:'0 0 8px'}}>⚠ 技が重複しています: {dupMv.join(', ')}</div>:null}
        {[0,1,2,3].map(i=>{
          const mi=moveInfo(d.moves[i])
          const isDup=d.moves[i]&&dupMv.includes(d.moves[i])
          return (
            <div className="frow" key={i}>
              <span className="mdot" style={{background:mi?TYPE_COLORS[mi[0]]:'#cbd3e6',width:12,height:12}} title={mi?mi[0]:'未登録'}></span>
              <MoveSelect className={'fsel'+(isDup?' dup-move':'')} value={d.moves[i]||''} placeholder={'技'+(i+1)+'を選択'} onChange={v=>setMove(i,v)} />
            </div>
          )
        })}

        <div className="modal-sec" style={{display:'flex',alignItems:'center',gap:6}}>努力値・実数値 <Tip text={`現在「${cfg.label}」モード（各ステ最大${cfg.max}・合計${cfg.total}）。努力値を入れると実数値を自動計算(Lv50・個体値31)。モード切替はチーム構成パネル右上。種族値未登録なら実数値は手入力。`} /></div>
        <div className="ana-note" style={{margin:'0 0 8px'}}>モード: <b>{cfg.label}</b>（各ステ最大{cfg.max}/合計{cfg.total}）{base?' → 実数値は自動計算':' → 種族値未登録のため実数値は手入力'}</div>
        <div className="ev-grid">
          {EV_LABELS.map((lab,i)=>(
            <div className="ev-row" key={i}>
              <span className="ev-lab">{lab}</span>
              <select className="ev-ev" value={d.stats[i].ev||0} onChange={e=>setStat(i,'ev',e.target.value)} title="努力値">
                {cfg.preset.includes(d.stats[i].ev||0)?null:<option value={d.stats[i].ev}>{d.stats[i].ev}</option>}
                {cfg.preset.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              {base
                ? <span className="ev-real" title="実数値（自動計算）">{d.stats[i].val||0}</span>
                : <input className="ev-real manual" type="number" value={d.stats[i].val||''} onChange={e=>setStat(i,'val',e.target.value)} placeholder="実数" title="実数値（手入力）" />}
              <div className="ev-bar"><i style={{width:Math.min((d.stats[i].ev||0)/cfg.max*100,100)+'%'}}></i></div>
            </div>
          ))}
        </div>
        <div className={'ev-total'+(evTotal>cfg.total?' over':'')}>努力値合計 {evTotal} / {cfg.total} {evTotal>cfg.total?'⚠ 超過':''}</div>

        <button className="modal-save" onClick={()=>onSave(d,modal.slot)}>{isAdd?'チームに追加':'保存してチームに反映'}</button>

        <div className="modal-raw-tog" onClick={()=>setShowRaw(s=>!s)}>{showRaw?'▾ ポケソルテキスト非表示':'▸ ポケソルテキスト表示'}</div>
        {showRaw && <div className="modal-raw">{buildRaw(d)}</div>}
        </>
        )}
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>)

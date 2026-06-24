// app-speed.js — 素早さ調整ビュー（SpeedView / SpeedPlot / 速度ヘルパ）
// ── 素早さ補助 ──
// evReal=従来式換算後EV（floor(/4)が投資量）。mult=性格補正倍率
function speedAt(base, evReal, mult){
  const inner=Math.floor((2*base+31+Math.floor(evReal/4))*50/100)
  return Math.floor((inner+5)*mult)
}
// 現EVモードの最大投資を実数値計算用に換算（champ:32→256 / classic:252）
const evMaxReal  = ()=>evCfg().conv(evCfg().max)
const spdFastest = b=>speedAt(b,evMaxReal(),1.1)  // 最速(MAX振り+上昇補正)
const spdQuick   = b=>speedAt(b,evMaxReal(),1.0)  // 準速(MAX振り・無補正)
const spdSlowest = b=>speedAt(b,0,0.9)            // 最遅(0振り・下降補正)
const spdMax     = spdFastest                     // 後方互換（プロット図）
const spdMin     = b=>speedAt(b,0,1.0)            // 無振り無補正
// 最速にする+S性格（物理寄り=ようき / 特殊寄り=おくびょう）
function natForFast(base){ return (base && base[1]>=base[3]) ? 'ようき' : 'おくびょう' }
function isFastNat(n){ const m=NATURE_MOD[n]; return m && m[0]===4 }      // +S補正
function isNeutralSpd(n){ const m=NATURE_MOD[n]; return !m || (m[0]!==4 && m[1]!==4) }

// ── 素早さプロット図（常時表示・S種族値順）──
// 縦軸=素早さ実数値。各ポケを「最遅〜最速」帯で、現在実数値(補正・スカーフ・おいかぜ込み)を●で表示。
// 横線=100/110…10刻みの「準速スカーフ」ライン（その種族値の準速×1.5＝抜くべき基準）。
function SpeedPlot({rows}){
  if(!rows.length) return null
  const cur=r=>(r.eff!=null?r.eff:r.spe)
  // S種族値の速い順に並べる（左=速い）
  const prows=[...rows].sort((a,b)=>b.baseSpe-a.baseSpe)
  const mins = prows.map(r=>spdSlowest(r.baseSpe))
  const maxs = prows.map(r=>Math.max(spdFastest(r.baseSpe), cur(r)))   // おいかぜで最速超えもあるため現在値も内包
  const curs = prows.map(cur)
  let lo=Math.min(...mins, ...curs)
  let hi=Math.max(...maxs, ...curs)
  const span=Math.max(1,hi-lo), pad=Math.max(6,Math.round(span*0.05))
  lo-=pad; hi+=pad
  const N=prows.length, padL=42, padR=16, padT=6, padB=30, colW=36, plotH=176
  const plotW=N*colW, W=padL+plotW+padR, H=padT+plotH+padB
  const y=v=>padT+(hi-v)/(hi-lo)*plotH
  const colX=i=>padL+colW*i+colW/2
  // 横線＝10刻みの準速スカーフライン（spdQuick(種)×1.5）
  const tiers=[]; for(let t=50;t<=200;t+=10){ const v=Math.floor(spdQuick(t)*1.5); if(v>=lo&&v<=hi) tiers.push({t,v}) }
  return (
    <div className="spd-plot">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" style={{fontFamily:'inherit'}}>
        {/* 横線＝10刻みの準速スカーフライン（100準ス・110準ス…） */}
        {tiers.map(({t,v},k)=>(
          <g key={'t'+k}>
            <line x1={padL} y1={y(v)} x2={padL+plotW} y2={y(v)} stroke="var(--warn)" strokeWidth={t%50===0?1.2:0.7} strokeDasharray={t%50===0?'':'3 2'} opacity={t%50===0?0.55:0.4}/>
            <text x={padL-3} y={y(v)+2.3} textAnchor="end" fontSize="6.5" fill="var(--warn)" fontWeight={t%50===0?800:600}>{t}準ス</text>
          </g>
        ))}
        {/* 各ポケの列（S種族値順） */}
        {prows.map((r,i)=>{
          const x=colX(i), col=TYPE_COLORS[getTypes(r.name)[0]]||'var(--accent)'
          const yTop=y(spdFastest(r.baseSpe)), yBot=y(spdSlowest(r.baseSpe))
          const c=cur(r), yCur=y(c)
          return (
            <g key={'c'+i}>
              <rect x={x-9} y={yTop} width="18" height={Math.max(2,yBot-yTop)} rx="5" fill={col} opacity="0.16" stroke={col} strokeWidth="1"/>
              <line x1={x-10} y1={yCur} x2={x+10} y2={yCur} stroke={col} strokeWidth="2"/>
              <circle cx={x} cy={yCur} r="3.5" fill={col} stroke="var(--panel)" strokeWidth="1.5"/>
              <text x={x+12} y={yCur+2.6} fontSize="7.5" fill="var(--text)" fontWeight="800">{c}</text>
              <text x={x} y={padT+plotH+12} textAnchor="middle" fontSize="7" fill="var(--faint)">種{r.baseSpe}</text>
              <text x={x} y={padT+plotH+22} textAnchor="middle" fontSize="7" fill="var(--muted)" fontWeight="700">{r.name.length>5?r.name.slice(0,4)+'…':r.name}</text>
            </g>
          )
        })}
      </svg>
      <div className="ana-note" style={{margin:'2px 0 0'}}>帯=最遅〜最速 ／ ●=現在の実数値(補正・スカーフ・おいかぜ込み) ／ 橙の横線=10刻みの準速スカーフライン(実線=50刻み)。列はS種族値順。</div>
    </div>
  )
}

// ── 素早さ調整（左=種族値+最速 / 右=準速・スカーフの横ライン / 自動並替・スカーフ自動チェック）──
function SpeedView({team,evMode,onSpeedEv}){
  const [scope,setScope]=useState('all')
  const [autoSort,setAutoSort]=useState(false)  // 自動並び替え（既定OFF＝枠順固定）
  const [tailwind,setTailwind]=useState(false)   // おいかぜ（場全体×2）
  const [ranks,setRanks]=useState({})   // slotIdx -> ランク(-6〜+6)
  const [mults,setMults]=useState({})   // slotIdx -> 性格補正倍率(1.1|1.0|0.9)
  const [scarfs,setScarfs]=useState({}) // slotIdx -> bool（未設定は持ち物から自動判定）
  const cfg=EV_MODES[evMode]||EV_MODES.champ
  const idx=team.map((p,i)=>({p,i})).filter(x=>x.p && (scope==='sel'?x.p.selected:true) && getBase(x.p.name))
  const rows=idx.map(({p,i})=>{
    const base=getBase(p.name), b=base[5]
    const ev=(p.stats[5]&&p.stats[5].ev)||0
    const rank=ranks[i]||0
    const mult=mults[i]!=null?mults[i]:1.0
    // スカーフ自動チェック：持ち物がこだわりスカーフなら既定ON（手動で上書き可）
    const scarf=scarfs[i]!=null?scarfs[i]:(p.item==='こだわりスカーフ')
    const spe=speedAt(b,effEV(ev),mult)
    const eff=Math.floor(Math.floor(spe*rankMult(rank))*(scarf?1.5:1))*(tailwind?2:1)  // おいかぜ=×2
    return {i,name:p.name,item:p.item||'',base,baseSpe:b,spe,rank,eff,ev,mult,scarf,
      slow:spdSlowest(b),quick:spdQuick(b),fast:spdFastest(b),
      quickScarf:Math.floor(spdQuick(b)*1.5),fastScarf:Math.floor(spdFastest(b)*1.5)}
  })
  const setRank=(i,r)=>setRanks(o=>({...o,[i]:Math.max(-6,Math.min(6,r))}))
  const setMult=(i,m)=>setMults(o=>({...o,[i]:m}))
  const setScarf=(i,v)=>setScarfs(o=>({...o,[i]:v}))
  // 自動並替ON=現在実数値の降順 / OFF=枠順固定
  const display = autoSort ? [...rows].sort((a,b)=>b.eff-a.eff) : rows
  // 全ポケ共有の横軸ドメイン（最遅〜最速スカーフ）→ 行をそろえて比較
  const lo=rows.length?Math.min(...rows.map(r=>r.slow)):0
  const hi=rows.length?Math.max(...rows.map(r=>r.fastScarf)):1
  const span=Math.max(1,hi-lo), pad=Math.max(4,Math.round(span*0.04))
  const dlo=lo-pad, dhi=hi+pad
  const pos=v=>Math.max(0,Math.min(100,(v-dlo)/(dhi-dlo)*100))
  const ticks=r=>[
    {v:r.quick,      cls:'quick',  lab:'準速'},
    {v:r.quickScarf, cls:'qscarf', lab:'準速🧣'},
    {v:r.fastScarf,  cls:'fscarf', lab:'最速🧣'},
  ]

  return (
    <div>
      <ScopeTabs scope={scope} setScope={setScope}/>
      {!rows.length ? <div className="chart-empty">種族値が分かるポケモンを追加すると表示されます</div> : (
      <div>
        <div className="spd-toolbar">
          <span style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <label className="spd-autosort"><input type="checkbox" checked={autoSort} onChange={e=>setAutoSort(e.target.checked)}/>素早さ順に自動並び替え</label>
            <label className={'spd-autosort'+(tailwind?' on':'')}><input type="checkbox" checked={tailwind} onChange={e=>setTailwind(e.target.checked)}/>おいかぜ ×2</label>
          </span>
          <span className="spd-legend"><i className="lg quick"></i>準速 <i className="lg qscarf"></i>準速スカーフ <i className="lg fscarf"></i>最速スカーフ <i className="lg mark"></i>現在</span>
        </div>
        {/* プロット図は常時表示・S種族値順 */}
        <SpeedPlot rows={rows} />
        <div className="ana-note">左＝種族値と最速実数値／右＝準速・準速スカーフ・最速スカーフのライン上に現在値(●)を重ねて、どのラインを抜けるか一目で。下の枠で 補正(1.1/1.0/0.9)・スカーフ・S努力値(0〜{cfg.max})・ランク(-6〜+6) を調整。おいかぜONで全体×2。</div>
        <div className="spd-hlist">
          {display.map(r=>(
            <div className="spd-hrow" key={r.i}>
              <div className="spd-hhead">
                <div className="spd-hleft">
                  {spriteIcon(r.name)}
                  <div className="spd-hname-wrap">
                    <span className="spd-hname">{r.name}</span>
                    <span className="spd-hnums">種<b>{r.baseSpe}</b> ／ 最速<b>{r.fast}</b></span>
                  </div>
                </div>
                <span className="spd-hcur"><b>{r.eff}</b>{r.scarf?<i className="spd-scarficon" title="スカーフ">🧣</i>:null}{(r.rank!==0||r.mult!==1.0)?<i className="spd-rk"> {r.mult===1.1?'×1.1 ':r.mult===0.9?'×0.9 ':''}{r.rank!==0?(r.rank>0?'+':'')+r.rank:''}</i>:null}</span>
              </div>
              <div className="spd-htrack">
                <div className="spd-band" style={{left:pos(r.slow)+'%',width:Math.max(1,pos(r.fast)-pos(r.slow))+'%'}}></div>
                {ticks(r).map((t,k)=>(
                  <div className={'spd-tick '+t.cls} key={k} style={{left:pos(t.v)+'%'}} title={t.lab+' '+t.v}>
                    <span className="spd-tick-lab">{t.lab}<b>{t.v}</b></span>
                  </div>
                ))}
                <div className="spd-mark" style={{left:pos(r.eff)+'%'}} title={'現在 '+r.eff}>{r.eff}</div>
              </div>
              <div className="spd-ctrl">
                <span className="nat-tog">
                  <button className={'nat-btn'+(r.mult===1.1?' on':'')} onClick={()=>setMult(r.i,1.1)} title="上昇補正(ようき/おくびょう等)">1.1</button>
                  <button className={'nat-btn'+(r.mult===1.0?' on':'')} onClick={()=>setMult(r.i,1.0)} title="無補正">1.0</button>
                  <button className={'nat-btn'+(r.mult===0.9?' on':'')} onClick={()=>setMult(r.i,0.9)} title="下降補正">0.9</button>
                </span>
                <label className="scarf-tog"><input type="checkbox" checked={r.scarf} onChange={e=>setScarf(r.i,e.target.checked)}/>スカーフ</label>
                <span className="spd-slider">
                  <input type="range" min="0" max={cfg.max} step={cfg.step} value={r.ev} onChange={e=>onSpeedEv(r.i,+e.target.value)} title="すばやさ努力値"/>
                  <span className="spd-evval">S{r.ev}</span>
                </span>
                <RankStepper rank={r.rank} setRank={v=>setRank(r.i,v)} />
              </div>
            </div>
          ))}
        </div>
      </div>)}
    </div>
  )
}

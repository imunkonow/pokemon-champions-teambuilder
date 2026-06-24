// boot.js — 全ページ共通ブートストラップ
// app-*.js（JSX付き）を fetch→連結→Babel変換→eval。分割しても単一スコープで動くので
// 従来の「1ファイルに全部」と同じ感覚で書ける。編集時は該当 app-*.js のみ読めばよい（token節約）。
// キャッシュ無効化: app-*.js と style.css は読み込み毎にユニーククエリを付け、編集/デプロイが即反映されるようにする。
window.PC_BOOT = function(files, mountSrc){
  var v = '?t=' + Date.now()
  // style.css も最新化（<link> はブラウザが握りやすいため毎回リフレッシュ）
  try{
    var link = document.querySelector('link[rel="stylesheet"]')
    if(link){ var base = link.getAttribute('href').split('?')[0]; link.setAttribute('href', base + v) }
  }catch(e){}
  Promise.all(files.map(function(f){
    return fetch(f + v).then(function(r){ if(!r.ok) throw new Error(f + ' ' + r.status); return r.text() })
  })).then(function(srcs){
    if(mountSrc) srcs.push(mountSrc)
    var out = Babel.transform(srcs.join('\n;\n'), { presets: [['react', { runtime: 'classic' }]] }).code
    ;(0, eval)(out)
  }).catch(function(e){
    console.error(e)
    document.getElementById('root').innerHTML =
      '<pre style="padding:16px;color:#b00;white-space:pre-wrap;font-size:12px">' + (e && e.message || e) + '</pre>'
  })
}

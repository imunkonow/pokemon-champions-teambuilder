// data.js — アセンブラ（各 data-*.js を統合して window.PCDATA を構築）
// 読み込み順: data-master.js → data-pokemon.js → data-moves.js → data-season.js → data-owned.js → data.js
window.PCDATA = (function () {
  const R = window._PCR || {}

  const DEX  = R.DEX  || {}
  const MEGA = R.MEGA || {}

  // DEX + MEGA から各マスタを生成
  const POKEMON_TYPES = {}, SPRITE_IDS = {}, BASE_STATS = {}
  for(const [nm,[id,tp,st]] of Object.entries({...DEX, ...MEGA})){
    POKEMON_TYPES[nm]=tp; BASE_STATS[nm]=st; if(id) SPRITE_IDS[nm]=id
  }

  return {
    TYPE_COLORS:    R.TYPE_COLORS    || {},
    TYPES:          R.TYPES          || [],
    EFF:            R.EFF            || [],
    POKEMON_TYPES,
    SPRITE_IDS,
    SHOWDOWN_NAMES: R.SHOWDOWN_NAMES || {},
    ALL_NATURES:    R.ALL_NATURES    || [],
    NATURE_MOD:     R.NATURE_MOD     || {},
    MOVE_TYPES:     R.MOVE_TYPES     || {},
    MOVE_POWER:     R.MOVE_POWER     || {},
    THREATS:        R.THREATS        || [],
    BASE_STATS,
    ITEMS:          R.ITEMS          || [],
    OWNED_MD_TEXT:  R.OWNED_MD_TEXT  || '',
  }
})()

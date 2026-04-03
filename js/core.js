


















// Supabase config — filled in by api/index.js at serve time
// Config injected by /api/config — Supabase public keys
// Falls back to empty strings (guest mode) if not configured
window.SUPABASE_URL = window.SUPABASE_URL || '';
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

// ─── SHARED GLOBALS (hoisted for cross-file access) ──────────────────────────
var _userTier = 'free';
var _reflectHistory = [];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const EK='lunations_v1', PK='lunations_profile_v1', RK='lunations_reading_v1';

// ── Migrate old key names from before the Lunations rebrand ──────────────────
(function migrateLegacyKeys(){
  const migrations = [
    ['lunar_journal_v1', EK],
    ['lunar_profile_v1', PK],
    ['lunar_intention_v1', 'lunations_intention_v1'],
    ['lunar_settings_v1', 'lunations_settings_v1'],
  ];
  migrations.forEach(([oldKey, newKey]) => {
    const old = localStorage.getItem(oldKey);
    if(old && !localStorage.getItem(newKey)){
      localStorage.setItem(newKey, old);
      localStorage.removeItem(oldKey);
      console.log('Migrated', oldKey, '→', newKey);
    }
  });
  // Also migrate any individual backup entries
  Object.keys(localStorage).forEach(k => {
    if(k.startsWith('lunar_backup_')){
      const newKey = k.replace('lunar_backup_', 'lunations_backup_');
      if(!localStorage.getItem(newKey)){
        localStorage.setItem(newKey, localStorage.getItem(k));
        localStorage.removeItem(k);
      }
    }
  });
})();


// ── IndexedDB backup — survives cache clears that wipe localStorage ───────────
const IDB_NAME = 'lunations_db', IDB_STORE = 'entries', IDB_VER = 1;

function openIDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VER);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value){
  try{
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    return new Promise(res => tx.oncomplete = res);
  } catch(e){ console.warn('IDB write failed:', e); }
}

async function idbGet(key){
  try{
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch(e){ return null; }
}

// On load — if localStorage entries are empty but IDB has data, restore it
async function restoreFromIDB(){
  const lsData = localStorage.getItem(EK);
  const lsEntries = lsData ? JSON.parse(lsData) : {};
  if(Object.keys(lsEntries).length === 0){
    const idbData = await idbGet('entries');
    if(idbData && Object.keys(idbData).length > 0){
      // Strip mock data on restore
      const real={};
      Object.entries(idbData).forEach(([k,v])=>{ if(!v.isMockData) real[k]=v; });
      localStorage.setItem(EK, JSON.stringify(real));
      await idbSet('entries', real);
      console.log('Restored', Object.keys(real).length, 'entries from IndexedDB (mock stripped)');
      return true;
    }
  }
  return false;
}

// Mirror entries to IDB every save
const _origSaveEntries = e => localStorage.setItem(EK, JSON.stringify(e));
const loadEntries=()=>{
  try{
    const all=JSON.parse(localStorage.getItem(EK)||'{}');
    // Strip mock data silently
    const real={};
    Object.entries(all).forEach(([k,v])=>{ if(!v.isMockData) real[k]=v; });
    return real;
  }catch(e){return{};}
};
const saveEntries = e => { 
  localStorage.setItem('lunations_v1', JSON.stringify(e));
  idbSet('entries', e); 
};
const loadProfile=()=>{try{return JSON.parse(localStorage.getItem(PK)||'null')}catch(e){return null}};
async function loadProfileWithIDBFallback(){
  const p=loadProfile();
  if(p)return p;
  const idbP=await idbGet('profile');
  if(idbP){localStorage.setItem(PK,JSON.stringify(idbP));return idbP;}
  return null;
}
const saveProfileData=p=>{localStorage.setItem(PK,JSON.stringify(p));idbSet('profile',p);};
const entryKey=d=>d.toISOString().slice(0,10);

// ─── MOON MATH ────────────────────────────────────────────────────────────────
function julianDay(date){
  const d=new Date(date),y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();
  const h=(d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600)/24;
  const A=Math.floor((14-m)/12),Y=y+4800-A,M=m+12*A-3;
  return day+Math.floor((153*M+2)/5)+365*Y+Math.floor(Y/4)-Math.floor(Y/100)+Math.floor(Y/400)-32045-0.5+h;
}
function moonAge(date){const JD=julianDay(date),s=29.53058867;return((JD-2451549.5)%s+s)%s;}
function moonPhaseInfo(date){
  const age=moonAge(date),illum=(1-Math.cos(age/29.53058867*2*Math.PI))/2,pct=Math.round(illum*100);
  const tbl=[[1.85,'New Moon','🌑',0],[7.38,'Waxing Crescent','🌒',1],[9.22,'First Quarter','🌓',2],[14.77,'Waxing Gibbous','🌔',3],[16.61,'Full Moon','🌕',4],[22.15,'Waning Gibbous','🌖',5],[23.99,'Last Quarter','🌗',6],[99,'Waning Crescent','🌘',7]];
  // Override: if illumination >= 95%, it's visually full (~2-3 day window)
  if(pct>=95) return{name:'Full Moon',emoji:'🌕',quarter:4,pct,age};
  const row=tbl.find(r=>age<r[0])||tbl[tbl.length-1];
  return{name:row[1],emoji:row[2],quarter:row[3],pct,age};
}
function prevNewMoon(date){
  // More accurate: iterate backwards by synodic period until age < 1 day
  const SYN = 29.53058867;
  let d = new Date(date);
  let age = moonAge(d);
  // Jump back to approximate new moon
  d = new Date(d.getTime() - age * 86400000);
  // Refine with small steps
  for(let i = 0; i < 10; i++){
    age = moonAge(d);
    if(age < 0.5) break;
    if(age > SYN/2){
      // We're in the second half — we overshot, go forward
      d = new Date(d.getTime() + (SYN - age) * 86400000);
    } else {
      d = new Date(d.getTime() - age * 86400000);
    }
  }
  // Final snap: set to start of that day
  d.setHours(0,0,0,0);
  return d;
}

// ─── ZODIAC ───────────────────────────────────────────────────────────────────
const SIGNS=[
  {name:'Aries',symbol:'♈',icon:'🐏',element:'Fire',quality:'Cardinal',keywords:'initiative, courage, drive',ruling:'Mars',color:'#c85040'},
  {name:'Taurus',symbol:'♉',icon:'🐂',element:'Earth',quality:'Fixed',keywords:'stability, sensuality, devotion',ruling:'Venus',color:'#7a9a40'},
  {name:'Gemini',symbol:'♊',icon:'✦✦',element:'Air',quality:'Mutable',keywords:'communication, duality, wit',ruling:'Mercury',color:'#d4c040'},
  {name:'Cancer',symbol:'♋',icon:'🌙',element:'Water',quality:'Cardinal',keywords:'intuition, feeling, home',ruling:'Moon',color:'#5080c0'},
  {name:'Leo',symbol:'♌',icon:'🦁',element:'Fire',quality:'Fixed',keywords:'radiance, creativity, sovereignty',ruling:'Sun',color:'#d48020'},
  {name:'Virgo',symbol:'♍',icon:'🌾',element:'Earth',quality:'Mutable',keywords:'refinement, discernment, craft',ruling:'Mercury',color:'#60a060'},
  {name:'Libra',symbol:'♎',icon:'⚖',element:'Air',quality:'Cardinal',keywords:'balance, beauty, relation',ruling:'Venus',color:'#c090c0'},
  {name:'Scorpio',symbol:'♏',icon:'🦂',element:'Water',quality:'Fixed',keywords:'depth, transformation, mystery',ruling:'Pluto',color:'#804080'},
  {name:'Sagittarius',symbol:'♐',icon:'🏹',element:'Fire',quality:'Mutable',keywords:'vision, freedom, truth-seeking',ruling:'Jupiter',color:'#a06020'},
  {name:'Capricorn',symbol:'♑',icon:'🐐',element:'Earth',quality:'Cardinal',keywords:'mastery, discipline, ascent',ruling:'Saturn',color:'#507080'},
  {name:'Aquarius',symbol:'♒',icon:'🌊',element:'Air',quality:'Fixed',keywords:'awakening, originality, community',ruling:'Uranus',color:'#4090c0'},
  {name:'Pisces',symbol:'♓',icon:'🐟',element:'Water',quality:'Mutable',keywords:'dissolution, compassion, mysticism',ruling:'Neptune',color:'#6070a0'},
];
function sunSignForDate(date){
  const d=new Date(date),mon=d.getMonth(),day=d.getDate();
  const bounds=[[3,20],[4,20],[5,21],[6,21],[7,22],[8,22],[9,22],[10,22],[11,21],[12,22],[1,20],[2,18],[3,20]];
  for(let i=0;i<12;i++){const[nm,nd]=bounds[i],[nm2,nd2]=bounds[i+1],start=new Date(2000,nm-1,nd),end=new Date(2000,nm2-1,nd2),test=new Date(2000,mon,day);if(test>=start&&test<end)return SIGNS[i];}
  return SIGNS[11];
}
function moonSignApprox(date){const JD=julianDay(date),lon=((JD-2451545)*13.176396+218.316)%360;return SIGNS[Math.floor(((lon%360)+360)%360/30)];}
const PLANETS=[{name:'Mercury',symbol:'☿',period:87.97},{name:'Venus',symbol:'♀',period:224.7},{name:'Mars',symbol:'♂',period:686.97},{name:'Jupiter',symbol:'♃',period:4332.59},{name:'Saturn',symbol:'♄',period:10759.22},{name:'Uranus',symbol:'⛢',period:30688.5},{name:'Neptune',symbol:'♆',period:60195},{name:'Pluto',symbol:'♇',period:90560}];
const BASE_LONS={Mercury:75,Venus:181,Mars:355,Jupiter:34,Saturn:49,Uranus:313,Neptune:300,Pluto:260};
function planetSign(p,date){const JD=julianDay(date),lon=((BASE_LONS[p.name]+(JD-2451545)*(360/p.period))%360+360)%360;return SIGNS[Math.floor(lon/30)];}
function allPlanets(date){return[{name:'Sun',symbol:'☉',sign:sunSignForDate(date)},{name:'Moon',symbol:'☽',sign:moonSignApprox(date)},...PLANETS.map(p=>({...p,sign:planetSign(p,date)}))];}

// ─── PHASE TONES ──────────────────────────────────────────────────────────────
const PHASE_TONES={0:'Dark moon: the void between worlds. Receive. Surrender. Seed the prayer.',1:'New light emerges from darkness. Set your intention with gentleness.',2:'Waxing Crescent: the initiation of will. Small steps carry great charge now.',3:'First Quarter: tension between vision and resistance. Act decisively.',4:'Waxing Gibbous: refinement and preparation. The wave rises — trust the momentum.',5:'Full Moon: the apex of illumination. What has been hidden becomes luminous. Release, offer.',6:'Waning Gibbous: gratitude and integration. The wisdom is in the digestion.',7:'Last Quarter: release. What serves the next cycle? What must be composted?'};

// ─── PLANET INFLUENCE LIBRARY ─────────────────────────────────────────────────
const PI={
  Sun:{Aries:'Solar energy is direct and initiating — your will wants to act boldly. Good for starting, asserting, physical movement.',Taurus:'The sun grounds in sensory reality. Slow down, use your hands, enjoy beauty. Creative and material work thrives.',Gemini:'Curiosity and communication are lit up. Your mind is quick. Write, converse, make connections.',Cancer:'The solar spotlight turns inward to home and emotional roots. Nurturing is primary.',Leo:'Solar energy at home — radiant, expressive. Excellent for art, visibility, leadership.',Virgo:'Attention to craft and detail is heightened. The sun here wants to refine. Health and daily practice benefit.',Libra:'Harmony, beauty, and relationship are at center. Aesthetic awareness is strong.',Scorpio:'Depth, intensity, transformation. The surface is not enough — dig into what is actually happening.',Sagittarius:'Expansion, vision, philosophy. Look at the big picture. Meaning-making is supported.',Capricorn:'Ambition and structure. Build something lasting. Discipline serves you.',Aquarius:'Collective vision and individuality pull simultaneously. Originality and community both matter.',Pisces:'Dissolution, mystical perception, compassion. Dreams and art are elevated. Boundaries may thin.'},
  Moon:{Aries:'Emotional energy is impulsive and fast-moving. Feelings arise and pass quickly. Good for courage, not patience.',Taurus:'Moon exalted — stable, sensual, grounded emotional state. Comfort-seeking and slow pleasure.',Gemini:'Emotions are mental and chatty. Process feelings by talking or writing. Restlessness possible.',Cancer:'Moon at home — deeply feeling, intuitive, nurturing. Emotions are primary data today.',Leo:'Emotions want to be seen and expressed. Warmth, generosity, need for appreciation.',Virgo:'The heart wants to be useful. Analytical emotional processing. Health anxieties may surface.',Libra:'Relational harmony matters deeply. Discomfort with conflict; desire for beauty and fairness.',Scorpio:'Emotional depths open. Intensity runs hot. Psychic sensitivity heightened. Power dynamics surface.',Sagittarius:'Restless need for freedom and meaning. Philosophy over feeling. Optimism natural.',Capricorn:'Moon in fall — emotions feel controlled or muted. Ambition and reserve dominate.',Aquarius:'Detached but humanitarian. Emotional needs expressed through ideas and collective connection.',Pisces:'Extremely permeable emotional boundaries. Empathy peaks. Mysticism and creative sensitivity are open.'},
  Mercury:{Aries:'Thinking is fast and direct. Good for decisions, less for patient listening.',Taurus:'Slow, deliberate thinking. Ideas that stick. Good for finalizing plans.',Gemini:'Mercury at home — quick, curious, multitasking. Ideal for writing, learning, networking.',Cancer:'Intuitive and emotionally colored thinking. Memory is strong.',Leo:'Thinking is dramatic and creative. Communication is expressive and confident.',Virgo:'Mercury at home — precise, analytical. Excellent for editing, research, problem-solving.',Libra:'Diplomatic communication. Thinking seeks balance. Decision-making may stall.',Scorpio:'Penetrating, investigative thinking. Secrets and hidden patterns are accessible.',Sagittarius:'Big-picture thinking. Philosophy and meaning over detail.',Capricorn:'Disciplined, practical communication. Long-term planning benefits.',Aquarius:'Innovative and lateral thinking. Ideas arrive suddenly, unconventionally.',Pisces:'Intuitive but foggy reasoning. Art and music benefit. Logic takes a back seat.'},
  Venus:{Aries:'Love is direct and passionate — wants what it wants now. Bold aesthetic.',Taurus:'Venus at home — sensual pleasure, beauty, loyalty. Ideal for art, love, money.',Gemini:'Light, flirtatious, socially playful love energy. Charm through wit.',Cancer:'Nurturing, domestic love. Tenderness and emotional safety are attractive.',Leo:'Dramatic, generous love. You want to be adored. Creative expression thrives.',Virgo:'Love through acts of service. Aesthetic precision. Can be self-critical.',Libra:'Venus at home — refined, relational, aesthetically heightened. Partnership is everything.',Scorpio:'Intense, magnetic, all-or-nothing. Desire runs deep. Power dynamics in relationships.',Sagittarius:'Free-spirited, adventurous love. Philosophy and travel as romance.',Capricorn:'Love through commitment and achievement. Loyalty and long-term matters.',Aquarius:'Unconventional attraction. Love as friendship and intellectual resonance.',Pisces:'Venus exalted — boundless compassion, romantic idealism. Spiritual love is accessible.'},
  Mars:{Aries:'Mars at home — peak energy and drive. Physical vitality is high. Act now.',Taurus:'Mars slows — steady, persistent energy. Build incrementally.',Gemini:'Scattered but mentally active. Multiple projects. Restless.',Cancer:'Mars in fall — emotionally motivated energy, sometimes passive-aggressive.',Leo:'Dramatic, proud energy. Drive for recognition. Leadership and performance.',Virgo:'Productive, detail-focused action. Energy best spent on craft and improvement.',Libra:'Mars in detriment — difficulty asserting directly. Energy goes to diplomacy.',Scorpio:'Intense, strategic, relentless energy. Hidden power and depth of will.',Sagittarius:'Enthusiastic, expansive energy. Driven by ideals and adventure.',Capricorn:'Mars exalted — sustained disciplined effort. Long-game energy at its peak.',Aquarius:'Rebellious, humanitarian drive. Energy for causes and collective action.',Pisces:'Diffuse, spiritually motivated energy. Art and healing benefit. Direct action is harder.'},
  Jupiter:{_:'Jupiter expands whatever sign it touches. Growth, optimism, and abundance radiate in this area of life. Look here for where luck, learning, and expansion are most available.'},
  Saturn:{_:'Saturn brings discipline, lessons, and structure. Where Saturn sits, mastery is demanded — slower, harder work, but the results are durable. Restrictions here are teachers.'},
  Uranus:{_:'Uranus disrupts and liberates. Its influence is sudden and often feels chaotic before it feels freeing. Where Uranus sits, the old order breaks up to allow something more authentic.'},
  Neptune:{_:'Neptune dissolves boundaries and inspires mysticism and art. Where Neptune sits, reality is permeable. Spiritual sensitivity, inspiration, and possible confusion are all in play.'},
  Pluto:{_:'Pluto transforms through destruction and regeneration. This is generational, deep change. Where Pluto sits, power, shadow, and irreversible transformation are operating.'},
};
function getPlanetInfluence(name,sign){const lib=PI[name];if(!lib)return`${name} in ${sign} brings its quality to today's field.`;if(lib._)return lib._;return lib[sign]||`${name} in ${sign} — a nuanced blend of this planet's nature with ${sign}'s energy.`;}

// ─── PLANET POPUP ─────────────────────────────────────────────────────────────
function openPlanetPopup(name,symbol,sign,evt){
  evt.stopPropagation();
  const popup=document.getElementById('planetPopup'),profile=loadProfile();
  document.getElementById('ppTitle').textContent=`${symbol} ${name} in ${sign}`;
  document.getElementById('ppBody').textContent=getPlanetInfluence(name,sign);
  let natal='';
  if(profile&&profile.dob){
    const bd=new Date(profile.dob+'T12:00:00');
    const natSign=name==='Sun'?sunSignForDate(bd):name==='Moon'?moonSignApprox(bd):planetSign(PLANETS.find(p=>p.name===name)||{name,period:365},bd);
    if(natSign){
      if(natSign.name===sign)natal=`${name} currently occupies your natal ${name} sign (${sign}) — a return energy. This carries resonance with who you fundamentally are.`;
      else natal=`Your natal ${name} is in ${natSign.name||''}. Today it transits ${sign} — notice how ${sign}'s quality of ${SIGNS.find(s=>s.name===sign)?.keywords||''} interacts with your natal ${natSign.keywords||''}.`;
    }
  }
  const ppn=document.getElementById('ppNatal');ppn.textContent=natal;ppn.style.display=natal?'block':'none';
  const rect=evt.currentTarget.getBoundingClientRect();
  popup.style.top=Math.min(rect.bottom+8,window.innerHeight-360)+'px';
  popup.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-360))+'px';
  popup.classList.add('open');
}
function closePlanetPopup(){document.getElementById('planetPopup').classList.remove('open');}
document.addEventListener('click',e=>{const p=document.getElementById('planetPopup');if(p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('.planet-card'))closePlanetPopup();});

// ─── MOON SVG ─────────────────────────────────────────────────────────────────
function drawMoon(el,age,size){
  const r=size/2-4,cx=size/2,cy=size/2,ph=age/29.53058867;
  // Illumination fraction: 0 at new, 1 at full, 0 at next new
  const illum = ph<=0.5 ? ph*2 : (1-ph)*2;
  // Terminator rx: maps illumination to ellipse radius for the inner arc
  // At 0% → rx=r (full dark disk), at 50% → rx=0 (half), at 100% → rx=r (full lit)
  const rx = Math.abs(illum*2-1)*r;
  const sweep = illum>0.5 ? 1 : 0; // inner arc direction
  let d;
  if(ph<=0.5){
    // Waxing: lit side is on the right
    d=`M${cx} ${cy-r}A${r} ${r} 0 0 1 ${cx} ${cy+r}A${rx} ${r} 0 0 ${sweep} ${cx} ${cy-r}Z`;
  } else {
    // Waning: lit side is on the left
    d=`M${cx} ${cy-r}A${r} ${r} 0 0 0 ${cx} ${cy+r}A${rx} ${r} 0 0 ${1-sweep} ${cx} ${cy-r}Z`;
  }
  const isFull = illum > 0.95;
  const glow = isFull ? `<defs><filter id="fmg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : '';
  const pathAttr = isFull ? ` filter="url(#fmg)"` : '';
  const strokeCol = isFull ? 'rgba(245,240,232,.5)' : 'rgba(201,168,76,.3)';
  el.innerHTML=`${glow}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#222" stroke="${strokeCol}" stroke-width="${isFull?1.5:1}"/><path d="${d}" fill="rgba(245,240,232,.9)"${pathAttr}/>`;
}


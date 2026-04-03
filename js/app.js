// ─── DAILY READING (AI) ───────────────────────────────────────────────────────
async function generateReading(force=false){
  const todayKey=entryKey(new Date()),cached=localStorage.getItem(RK);
  if(!force&&cached){try{const c=JSON.parse(cached);const age=Date.now()-(c.ts||0);if(c.date===todayKey&&age<8*3600000){document.getElementById('readingText').textContent=c.text;setTimeout(renderReadingPaywall,50);return;}}catch(e){}}
  const now2=new Date(),phase2=moonPhaseInfo(now2),mSign2=moonSignApprox(now2),sSign2=sunSignForDate(now2),profile2=loadProfile();
  if(!canUseAI()){
    const el=document.getElementById('readingText');
    if(el){ el.textContent=getFallbackReading(phase2,mSign2,sSign2,profile2); }
    const sn=document.getElementById('readingSigninNote');
    if(sn) sn.style.display='block';
    return;
  }
  document.getElementById('readingText').innerHTML=_themeFeatures?'<div class="skeleton skeleton-line" style="width:90%"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line" style="width:75%"></div>':'<span class="reading-loading">Reading the sky for you\u2026</span>';
  const now=new Date(),phase=moonPhaseInfo(now),mSign=moonSignApprox(now),sSign=sunSignForDate(now),planets=allPlanets(now),profile=loadProfile();
  let profileCtx='';
  if(profile?.dob){
    const bd=new Date(profile.dob+'T12:00:00'),natSun=sunSignForDate(bd),natMoon=moonSignApprox(bd);
    profileCtx=`The person was born ${profile.dob}. Natal Sun: ${natSun.name}. Natal Moon: ${natMoon.name}.`;
    if(profile.rising)profileCtx+=` Rising: ${profile.rising}.`;
    if(profile.notes){var _cb=parseContextBriefing(profile.notes);if(_cb.chart)profileCtx+=' Chart: '+_cb.chart+'.';if(_cb.life)profileCtx+=' Life now: '+_cb.life+'.';if(_cb.practice)profileCtx+=' Practice: '+_cb.practice.slice(0,60)+'.';}
    var _ww=buildWhosWho(3);if(_ww)profileCtx+=' Key people: '+_ww+'.';
    if(profile.name)profileCtx+=` Name: ${profile.name}.`;
    if(profile.birthCity)profileCtx+=` Birth city: ${profile.birthCity}.`;
  }
  try{var _cn=getChineseDayInfo(now);if(_cn)profileCtx+=' Chinese day: '+_cn.pillar+' '+_cn.yinyang+' '+_cn.element+' '+_cn.branch.animal+'.';}catch(ex){}
  const planetSummary=planets.slice(0,6).map(p=>`${p.name} in ${p.sign?.name||''}`).join(', ');
  var entryCtx='';
  try{
    var ae=loadEntries(),allKeys=Object.keys(ae).sort(),rk=allKeys.slice(-30);
    if(rk.length>=1){
      var r=rk.map(function(k){return{date:k,e:ae[k]};}).filter(function(x){return x.e;});
      // Overall averages
      var avgE=(r.reduce(function(s,x){return s+(x.e.energy||5);},0)/r.length).toFixed(1);
      var avgM=(r.reduce(function(s,x){return s+(x.e.mood||5);},0)/r.length).toFixed(1);
      var topQ=[...new Set(r.flatMap(function(x){return x.e.qualities||[];}))].slice(0,6).join(', ');
      entryCtx='\n\nJournal digest ('+r.length+' entries, full cycle): avg energy '+avgE+'/10, mood '+avgM+'/10.';
      if(topQ) entryCtx+=' Recurring qualities: '+topQ+'.';
      // Energy/mood trend: compare first half to second half
      if(r.length>=4){
        var half=Math.floor(r.length/2);
        var e1=(r.slice(0,half).reduce(function(s,x){return s+(x.e.energy||5);},0)/half).toFixed(1);
        var e2=(r.slice(half).reduce(function(s,x){return s+(x.e.energy||5);},0)/(r.length-half)).toFixed(1);
        var m1=(r.slice(0,half).reduce(function(s,x){return s+(x.e.mood||5);},0)/half).toFixed(1);
        var m2=(r.slice(half).reduce(function(s,x){return s+(x.e.mood||5);},0)/(r.length-half)).toFixed(1);
        entryCtx+=' Trend: energy '+e1+'->'+e2+', mood '+m1+'->'+m2+'.';
      }
      // Recent entry excerpts (last 5 days, ~120 chars each)
      var recent=r.slice(-5);
      var excerpts=recent.map(function(x){
        var bits=[];
        if(x.e.energy) bits.push('E:'+x.e.energy);
        if(x.e.mood) bits.push('M:'+x.e.mood);
        if(x.e.qualities&&x.e.qualities.length) bits.push(x.e.qualities.slice(0,2).join(', '));
        if(x.e.text) bits.push('"'+x.e.text.slice(0,120)+'"');
        if(x.e.dream) bits.push('Dream: "'+x.e.dream.slice(0,60)+'"');
        return x.date+': '+bits.join(' · ');
      }).join('\n');
      entryCtx+='\n\nRecent entries:\n'+excerpts;
      // Cycle intention if present
      try{
        var intEl=document.querySelector('.intention-text');
        if(intEl&&intEl.textContent.trim()) entryCtx+='\n\nCycle intention: "'+intEl.textContent.trim().slice(0,100)+'"';
      }catch(ex2){}
      // Calendar events context
      try{
        var calEvts=getTodayCalendarEvents();
        if(calEvts.length){
          entryCtx+='\nToday\'s calendar: '+calEvts.slice(0,6).map(function(e){return(e.allDay?'all day':formatCalTime(e.start))+' '+e.title;}).join(', ')+'.';
        }
      }catch(ex3){}
    }
  }catch(ex){}
  const _isOracle = getAITone()==='oracle';
  const prompt=`You are a skilled astrologer writing a daily reading for someone's private Lunations journal. Tone: direct and interpretive — specific, not vague or generic. Second person, present tense. ${_isOracle ? 'Under 300 words. Multiple paragraphs welcome.' : 'Under 140 words. One paragraph.'}

Today's sky: ${phase.name} (day ${Math.floor(phase.age)} of 29-day cycle), Moon in ${mSign.name} (${mSign.element} sign — ${mSign.keywords}), Sun in ${sSign.name}. Planets: ${planetSummary}.
${profileCtx}${entryCtx}

Write the reading. Weave in recent patterns where relevant. One specific tension or opportunity today, one practical suggestion. No filler. Do not begin with "Today". ${getModeData().readingLens || ''} ${getTonePromptAddition()}`;
  if(_readingInFlight){_readingQueue=true;return;}
  _readingInFlight=true;
  try{
    var res=await fetch('/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})});
    if(!res.ok){var ed=await res.json().catch(function(){return{};});throw new Error('API '+res.status);}
    var data=await res.json();
    var text=data.text||buildFallbackReading(phase,mSign,sSign,profile);
    document.getElementById('readingText').textContent=text;
    if(_themeFeatures){var _rc=document.getElementById('readingText')?.closest('.reading-card');if(_rc)_rc.classList.add('glow-gold');}
    localStorage.setItem(RK,JSON.stringify({date:todayKey,text:text,ts:Date.now()}));
    incrementReadingUsage();
    updateReadingCapLabel();
    // Hide the guest signin note if visible
    var sn=document.getElementById('readingSigninNote');if(sn)sn.style.display='none';
    setTimeout(renderReadingPaywall,100);
  }catch(e){
    var el=document.getElementById('readingText');
    if(el)el.textContent=buildFallbackReading(phase,mSign,sSign,profile);
  }finally{
    _readingInFlight=false;
    if(_readingQueue){_readingQueue=false;setTimeout(function(){generateReading(true);},1000);}
  }
}
function buildFallbackReading(phase,mSign,sSign,profile){
  const n=profile?.name?profile.name+', the':'The';
  return`${n} ${phase.name} carries ${mSign.element.toLowerCase()} energy — ${mSign.keywords}. With the Sun in ${sSign.name}, the day asks for ${sSign.keywords}. ${PHASE_TONES[phase.quarter]} The ${mSign.element} quality in you is your most reliable signal right now.`;
}

// ─── RENDER TODAY ─────────────────────────────────────────────────────────────
function renderToday(){
  try{

  const now=new Date(),phase=moonPhaseInfo(now),mSign=moonSignApprox(now),sSign=sunSignForDate(now),nm=prevNewMoon(now),dayInCycle=Math.floor((now-nm)/86400000)+1,profile=loadProfile();
  {const _e=document.getElementById('headerMoon');if(_e)_e.textContent=getSetting('icon',phase.emoji);}
  {const _e=document.getElementById('moonPhaseName');if(_e)_e.textContent=phase.name;}
  {const _e=document.getElementById('moonPhasePercent');if(_e)_e.textContent=`${phase.pct}% illuminated · Day ${Math.floor(phase.age)} of cycle`;}
  {const _e=document.getElementById('moonSign');if(_e)_e.textContent=`${mSign.symbol} ${mSign.name}`;}
  {const _e=document.getElementById('moonSignKeywords');if(_e)_e.textContent=mSign.keywords;}
  {const _e=document.getElementById('cycleDayNum');if(_e)_e.textContent=`Day ${dayInCycle}`;}
  {const _e=document.getElementById('cycleContext');if(_e)_e.textContent=`${dayInCycle} of ≈29 in current cycle`;}
  {const _e=document.getElementById('sunSign');if(_e)_e.textContent=`${sSign.symbol} ${sSign.name}`;}
  {const _e=document.getElementById('sunSignSub');if(_e)_e.textContent=`${sSign.element} · ${sSign.quality}`;}
  {const _e=document.getElementById('cycleTone');if(_e)_e.textContent=PHASE_TONES[phase.quarter]||'';}
  drawMoon(document.getElementById('moonSVG'),phase.age,56);
  // Toggle full-moon glow on the hero wrapper (~2-3 days around full)
  const heroLeft = document.querySelector('.moon-hero-left');
  if(heroLeft) heroLeft.classList.toggle('moon-full-glow', phase.pct >= 95);
  // Also populate The Sky section duplicates
  const moonSVG2 = document.getElementById('moonSVG2');
  if(moonSVG2) drawMoon(moonSVG2, phase.age, 40);
  const skyWrap = document.querySelector('.moon-svg-wrap');
  if(skyWrap){ skyWrap.style.position='relative'; skyWrap.classList.toggle('moon-full-glow', phase.pct >= 95); }
  const skyMPL = document.getElementById('skyMoonPhaseLabel');
  if(skyMPL) skyMPL.textContent = phase.name + ' · ' + phase.pct + '%';
  const sunSign2El = document.getElementById('sunSign2');
  if(sunSign2El) sunSign2El.textContent = sSign.symbol + ' ' + sSign.name;
  const bw=document.getElementById('natalBadgeWrap');
  if(bw){
    if(profile?.name){
      // Signed-in user with profile — show their natal badge
      const ns=sunSignForDate(new Date(profile.dob+'T12:00:00'));
      bw.innerHTML=`<div class="natal-badge" onclick="openOnboarding()">✦ ${profile.name} · ${ns.symbol} ${ns.name}${profile.rising?' · '+profile.rising+' Rising':''}</div>`;
    } else if(currentUser && !profile?.name){
      // Signed-in but no profile — show setup pill (profileNudge bar handles guests)
      bw.innerHTML=`<div class="natal-badge" onclick="openOnboarding()">✦ Add your birth profile for personalized readings</div>`;
    } else {
      // Guest — hide pill, profileNudge bar is the single CTA
      bw.innerHTML='';
    }
  }
  const planets=allPlanets(now);
  document.getElementById('planetGridToday').innerHTML=planets.slice(0,8).filter(p=>p&&p.sign).map(p=>`<div class="planet-card" onclick="openPlanetPopup('${p.name}','${p.symbol}','${p.sign?.name||''}',event)"><div style="display:flex;justify-content:space-between;align-items:start;"><div class="planet-name">${p.name}</div><div class="planet-symbol">${p.symbol}</div></div><div class="planet-sign">${p.sign.symbol||''} ${p.sign.name||''}</div><div class="planet-tap-hint">tap for influence</div></div>`).join('');
  generateReading(); // cached 8hrs
  updateToneLabel();
  renderIntentionBanner();
  fetchSpaceWeather(); // populates compact strip in Now
  renderCalendarEvents();
  renderDailyPatternMessage();
  renderEveningCheckin();
  renderStreak();
  renderInlineCycleCard();
  renderProfileNudge();
  setTimeout(renderTodayForecastCard, 200);
  // If today already has an entry, show submitted card not blank form
  const todayEntry = loadEntries()[entryKey(new Date())];
  if(todayEntry){
    showSubmittedCard(todayEntry);
  setTimeout(renderEveningCheckin, 100);
  } else {
    showEntryForm();
    setTimeout(initHeartbeats, 50);
    // Reset sliders to 5
    ['sliderEnergy','sliderMood','sliderClarity','sliderCreativity'].forEach(id => {
      const el = document.getElementById(id);
      if(el){ el.value = 5; updateSliderFill(el); }
      const valId = id.replace('slider','val');
      const valEl = document.getElementById(valId);
      if(valEl) valEl.textContent = '5';
    });
    // Clear text fields
    ['entryText','dreamText','intentionText','sadhanaText'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    // Clear quality selections
    document.querySelectorAll('#qualityTags .tag-btn.selected').forEach(b => b.classList.remove('selected'));
  }
  if(getSetting('showTransits',true))renderTransitAlerts(); else {var tw=document.getElementById('transitAlertsWrap');if(tw)tw.innerHTML='';}
  if(getSetting('showVedic',true)){
    renderVedicPanel();
    renderTzolkinPanel();
  } else {
    var vw=document.getElementById('vedicPanelWrap');if(vw)vw.innerHTML='';
    var tw2=document.getElementById('tzolkinPanelWrap');if(tw2)tw2.innerHTML='';
  }
  if(getSetting('showChinese',true)){
    renderChinesePanel();
  } else {
    var cw=document.getElementById('chinesePanelWrap');if(cw)cw.innerHTML='';
  }

  } catch(err){ console.error("renderToday error:", err); }
}

// ─── COMPARISON ───────────────────────────────────────────────────────────────
function renderComparison(){
  const now=new Date(),last=new Date(now.getTime()-29.53*86400000),lastKey=entryKey(last),todayKey=entryKey(now),entries=loadEntries(),tE=entries[todayKey],lE=entries[lastKey],nowPhase=moonPhaseInfo(now),lastPhase=moonPhaseInfo(last),nowMS=moonSignApprox(now),lastMS=moonSignApprox(last);
  document.getElementById('compareSubtitle').textContent=`${last.toLocaleDateString('en-US',{month:'long',day:'numeric'})} ↔ ${now.toLocaleDateString('en-US',{month:'long',day:'numeric'})}`;
  const metrics=[{n:'Energy',now:tE?.energy,last:lE?.energy},{n:'Mood',now:tE?.mood,last:lE?.mood},{n:'Clarity',now:tE?.clarity,last:lE?.clarity},{n:'Creativity',now:tE?.creativity,last:lE?.creativity}];
  function mHTML(label,val,comp){const delta=(val&&comp)?val-comp:null,dh=delta!==null?`<span class="compare-delta ${delta>0?'up':delta<0?'down':'same'}">${delta>0?'+':''}${delta}</span>`:'';return`<div class="compare-metric"><span class="compare-metric-name">${label}</span><span class="compare-metric-val">${val!==undefined?val+'/10':'—'}${dh}</span></div><div class="compare-bar"><div class="compare-bar-fill" style="width:${val?(val/10)*100:0}%"></div></div>`;}
  document.getElementById('comparisonGrid').innerHTML=`
    <div class="comparison-col"><div class="comparison-col-label">Last Cycle · ${last.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div><div style="font-size:20px;margin-bottom:4px;">${lastPhase.emoji}</div><div style="font-size:13px;color:rgba(245,240,232,.45);margin-bottom:14px;font-style:italic;">${lastPhase.name} · Moon in ${lastMS.name}</div>${metrics.map(m=>mHTML(m.n,m.last,m.now)).join('')}</div>
    <div class="comparison-col now"><div class="comparison-col-label">Today · ${now.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div><div style="font-size:20px;margin-bottom:4px;">${nowPhase.emoji}</div><div style="font-size:13px;color:rgba(245,240,232,.45);margin-bottom:14px;font-style:italic;">${nowPhase.name} · Moon in ${nowMS.name}</div>${metrics.map(m=>mHTML(m.n,m.now,m.last)).join('')}</div>`;
  const np=allPlanets(now).slice(0,5),lp=allPlanets(last).slice(0,5);
  document.getElementById('compareSkyContent').innerHTML=np.map((p,i)=>{const l=lp[i],moved=(p.sign?.name||'')!==(l.sign?.name||'');return`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(245,240,232,.05);"><span style="font-size:16px;min-width:22px;">${p.symbol}</span><span style="font-size:13px;color:rgba(245,240,232,.35);min-width:70px;">${p.name}</span><span style="font-size:14px;color:rgba(245,240,232,.4);">${l.sign?.symbol||''} ${l.sign?.name||''}</span><span style="font-size:11px;color:rgba(245,240,232,.2);margin:0 4px;">→</span><span style="font-size:14px;color:${moved?'rgba(201,168,76,.85)':'rgba(245,240,232,.55)'};">${p.sign?.symbol||''} ${p.sign?.name||''}</span>${moved?'<span style="font-size:10px;color:rgba(201,168,76,.5);margin-left:4px;font-family:Cinzel,serif;letter-spacing:.05em;">MOVED</span>':''}</div>`;}).join('');
  const tc=document.getElementById('compareTextContent');
  if(lE?.text){
    const isLong = lE.text.length > 300;
    const preview = lE.text.slice(0, 300);
    const qualHtml = lE.qualities?.length ? `<div class="entry-qualities" style="margin-top:10px;">${lE.qualities.map(q=>`<span class="quality-pill">${q}</span>`).join('')}</div>` : '';
    const intentHtml = lE.intention ? `<div style="margin-top:10px;font-size:13px;color:rgba(245,240,232,.35);font-style:italic;">Intention: ${lE.intention}</div>` : '';
    tc.innerHTML = `
      <div id="lcJournalWrap" style="cursor:${isLong?'pointer':'default'};" onclick="${isLong?'toggleLastCycleEntry()':''}">
        <div id="lcJournalText" style="font-size:15px;color:rgba(245,240,232,.6);line-height:1.8;font-style:italic;">"${preview}${isLong?'<span id="lcEllipsis">…</span>':''}"
          <span id="lcFullText" style="display:none;">${lE.text.slice(300)}</span>
        </div>
        ${isLong ? `<div id="lcExpandBtn" style="margin-top:8px;font-family:Cinzel,serif;font-size:10px;letter-spacing:.1em;color:rgba(201,168,76,.5);text-transform:uppercase;">Read full entry ▾</div>` : ''}
      </div>
      ${qualHtml}${intentHtml}`;
  }
  else tc.innerHTML=`<div style="color:rgba(245,240,232,.25);font-style:italic;font-size:15px;">No entry for ${last.toLocaleDateString('en-US',{month:'long',day:'numeric'})}. Begin recording now — the mirror fills itself forward.</div>`;
}

// ─── CYCLE CALENDAR ───────────────────────────────────────────────────────────
let cycleOffset=0;
function getCycleStart(offset){
  const SYN=29.53058867;
  let nm=prevNewMoon(new Date());
  if(offset<0){
    // Go back: subtract slightly less than one full period to land in previous cycle
    for(let i=0;i<-offset;i++) nm=prevNewMoon(new Date(nm.getTime()-(SYN-1)*86400000));
  } else {
    // Go forward: add slightly more than one period to land in next cycle
    for(let i=0;i<offset;i++) nm=prevNewMoon(new Date(nm.getTime()+(SYN+1)*86400000));
  }
  return nm;
}
function getCycleNum(date){return Math.floor((date-prevNewMoon(new Date(date.getFullYear(),0,1)))/86400000/29.53)+1;}
let calView = 'lunar';
let gregMonthOffset = 0;

function setCalView(view){
  calView = view;
  document.getElementById('calViewLunar').style.display = view==='lunar' ? 'block' : 'none';
  document.getElementById('calViewGreg').style.display = view==='greg' ? 'block' : 'none';
  document.getElementById('btnLunar').classList.toggle('active', view==='lunar');
  document.getElementById('btnGreg').classList.toggle('active', view==='greg');
  if(view==='greg') renderGregCalendar();
}

function renderCycle(){
  const nm=getCycleStart(cycleOffset),entries=loadEntries(),todayKey=entryKey(new Date()),ms=moonSignApprox(nm);
  document.getElementById('cycleLabel').textContent=`${ms.symbol} ${ms.name} Cycle`;
  document.getElementById('cycleNum').textContent=Math.max(1,Math.min(13,getCycleNum(nm)));
  const grid=document.getElementById('cycleGrid');grid.innerHTML='';
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Spacer cells so day 1 aligns with correct weekday column
  const nmDow = new Date(nm).getDay();
  for(let s=0; s<nmDow; s++){
    const sp=document.createElement('div');
    sp.className='day-cell';
    sp.style.cssText='background:none;border-color:transparent;cursor:default;pointer-events:none;';
    grid.appendChild(sp);
  }
  for(let i=0;i<29;i++){
    const d=new Date(nm);d.setDate(d.getDate()+i);
    const phase=moonPhaseInfo(d),key=entryKey(d),hasEntry=!!entries[key],isToday=key===todayKey,entry=entries[key];
    const ew=hasEntry&&entry.energy?(entry.energy/10)*100:0;
    const gregLabel=`${d.getDate()} ${MONTHS[d.getMonth()]}`;
    const cell=document.createElement('div');
    cell.className=`day-cell ${isToday?'today':''} ${hasEntry?'has-entry':''}`;
    // Menstrual cycle marker
    let cycleMarker = '';
    const cd2 = loadCycleData();
    if(cd2?.lastStart && cd2?.trackCycle){
      const cycleStart2 = new Date(cd2.lastStart + 'T00:00:00');
      const daysSince2 = Math.floor((d - cycleStart2) / 86400000);
      const cycLen2 = cd2.cycleLength || 28;
      const dayInC = ((daysSince2 % cycLen2) + cycLen2) % cycLen2 + 1;
      if(dayInC === 1) cycleMarker = '<span style="position:absolute;top:2px;right:2px;font-size:8px;" title="Period starts">🌸</span>';
      else if(dayInC <= 5) cycleMarker = '<span style="position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;background:rgba(200,100,130,.5);display:block;" title="Menstrual day '+dayInC+'"></span>';
      else if(dayInC >= 13 && dayInC <= 15) cycleMarker = '<span style="position:absolute;top:2px;right:2px;font-size:8px;" title="Ovulation window">✦</span>';
    }
    // Signs marker
    let signMarker='';
    const daySigns=(typeof getSignsLocal==='function')?getSignsLocal().filter(function(s){return s.timestamp&&s.timestamp.slice(0,10)===key;}):[];
    if(daySigns.length>0) signMarker='<span style="position:absolute;bottom:2px;right:2px;font-size:7px;color:rgba(201,168,76,.6);" title="'+daySigns.length+' sign'+(daySigns.length>1?'s':'')+'">'+'\u2726'.repeat(Math.min(daySigns.length,3))+'</span>';
    cell.style.position = 'relative';
    cell.innerHTML=`<span class="day-num">${i+1}</span><span class="day-moon">${phase.emoji}</span><span class="day-greg">${gregLabel}</span><div class="day-energy-bar" style="width:${ew}%"></div>${cycleMarker}${signMarker}`;
    cell.title=`${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · ${phase.name}`;
    cell.onclick=()=>openDayModal(d,entry,phase);
    grid.appendChild(cell);
  }
}

function prevCycle(){cycleOffset--;renderCycle();if(calView==='greg')renderGregCalendar();}
function nextCycle(){cycleOffset++;renderCycle();if(calView==='greg')renderGregCalendar();}

function prevGregMonth(){gregMonthOffset--;renderGregCalendar();}
function nextGregMonth(){gregMonthOffset++;renderGregCalendar();}

function renderGregCalendar(){
  const now=new Date(),entries=loadEntries(),todayKey=entryKey(now);
  const base=new Date(now.getFullYear(),now.getMonth()+gregMonthOffset,1);
  const year=base.getFullYear(),month=base.getMonth();
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('gregMonthLabel').textContent=`${MONTHS[month]} ${year}`;
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPrev=new Date(year,month,0).getDate();
  const grid=document.getElementById('gregGrid');grid.innerHTML='';
  const total=Math.ceil((firstDay+daysInMonth)/7)*7;
  for(let i=0;i<total;i++){
    let d,otherMonth=false;
    if(i<firstDay){d=new Date(year,month-1,daysInPrev-firstDay+i+1);otherMonth=true;}
    else if(i>=firstDay+daysInMonth){d=new Date(year,month+1,i-firstDay-daysInMonth+1);otherMonth=true;}
    else{d=new Date(year,month,i-firstDay+1);}
    const key=entryKey(d),hasEntry=!!entries[key],isToday=key===todayKey;
    const phase=moonPhaseInfo(d);
    const entry=entries[key];
    const ew=hasEntry&&entry&&entry.energy?(entry.energy/10)*100:0;
    const cell=document.createElement('div');
    cell.className=`greg-cell ${isToday?'greg-today':''} ${otherMonth?'greg-other-month':''} ${hasEntry?'greg-has-entry':''}`;
    const gKey=entryKey(d);
    const gSigns=(typeof getSignsLocal==='function')?getSignsLocal().filter(function(s){return s.timestamp&&s.timestamp.slice(0,10)===gKey;}):[];
    const gSignMark=gSigns.length>0?'<span style="position:absolute;bottom:1px;right:2px;font-size:6px;color:rgba(201,168,76,.6);">\u2726</span>':'';
    cell.style.position='relative';
    cell.innerHTML=`<div class="greg-day-moon">${phase.emoji}</div><div class="greg-day-num">${d.getDate()}</div><div class="greg-energy-bar" style="width:${ew}%"></div>${gSignMark}`;
    cell.title=`${d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · ${phase.name}`;
    cell.onclick=()=>openDayModal(d,entry,phase);
    grid.appendChild(cell);
  }
}

// ─── GOOGLE CALENDAR EXPORT ───────────────────────────────────────────────────
function exportToGCal(){
  const nm=getCycleStart(cycleOffset);
  const cycleEnd=new Date(nm.getTime()+29.53*86400000);
  const ms=moonSignApprox(nm);
  const fullMoonDate=new Date(nm.getTime()+14.77*86400000);

  // Build ICS file with key cycle events
  const events = [
    {
      title:`🌑 New Moon — ${ms.name} Cycle begins`,
      date: nm,
      description:`Lunations cycle ${getCycleNum(nm)} of 13. Moon enters ${ms.name}. Set your intention for the lunation.`
    },
    {
      title:`🌓 First Quarter`,
      date: new Date(nm.getTime()+7.38*86400000),
      description:`First quarter moon. Action and building phase. Push forward on your cycle intention.`
    },
    {
      title:`🌕 Full Moon`,
      date: fullMoonDate,
      description:`Full moon illumination. Peak energy. Release, celebrate, offer.`
    },
    {
      title:`🌗 Last Quarter`,
      date: new Date(nm.getTime()+22.15*86400000),
      description:`Last quarter moon. Release and integrate. What needs to be composted?`
    },
    {
      title:`🌑 New Moon — Cycle ends`,
      date: cycleEnd,
      description:`End of lunation cycle. New cycle begins.`
    },
  ];

  function toICSDate(d){
    return d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  }

  let ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lunations//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  events.forEach((ev,i) => {
    const uid=`lunations-${entryKey(nm)}-${i}@lunations.app`;
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${uid}`);
    ics.push(`DTSTART:${toICSDate(ev.date)}`);
    ics.push(`DTEND:${toICSDate(new Date(ev.date.getTime()+3600000))}`);
    ics.push(`SUMMARY:${ev.title}`);
    ics.push(`DESCRIPTION:${ev.description}`);
    ics.push('END:VEVENT');
  });
  ics.push('END:VCALENDAR');

  const blob=new Blob([ics.join('\r\n')],{type:'text/calendar'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`lunations-cycle-${entryKey(nm)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✦ Calendar exported — open the .ics file to import into Google Calendar');
}

// ─── DAY MODAL ────────────────────────────────────────────────────────────────
function openDayModal(date,entry,phase){
  const dateStr=date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}),ms=moonSignApprox(date);
  document.getElementById('modalTitle').textContent=dateStr;
  let c=`<div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;"><span style="font-size:36px">${phase.emoji}</span><div><div style="font-size:16px;color:rgba(245,240,232,.8);">${phase.name}</div><div style="font-size:13px;color:rgba(245,240,232,.4);font-style:italic;">${ms.symbol} ${ms.name} · ${phase.pct}% illuminated</div></div></div>`;
  if(entry){c+=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;"><div><div class="card-label">Energy</div><div style="font-size:22px;color:rgba(245,240,232,.8);">${entry.energy}/10</div></div><div><div class="card-label">Mood</div><div style="font-size:22px;color:rgba(245,240,232,.8);">${entry.mood}/10</div></div><div><div class="card-label">Clarity</div><div style="font-size:22px;color:rgba(245,240,232,.8);">${entry.clarity||5}/10</div></div><div><div class="card-label">Creativity</div><div style="font-size:22px;color:rgba(245,240,232,.8);">${entry.creativity||5}/10</div></div></div>`;if(entry.qualities?.length)c+=`<div style="margin-bottom:14px;">${entry.qualities.map(q=>`<span class="quality-pill">${q}</span>`).join(' ')}</div>`;if(entry.dream)c+=`<div class="card-label" style="margin-bottom:6px;">Dreams</div><div style="font-size:15px;color:rgba(245,240,232,.6);font-style:italic;line-height:1.7;margin-bottom:14px;">${entry.dream}</div>`;if(entry.text)c+=`<div class="card-label" style="margin-bottom:6px;">Reflection</div><div style="font-size:15px;color:rgba(245,240,232,.65);line-height:1.75;">${entry.text}</div>`;if(entry.sadhana)c+=`<div class="card-label" style="margin-top:14px;margin-bottom:6px;">Sadhana</div><div style="font-size:15px;color:rgba(245,240,232,.5);font-style:italic;line-height:1.7;">${entry.sadhana}</div>`;
  if(entry.intention)c+=`<div class="card-label" style="margin-top:14px;margin-bottom:6px;">Intention</div><div style="font-size:15px;color:rgba(245,240,232,.5);font-style:italic;line-height:1.7;">${entry.intention}</div>`;}
  else{c+=`<div style="color:rgba(245,240,232,.3);font-style:italic;font-size:15px;">No entry for this day.</div>`;}

  // Add edit button to all past entries
  const isToday2 = entryKey(date) === entryKey(new Date());
  if(entry){
    c += `<button class="save-btn" style="margin-top:20px;font-size:10px;" onclick="closeModal();editEntry('${entryKey(date)}')">✎ Edit Morning Entry</button>`;
  } else if(!isToday2){
    c += `<button class="save-btn" style="margin-top:16px;font-size:10px;" onclick="closeModal();editEntry('${entryKey(date)}')">+ Add Entry for This Day</button>`;
  }

  // Evening entry section in modal
  const eveEntries = loadEveningEntries();
  const eveKey = entryKey(date);
  const eveEntry = eveEntries[eveKey] || (entry?.eveTimestamp ? {
    energy: entry.eveEnergy, mood: entry.eveMood,
    clarity: entry.eveClarity, creativity: entry.eveCreativity,
    text: entry.eveText, timestamp: entry.eveTimestamp,
  } : null);

  if(eveEntry){
    const eveMetrics = ['Energy','Mood','Clarity','Creativity']
      .map((m,i) => {
        const val = [eveEntry.energy,eveEntry.mood,eveEntry.clarity,eveEntry.creativity][i];
        if(!val) return '';
        return '<div style="text-align:center;"><div style="font-family:Cinzel,serif;font-size:16px;color:rgba(160,120,220,.8);">'+val+'</div><div style="font-size:9px;color:rgba(245,240,232,.3);">'+m+'</div></div>';
      }).join('');
    c += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(120,90,160,.2);">' +
      '<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.12em;color:rgba(160,120,220,.6);text-transform:uppercase;margin-bottom:12px;">🌙 Evening</div>' +
      '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;">' + eveMetrics + '</div>' +
      (eveEntry.text ? '<div style="font-size:15px;color:rgba(245,240,232,.45);line-height:1.75;font-style:italic;">'+eveEntry.text+'</div>' : '') +
      '<button class="save-btn" style="margin-top:12px;font-size:10px;border-color:rgba(140,100,200,.3);color:rgba(160,120,220,.7);" onclick="closeModal();openEveningEditor(\'' + eveKey + '\')">✎ Edit Evening Entry</button>' +
      '</div>';
  } else if(entry) {
    c += '<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(120,90,160,.15);">' +
      '<button class="save-btn" style="font-size:10px;border-color:rgba(140,100,200,.25);color:rgba(160,120,220,.5);" onclick="closeModal();openEveningEditor(\'' + eveKey + '\')">🌙 Add Evening Entry</button>' +
      '</div>';
  }
  // Signs logged on this day
  const modalDayKey=entryKey(date);
  const modalSigns=(typeof getSignsLocal==='function')?getSignsLocal().filter(function(s){return s.timestamp&&s.timestamp.slice(0,10)===modalDayKey;}):[];
  if(modalSigns.length>0){
    c+='<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(201,168,76,.12);">';
    c+='<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.12em;color:rgba(201,168,76,.5);text-transform:uppercase;margin-bottom:10px;">\u2726 Signs ('+modalSigns.length+')</div>';
    modalSigns.forEach(function(s){
      var t=new Date(s.timestamp);
      var ts=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var tags=(s.categories||[]).map(function(cat){return'<span style="font-size:10px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.15);border-radius:10px;padding:1px 8px;color:rgba(201,168,76,.5);">'+cat+'</span>';}).join(' ');
      c+='<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,.06);">';
      c+='<div style="font-size:14px;color:rgba(245,240,232,.65);line-height:1.6;">'+sanitizeAIText(s.text)+'</div>';
      if(s.context)c+='<div style="font-size:12px;color:rgba(245,240,232,.3);font-style:italic;margin-top:2px;">while: '+sanitizeAIText(s.context)+'</div>';
      c+='<div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap;"><span style="font-size:10px;color:rgba(245,240,232,.2);">'+ts+' \u00b7 '+sanitizeAIText(s.moon_phase||'')+'</span>'+tags+'</div>';
      c+='</div>';
    });
    c+='</div>';
  }
  document.getElementById('modalContent').innerHTML=c;document.getElementById('dayModal').classList.add('open');
}
function closeModal(){document.getElementById('dayModal').classList.remove('open');}
document.getElementById('dayModal').onclick=function(e){if(e.target===this)closeModal();};

// ─── QUALITIES ────────────────────────────────────────────────────────────────
const QUALITIES=['Expansive','Contracted','Grounded','Scattered','Luminous','Shadowed','Creative','Receptive','Devotional','Restless','Visionary','Earthed','Sensual','Ascetic','Connected','Isolated','Fierce','Tender','Dreaming','Awake','Grateful','Grieving','Inspired','Depleted'];
function renderQualityTags(){document.getElementById('qualityTags').innerHTML=QUALITIES.map(q=>`<button class="tag-btn" onclick="this.classList.toggle('selected')">${q}</button>`).join('');}
function selectedQualities(){return[...document.querySelectorAll('#qualityTags .tag-btn.selected')].map(b=>b.textContent);}

// ─── SAVE ENTRY ───────────────────────────────────────────────────────────────
function saveEntry(){
  const now=new Date(),key=entryKey(now),entries=loadEntries();
  const phase=moonPhaseInfo(now),mSign=moonSignApprox(now),sSign=sunSignForDate(now);
  const tithi=getTithi(now),nakshatra=getNakshatra(now),vara=getVara(now);
  const transits=getTransitAlerts().map(a=>a.title);
  const planets=allPlanets(now).filter(p=>p&&p.sign).slice(0,6).map(p=>p.name+' in '+(p.sign?.name||''));
  entries[key]={
    ...(entries[key]||{}),
    energy:+document.getElementById('sliderEnergy').value,
    mood:+document.getElementById('sliderMood').value,
    clarity:+document.getElementById('sliderClarity').value,
    creativity:+document.getElementById('sliderCreativity').value,
    qualities:selectedQualities(),
    text:document.getElementById('entryText').value.trim(),
    dream:document.getElementById('dreamText').value.trim(),
    intention:document.getElementById('intentionText').value.trim(),
    phase:phase.name,
    phaseAge:Math.floor(phase.age),
    phasePct:phase.pct,
    moonSign:mSign.name,
    sunSign:sSign.name,
    tithi:tithi.num+' '+tithi.name,
    tithiQuality:tithi.quality,
    nakshatra:nakshatra.name,
    nakshatraPada:nakshatra.pada,
    vara:vara.name,
    planets:planets,
    activeTransits:transits,
    timestamp:now.toISOString(),
    sadhana:(document.getElementById('sadhanaText')?.value||'').trim(),
  };
  // Record morning snapshot
  var snaps=entries[key].snapshots||[];
  snaps.push({type:'morning',time:now.toISOString(),energy:entries[key].energy,mood:entries[key].mood,clarity:entries[key].clarity,creativity:entries[key].creativity});
  entries[key].snapshots=snaps;
  try{ saveEntries(entries); }catch(e){ console.error('Save failed:', e); showToast('Storage full — entry saved to cloud only'); }
  pushEntryToCloud(key, entries[key]);
  showSubmittedCard(entries[key]);
  setTimeout(function(){setLogMode('daylog');},150);
  // Auto-backup to localStorage secondary key
  // localStorage.setItem('lunations_v1'+key, JSON.stringify(entries[key]));
}

// ─── ENTRIES LIST ─────────────────────────────────────────────────────────────
function renderEntries(){
  const allEntries = loadEntries();
  const container = document.getElementById('entriesList');
  const search = (document.getElementById('entrySearch')?.value||'').toLowerCase();
  const phaseFilter = document.getElementById('entryPhaseFilter')?.value||'';
  const groupBy = document.getElementById('entryGroupBy')?.value||'cycle';

  // Filter
  let keys = Object.keys(allEntries).sort((a,b)=>b.localeCompare(a));
  if(phaseFilter) keys = keys.filter(k => allEntries[k].phase === phaseFilter);
  if(search) keys = keys.filter(k => {
    const e = allEntries[k];
    return (e.text||'').toLowerCase().includes(search) ||
           (e.dream||'').toLowerCase().includes(search) ||
           (e.qualities||[]).some(q=>q.toLowerCase().includes(search)) ||
           (e.phase||'').toLowerCase().includes(search) ||
           (e.moonSign||'').toLowerCase().includes(search) ||
           k.includes(search);
  });

  if(!keys.length){
    container.innerHTML = `<div class="entries-empty">${search||phaseFilter ? 'No entries match this filter.' : 'The record is empty. Begin your first entry today.'}</div>`;
    return;
  }

  // Stats bar
  const totalEntries = Object.keys(allEntries).length;
  const avgEnergy = (Object.values(allEntries).reduce((s,e)=>s+(e.energy||0),0)/totalEntries).toFixed(1);
  const avgMood = (Object.values(allEntries).reduce((s,e)=>s+(e.mood||0),0)/totalEntries).toFixed(1);
  const firstDate = Object.keys(allEntries).sort()[0];
  const daysSince = firstDate ? Math.floor((new Date()-new Date(firstDate+'T12:00:00'))/86400000) : 0;

  let html = `<div class="entries-stats">
    <div class="entries-stat"><span class="entries-stat-val">${totalEntries}</span><span class="entries-stat-label">entries</span></div>
    <div class="entries-stat"><span class="entries-stat-val">${daysSince}</span><span class="entries-stat-label">days recorded</span></div>
    <div class="entries-stat"><span class="entries-stat-val">${avgEnergy}</span><span class="entries-stat-label">avg energy</span></div>
    <div class="entries-stat"><span class="entries-stat-val">${avgMood}</span><span class="entries-stat-label">avg mood</span></div>
  </div>`;

  // Group entries
  const groups = {};
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  keys.forEach(k => {
    const d = new Date(k+'T12:00:00');
    let groupKey, groupLabel;

    if(groupBy === 'cycle'){
      const nm = prevNewMoon(d);
      groupKey = nm.toISOString().slice(0,10);
      const ms = moonSignApprox(nm);
      const cycleNum = getCycleNum(nm);
      const nmStr = nm.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const endStr = new Date(nm.getTime()+29.53*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      groupLabel = `${ms.symbol} ${ms.name} Cycle · ${nmStr}–${endStr} · Cycle ${Math.max(1,Math.min(13,cycleNum))} of ${d.getFullYear()}`;
    } else if(groupBy === 'month'){
      groupKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
      groupLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      groupKey = String(d.getFullYear());
      groupLabel = String(d.getFullYear());
    }

    if(!groups[groupKey]) groups[groupKey] = { label:groupLabel, keys:[] };
    groups[groupKey].keys.push(k);
  });

  // Render groups — newest first
  const groupKeys = Object.keys(groups).sort((a,b)=>b.localeCompare(a));

  groupKeys.forEach((gk, gi) => {
    const group = groups[gk];
    const gEntries = group.keys.map(k=>allEntries[k]);
    const avgE = (gEntries.reduce((s,e)=>s+(e.energy||0),0)/gEntries.length).toFixed(1);
    const avgM = (gEntries.reduce((s,e)=>s+(e.mood||0),0)/gEntries.length).toFixed(1);
    const isCollapsed = gi > 1; // collapse older groups by default

    html += `<div class="entries-group">
      <div class="entries-group-header" onclick="toggleGroup('grp-${gi}')">
        <div class="entries-group-title">${group.label}</div>
        <div class="entries-group-meta">
          <span>${group.keys.length} entries</span>
          <span>⚡${avgE} · 🌙${avgM}</span>
          <span class="entries-group-toggle ${isCollapsed?'collapsed':''}">▾</span>
        </div>
      </div>
      <div class="entries-group-body ${isCollapsed?'collapsed':''}" id="grp-${gi}" style="max-height:${isCollapsed?'0':'9999px'}">`;

    group.keys.forEach(k => {
      const e = allEntries[k];
      const d = new Date(k+'T12:00:00');
      const phase = moonPhaseInfo(d);
      const preview = (e.text||'').slice(0,100) + ((e.text||'').length>100?'…':'');
      const eData = JSON.stringify(e).replace(/'/g,"\'");
      const pData = JSON.stringify(phase).replace(/'/g,"\'");
      // Store entry in cache to avoid JSON-in-template issues
      window._ec = window._ec || {};
      window._ec[k] = {e, phase};
      html += `<div class="entry-item" data-ekey="${k}" onclick="(function(el){const d=el.getAttribute('data-ekey');const c=window._ec&&window._ec[d];if(c)openDayModal(new Date(d+'T12:00:00'),c.e,c.phase);})(this)">
        <div class="entry-date-col" style="text-align:center;">
          <span class="entry-moon-icon">${phase.emoji}</span>
          <span class="entry-date-num">${d.getDate()}</span>
          <span class="entry-date-month">${d.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
        </div>
        <div class="entry-content-col">
          <div class="entry-meta">
            <span class="entry-badge badge-energy">⚡${e.energy}</span>
            <span class="entry-badge badge-mood">🌙${e.mood}</span>
            <span style="font-size:12px;color:rgba(245,240,232,.25);font-style:italic;">${e.phase||''}${e.moonSign?' · '+e.moonSign:''}</span>
          </div>
          ${preview?`<div class="entry-text-preview">${preview}</div>`:''}
          ${e.qualities?.length?`<div class="entry-qualities" style="margin-top:5px;">${e.qualities.map(q=>`<span class="quality-pill">${q}</span>`).join('')}</div>`:''}
          ${e.activeTransits?.length?`<div style="font-size:11px;color:rgba(201,168,76,.35);margin-top:4px;font-style:italic;">${e.activeTransits[0]}</div>`:''}
        </div>
      </div>`;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

function toggleGroup(id){
  const body = document.getElementById(id);
  const header = body.previousElementSibling;
  const toggle = header.querySelector('.entries-group-toggle');
  const isCollapsed = body.classList.contains('collapsed');
  body.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed');
  body.style.maxHeight = isCollapsed ? '9999px' : '0';
}

// --- PATTERNS ---
let patternMonths = 1;
let chartInstances = {};

function setPatternRange(months, btn){
  patternMonths = months;
  document.querySelectorAll('.pattern-range-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPatterns();
}

function getFilteredEntries(months){
  const all = loadEntries();
  if(!months) return all; // 0 = all time
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffKey = entryKey(cutoff);
  return Object.fromEntries(Object.entries(all).filter(([k]) => k >= cutoffKey));
}

function getPreviousPeriodEntries(months){
  if(!months) return {};
  const all = loadEntries();
  const end = new Date(); end.setMonth(end.getMonth() - months);
  const start = new Date(end); start.setMonth(start.getMonth() - months);
  const endKey = entryKey(end), startKey = entryKey(start);
  return Object.fromEntries(Object.entries(all).filter(([k]) => k >= startKey && k < endKey));
}

function avg(arr){ return arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : 0; }

function renderPatterns(){
  const entries = getFilteredEntries(patternMonths);
  const keys = Object.keys(entries).sort();
  const showComp = document.getElementById('showComparison')?.checked;
  const prevEntries = showComp ? getPreviousPeriodEntries(patternMonths) : {};
  const prevKeys = Object.keys(prevEntries).sort();
  const container = document.getElementById('patternInsights');

  if(keys.length < 3){
    if(container) container.innerHTML = '<div class="empty-state">Record at least a few entries to see patterns emerge.</div>';
    return;
  }

  const PHASES = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  const PHASE_SHORT = ['New','Wax.Cres','1st Qtr','Wax.Gib','Full','Wan.Gib','Last Qtr','Wan.Cres'];
  const PHASE_EMOJIS = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];

  // Build phase data
  const phaseData = {};
  PHASES.forEach(p => { phaseData[p] = {energy:[],mood:[],clarity:[],creativity:[]}; });
  keys.forEach(k => {
    const e = entries[k];
    if(phaseData[e.phase]){
      phaseData[e.phase].energy.push(e.energy||0);
      phaseData[e.phase].mood.push(e.mood||0);
      phaseData[e.phase].clarity.push(e.clarity||5);
      phaseData[e.phase].creativity.push(e.creativity||5);
    }
  });

  const chartOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'rgba(245,240,232,.5)',font:{family:'EB Garamond',size:13},boxWidth:12}}},
    scales:{
      x:{ticks:{color:'rgba(245,240,232,.4)',font:{size:10},maxRotation:45},grid:{color:'rgba(245,240,232,.04)'}},
      y:{min:0,max:10,ticks:{color:'rgba(245,240,232,.4)',font:{size:10}},grid:{color:'rgba(245,240,232,.05)'}}
    }
  };

  function mk(id,cfg){
    if(chartInstances[id]) chartInstances[id].destroy();
    const ctx = document.getElementById(id);
    if(ctx) chartInstances[id] = new Chart(ctx, cfg);
  }

  // ── PHASE ENERGY CHART ───────────────────────────────────────────────────
  const phaseLabels = PHASES.filter(p => phaseData[p].energy.length > 0);
  const phaseEmojis = phaseLabels.map(p => PHASE_EMOJIS[PHASES.indexOf(p)] + ' ' + PHASE_SHORT[PHASES.indexOf(p)]);
  const phaseEn = phaseLabels.map(p => avg(phaseData[p].energy));
  const phaseMo = phaseLabels.map(p => avg(phaseData[p].mood));

  // Previous period comparison
  const prevPhaseData = {};
  PHASES.forEach(p => { prevPhaseData[p] = {energy:[],mood:[]}; });
  prevKeys.forEach(k => {
    const e = prevEntries[k];
    if(prevPhaseData[e.phase]){ prevPhaseData[e.phase].energy.push(e.energy||0); prevPhaseData[e.phase].mood.push(e.mood||0); }
  });
  const prevPhaseEn = phaseLabels.map(p => avg(prevPhaseData[p].energy));
  const prevPhaseMo = phaseLabels.map(p => avg(prevPhaseData[p].mood));

  const phaseDatasets = [
    {label:'Energy',data:phaseEn,backgroundColor:'rgba(201,168,76,.45)',borderColor:'rgba(201,168,76,.8)',borderWidth:1.5},
    {label:'Mood',data:phaseMo,backgroundColor:'rgba(180,100,80,.35)',borderColor:'rgba(200,130,100,.7)',borderWidth:1.5},
  ];
  if(showComp && prevKeys.length){
    phaseDatasets.push({label:'Energy (prev)',data:prevPhaseEn,backgroundColor:'rgba(201,168,76,.15)',borderColor:'rgba(201,168,76,.3)',borderWidth:1,borderDash:[4,3]});
    phaseDatasets.push({label:'Mood (prev)',data:prevPhaseMo,backgroundColor:'rgba(180,100,80,.12)',borderColor:'rgba(200,130,100,.3)',borderWidth:1,borderDash:[4,3]});
  }
  mk('phaseEnergyChart',{type:'bar',data:{labels:phaseEmojis,datasets:phaseDatasets},options:{...chartOpts,plugins:{...chartOpts.plugins,legend:{display:true,labels:{color:'rgba(245,240,232,.4)',font:{size:11},boxWidth:10}}}}});

  // ── ARC CHART (energy + mood over time) ──────────────────────────────────
  const arcTitle = document.getElementById('arcChartTitle');
  const rangeLabel = patternMonths ? `Last ${patternMonths} Month${patternMonths>1?'s':''}` : 'All Time';
  if(arcTitle) arcTitle.textContent = `Energy & Mood — ${rangeLabel}`;

  // Sample down if too many points
  let arcKeys = keys;
  if(arcKeys.length > 60) {
    const step = Math.floor(arcKeys.length / 60);
    arcKeys = arcKeys.filter((_,i) => i % step === 0);
  }
  const arcLabels = arcKeys.map(k => {
    const d = new Date(k+'T12:00:00');
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  });
  const arcEn = arcKeys.map(k => entries[k].energy||0);
  const arcMo = arcKeys.map(k => entries[k].mood||0);

  const arcDatasets = [
    {label:'Energy',data:arcEn,borderColor:'rgba(201,168,76,.8)',backgroundColor:'rgba(201,168,76,.06)',tension:.35,pointRadius:arcKeys.length>30?0:3,fill:true},
    {label:'Mood',data:arcMo,borderColor:'rgba(200,130,100,.7)',backgroundColor:'rgba(200,130,100,.05)',tension:.35,pointRadius:arcKeys.length>30?0:3,fill:true},
  ];

  if(showComp && prevKeys.length){
    let prevArcKeys = prevKeys;
    if(prevArcKeys.length > 60){ const step=Math.floor(prevArcKeys.length/60); prevArcKeys=prevArcKeys.filter((_,i)=>i%step===0); }
    arcDatasets.push({label:'Energy (prev)',data:prevArcKeys.map(k=>prevEntries[k].energy||0),borderColor:'rgba(201,168,76,.25)',backgroundColor:'transparent',tension:.35,pointRadius:0,borderDash:[4,3]});
    arcDatasets.push({label:'Mood (prev)',data:prevArcKeys.map(k=>prevEntries[k].mood||0),borderColor:'rgba(200,130,100,.25)',backgroundColor:'transparent',tension:.35,pointRadius:0,borderDash:[4,3]});
  }

  // Add Kp index overlay if we have cached space weather history
  try{
    const swCache = JSON.parse(localStorage.getItem(SWK)||'null');
    if(swCache && swCache.kp && swCache.kp.history && swCache.kp.history.length > 1){
      // Kp history is last 24h — only overlay if range is 1M
      if(patternMonths === 1 && arcKeys.length > 0){
        const kpHist = swCache.kp.history;
        // Scale Kp 0-9 to match our 1-10 scale visually
        const kpScaled = kpHist.map(h => (h.kp/9)*10);
        // Align to end of arcKeys
        const kpLabels = kpHist.map((_,i) => 'Kp-' + i);
        arcDatasets.push({
          label:'Kp Index (24h)',
          data: new Array(Math.max(0, arcKeys.length - kpScaled.length)).fill(null).concat(kpScaled),
          borderColor:'rgba(100,180,220,.5)',
          backgroundColor:'transparent',
          tension:.3,
          pointRadius:0,
          borderWidth:1,
          borderDash:[2,4],
        });
      }
    }
  } catch(e){}

  mk('arcChart',{type:'line',data:{labels:arcLabels,datasets:arcDatasets},options:{...chartOpts,scales:{...chartOpts.scales,x:{...chartOpts.scales.x,ticks:{...chartOpts.scales.x.ticks,maxTicksLimit:8}}}}});

  // ── CLARITY & CREATIVITY ARC ─────────────────────────────────────────────
  const clarArcEn = arcKeys.map(k => entries[k].clarity||5);
  const clarArcCr = arcKeys.map(k => entries[k].creativity||5);
  mk('clarityArcChart',{type:'line',data:{labels:arcLabels,datasets:[
    {label:'Clarity',data:clarArcEn,borderColor:'rgba(120,160,210,.7)',backgroundColor:'rgba(120,160,210,.05)',tension:.35,pointRadius:0,fill:true},
    {label:'Creativity',data:clarArcCr,borderColor:'rgba(160,120,200,.7)',backgroundColor:'rgba(160,120,200,.05)',tension:.35,pointRadius:0,fill:true},
  ]},options:{...chartOpts,scales:{...chartOpts.scales,x:{...chartOpts.scales.x,ticks:{...chartOpts.scales.x.ticks,maxTicksLimit:8}}}}});

  // ── PHASE FINGERPRINT ────────────────────────────────────────────────────
  const fpContainer = document.getElementById('phaseFingerprint');
  if(fpContainer){
    const maxVal = 10;
    fpContainer.innerHTML = PHASES.map((p,i) => {
      const enArr = phaseData[p].energy, moArr = phaseData[p].mood;
      if(!enArr.length) return '';
      const enAvg = avg(enArr), moAvg = avg(moArr);
      const enW = (enAvg/maxVal)*100, moW = (moAvg/maxVal)*100;
      return `<div class="phase-fingerprint-row">
        <div class="phase-fingerprint-label">${PHASE_EMOJIS[i]} ${p.replace(' Moon','').replace('ing ','')}</div>
        <div style="flex:1;">
          <div class="phase-fingerprint-bar-wrap" style="margin-bottom:3px;">
            <div class="phase-fingerprint-bar energy" style="width:${enW}%"></div>
          </div>
          <div class="phase-fingerprint-bar-wrap">
            <div class="phase-fingerprint-bar mood" style="width:${moW}%"></div>
          </div>
        </div>
        <div class="phase-fingerprint-val">${enAvg}/${moAvg}</div>
        <div style="font-size:10px;color:rgba(245,240,232,.2);min-width:28px;">${enArr.length}d</div>
      </div>`;
    }).join('');
  }

  // ── STATS SUMMARY ────────────────────────────────────────────────────────
  const allEn = keys.map(k=>entries[k].energy||0);
  const allMo = keys.map(k=>entries[k].mood||0);
  const allCl = keys.map(k=>entries[k].clarity||5);
  const allCr = keys.map(k=>entries[k].creativity||5);
  const prevAllEn = prevKeys.map(k=>prevEntries[k]?.energy||0);
  const prevAllMo = prevKeys.map(k=>prevEntries[k]?.mood||0);

  function deltaHTML(curr, prev){
    if(!prev || !prev.length) return '';
    const d = (curr - avg(prev)).toFixed(1);
    const cls = d>0?'up':d<0?'down':'same';
    return `<div class="stat-card-delta ${cls}">${d>0?'↑':'↓'} ${Math.abs(d)} vs prev</div>`;
  }

  const bestPhase = phaseLabels.reduce((best,p) => avg(phaseData[p].energy) > avg(phaseData[best]?.energy||[0]) ? p : best, phaseLabels[0]);
  const hardPhase = phaseLabels.reduce((hard,p) => avg(phaseData[p].energy) < avg(phaseData[hard]?.energy||[10]) ? p : hard, phaseLabels[0]);
  const streak = calcStreak(keys);

  const statsEl = document.getElementById('patternStats');
  if(statsEl) statsEl.innerHTML = [
    {val:keys.length, label:'Entries', delta:''},
    {val:avg(allEn).toFixed(1), label:'Avg Energy', delta:deltaHTML(avg(allEn),prevAllEn)},
    {val:avg(allMo).toFixed(1), label:'Avg Mood', delta:deltaHTML(avg(allMo),prevAllMo)},
    {val:avg(allCl).toFixed(1), label:'Avg Clarity', delta:''},
    {val:streak+'d', label:'Current Streak', delta:''},
    {val:PHASE_EMOJIS[PHASES.indexOf(bestPhase)]||'🌕', label:'Peak Phase', delta:''},
  ].map(s => `<div class="stat-card"><span class="stat-card-val">${s.val}</span><div class="stat-card-label">${s.label}</div>${s.delta}</div>`).join('');

  // ── PATTERN OBSERVATIONS ─────────────────────────────────────────────────
  renderPatternObservations(entries, keys, phaseData, PHASES, PHASE_EMOJIS);

  // ── AI PATTERN INSIGHT ───────────────────────────────────────────────────
  generatePatternInsight();
}

function calcStreak(sortedKeys){
  if(!sortedKeys.length) return 0;
  const today = entryKey(new Date());
  let streak = 0, check = new Date();
  for(let i=0;i<sortedKeys.length+1;i++){
    const k = entryKey(check);
    if(sortedKeys.includes(k)){ streak++; check.setDate(check.getDate()-1); }
    else if(k === today){ check.setDate(check.getDate()-1); } // allow today being missing
    else break;
  }
  return streak;
}

function renderPatternObservations(entries, keys, phaseData, PHASES, PHASE_EMOJIS){
  const obs = [];
  const avgFn = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

  // Check for consistent low phases
  PHASES.forEach((p,i) => {
    const en = phaseData[p].energy;
    if(en.length >= 2 && avgFn(en) < 4){
      obs.push({type:'warning', icon:PHASE_EMOJIS[i],
        title:`Low energy pattern — ${p}`,
        text:`Across ${en.length} ${p} days in this period, your energy averaged ${avgFn(en).toFixed(1)}/10. This phase consistently challenges you. Consider protecting rest during ${p}.`});
    }
  });

  // Check for peak phases
  PHASES.forEach((p,i) => {
    const en = phaseData[p].energy;
    if(en.length >= 2 && avgFn(en) > 7.5){
      obs.push({type:'positive', icon:PHASE_EMOJIS[i],
        title:`Peak phase — ${p}`,
        text:`Your energy averages ${avgFn(en).toFixed(1)}/10 during ${p}. This is when you're most alive. Plan important work, creative sessions, and social commitments here.`});
    }
  });

  // Mood vs energy gap
  const allEn = keys.map(k=>entries[k].energy||0);
  const allMo = keys.map(k=>entries[k].mood||0);
  const enAvg = avgFn(allEn), moAvg = avgFn(allMo);
  if(Math.abs(enAvg - moAvg) > 1.5){
    if(enAvg > moAvg){
      obs.push({type:'insight', icon:'⚡',
        title:'Energy runs ahead of mood',
        text:`Your energy (${enAvg.toFixed(1)}) consistently outpaces your mood (${moAvg.toFixed(1)}). You have physical vitality but emotional weight. The body wants to move while something in the heart needs tending.`});
    } else {
      obs.push({type:'insight', icon:'🌙',
        title:'Mood runs ahead of energy',
        text:`Your emotional state (${moAvg.toFixed(1)}) consistently outpaces your physical energy (${enAvg.toFixed(1)}). You feel more than your body can hold. Rest and embodiment practices would serve you.`});
    }
  }

  // Creativity trend
  const crKeys = keys.slice(-14);
  const crRecent = avgFn(crKeys.map(k=>entries[k].creativity||5));
  const crEarly = avgFn(keys.slice(0,14).map(k=>entries[k].creativity||5));
  if(crKeys.length >= 7 && crRecent - crEarly > 1){
    obs.push({type:'positive', icon:'🔥',
      title:'Creativity is rising',
      text:`Your creativity scores have increased by ${(crRecent-crEarly).toFixed(1)} points over this period. Something is opening.`});
  } else if(crKeys.length >= 7 && crEarly - crRecent > 1){
    obs.push({type:'warning', icon:'🔥',
      title:'Creativity has dipped',
      text:`Your creativity scores have dropped by ${(crEarly-crRecent).toFixed(1)} points recently. Your creative well may need refilling — input before output.`});
  }

  // Full moon check
  const fullMoonEntries = keys.filter(k => entries[k].phase === 'Full Moon');
  if(fullMoonEntries.length >= 2){
    const fmEn = avgFn(fullMoonEntries.map(k=>entries[k].energy||0));
    const fmMo = avgFn(fullMoonEntries.map(k=>entries[k].mood||0));
    if(fmMo < 5){
      obs.push({type:'insight', icon:'🌕',
        title:'Full moons run emotionally intense for you',
        text:`Across ${fullMoonEntries.length} full moon days, your mood averaged ${fmMo.toFixed(1)}/10. The full moon amplifies everything — both the light and the unresolved. This is not a warning, it is information.`});
    }
  }

  // Phase rhythm: day-before vs day-of vs day-after for Full Moon / New Moon
  ['Full Moon','New Moon'].forEach(function(targetPhase){
    var phaseDays = keys.filter(function(k){return entries[k].phase===targetPhase;});
    if(phaseDays.length < 2) return;
    var befores=[],dayOf=[],afters=[];
    phaseDays.forEach(function(k){
      var d=new Date(k+'T12:00:00');
      var bk=entryKey(new Date(d.getTime()-86400000));
      var ak=entryKey(new Date(d.getTime()+86400000));
      dayOf.push(entries[k].energy||0);
      if(entries[bk]) befores.push(entries[bk].energy||0);
      if(entries[ak]) afters.push(entries[ak].energy||0);
    });
    var bAvg=avgFn(befores),dAvg=avgFn(dayOf),aAvg=avgFn(afters);
    if(befores.length>=2 && bAvg > dAvg + 1){
      obs.push({type:'insight', icon:targetPhase==='Full Moon'?'🌕':'🌑',
        title:`Energy peaks before ${targetPhase}`,
        text:`Your energy averages ${bAvg.toFixed(1)} the day before ${targetPhase} but drops to ${dAvg.toFixed(1)} on the day itself. The buildup crests before the peak — plan demanding work the day before, not the day of.`});
    }
    if(afters.length>=2 && aAvg < dAvg - 1){
      obs.push({type:'warning', icon:targetPhase==='Full Moon'?'🌖':'🌒',
        title:`Integration day after ${targetPhase}`,
        text:`The day after ${targetPhase}, your energy drops to ${aAvg.toFixed(1)} (from ${dAvg.toFixed(1)}). This is your integration day — low-output, high-processing. Plan for it instead of fighting it.`});
    }
  });

  // Moon sign correlation
  var signData={};
  keys.forEach(function(k){var ms=entries[k].moonSign;if(ms){if(!signData[ms])signData[ms]={energy:[],mood:[]};signData[ms].energy.push(entries[k].energy||0);signData[ms].mood.push(entries[k].mood||0);}});
  var signEntries=Object.entries(signData).filter(function(e){return e[1].energy.length>=3;});
  if(signEntries.length>=3){
    signEntries.sort(function(a,b){return avgFn(b[1].mood)-avgFn(a[1].mood);});
    var best=signEntries[0], worst=signEntries[signEntries.length-1];
    if(avgFn(best[1].mood) - avgFn(worst[1].mood) > 1.5){
      obs.push({type:'positive', icon:'✦',
        title:'Your best moon sign: '+best[0],
        text:'When the Moon is in '+best[0]+', your mood averages '+avgFn(best[1].mood).toFixed(1)+'/10 across '+best[1].mood.length+' days. Your hardest: '+worst[0]+' at '+avgFn(worst[1].mood).toFixed(1)+'/10. Track the moon sign and plan accordingly.'});
    }
  }

  // Quality × phase correlation
  var qualByPhase={};
  keys.forEach(function(k){var p=entries[k].phase;if(!p)return;(entries[k].qualities||[]).forEach(function(q){if(!qualByPhase[p])qualByPhase[p]={};qualByPhase[p][q]=(qualByPhase[p][q]||0)+1;});});
  var topQualPhase=null,topQualName='',topQualCount=0;
  Object.keys(qualByPhase).forEach(function(p){Object.entries(qualByPhase[p]).forEach(function(e){if(e[1]>topQualCount){topQualCount=e[1];topQualName=e[0];topQualPhase=p;}});});
  if(topQualCount>=3){
    obs.push({type:'insight', icon:'◈',
      title:'"'+topQualName+'" peaks during '+topQualPhase,
      text:'You log "'+topQualName+'" most often during '+topQualPhase+' ('+topQualCount+' times). This quality has a lunar signature for you — it is not random.'});
  }

  // Dream intensity by phase
  var dreamsByPhase={};
  keys.forEach(function(k){if(entries[k].dream){var p=entries[k].phase||'unknown';dreamsByPhase[p]=(dreamsByPhase[p]||0)+1;}});
  var dreamEntries=Object.entries(dreamsByPhase).sort(function(a,b){return b[1]-a[1];});
  if(dreamEntries.length && dreamEntries[0][1]>=3){
    obs.push({type:'insight', icon:'💭',
      title:'Dreams intensify during '+dreamEntries[0][0],
      text:'You recorded dreams '+dreamEntries[0][1]+' times during '+dreamEntries[0][0]+' — more than any other phase. The unconscious speaks loudest here. Keep a notebook by the bed during this phase.'});
  }

  const container = document.getElementById('patternObservations');
  if(!container) return;
  if(!obs.length){ container.innerHTML=''; return; }
  container.innerHTML = `<div style="margin-bottom:16px;"><div class="sky-section-title">Observations</div></div>` +
    obs.map(o => `<div class="pattern-obs ${o.type}">
      <div class="pattern-obs-icon">${o.icon}</div>
      <div>
        <div class="pattern-obs-title">${o.title}</div>
        <div class="pattern-obs-text">${o.text}</div>
      </div>
    </div>`).join('');
}

const PKI = 'lunations_pattern_insight_v1';
async function generatePatternInsight(force=false){
  if(!canUseAI()) return;
  const card = document.getElementById('patternInsightCard');
  const textEl = document.getElementById('patternInsightText');
  if(!card || !textEl) return;

  // Weekly cache for fresher readings
  var now=new Date(),wkNum=Math.ceil(((now-new Date(now.getFullYear(),0,1))/86400000+1)/7);
  const weekKey = now.getFullYear()+'-W'+wkNum;
  if(!force){
    try{
      const c = JSON.parse(localStorage.getItem(PKI)||'null');
      if(c && c.key === weekKey && c.months === patternMonths){
        textEl.innerHTML = c.text; card.style.display='block'; return;
      }
    } catch(e){}
  }

  const entries = getFilteredEntries(patternMonths);
  const keys = Object.keys(entries).sort();
  if(keys.length < 7){ card.style.display='none'; return; }

  card.style.display='block';
  textEl.innerHTML=_themeFeatures?'<div class="skeleton skeleton-line" style="width:85%"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div>':'<span class="reading-loading">Reading your patterns\u2026</span>';

  const PHASES = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  var avgFn = function(arr){return arr.length?arr.reduce(function(a,b){return a+b;},0)/arr.length:0;};

  // Phase averages for ALL 4 metrics
  var phaseBlock = PHASES.map(function(p){
    var pk = keys.filter(function(k){return entries[k].phase===p;});
    if(!pk.length) return null;
    return p+' ('+pk.length+' days): energy '+avgFn(pk.map(function(k){return entries[k].energy||0;})).toFixed(1)
      +', mood '+avgFn(pk.map(function(k){return entries[k].mood||0;})).toFixed(1)
      +', clarity '+avgFn(pk.map(function(k){return entries[k].clarity||0;})).toFixed(1)
      +', creativity '+avgFn(pk.map(function(k){return entries[k].creativity||0;})).toFixed(1);
  }).filter(Boolean).join('\n');

  // Day-before/day-of/day-after for Full Moon and New Moon
  var adjacentAnalysis = '';
  ['Full Moon','New Moon'].forEach(function(targetPhase){
    var phaseDays = keys.filter(function(k){return entries[k].phase===targetPhase;});
    if(phaseDays.length < 2) return;
    var befores=[],afters=[];
    phaseDays.forEach(function(k){
      var d=new Date(k+'T12:00:00');
      var bk=entryKey(new Date(d.getTime()-86400000));
      var ak=entryKey(new Date(d.getTime()+86400000));
      if(entries[bk]) befores.push(entries[bk]);
      if(entries[ak]) afters.push(entries[ak]);
    });
    if(befores.length||afters.length){
      adjacentAnalysis += targetPhase+' rhythm: ';
      if(befores.length) adjacentAnalysis += 'day-before avg energy '+avgFn(befores.map(function(e){return e.energy||0;})).toFixed(1)+'/mood '+avgFn(befores.map(function(e){return e.mood||0;})).toFixed(1)+', ';
      adjacentAnalysis += 'day-of avg energy '+avgFn(phaseDays.map(function(k){return entries[k].energy||0;})).toFixed(1)+'/mood '+avgFn(phaseDays.map(function(k){return entries[k].mood||0;})).toFixed(1)+', ';
      if(afters.length) adjacentAnalysis += 'day-after avg energy '+avgFn(afters.map(function(e){return e.energy||0;})).toFixed(1)+'/mood '+avgFn(afters.map(function(e){return e.mood||0;})).toFixed(1);
      adjacentAnalysis += ' ('+phaseDays.length+' cycles)\n';
    }
  });

  // Moon sign correlations
  var signData={};
  keys.forEach(function(k){var ms=entries[k].moonSign;if(ms){if(!signData[ms])signData[ms]={energy:[],mood:[]};signData[ms].energy.push(entries[k].energy||0);signData[ms].mood.push(entries[k].mood||0);}});
  var signBlock=Object.keys(signData).filter(function(s){return signData[s].energy.length>=2;}).map(function(s){
    return 'Moon in '+s+' ('+signData[s].energy.length+'d): energy '+avgFn(signData[s].energy).toFixed(1)+', mood '+avgFn(signData[s].mood).toFixed(1);
  }).join('\n');

  // Top qualities per phase
  var qualByPhase={};
  keys.forEach(function(k){var p=entries[k].phase;if(!p)return;(entries[k].qualities||[]).forEach(function(q){if(!qualByPhase[p])qualByPhase[p]={};qualByPhase[p][q]=(qualByPhase[p][q]||0)+1;});});
  var qualBlock=Object.keys(qualByPhase).map(function(p){
    var sorted=Object.entries(qualByPhase[p]).sort(function(a,b){return b[1]-a[1];});
    if(!sorted.length)return null;
    return p+': '+sorted.slice(0,3).map(function(e){return e[0]+' ('+e[1]+'x)';}).join(', ');
  }).filter(Boolean).join('\n');

  // Journal excerpts — most emotionally significant entries (highest/lowest mood)
  var sortedByMood = keys.slice().sort(function(a,b){return(entries[a].mood||5)-(entries[b].mood||5);});
  var excerpts = [];
  var lowKeys = sortedByMood.slice(0,3);
  var highKeys = sortedByMood.slice(-3).reverse();
  lowKeys.concat(highKeys).forEach(function(k){
    var e=entries[k], txt=(e.text||'').slice(0,100);
    if(txt) excerpts.push(k+' ('+e.phase+', energy:'+e.energy+', mood:'+e.mood+'): "'+txt+(e.text.length>100?'…':'')+'"');
  });
  // Dream entries
  keys.forEach(function(k){
    if(entries[k].dream && excerpts.length<10){
      excerpts.push(k+' ('+entries[k].phase+') dream: "'+entries[k].dream.slice(0,80)+(entries[k].dream.length>80?'…':'')+'"');
    }
  });

  // Trend: first half vs second half
  var half=Math.floor(keys.length/2);
  var firstHalf=keys.slice(0,half),secondHalf=keys.slice(half);
  var trendBlock='First half avg: energy '+avgFn(firstHalf.map(function(k){return entries[k].energy||0;})).toFixed(1)+', mood '+avgFn(firstHalf.map(function(k){return entries[k].mood||0;})).toFixed(1)
    +'\nSecond half avg: energy '+avgFn(secondHalf.map(function(k){return entries[k].energy||0;})).toFixed(1)+', mood '+avgFn(secondHalf.map(function(k){return entries[k].mood||0;})).toFixed(1);

  var allEn=keys.map(function(k){return entries[k].energy||0;});
  var allMo=keys.map(function(k){return entries[k].mood||0;});
  var rangeLabel = patternMonths ? 'last '+patternMonths+' month'+(patternMonths>1?'s':'') : 'all recorded time';
  var profile = loadProfile();
  var profileCtx = '';
  if(profile){
    if(profile.name) profileCtx += 'Name: '+profile.name+'. ';
    if(profile.dob){
      var bd=new Date(profile.dob+'T12:00:00');
      profileCtx += 'Natal Sun: '+sunSignForDate(bd).name+', Moon: '+moonSignApprox(bd).name+(profile.rising?', Rising: '+profile.rising:'')+'. ';
    }
    var _cb=parseContextBriefing(profile.notes);
    if(_cb.life) profileCtx += 'Life context: '+_cb.life+'. ';
    if(_cb.practice) profileCtx += 'Practice: '+_cb.practice+'. ';
  }

  var prompt = '[PATTERN_MODE] Read this person\'s lunar journal data as both a scientist and a therapist. '+keys.length+' entries over '+rangeLabel+'.\n\n'
    +'Name the statistically consistent patterns — which phases reliably produce which states, what are the day-before / day-of / day-after rhythms around key phases, what moon sign correlations stand out. Reference actual numbers. Then name the emotional pattern that keeps repeating — what does the moon amplify for this person, what shadow pattern might they not see, what tension is worth their attention. If journal excerpts reveal recurring themes, name them. Write it as one cohesive reading, not separate sections.\n\n'
    +'End with one practical thing they can plan for based on these patterns. Be direct and specific. Second person. No filler.\n\n'
    +profileCtx+'\n'
    +'OVERALL: energy '+avgFn(allEn).toFixed(1)+'/10, mood '+avgFn(allMo).toFixed(1)+'/10, '+keys.length+' entries\n\n'
    +'PHASE AVERAGES:\n'+phaseBlock+'\n\n'
    +(adjacentAnalysis?'PHASE RHYTHMS:\n'+adjacentAnalysis+'\n':'')
    +(signBlock?'MOON SIGN CORRELATIONS:\n'+signBlock+'\n\n':'')
    +(qualBlock?'QUALITIES BY PHASE:\n'+qualBlock+'\n\n':'')
    +'TREND:\n'+trendBlock+'\n\n'
    +(excerpts.length?'KEY JOURNAL EXCERPTS:\n'+excerpts.join('\n')+'\n\n':'')
    +'Write the pattern reading now.';

  // Trim if over limit
  if(prompt.length > 7800) prompt = prompt.slice(0,7800);

  try{
    var tok=getAccessToken();
    var headers={'Content-Type':'application/json'};
    if(tok) headers.Authorization='Bearer '+tok;
    const res = await fetch('/api/reading',{method:'POST',headers:headers,body:JSON.stringify({prompt:prompt})});
    if(!res.ok) throw new Error(res.status);
    const data = await res.json();
    const text = data.text||'';
    if(text){
      textEl.innerHTML = sanitizeAIText(text);
      localStorage.setItem(PKI, JSON.stringify({key:weekKey, months:patternMonths, text:sanitizeAIText(text)}));
    } else { card.style.display='none'; }
  } catch(e){ card.style.display='none'; }
}


// ─── FULL SKY ─────────────────────────────────────────────────────────────────
function renderSky(){
  setTimeout(renderBirthChart,50);
  const now=new Date(),ms=moonSignApprox(now),ss=sunSignForDate(now),phase=moonPhaseInfo(now);

  // Hero section
  const heroMoon=document.getElementById('skyHeroMoon');
  const heroPhase=document.getElementById('skyHeroPhase');
  const heroSub=document.getElementById('skyHeroSub');
  if(heroMoon) heroMoon.textContent=phase.emoji;
  if(heroPhase) heroPhase.textContent=phase.name+' · Moon in '+ms.name;
  if(heroSub) heroSub.textContent=phase.pct+'% illuminated · '+ms.keywords;

  // Zodiac strip
    var zodP=loadProfile(),natMoonZ=null,natSunZ=null;
  if(zodP&&zodP.dob){var zodBd=new Date(zodP.dob+'T12:00:00');natMoonZ=moonSignApprox(zodBd).name;natSunZ=sunSignForDate(zodBd).name;}
  document.getElementById('signStrip').innerHTML=SIGNS.map(function(s){
    var im=s.name===ms.name,is2=s.name===ss.name,nm=natMoonZ&&s.name===natMoonZ&&!im,ns=natSunZ&&s.name===natSunZ&&!is2;
    var act=im||is2||nm||ns;
    var badge='';
    if(im)badge='<span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:8px;background:rgba(180,140,220,.95);color:#fff;border-radius:3px;padding:1px 5px;white-space:nowrap;font-family:Cinzel,serif;pointer-events:none;">MOON</span>';
    else if(is2)badge='<span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:8px;background:rgba(201,168,76,.95);color:#000;border-radius:3px;padding:1px 5px;white-space:nowrap;font-family:Cinzel,serif;pointer-events:none;">SUN</span>';
    if(nm)badge+='<span style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);font-size:7px;background:rgba(100,150,255,.8);color:#fff;border-radius:3px;padding:1px 4px;white-space:nowrap;font-family:Cinzel,serif;pointer-events:none;">NATAL ☽</span>';
    if(ns)badge+='<span style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);font-size:7px;background:rgba(255,180,60,.8);color:#000;border-radius:3px;padding:1px 4px;white-space:nowrap;font-family:Cinzel,serif;pointer-events:none;">NATAL ☀</span>';
    var title=s.name+' · '+s.element+' · '+s.keywords+(im?' · Moon is here now':'')+(is2?' · Sun is here now':'')+(nm?' · Your natal Moon sign':'')+(ns?' · Your natal Sun sign':'');
    var bord=act?'border-color:'+s.color+';background:'+s.color+'18;':'';
    var mt=(im||is2||nm||ns)?'10px':'0';
    return '<div class="sign-chip '+(act?'current':'')+'" style="'+bord+'position:relative;margin-top:'+mt+'" title="'+title+'">'+badge+'<span class="sign-symbol">'+(s.icon||s.symbol)+'</span><span class="sign-name">'+s.name+'</span></div>';
  }).join('');
  var sl=document.getElementById('signStripLegend');
  if(sl){sl.innerHTML='<span style="font-size:11px;font-family:Cinzel,serif;letter-spacing:.06em;"><span style="color:rgba(180,140,220,.8);">▪ Moon in '+ms.name+'</span>  <span style="color:rgba(201,168,76,.8);">▪ Sun in '+ss.name+'</span>'+(natMoonZ&&natMoonZ!==ms.name?'  <span style="color:rgba(100,150,255,.6);">▪ Natal Moon: '+natMoonZ+'</span>':'')+(natSunZ&&natSunZ!==ss.name?'  <span style="color:rgba(255,180,60,.6);">▪ Natal Sun: '+natSunZ+'</span>':'')+'</span>';}

  // Planet wheel - bigger cards
  const planets=allPlanets(now);
  document.getElementById('planetGridFull').innerHTML=planets.map(p=>`
    <div class="planet-wheel-card" onclick="openPlanetPopup('${p.name}','${p.symbol}','${p.sign?.name||''}',event)">
      <span class="planet-wheel-symbol">${p.symbol}</span>
      <div class="planet-wheel-name">${p.name}</div>
      <div class="planet-wheel-sign">${p.sign?.symbol||''} ${p.sign?.name||''}</div>
    </div>`).join('');

  // Generate collective reading
  generateCollectiveReading();
  fetchSpaceWeather();
  renderSkyForecast();
  if(getSetting('showVedic',true)){renderVedicPanel();renderTzolkinPanel();}
  // Profile now in Settings tab
  // Year overview
  const ys=new Date(now.getFullYear(),0,1),firstNm=prevNewMoon(ys);let d=new Date(firstNm),cycles=[];
  for(let i=0;i<13;i++){const nm=prevNewMoon(d),end=new Date(nm.getTime()+29.53*86400000);cycles.push({num:i+1,start:nm,end,sign:moonSignApprox(nm)});d=new Date(end.getTime()+86400000);}
  var _yo=document.getElementById('yearOverview');if(_yo)_yo.innerHTML=cycles.map(c=>{const cur=now>=c.start&&now<c.end,s1=c.start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),s2=c.end.toLocaleDateString('en-US',{month:'short',day:'numeric'});return`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(245,240,232,.05);${cur?'color:#e8d49a;':'color:rgba(245,240,232,.4);'}"><span style="font-family:Cinzel,serif;font-size:11px;min-width:22px;">${c.num}</span><span style="font-size:13px;">${c.sign?.symbol||''} ${c.sign?.name||''}</span><span style="font-size:12px;margin-left:auto;font-style:italic;">${s1}–${s2}</span>${cur?'<span style="font-family:Cinzel,serif;font-size:9px;color:var(--gold);letter-spacing:.1em;margin-left:6px;">NOW</span>':''}</div>`;}).join('');
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function openOnboarding(){
  const p=loadProfile();
  if(p){
    if(p.name)  document.getElementById('obName').value=p.name;
    if(p.dob)   document.getElementById('obDOB').value=p.dob;
    if(p.tone)  { localStorage.setItem(TONE_KEY,p.tone); updateToneLabel(); renderToneGrid(); }
    if(p.time)  document.getElementById('obTime').value=p.time;
    if(p.rising)document.getElementById('obRising').value=p.rising;
    const cityEl=document.getElementById('obBirthCity');
    if(cityEl) cityEl.value=p.birthCity||'';
    var latEl=document.getElementById('obBirthLat');if(latEl)latEl.value=p.birthLat||'';
    var lngEl=document.getElementById('obBirthLng');if(lngEl)lngEl.value=p.birthLng||'';
    var tzEl=document.getElementById('obBirthTz');if(tzEl)tzEl.value=p.birthTz||'';
    if(p.birthLat && p.birthLng){
      var meta=document.getElementById('cityGeocodeMeta');
      var st=document.getElementById('cityGeocodeStatus');
      var tzNote=p.birthTz&&p.birthTz!=='LMT'?' · '+p.birthTz:'';
      if(meta)meta.textContent='Coordinates saved: '+Number(p.birthLat).toFixed(4)+', '+Number(p.birthLng).toFixed(4)+tzNote;
      if(st)st.style.display='inline';
    }
  }
  document.getElementById('obOverlay').classList.add('open');
}
function closeOnboarding(){document.getElementById('obOverlay').classList.remove('open');}

// ─── CONTEXT BRIEFING HELPERS ────────────────────────────────────────────────
function parseContextBriefing(notes){
  if(!notes) return {chart:'',life:'',practice:''};
  if(notes.indexOf('[chart]')===-1&&notes.indexOf('[life]')===-1&&notes.indexOf('[practice]')===-1){
    return {chart:notes,life:'',practice:''};
  }
  var m=function(tag){var re=new RegExp('\\['+tag+'\\]([^\\[]*)','i');var match=notes.match(re);return match?match[1].trim():'';};
  return {chart:m('chart'),life:m('life'),practice:m('practice')};
}
function buildContextBriefing(ctx){
  var parts=[];
  if(ctx.chart)parts.push('[chart]'+ctx.chart);
  if(ctx.life)parts.push('[life]'+ctx.life);
  if(ctx.practice)parts.push('[practice]'+ctx.practice);
  return parts.join('');
}
function parsePersonRole(notes){
  if(!notes)return{role:'',detail:''};
  var m=notes.match(/^\[(\w[\w\s]*?)\]\s*(.*)/);
  if(m)return{role:m[1].trim(),detail:m[2].trim()};
  return{role:'',detail:notes};
}
function buildPersonNotes(role,detail){
  if(!role&&!detail)return'';
  if(!role)return detail;
  return'['+role+']'+(detail?' '+detail:'');
}
function buildWhosWho(limit){
  var people=loadPeople();
  var items=[];
  for(var i=0;i<people.length&&items.length<(limit||3);i++){
    var p=people[i];
    var parsed=parsePersonRole(p.notes);
    if(!parsed.role)continue;
    var signs=getPersonSigns(p);
    var entry=p.name+' ('+parsed.role;
    if(parsed.detail)entry+=' — '+parsed.detail.slice(0,25);
    if(signs)entry+=', '+signs.sun+' sun';
    entry+=')';
    items.push(entry);
  }
  return items.join(', ');
}

async function saveProfile(){
  const p={
    name:document.getElementById('obName').value.trim(),
    dob:document.getElementById('obDOB').value,
    time:document.getElementById('obTime').value,
    rising:document.getElementById('obRising').value,
    birthCity:document.getElementById('obBirthCity')?.value.trim()||'',
    birthLat:parseFloat(document.getElementById('obBirthLat')?.value)||null,
    birthLng:parseFloat(document.getElementById('obBirthLng')?.value)||null,
    birthTz:document.getElementById('obBirthTz')?.value||'',
    notes:(function(){var existing=parseContextBriefing(loadProfile()?.notes);var chart='';var dob=document.getElementById('obDOB').value;if(dob){var bd=new Date(dob+'T12:00:00');chart='Sun '+sunSignForDate(bd).name+', Moon '+moonSignApprox(bd).name;var r=document.getElementById('obRising').value;if(r)chart+=', '+r+' Rising';}return buildContextBriefing({chart:chart,life:existing.life,practice:existing.practice});})()
  };
  saveProfileData(p);
  closeOnboarding();
  localStorage.removeItem(RK);
  renderToday();
  generateReading(true);
  // Push to DB if signed in
  if(currentUser && sbClient){
    try{
      const token=getAccessToken();
      const res=await fetch('/api/profile',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({profile:p})
      });
      if(res.ok) console.log('Profile saved to cloud');
      else console.warn('Profile cloud save failed:', await res.text());
    } catch(e){ console.warn('Profile sync failed:', e); }
  }
}
document.getElementById('obOverlay').onclick=function(e){if(e.target===this)closeOnboarding();};

// ─── NAV ──────────────────────────────────────────────────────────────────────
const _scrollPositions = {};
let _currentView = 'today';
function switchView(name,btn){
  if(name==='settings'){ openSettingsModal(); return; }
  if(_themeFeatures){
    _scrollPositions[_currentView] = window.scrollY;
    const currentViewEl = document.querySelector('.view.active');
    if(currentViewEl && currentViewEl.id !== 'view-'+name){
      currentViewEl.classList.add('fade-out');
      setTimeout(() => { currentViewEl.classList.remove('active','fade-out'); }, 150);
    } else if(currentViewEl){ currentViewEl.classList.remove('active'); }
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    const viewEl = document.getElementById('view-'+name);
    if(!viewEl){ console.warn('switchView: no view for', name); return; }
    setTimeout(() => {
      viewEl.classList.add('active');
      window.scrollTo(0, _scrollPositions[name] || 0);
    }, currentViewEl && currentViewEl.id !== 'view-'+name ? 150 : 0);
    if(btn)btn.classList.add('active');
  } else {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
    const viewEl = document.getElementById('view-'+name);
    if(!viewEl){ console.warn('switchView: no view for', name); return; }
    viewEl.classList.add('active');
    if(btn)btn.classList.add('active');
  }
  if(name==='cycles'){renderComparison();renderPatterns();renderSkyForecast();}
  if(name==='cycle')renderCycle();
  if(name==='entries')renderEntries();
  if(name==='sky')renderSky();
  closePlanetPopup();
  _currentView = name;
  saveLastTab(name);
}



// ─── VEDIC CALENDAR LAYER ────────────────────────────────────────────────────

// TITHI — lunar day (1-30, 15 = full moon, 30/0 = new moon)
function getTithi(date) {
  const sunLon  = getSunLongitude(date);
  const moonLon = getMoonLongitude(date);
  let diff = ((moonLon - sunLon) % 360 + 360) % 360;
  const tithiNum = Math.floor(diff / 12) + 1; // 1–30
  const tithis = [
    { n:1,  name:'Pratipada',  quality:'neutral',     desc:'New beginnings, initiations. Good for starting ventures.' },
    { n:2,  name:'Dwitiya',    quality:'auspicious',  desc:'Favors travel, building, and creative work.' },
    { n:3,  name:'Tritiya',    quality:'auspicious',  desc:'Excellent for beginning work, cutting hair, auspicious activities.' },
    { n:4,  name:'Chaturthi',  quality:'mixed',       desc:'Ruled by Ganesh. Good for removing obstacles. Avoid new starts.' },
    { n:5,  name:'Panchami',   quality:'auspicious',  desc:'Strong for medicine, learning, spiritual practice.' },
    { n:6,  name:'Shashthi',   quality:'auspicious',  desc:'Good for valor, courage, and action.' },
    { n:7,  name:'Saptami',    quality:'auspicious',  desc:'Favors vehicles, travel, and solar work.' },
    { n:8,  name:'Ashtami',    quality:'intense',     desc:'Powerful Shakti day. Intense energy — good for deep practice, not new ventures.' },
    { n:9,  name:'Navami',     quality:'mixed',       desc:'Good for aggressive or destructive work. Use force wisely.' },
    { n:10, name:'Dashami',    quality:'auspicious',  desc:'Very auspicious. Favors all good works and dharmic action.' },
    { n:11, name:'Ekadashi',   quality:'sacred',      desc:'Most spiritually potent day. Fasting, mantra, devotion. The 11th is revered across traditions.' },
    { n:12, name:'Dwadashi',   quality:'auspicious',  desc:'Good for gifting, worship of Vishnu, and charitable acts.' },
    { n:13, name:'Trayodashi', quality:'auspicious',  desc:'Favors music, art, and sensual/creative pursuits.' },
    { n:14, name:'Chaturdashi',quality:'intense',     desc:'Shiva and Kali day. Deep tantric potency. Not for worldly beginnings.' },
    { n:15, name:'Purnima',    quality:'sacred',      desc:'Full moon. Peak manifestation, gratitude, and offering. Highly auspicious.' },
    { n:16, name:'Pratipada',  quality:'neutral',     desc:'Waning begins. Good for completing, releasing.' },
    { n:17, name:'Dwitiya',    quality:'auspicious',  desc:'Good for work requiring endurance.' },
    { n:18, name:'Tritiya',    quality:'auspicious',  desc:'Favors travel and action under waning light.' },
    { n:19, name:'Chaturthi',  quality:'mixed',       desc:'Obstacle-clearing energy. Ganesh rules.' },
    { n:20, name:'Panchami',   quality:'auspicious',  desc:'Healing and learning supported.' },
    { n:21, name:'Shashthi',   quality:'auspicious',  desc:'Courage and protection.' },
    { n:22, name:'Saptami',    quality:'auspicious',  desc:'Solar and travel energy.' },
    { n:23, name:'Ashtami',    quality:'intense',     desc:'Kali energy strong. Deep practice, not new projects.' },
    { n:24, name:'Navami',     quality:'mixed',       desc:'Completion energy. Finish what remains.' },
    { n:25, name:'Dashami',    quality:'auspicious',  desc:'Auspicious for dharmic and devotional acts.' },
    { n:26, name:'Ekadashi',   quality:'sacred',      desc:'Krishna Ekadashi — second most potent day of the cycle. Fast, mantra, devotion.' },
    { n:27, name:'Dwadashi',   quality:'auspicious',  desc:'Good for acts of service and giving.' },
    { n:28, name:'Trayodashi', quality:'auspicious',  desc:'Artistic and sensory pursuits.' },
    { n:29, name:'Chaturdashi',quality:'intense',     desc:'Dark 14th — Shiva and shadow work. Powerful for depth practice.' },
    { n:30, name:'Amavasya',   quality:'sacred',      desc:'New moon / dark moon. Deepest void. Ancestor offerings, seed intentions, silence.' },
  ];
  return { ...tithis[(tithiNum-1) % 30], num: tithiNum, fortnight: tithiNum <= 15 ? 'Shukla (waxing)' : 'Krishna (waning)' };
}

// Approximate sun longitude
function getSunLongitude(date) {
  const JD = julianDay(date);
  const n = JD - 2451545.0;
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lambda = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2*g);
  return ((lambda % 360) + 360) % 360;
}

// Approximate moon longitude
function getMoonLongitude(date) {
  const JD = julianDay(date);
  const lon = ((JD - 2451545.0) * 13.176396 + 218.316) % 360;
  return ((lon % 360) + 360) % 360;
}

// NAKSHATRA — lunar mansion (27 nakshatras, each 13°20')
function getNakshatra(date) {
  const moonLon = getMoonLongitude(date);
  const idx = Math.floor(moonLon / (360/27));
  const nakshatras = [
    { name:'Ashwini',     ruling:'Ketu',    quality:'auspicious', keywords:'swift beginnings, healing, travel' },
    { name:'Bharani',     ruling:'Venus',   quality:'intense',    keywords:'transformation, desire, creative force' },
    { name:'Krittika',    ruling:'Sun',     quality:'mixed',      keywords:'sharp action, purification, cutting away' },
    { name:'Rohini',      ruling:'Moon',    quality:'auspicious', keywords:'growth, beauty, abundance, creativity — most beloved of the moon' },
    { name:'Mrigashira',  ruling:'Mars',    quality:'auspicious', keywords:'seeking, gentleness, curiosity, inspiration' },
    { name:'Ardra',       ruling:'Rahu',    quality:'intense',    keywords:'storm energy, dissolution, raw power' },
    { name:'Punarvasu',   ruling:'Jupiter', quality:'auspicious', keywords:'renewal, return, nourishment, restoration' },
    { name:'Pushya',      ruling:'Saturn',  quality:'sacred',     keywords:'most auspicious nakshatra. nourishment, spiritual growth, dharma' },
    { name:'Ashlesha',    ruling:'Mercury', quality:'intense',    keywords:'serpent wisdom, kundalini, mystical but volatile' },
    { name:'Magha',       ruling:'Ketu',    quality:'auspicious', keywords:'ancestors, royalty, power, throne' },
    { name:'Purva Phalguni', ruling:'Venus', quality:'auspicious',keywords:'pleasure, creativity, love, rest' },
    { name:'Uttara Phalguni', ruling:'Sun', quality:'auspicious',keywords:'service, contracts, relationships, fruition' },
    { name:'Hasta',       ruling:'Moon',    quality:'auspicious', keywords:'skillful hands, healing, craft, manifestation' },
    { name:'Chitra',      ruling:'Mars',    quality:'auspicious', keywords:'beauty, art, architecture, brilliance' },
    { name:'Swati',       ruling:'Rahu',    quality:'mixed',      keywords:'independence, flexibility, cutting free' },
    { name:'Vishakha',    ruling:'Jupiter', quality:'auspicious', keywords:'purpose, determination, two-pathed, power' },
    { name:'Anuradha',    ruling:'Saturn',  quality:'auspicious', keywords:'devotion, friendship, following the star' },
    { name:'Jyeshtha',    ruling:'Mercury', quality:'intense',    keywords:'eldest, protection, but pride and conflict' },
    { name:'Mula',        ruling:'Ketu',    quality:'intense',    keywords:'root destruction, going to the source — powerful but uprooting' },
    { name:'Purva Ashadha', ruling:'Venus', quality:'auspicious',keywords:'invincible, purification, water energy' },
    { name:'Uttara Ashadha', ruling:'Sun',  quality:'auspicious',keywords:'final victory, unwavering purpose' },
    { name:'Shravana',    ruling:'Moon',    quality:'auspicious', keywords:'listening, learning, Vishnu\'s star — wisdom through receptivity' },
    { name:'Dhanishtha',  ruling:'Mars',    quality:'auspicious', keywords:'wealth, music, abundance, symphony' },
    { name:'Shatabhisha', ruling:'Rahu',    quality:'mixed',      keywords:'healing, mystery, hundred physicians' },
    { name:'Purva Bhadrapada', ruling:'Jupiter', quality:'intense', keywords:'fire of transformation, two-faced, fierce' },
    { name:'Uttara Bhadrapada', ruling:'Saturn', quality:'auspicious', keywords:'depth, wisdom, rain, serpent of depths' },
    { name:'Revati',      ruling:'Mercury', quality:'auspicious', keywords:'completion, nourishment, final journey, gentle' },
  ];
  const pada = Math.floor((moonLon % (360/27)) / (360/27/4)) + 1;
  return { ...nakshatras[idx % 27], pada, moonDegree: moonLon.toFixed(1) };
}

// VARA — weekday planetary ruler
function getVara(date) {
  const day = date.getDay(); // 0=Sun
  const varas = [
    { name:'Ravivara',   planet:'Sun',     symbol:'☉', quality:'auspicious', desc:'Solar energy — vitality, visibility, leadership, divine masculine.' },
    { name:'Somavara',   planet:'Moon',    symbol:'☽', quality:'sacred',     desc:'Moon day — ideal for lunar practice, intuition, and devotional work.' },
    { name:'Mangalavara',planet:'Mars',    symbol:'♂', quality:'intense',    desc:'Mars day — courage, action, fire practice. Avoid conflict without purpose.' },
    { name:'Budhavara',  planet:'Mercury', symbol:'☿', quality:'auspicious', desc:'Mercury day — communication, learning, writing, commerce.' },
    { name:'Guruvara',   planet:'Jupiter', symbol:'♃', quality:'sacred',     desc:'Jupiter day — most auspicious vara. Guru, teaching, expansion, dharma.' },
    { name:'Shukravara', planet:'Venus',   symbol:'♀', quality:'auspicious', desc:'Venus/Shukra day — beauty, art, devotion, the feminine. Excellent for creative and devotional work.' },
    { name:'Shanivara',  planet:'Saturn',  symbol:'♄', quality:'mixed',      desc:'Saturn day — discipline, karma, ancestors, limits. Good for serious and structural work.' },
  ];
  return varas[day];
}

// QUALITY COLOR MAPPING
const VEDIC_QUALITY_COLORS = {
  auspicious: { bg: 'rgba(60,120,60,.15)', border: 'rgba(100,180,100,.3)', text: '#8fcc8f' },
  sacred:     { bg: 'rgba(201,168,76,.12)', border: 'rgba(201,168,76,.35)', text: '#e8d49a' },
  intense:    { bg: 'rgba(139,58,42,.15)', border: 'rgba(200,100,70,.3)', text: '#d4856a' },
  mixed:      { bg: 'rgba(100,100,140,.12)', border: 'rgba(140,140,200,.25)', text: 'rgba(200,200,245,.6)' },
  neutral:    { bg: 'rgba(100,100,100,.08)', border: 'rgba(160,160,160,.15)', text: 'rgba(245,240,232,.4)' },
};

function renderVedicPanelOrig() {
  const now = new Date();
  const tithi = getTithi(now);
  const nakshatra = getNakshatra(now);
  const vara = getVara(now);

  const tq = VEDIC_QUALITY_COLORS[tithi.quality] || VEDIC_QUALITY_COLORS.neutral;
  const nq = VEDIC_QUALITY_COLORS[nakshatra.quality] || VEDIC_QUALITY_COLORS.neutral;
  const vq = VEDIC_QUALITY_COLORS[vara.quality] || VEDIC_QUALITY_COLORS.neutral;

  // Natal Vedic info for title
  var vedicNatal = '';
  try {
    var _vp = loadProfile();
    if (_vp && _vp.dob) {
      var _bd = new Date(_vp.dob + 'T12:00:00');
      var _bnk = getNakshatra(_bd);
      var _bns = sunSignForDate(_bd);
      vedicNatal = '<span style="font-size:11px;color:rgba(245,240,232,.35);font-style:italic;font-family:inherit;text-transform:none;letter-spacing:0;">' + _bns.symbol + ' ' + _bns.name + ' · ' + _bnk.name + ' nakshatra</span>';
    }
  } catch(e) {}

  const html = `<div class="astro-card" style="margin-bottom:20px;" id="vedicPanel">
    <div class="card-label" style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;">
      <span>Vedic Day</span>
      ${vedicNatal}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px;">

      <div style="background:${tq.bg};border:1px solid ${tq.border};border-radius:6px;padding:14px;">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:${tq.text};opacity:.7;margin-bottom:6px;text-transform:uppercase;">Tithi ${tithi.num} · ${tithi.fortnight}</div>
        <div style="font-size:17px;color:rgba(245,240,232,.85);margin-bottom:4px;">${tithi.name}</div>
        <div style="font-size:13px;color:rgba(245,240,232,.45);line-height:1.6;font-style:italic;">${tithi.desc}</div>
      </div>

      <div style="background:${nq.bg};border:1px solid ${nq.border};border-radius:6px;padding:14px;">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:${nq.text};opacity:.7;margin-bottom:6px;text-transform:uppercase;">Nakshatra · Pada ${nakshatra.pada}</div>
        <div style="font-size:17px;color:rgba(245,240,232,.85);margin-bottom:4px;">${nakshatra.name}</div>
        <div style="font-size:13px;color:rgba(245,240,232,.45);line-height:1.6;font-style:italic;">Ruled by ${nakshatra.ruling} · ${nakshatra.keywords}</div>
      </div>

      <div style="background:${vq.bg};border:1px solid ${vq.border};border-radius:6px;padding:14px;">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:${vq.text};opacity:.7;margin-bottom:6px;text-transform:uppercase;">Vara · Day of Week</div>
        <div style="font-size:17px;color:rgba(245,240,232,.85);margin-bottom:4px;">${vara.symbol} ${vara.name}</div>
        <div style="font-size:13px;color:rgba(245,240,232,.45);line-height:1.6;font-style:italic;">${vara.desc}</div>
      </div>

    </div>
    ${tithi.quality === 'sacred' || nakshatra.quality === 'sacred' ? `<div style="margin-top:14px;padding:10px 14px;background:rgba(201,168,76,.07);border-radius:4px;font-size:13px;color:rgba(232,212,154,.7);font-style:italic;">✦ Spiritually potent day — ${tithi.quality === 'sacred' ? tithi.name : nakshatra.name} carries heightened energy for practice and devotion.</div>` : ''}
    ${tithi.quality === 'intense' || nakshatra.quality === 'intense' ? `<div style="margin-top:14px;padding:10px 14px;background:rgba(139,58,42,.08);border-radius:4px;font-size:13px;color:rgba(212,133,106,.6);font-style:italic;">⚡ Intense energy today — proceed with awareness. Powerful for depth practice; approach new ventures with caution.</div>` : ''}
  </div>`;

  let vedicWrap = document.getElementById('vedicPanelWrap');
  if (!vedicWrap) {
    vedicWrap = document.createElement('div');
    vedicWrap.id = 'vedicPanelWrap';
    const anchor = document.getElementById('vedicAnchor');
    if (anchor) { anchor.innerHTML = ''; anchor.appendChild(vedicWrap); }
    else {
      const cycleTone = document.getElementById('cycleTone')?.closest('.astro-card');
      if (cycleTone) cycleTone.after(vedicWrap);
    }
  }
  vedicWrap.innerHTML = applyVedicTooltips(html);
}



// ─── SETTINGS ────────────────────────────────────────────────────────────────
const SK = 'lunations_settings_v1';
// ─── AI RESPONSE SANITIZER ───────────────────────────────────────────────────
function sanitizeAIText(text){
  if(!text) return '';
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const ICON_OPTIONS = [
  { glyph:'', label:'Dynamic' },
  { glyph:'🌙', label:'Crescent' },
  { glyph:'🌕', label:'Full Moon' },
  { glyph:'🌑', label:'New Moon' },
  { glyph:'✦',  label:'Star' },
  { glyph:'☽',  label:'Luna' },
  { glyph:'⊛',  label:'Mandala' },
  { glyph:'🌸', label:'Lotus' },
  { glyph:'♀',  label:'Venus' },
  { glyph:'☯',  label:'Yin Yang' },
  { glyph:'🔥', label:'Flame' },
  { glyph:'💫', label:'Comet' },
  { glyph:'🪷', label:'Lotus' },
];

function loadSettings(){
  try{ return JSON.parse(localStorage.getItem(SK)||'{}'); }catch(e){return{};}
}
function saveSetting(key, val){
  const s=loadSettings(); s[key]=val;
  localStorage.setItem(SK, JSON.stringify(s));
}
function getSetting(key, defaultVal){
  const s=loadSettings();
  return s[key]!==undefined ? s[key] : defaultVal;
}

function renderSettings(){
  // Settings now handled by modal - renderSettings kept for compat
  try { renderModeGrid(); } catch(e){ console.error('renderModeGrid',e); }
  try { renderAccountSettings(); } catch(e){ console.error('renderAccountSettings',e); }
  try { renderBirthChart(); } catch(e){ console.error('renderBirthChart',e); }
  try { renderToneGrid(); } catch(e){ console.error('renderToneGrid',e); }
  // Pre-fill cycle tracker (use setTimeout so DOM is ready)
  setTimeout(() => {
    const cd = loadCycleData();
    const cycleStart = document.getElementById('settingsCycleStart');
    const cycleLen = document.getElementById('settingsCycleLength');
    if(cycleStart && cd?.lastStart) cycleStart.value = cd.lastStart;
    if(cycleLen && cd?.cycleLength) cycleLen.value = cd.cycleLength;
  }, 100);
  const s=loadSettings(), profile=loadProfile();
  const entries=loadEntries(), entryCount=Object.keys(entries).length;

  // Icon grid
  const currentIcon = getSetting('icon','');
  document.getElementById('iconGrid').innerHTML = ICON_OPTIONS.map(opt=>`
    <div class="icon-option ${opt.glyph===currentIcon?'selected':''}" onclick="setIcon('${opt.glyph}',this)">
      <span class="icon-glyph">${opt.glyph || moonPhaseInfo(new Date()).emoji}</span>
      <span class="icon-label">${opt.label}</span>
    </div>`).join('');

  // Toggle states
  document.getElementById('toggleVedic').checked = getSetting('showVedic', true);
  document.getElementById('toggleTransits').checked = getSetting('showTransits', true);
  document.getElementById('toggleIntention').checked = getSetting('showIntention', true);
  var _tcSb = document.getElementById('toggleChinese');
  if(_tcSb) _tcSb.checked = getSetting('showChinese', true);

  // Storage info
  const totalSize = JSON.stringify(entries).length;
  const kb = (totalSize/1024).toFixed(1);
    // Show timezone in storage info
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('storageInfo').innerHTML =
    `${entryCount} entries recorded · ${kb} KB used<br>` +
    `First entry: ${entryCount ? Object.keys(entries).sort()[0] : '—'}<br>` +
    `Latest entry: ${entryCount ? Object.keys(entries).sort().pop() : '—'}<br>` +
    `<span style="font-size:12px;opacity:.6;">Timezone: ${tz}</span>`;

  // Profile preview
  const pp = document.getElementById('settingsProfilePreview');
  if(profile?.dob){
    const bd=new Date(profile.dob+'T12:00:00'),ns=sunSignForDate(bd),nm=moonSignApprox(bd);
    let html = '<strong style="color:rgba(245,240,232,.75);font-size:17px;">'+(profile.name||'Anonymous')+'</strong><br>';
    html += 'Born: '+bd.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
    if(profile.birthCity) html += ' · '+profile.birthCity;
    html += '<br>';
    html += ns.symbol+' '+ns.name+' Sun · '+nm.symbol+' '+nm.name+' Moon';
    if(profile.rising) html += ' · '+profile.rising+' Rising';
    html += '<br>';
    if(profile.notes){var _cb=parseContextBriefing(profile.notes);var _parts=[];if(_cb.chart)_parts.push(_cb.chart);if(_cb.life)_parts.push(_cb.life);if(_cb.practice)_parts.push(_cb.practice);if(_parts.length)html+='<span style="font-style:italic;color:rgba(245,240,232,.35);">'+_parts.join(' · ')+'</span>';}
    pp.innerHTML = html;
  } else {
    pp.innerHTML='No profile set yet. Add your birth details to unlock personalized readings and transit alerts.';
  }
}

function saveReadingContext(){
  var profile=loadProfile()||{};
  var existing=parseContextBriefing(profile.notes);
  profile.notes=buildContextBriefing({chart:existing.chart,life:(document.getElementById('smLifeContext')?.value||'').trim(),practice:(document.getElementById('smPractice')?.value||'').trim()});
  saveProfileData(profile);
  localStorage.removeItem(RK);
  showToast('Reading context saved');
  // Push to cloud
  if(currentUser&&sbClient){
    var token=getAccessToken();if(token)fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({profile:{name:profile.name,dob:profile.dob,time:profile.time,rising:profile.rising,notes:profile.notes,birthCity:profile.birthCity,settings:profile.settings||{}}})}).catch(function(){});
  }
}

function setIcon(glyph, el){
  if(glyph){
    saveSetting('icon', glyph);
  } else {
    // Dynamic mode — remove saved icon so phase emoji is used
    var s=loadSettings(); delete s['icon']; localStorage.setItem(SK, JSON.stringify(s));
  }
  document.querySelectorAll('.icon-option').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('headerMoon').textContent = glyph || moonPhaseInfo(new Date()).emoji;
}

function importEntries(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const data = JSON.parse(e.target.result);
      const entries = data.entries || data; // handle both formats
      const existing = loadEntries();
      const merged = {...existing, ...entries};
      saveEntries(merged);
      const count = Object.keys(entries).length;
      showToast('✦ ' + count + ' entries imported');
      renderSettings();
      // Push to cloud if signed in
      if(currentUser && sbClient){
        showToast('Syncing ' + count + ' entries to cloud…');
        (function(){
          var _tok = getAccessToken(); if(!_tok) return;
          fetch('/api/sync',{
            method:'POST',
            headers:{'Content-Type':'application/json', Authorization:'Bearer '+_tok},
            body: JSON.stringify({entries: merged})
          }).then(r=>r.json()).then(d=>{
            if(d.synced) showToast('✦ ' + d.synced + ' entries saved to your account');
          }).catch(e=>console.warn('Import sync failed:',e));
        })();
      }
    } catch(err){
      alert('Could not read file. Make sure it is a valid Lunations JSON export.');
    }
  };
  reader.readAsText(file);
  evt.target.value = ''; // reset input
}



// ─── AUTH & CLOUD SYNC ────────────────────────────────────────────────────────
// Supabase client — injected at build time via window.SUPABASE_CONFIG
// For guest mode, all functions gracefully fall back to localStorage

let sbClient = null;
let currentUser = null;
let syncInProgress = false;
let _cachedAccessToken = null;

function initSupabase(){
  const url = window.SUPABASE_URL || '';
  const key = window.SUPABASE_ANON_KEY || '';
  if(!url || !key){ renderAuthBadge(); return; } // guest mode — still show the badge

  // Supabase CDN loads with defer — poll until available
  let attempts = 0;
  const tryInit = setInterval(() => {
    attempts++;
    if(window.supabase){
      clearInterval(tryInit);
      try {
        sbClient = window.supabase.createClient(url, key);
        checkAuthState();
      } catch(e) {
        console.warn('Supabase init failed:', e);
        renderAuthBadge();
      }
    } else if(attempts > 20) {
      // CDN failed to load after 2s — show guest badge anyway
      clearInterval(tryInit);
      renderAuthBadge();
    }
  }, 100);
}

async function checkAuthState(){
  if(!sbClient) return;
  const { data: { session } } = await sbClient.auth.getSession();
  if(session?.user){
    currentUser = session.user;
    _cachedAccessToken = session.access_token;
    await onSignedIn(session.user, false);
  }
  sbClient.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_IN' && session?.user){
      currentUser = session.user;
      _cachedAccessToken = session.access_token;
      await onSignedIn(session.user, false);
    }
    if(event === 'TOKEN_REFRESHED' && session){
      _cachedAccessToken = session.access_token;
    }
    if(event === 'SIGNED_OUT'){
      currentUser = null;
      _cachedAccessToken = null;
      onSignedOut();
    }
  });
}


async function pullCloudProfile(){
  if(!currentUser || !sbClient) return false;
  try{
    const token=getAccessToken();
    const res=await fetch('/api/profile',{
      headers:{Authorization:'Bearer '+token}
    });
    if(!res.ok) return false;
    const {profile} = await res.json();
    if(profile && profile.dob){
      const existingLocal = loadProfile() || {};
      const localProfile = {
        name: profile.name||'',
        dob: profile.dob||'',
        time: profile.birth_time||'',
        rising: profile.rising||'',
        birthCity: profile.birth_city || existingLocal.birthCity || '',
        birthLat: profile.birth_lat || existingLocal.birthLat || null,
        birthLng: profile.birth_lng || existingLocal.birthLng || null,
        birthTz: profile.birth_tz || existingLocal.birthTz || '',
        notes: profile.notes||'',
      };
      saveProfileData(localProfile);
      localStorage.setItem('lunations_profile_loaded_v1', '1');
      console.log('Profile loaded from cloud:', localProfile.name);
      return true;
    }
  } catch(e){ console.warn('Profile pull failed:', e); }
  return false;
}
async function onSignedIn(user, isNew){
  // Auto-enter app for signed-in users — hide landing, go to today
  var _ls=document.getElementById('landingScreen');if(_ls)_ls.classList.add('hidden');
  localStorage.setItem('lj_entered','1'); // They're authed — mark as entered
  // Close auth modal if open
  var _am=document.getElementById('authModal');if(_am)_am.classList.remove('open');
  // Navigate to today tab if not already there
  if(typeof navTabTap==='function'){
    var todayBtn=document.querySelector('.nav-btn[onclick*="today"]');
    if(todayBtn) navTabTap('today',todayBtn);
  }
  renderAuthBadge();
  await loadUserTier();       // MUST resolve before renderToday/generateReading see _userTier
  // Hide the guest signin note immediately on sign-in
  var _sn=document.getElementById('readingSigninNote');if(_sn)_sn.style.display='none';
  // Show Plus features
  if(_userTier==='plus'||_userTier==='pro'){
    var _pw=document.getElementById('promptSuggestionsWrap');if(_pw)_pw.style.display='block';
    setTimeout(generateJournalPrompts,500);
    renderRelationshipSelect();
    var _fw=document.getElementById('followupWrap');if(_fw)_fw.style.display='block';
  }
  checkUpgradeRedirect();
  setTimeout(function(){loadSignsFromCloud().then(function(){initSignsFab();});runDailySignsCorrelation();},1500);
  // Sync people from cloud (Plus feature — only computed signs, no DOB)
  if(_userTier==='plus'||_userTier==='pro') setTimeout(pullPeopleFromCloud, 2000);
  // Reconcile local entries to cloud (3s delay)
  setTimeout(async function(){
    try{
      var le=loadEntries();var lk=Object.keys(le).filter(function(k){return k>="2024-01-01"&&!le[k].isMockData;});
      if(!lk.length)return;
      var tok=getAccessToken();if(!tok)return;
      var res=await fetch("/api/sync",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+tok},body:JSON.stringify({entries:Object.fromEntries(lk.map(function(k){return[k,le[k]];}))})});
      var d=await res.json();if(d.synced>0)console.log("Reconciled",d.synced,"entries to cloud");
    }catch(e){console.warn("Reconcile:",e.message);}
  },3000);
  // Only show welcome tour for genuinely new users — not returning sign-ins
  if(!isNew){localStorage.setItem('lunations_wt_done_v1','1');localStorage.setItem('lunations_welcomed_v1','1');}
  if(isNew && !localStorage.getItem('lunations_wt_done_v1'))setTimeout(showWelcomeModal,1400);
  setTimeout(function(){generateCycleSummaryAI();},3000);

  // Mark as welcomed AND wt_done for returning users with entries — prevents tour on re-login
  if(Object.keys(loadEntries()).length > 0 || !isNew) {
    localStorage.setItem('lunations_welcomed_v1','1');
    localStorage.setItem('lunations_wt_done_v1','1');
  }
  // Always pull profile from cloud first — this is the source of truth
  const profileLoaded = await pullCloudProfile();
  await pullEntriesFromCloud();
  if(!profileLoaded && !loadProfile()){
    // No profile anywhere — prompt once after a short delay
    setTimeout(openOnboarding, 1000);
  }

  if(isNew){
    // Also push local profile to cloud if we have one and cloud didn't have it
    if(!profileLoaded){
      const localP = loadProfile();
      if(localP?.dob){
        try{
          const token=getAccessToken();
          await fetch('/api/profile',{
            method:'POST',
            headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
            body:JSON.stringify({profile:localP})
          });
        } catch(e){}
      }
    }
    // First sign in — silently sync local entries to cloud in background
    const localEntries = loadEntries();
    const realEntries = Object.fromEntries(
      Object.entries(localEntries).filter(([k,v]) => !v.isMockData)
    );
    const count = Object.keys(realEntries).length;
    if(count > 0){
      try {
        const token = getAccessToken();
        const res = await fetch('/api/sync', {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
          body: JSON.stringify({ entries: realEntries })
        });
        const data = await res.json();
        if(data.synced){
          localStorage.setItem('lunations_last_sync', new Date().toLocaleDateString());
          if(data.synced > 0) showToast('✦ ' + data.synced + ' entries backed up to your account');
        }
      } catch(e){ console.warn('Background sync failed:', e); }
    }
  }
  // Load cloud entries and merge with local
  await syncEntriesFromCloud();
  renderToday();
  // Refresh settings modal if open
  try { 
    if(document.getElementById('settingsModal')?.classList.contains('open')) renderSettingsModal();
    renderProfileNudge(); 
  } catch(e){}
}

function onSignedOut(){
  // Called by Supabase auth state change — signOut() handles redirect/cleanup
  // Just update UI state in case sign-out happened externally (e.g. another tab)
  currentUser = null;
  if(!window._signingOut){
    // External sign-out (another tab etc) - clean up and redirect
    Object.keys(localStorage).forEach(k => {
      if((k.startsWith('lunations') || k === 'lj_entered') && k !== 'lunations_wt_done_v1') localStorage.removeItem(k);
    });
    window.location.replace('/');
  }
}

async function pullCloudEntries(){
  if(!currentUser || !sbClient) return;
  try{
    const token = getAccessToken();
    const res = await fetch('/api/entries', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!res.ok) return;
    const { entries: cloudEntries } = await res.json();
    if(cloudEntries && Object.keys(cloudEntries).length > 0){
      // Merge: cloud wins for conflicts (cloud is source of truth)
      const local = loadEntries();
      const merged = { ...local, ...cloudEntries };
      localStorage.setItem(EK, JSON.stringify(merged));
      idbSet('entries', merged);
    }
  } catch(e){ console.warn('Pull failed:', e); }
}

function getAccessToken(){
  if(_cachedAccessToken) return _cachedAccessToken;
  try {
    const raw = localStorage.getItem('sb-' + (window.SUPABASE_URL||'').split('//')[1]?.split('.')[0] + '-auth-token');
    if(raw){ const parsed = JSON.parse(raw); if(parsed.access_token) return parsed.access_token; }
  } catch(e){}
  return null;
}

async function pushEntryToCloud(date, entry) {
  if (!currentUser || !sbClient) return;
  try {
    var token = getAccessToken();
    if (!token){ console.warn('pushEntryToCloud: no token — entry saved locally only'); return; }
    var res = await fetch('/api/sync', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({entries:{[date]:entry}})});
    if (!res.ok) console.error('pushEntryToCloud FAILED', res.status);
  } catch(e) { console.error('pushEntryToCloud:', e.message); }
}
// Alias used by saveEveningEntry
var syncEntryToCloud = pushEntryToCloud;
// Call this on app load when signed in to restore entries from cloud
async function syncEntriesFromCloud(){
  if(!currentUser || !sbClient) return;
  try{
    const token = getAccessToken();
    if(!token) return;
    console.log('syncEntriesFromCloud: pulling...');
    const res = await fetch('/api/entries', { headers:{ Authorization:'Bearer '+token } });
    if(!res.ok){ console.error('syncEntriesFromCloud failed:', res.status); return; }
    const { entries: cloud } = await res.json();
    if(!cloud){ return; }
    const count = Object.keys(cloud).length;
    console.log('syncEntriesFromCloud: got', count, 'entries from cloud');
    if(count > 0){
      const local = loadEntries();
      const localCount = Object.keys(local).length;
      var merged = Object.assign({}, local);
      Object.entries(cloud).forEach(function([k,cv]) {
        var lv=local[k]; if(!lv){merged[k]=cv;return;}
        var ct=cv.timestamp?new Date(cv.timestamp).getTime():0;
        var lt=lv.timestamp?new Date(lv.timestamp).getTime():0;
        if(ct>=lt){
          // Keep whichever has more snapshots
          var localSnaps=(lv.snapshots||[]);var cloudSnaps=(cv.snapshots||[]);
          merged[k]=cv;
          if(localSnaps.length>cloudSnaps.length)merged[k].snapshots=localSnaps;
        }
      });
      saveEntries(merged);
      console.log('syncEntriesFromCloud: merged', localCount, 'local +', count, 'cloud =', Object.keys(merged).length);
      // Re-render if on today or entries view
      if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
      if(document.getElementById('view-entries')?.classList.contains('active')) renderEntries();
    }
  } catch(e){ console.error('syncEntriesFromCloud error:', e); }
}

async function offerLocalMigration(count, entries){
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;';
    const inner = document.createElement('div');
    inner.style.cssText = 'background:#1a160e;border:1px solid rgba(201,168,76,.3);border-radius:12px;padding:32px;max-width:440px;width:100%;text-align:center;';
    inner.innerHTML = '<div style="font-size:32px;margin-bottom:16px;">🌙</div>' +
      '<div style="font-family:Cinzel,serif;font-size:16px;color:#e8d49a;margin-bottom:12px;letter-spacing:.08em;">Upload Local Entries</div>' +
      '<p style="font-size:15px;color:rgba(245,240,232,.55);line-height:1.7;margin-bottom:24px;">You have ' + count + ' local entries. Upload them to your account so they are safe and accessible everywhere?</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;">' +
      '<button id="migYes" style="font-family:Cinzel,serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.4);border-radius:4px;color:#c9a84c;cursor:pointer;">Upload ' + count + ' Entries</button>' +
      '<button id="migNo" style="font-family:Cinzel,serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;background:transparent;border:1px solid rgba(245,240,232,.15);border-radius:4px;color:rgba(245,240,232,.4);cursor:pointer;">Skip</button>' +
      '</div>';
    modal.appendChild(inner);
    document.body.appendChild(modal);
    async function doMigration(doIt){
      modal.remove();
      if(doIt){
        try{
          const token = getAccessToken();
          const res = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ entries })
          });
          const data = await res.json();
          if(data.synced) showToast('✦ ' + data.synced + ' entries uploaded to your account');
        } catch(e){ console.warn('Migration failed:', e); }
      }
      resolve();
    }
    inner.querySelector('#migYes').onclick = () => doMigration(true);
    inner.querySelector('#migNo').onclick = () => doMigration(false);
  });
}

function renderAuthBadge(){
  var up=document.getElementById('upgradeBtnSideMenu'),bi=document.getElementById('billingBtnSideMenu');
  var sb=document.getElementById('subscriberBadgeSideMenu'),tl=document.getElementById('subscriberTierLabel');
  var isPaid=(_userTier==='plus'||_userTier==='pro');
  var isPro=(_userTier==='pro');
  // Show upgrade button for free AND plus users (plus can upgrade to pro)
  if(up)up.style.display=(_userTier==='pro')?'none':'';
  if(sb)sb.style.display=isPaid?'':'none';
  if(bi)bi.style.display=isPaid?'':'none';
  if(tl&&isPaid)tl.textContent=_userTier==='pro'?'Pro ✦':'Plus ✦';
  // Update upgrade button label based on current tier
  var ubl=document.getElementById('upgradeBtnLabel');
  var ubs=document.getElementById('upgradeBtnSub');
  if(ubl){ubl.textContent=_userTier==='plus'?'Upgrade to Pro':_userTier==='free'?'Upgrade to Plus':'Upgrade';}
  if(ubs){ubs.textContent=_userTier==='plus'?'Full practitioner features':'Unlock unlimited readings';}
  var ppl=document.getElementById('peopleBtnSideMenu');if(ppl)ppl.style.display=isPaid?'':'none';
  updateSideMenuAccount();
  const wrap = document.getElementById('authBadgeWrap');
  if(!wrap) return;
  if(!sbClient){
    // Show sign-in option even before Supabase loads — clicking will init it
    wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="font-size:13px;color:rgba(245,240,232,.3);font-style:italic;">Using local storage only</div>
      <button onclick="openAuthModal()" style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 12px;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:20px;color:#c9a84c;cursor:pointer;">Sign in / Sign up</button>
    </div>`;
    return;
  }
  if(currentUser){
    wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="font-size:13px;color:rgba(245,240,232,.5);font-style:italic;">✦ ${currentUser.email}</div>
      <button onclick="openAuthModal();setTimeout(showAccountPanel,50)" style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 12px;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:20px;color:#c9a84c;cursor:pointer;">Account</button>
      <button onclick="confirmSignOut()" style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 10px;background:transparent;border:1px solid rgba(245,240,232,.1);border-radius:20px;color:rgba(245,240,232,.25);cursor:pointer;">Sign out</button>
    </div>`;
  } else {
    wrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="font-size:13px;color:rgba(245,240,232,.3);font-style:italic;">Using local storage only</div>
      <button onclick="openAuthModal()" style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 12px;background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.2);border-radius:20px;color:#c9a84c;cursor:pointer;">Sign in / Sign up</button>
    </div>`;
  }
}

function openAuthModal(){
  const modal = document.getElementById('authModal');
  modal.classList.add('open');
  if(currentUser) showAccountPanel();
  else showAuthPanel();
}

function closeAuthModal(){
  document.getElementById('authModal').classList.remove('open');
  document.getElementById('authError').textContent = '';
}

function showAuthPanel(){
  document.getElementById('authPanel').style.display = 'block';
  document.getElementById('authConfirmPanel').style.display = 'none';
  document.getElementById('authAccountPanel').style.display = 'none';
}

function showConfirmPanel(email){
  document.getElementById('authPanel').style.display = 'none';
  document.getElementById('authConfirmPanel').style.display = 'block';
  document.getElementById('authAccountPanel').style.display = 'none';
  document.getElementById('authConfirmEmail').textContent = email;
  // WT_KEY preserved
}

function showAccountPanel(){
  document.getElementById('authPanel').style.display = 'none';
  document.getElementById('authConfirmPanel').style.display = 'none';
  document.getElementById('authAccountPanel').style.display = 'block';
  if(currentUser){
    const entries = loadEntries();
    const count = Object.keys(entries).filter(k => !entries[k].isMockData).length;
    const lastSync = localStorage.getItem('lunations_last_sync') || 'never';
    document.getElementById('authAccountInfo').innerHTML =
      '<div style="margin-bottom:16px;">' +
      '<div style="font-size:12px;color:rgba(245,240,232,.3);margin-bottom:4px;">Signed in as</div>' +
      '<div style="font-size:16px;color:rgba(245,240,232,.75);">'+currentUser.email+'</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">' +
      '<div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:10px;text-align:center;">' +
      '<div style="font-family:Cinzel,serif;font-size:20px;color:var(--gold);">'+count+'</div>' +
      '<div style="font-size:10px;color:rgba(245,240,232,.3);margin-top:2px;">entries</div></div>' +
      '<div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:10px;text-align:center;">' +
      '<div style="font-family:Cinzel,serif;font-size:12px;color:rgba(245,240,232,.5);">'+lastSync+'</div>' +
      '<div style="font-size:10px;color:rgba(245,240,232,.3);margin-top:2px;">last sync</div></div>' +
      '</div>';
  }
}

async function signUp(){
  if(!sbClient){ showToast('Cloud sync loading, try again in a moment'); return; }
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  if(!email || !pass){ document.getElementById('authError').textContent = 'Email and password required.'; return; }
  if(pass.length < 6){ document.getElementById('authError').textContent = 'Password must be at least 6 characters.'; return; }
  document.getElementById('authError').textContent = '';
  const { error } = await sbClient.auth.signUp({ email, password: pass });
  if(error) document.getElementById('authError').textContent = error.message;
  else showConfirmPanel(email);
}

async function signIn(){
  if(!sbClient){ showToast('Cloud sync loading, try again in a moment'); return; }
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  if(!email || !pass){ document.getElementById('authError').textContent = 'Email and password required.'; return; }
  document.getElementById('authError').textContent = 'Signing in…';
  const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pass });
  if(error){
    document.getElementById('authError').textContent = error.message;
  } else {
    currentUser = data.user;
    renderAuthBadge();
    closeAuthModal();
    localStorage.setItem('lj_entered','1');
    localStorage.setItem('lunations_wt_done_v1','1');
    showToast('✦ Signed in — syncing your entries');
    await pullCloudEntries();
    renderToday();
  }
}

async function signOut() {
  window._signingOut = true;
  if (!sbClient) { window.location.replace('/'); return; }
  closeSettingsModal(); closeAccountModal(); closeSideMenu();
  showToast('Signing out…');
  try { await sbClient.auth.signOut(); } catch(e) {}
  currentUser = null;
  Object.keys(localStorage).forEach(function(k) {
    if ((k.startsWith('lunations') || k === 'lj_entered') && k !== 'lunations_wt_done_v1') localStorage.removeItem(k);
  });
  try { idbSet('entries', {}); idbSet('profile', null); } catch(e) {}
  setTimeout(function() { window.location.replace('/'); }, 700);
}

function confirmSignOut(){
  if(confirm('Sign out of Lunations? Your entries are safely saved in the cloud.')) signOut();
}

async function syncNow(){
  if(!currentUser || !sbClient) return;
  const entries = loadEntries();
  const count = Object.keys(entries).length;
  if(!count){ showToast('No local entries to sync'); return; }
  showToast('Syncing ' + count + ' entries…');
  try {
    const token = getAccessToken();
    const res = await fetch('/api/sync', {
      method:'POST',
      headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify({ entries })
    });
    const data = await res.json();
    if(data.synced){
      localStorage.setItem('lunations_last_sync', new Date().toLocaleDateString());
      showToast('✦ ' + data.synced + ' entries synced to cloud');
      showAccountPanel();
    }
  } catch(e){ showToast('Sync failed — check connection'); }
}

// ─── TOAST SYSTEM (themed: queued/glass OR classic inline) ───
const _toastState = { container: null, current: null, queue: [], lastMsg: '', lastTime: 0 };
function _ensureToastContainer(){
  if(!_toastState.container){
    const c = document.createElement('div');
    c.className = 'toast-container';
    c.setAttribute('aria-live','polite');
    document.body.appendChild(c);
    _toastState.container = c;
  }
  return _toastState.container;
}
function showToast(msg){
  if(!_themeFeatures){
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a160e;border:1px solid rgba(201,168,76,.3);border-radius:8px;padding:12px 20px;font-size:14px;color:rgba(245,240,232,.7);z-index:500;font-style:italic;white-space:nowrap;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
    return;
  }
  const now = Date.now();
  if(msg === _toastState.lastMsg && now - _toastState.lastTime < 2000) return;
  _toastState.lastMsg = msg;
  _toastState.lastTime = now;
  if(_toastState.current){ _toastState.queue.push(msg); return; }
  _showToastNow(msg);
}
function _showToastNow(msg){
  const c = _ensureToastContainer();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  _toastState.current = t;
  setTimeout(() => {
    t.classList.add('toast-exit');
    t.addEventListener('animationend', () => {
      t.remove();
      _toastState.current = null;
      if(_toastState.queue.length) _showToastNow(_toastState.queue.shift());
    }, { once: true });
  }, 3000);
}



// ─── EDIT ENTRY ───────────────────────────────────────────────────────────────
function editEntry(dateKey){
  const entries = loadEntries();
  const entry = entries[dateKey] || {};
  const date = new Date(dateKey + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const phase = moonPhaseInfo(date);

  // Build edit modal
  const modal = document.getElementById('editModal');
  document.getElementById('editModalTitle').textContent = dateStr;
  document.getElementById('editDateKey').value = dateKey;

  // Populate fields
  document.getElementById('editEnergy').value = entry.energy || 5;
  document.getElementById('editMood').value = entry.mood || 5;
  document.getElementById('editClarity').value = entry.clarity || 5;
  document.getElementById('editCreativity').value = entry.creativity || 5;
  document.getElementById('valEditEnergy').textContent = entry.energy || 5;
  document.getElementById('valEditMood').textContent = entry.mood || 5;
  document.getElementById('valEditClarity').textContent = entry.clarity || 5;
  document.getElementById('valEditCreativity').textContent = entry.creativity || 5;
  document.getElementById('editText').value = entry.text || '';
  document.getElementById('editDream').value = entry.dream || '';
  document.getElementById('editIntention').value = entry.intention || '';
  const sadhanaEditEl = document.getElementById('editSadhana');
  if(sadhanaEditEl) sadhanaEditEl.value = entry.sadhana || '';

  // Qualities
  const qWrap = document.getElementById('editQualityTags');
  qWrap.innerHTML = QUALITIES.map(q => {
    const sel = entry.qualities && entry.qualities.includes(q) ? 'selected' : '';
    return `<button class="tag-btn ${sel}" onclick="this.classList.toggle('selected')">${q}</button>`;
  }).join('');

  modal.classList.add('open');
  // Defer slider fill update until after modal is painted
  requestAnimationFrame(function(){ requestAnimationFrame(initSliders); });
}


function deleteEntry(){
  const dateKey = document.getElementById('editDateKey').value;
  if(!confirm('Delete this entry permanently?')) return;
  const entries = loadEntries();
  delete entries[dateKey];
  saveEntries(entries);
  // Also delete from cloud
  if(currentUser && sbClient){
    var token=getAccessToken();
    if(token) fetch('/api/entries?date='+encodeURIComponent(dateKey),{method:'DELETE',headers:{Authorization:'Bearer '+token}}).catch(function(e){console.warn('Cloud delete failed:',e.message);});
  }
  closeEditModal();
  showToast('Entry deleted');
  if(document.getElementById('view-entries').classList.contains('active')) renderEntries();
  if(document.getElementById('view-cycle').classList.contains('active')) renderCycle();
}

function closeEditModal(){
  document.getElementById('editModal').classList.remove('open');
}

function saveEditEntry(){
  const dateKey = document.getElementById('editDateKey').value;
  const entries = loadEntries();
  const date = new Date(dateKey + 'T12:00:00');
  const phase = moonPhaseInfo(date);
  const mSign = moonSignApprox(date);
  const sSign = sunSignForDate(date);
  const qualities = [...document.querySelectorAll('#editQualityTags .tag-btn.selected')].map(b=>b.textContent);

  entries[dateKey] = {
    ...entries[dateKey], // preserve existing astro data if present
    energy: +document.getElementById('editEnergy').value,
    mood: +document.getElementById('editMood').value,
    clarity: +document.getElementById('editClarity').value,
    creativity: +document.getElementById('editCreativity').value,
    qualities,
    text: document.getElementById('editText').value.trim(),
    dream: document.getElementById('editDream').value.trim(),
    intention: document.getElementById('editIntention').value.trim(),
    sadhana: (document.getElementById('editSadhana')?.value||'').trim(),
    phase: entries[dateKey]?.phase || phase.name,
    moonSign: entries[dateKey]?.moonSign || mSign.name,
    sunSign: entries[dateKey]?.sunSign || sSign.name,
    timestamp: entries[dateKey]?.timestamp || date.toISOString(),
    edited: new Date().toISOString(),
  };

  saveEntries(entries);
  pushEntryToCloud(dateKey, entries[dateKey]);
  closeEditModal();
  showToast('✦ Entry updated');
  // If editing today's entry, refresh submitted card + reflection
  if(dateKey === entryKey(new Date())){
    showSubmittedCard(entries[dateKey]);
    setTimeout(renderEveningCheckin, 150);
  }
  if(document.getElementById('view-entries').classList.contains('active')) renderEntries();
  if(document.getElementById('view-cycle').classList.contains('active')) renderCycle();
  if(document.getElementById('view-patterns').classList.contains('active')) renderPatterns();
}

document.addEventListener('DOMContentLoaded', () => {
  const em = document.getElementById('editModal');
  if(em) em.onclick = function(e){ if(e.target===this) closeEditModal(); };
});

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
function injectMockData(){
  const existing = loadEntries();
  const realEntries = Object.values(existing).filter(e => !e.isMockData);
  if(realEntries.length > 0) return; // don't inject if ANY real entries exist

  const phases = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  const moonSigns = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const qualityPool = [['Expansive','Visionary','Creative'],['Grounded','Receptive','Earthed'],['Luminous','Grateful','Connected'],['Scattered','Restless'],['Devotional','Tender','Dreaming'],['Fierce','Awake','Inspired'],['Contracted','Shadowed'],['Sensual','Creative','Grateful']];

  // Phase energy patterns — realistic correlations
  const phaseEnergy = {
    'New Moon':7, 'Waxing Crescent':6, 'First Quarter':8, 'Waxing Gibbous':8,
    'Full Moon':9, 'Waning Gibbous':7, 'Last Quarter':5, 'Waning Crescent':4
  };
  const phaseMood = {
    'New Moon':6, 'Waxing Crescent':7, 'First Quarter':7, 'Waxing Gibbous':8,
    'Full Moon':8, 'Waning Gibbous':7, 'Last Quarter':6, 'Waning Crescent':5
  };

  const entries = {};
  const now = new Date();

  // Generate 90 days of mock data
  for(let i = 89; i >= 0; i--){
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    // Skip ~20% of days (realistic journaling frequency)
    if(Math.random() < 0.18) continue;

    const phase = moonPhaseInfo(d);
    const mSign = moonSignApprox(d);
    const sSign = sunSignForDate(d);
    const tithi = getTithi(d);
    const nakshatra = getNakshatra(d);
    const vara = getVara(d);

    const baseEnergy = phaseEnergy[phase.name] || 6;
    const baseMood = phaseMood[phase.name] || 6;
    const variance = () => Math.round((Math.random() - 0.5) * 3);

    const energy = Math.max(1, Math.min(10, baseEnergy + variance()));
    const mood = Math.max(1, Math.min(10, baseMood + variance()));
    const clarity = Math.max(1, Math.min(10, Math.round((energy+mood)/2) + variance()));
    const creativity = Math.max(1, Math.min(10, (phase.name.includes('Full')||phase.name.includes('Wax') ? 8 : 5) + variance()));

    const phaseIdx = phases.indexOf(phase.name);
    const qualities = qualityPool[phaseIdx >= 0 ? phaseIdx : 0];

    const key = d.toISOString().slice(0,10);
    entries[key] = {
      energy, mood, clarity, creativity,
      qualities,
      text: '',
      dream: '',
      intention: '',
      phase: phase.name,
      phaseAge: Math.floor(phase.age),
      phasePct: phase.pct,
      moonSign: mSign.name,
      sunSign: sSign.name,
      tithi: tithi.num + ' ' + tithi.name,
      tithiQuality: tithi.quality,
      nakshatra: nakshatra.name,
      nakshatraPada: nakshatra.pada,
      vara: vara.name,
      planets: [],
      activeTransits: [],
      timestamp: d.toISOString(),
      isMockData: true,
    };
  }

  saveEntries(entries);
  console.log('Mock data injected:', Object.keys(entries).length, 'entries');
}



// ─── SIDE MENU ────────────────────────────────────────────────────────────────
function toggleSideMenu(){
  const menu = document.getElementById('sideMenu');
  const overlay = document.getElementById('sideMenuOverlay');
  const btn = document.getElementById('hamburgerBtn');
  const isOpen = menu.classList.contains('open');
  if(isOpen){ closeSideMenu(); }
  else {
    menu.classList.add('open');
    overlay.classList.add('open');
    btn.classList.add('open');
    updateSideMenuAccount();
  }
}

function closeSideMenu(cb){
  var menu=document.getElementById('sideMenu'),overlay=document.getElementById('sideMenuOverlay'),btn=document.getElementById('hamburgerBtn');
  if(menu)menu.classList.remove('open');if(btn)btn.classList.remove('open');
  if(overlay){overlay.classList.remove('open');overlay.style.display='none';setTimeout(function(){overlay.style.display='';},400);}
  if(typeof cb==='function')setTimeout(cb,50);
}

function navTo(view){
  const btn = document.querySelector(`.nav-tab[onclick*="'${view}'"]`);
  // For views without nav tabs (settings), scroll nav to start
  switchView(view, btn || null);
  closeSideMenu();
  // Scroll to top
  window.scrollTo(0,0);
}

function updateSideMenuAccount(){
  const emailEl = document.getElementById('sideMenuEmail');
  if(!emailEl) return;
  if(currentUser){
    const profile = loadProfile();
    const name = profile?.name || currentUser.email.split('@')[0];
    emailEl.textContent = name + ' · ' + currentUser.email;
  } else {
    emailEl.textContent = 'Not signed in';
  }
}



// ─── GLOW BARS ───────────────────────────────────────────────────────────────
const GLOW_COLORS = {
  Energy:     ['rgba(201,168,76,.75)',  'rgba(201,168,76,.45)'],
  Mood:       ['rgba(180,120,100,.7)', 'rgba(180,120,100,.35)'],
  Clarity:    ['rgba(100,150,210,.65)','rgba(100,150,210,.3)'],
  Creativity: ['rgba(150,100,200,.65)','rgba(150,100,200,.3)'],
};

function updateGlowBar(idOrLabel, value, bgColor, glowColor){
  // Support both old-style label ('Energy') and new-style direct id ('eveFilEnergy')
  let fillId, bg, glow;
  if(bgColor){
    // Direct call with id and colors
    fillId = idOrLabel;
    bg = bgColor;
    glow = glowColor || bgColor;
  } else {
    // Legacy call with label name
    fillId = 'fill' + idOrLabel;
    const colors = GLOW_COLORS[idOrLabel] || GLOW_COLORS.Energy;
    bg = colors[0]; glow = colors[1];
  }
  const fill = document.getElementById(fillId);
  if(!fill) return;
  const pct = ((+value - 1) / 9) * 100;
  fill.style.width = pct + '%';
  fill.style.background = bg;
  fill.style.boxShadow = pct > 10 ? `0 0 12px ${glow}, 0 0 4px ${glow}` : 'none';
}

function initHeartbeats(){
  ['Energy','Mood','Clarity','Creativity'].forEach(label => {
    const slider = document.getElementById('slider'+label);
    if(slider) updateGlowBar(label, slider.value);
  });
}

// Keep updateHeartbeat as alias for any existing calls
function updateHeartbeat(label, value){ updateGlowBar(label, value); }

// ─── SLIDER FILL ──────────────────────────────────────────────────────────────
function updateSliderFill(input){
  const min = +input.min||1, max = +input.max||10, val = +input.value;
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--pct', pct + '%');
  // Also update the track directly for better cross-browser support
  input.style.background = `linear-gradient(90deg, rgba(201,168,76,.7) ${pct}%, rgba(245,240,232,.1) ${pct}%)`;
}
function initSliders(){
  document.querySelectorAll('input[type=range]').forEach(s => {
    updateSliderFill(s);
    s.addEventListener('input', () => updateSliderFill(s));
  });
}

// ─── NAV WHEEL SCROLL ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav-tabs');
  if(nav){
    nav.addEventListener('wheel', e => {
      if(e.deltaY !== 0){
        e.preventDefault();
        nav.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }
});

// ─── ENTRY FORM COLLAPSE ──────────────────────────────────────────────────────
function showEntryForm(){
  const mode = getLogMode();
  document.getElementById('entrySubmittedCard').style.display = 'none';
  document.getElementById('quickLogWrap').style.display = mode==='quick' ? 'block' : 'none';
  document.getElementById('entryFormWrap').style.display = mode==='full' ? 'block' : 'none';
  // Restore tabs for fresh day (no entry yet): Morning + Quick Log only
  var bf=document.getElementById('btnFullLog');if(bf){bf.style.display='';bf.textContent='Morning';}
  var be=document.getElementById('btnEvening');if(be)be.style.display='none';
  var bd=document.getElementById('btnDayLog');if(bd)bd.style.display='none';
  var dlw=document.getElementById('dayLogWrap');if(dlw)dlw.style.display='none';
  document.getElementById('btnFullLog')?.classList.toggle('active', mode==='full');
  document.getElementById('btnQuickLog')?.classList.toggle('active', mode==='quick');
  // Pre-populate from existing entry if editing today
  var existing = loadEntries()[entryKey(new Date())];
  if(existing && mode==='full'){
    ['Energy','Mood','Clarity','Creativity'].forEach(function(m){
      var sl=document.getElementById('slider'+m);var vl=document.getElementById('val'+m);
      if(sl&&existing[m.toLowerCase()]){sl.value=existing[m.toLowerCase()];if(vl)vl.textContent=existing[m.toLowerCase()];updateSliderFill(sl);}
    });
    var et=document.getElementById('entryText');if(et&&existing.text)et.value=existing.text;
    var dt=document.getElementById('dreamText');if(dt&&existing.dream)dt.value=existing.dream;
    var it=document.getElementById('intentionText');if(it&&existing.intention)it.value=existing.intention;
    var st=document.getElementById('sadhanaText');if(st&&existing.sadhana)st.value=existing.sadhana;
    if(existing.qualities&&existing.qualities.length){
      document.querySelectorAll('#qualityTags .tag-btn').forEach(function(b){if(existing.qualities.includes(b.textContent))b.classList.add('selected');});
    }
  }
  setTimeout(initHeartbeats, 50);
}

function showSubmittedCard(entry){
  const card = document.getElementById('entrySubmittedCard');
  const form = document.getElementById('entryFormWrap');

  // Populate metrics
  const metrics = [
    {val: entry.energy, label: 'Energy'},
    {val: entry.mood, label: 'Mood'},
    {val: entry.clarity, label: 'Clarity'},
    {val: entry.creativity, label: 'Creativity'},
  ];
  document.getElementById('submittedMetrics').innerHTML = metrics.map(m =>
    `<div class="entry-submitted-metric">
      <span class="entry-submitted-metric-val">${m.val}</span>
      <span class="entry-submitted-metric-label">${m.label}</span>
    </div>`
  ).join('');

  // Qualities
  document.getElementById('submittedQualities').innerHTML = (entry.qualities||[])
    .map(q => `<span class="quality-pill">${q}</span>`).join('');

  // Text preview
  const txt = entry.text || entry.dream || entry.intention || '';
  document.getElementById('submittedText').textContent = txt.slice(0,200) + (txt.length>200?'…':'');
  document.getElementById('submittedText').style.display = txt ? 'block' : 'none';

  // Show card, hide forms
  card.style.display = 'block';
  form.style.display = 'none';
  var qlw=document.getElementById('quickLogWrap');if(qlw)qlw.style.display='none';
  var dlw=document.getElementById('dayLogWrap');if(dlw)dlw.style.display='none';
  // Reconfigure tabs: Morning (shows submitted card), Quick Log, Evening, Today's Log
  var mt=document.getElementById('logModeToggle');
  if(mt){
    mt.style.display='flex';
    var bf=document.getElementById('btnFullLog');if(bf){bf.style.display='';bf.textContent='Morning';bf.classList.add('active');}
    var bq=document.getElementById('btnQuickLog');if(bq){bq.style.display='';bq.classList.remove('active');}
    var be=document.getElementById('btnEvening');if(be){be.style.display='';be.classList.remove('active');}
    var bd=document.getElementById('btnDayLog');if(bd){bd.style.display='';bd.classList.remove('active');}
  }
  // Hide evening standalone section — it's now in tabs
  var evc=document.getElementById('eveningCheckin');if(evc)evc.style.display='none';

  // Generate reflection if they wrote something
  if(entry.text && entry.text.length > 20){
    generateEntryReflection(entry);
  }
}

async function generateEntryReflection(entry){
  const reflectionWrap = document.getElementById('entryReflection');
  const reflectionEl = document.getElementById('reflectionText');
  if(!reflectionWrap || !reflectionEl) return;
  if(!canUseAI()){ reflectionWrap.style.display='none'; return; }
  reflectionWrap.style.display = 'block';

  // Cache per entry date + text hash (don't re-call if same entry)
  const REK = 'lunations_reflect_v1';
  const cacheKey = entryKey(new Date()) + '_' + (entry.text||'').length;
  try{
    const c = JSON.parse(localStorage.getItem(REK)||'null');
    if(c && c.key === cacheKey && c.text){
      reflectionEl.textContent = c.text;
      return;
    }
  } catch(e){}

  const phase = moonPhaseInfo(new Date());
  const mSign = moonSignApprox(new Date());
  const profile = loadProfile();
  const name = profile?.name ? profile.name : '';

  const prompt = `You are reflecting back to someone what they wrote in their lunar journal today. Be direct, warm, and brief — 2-3 sentences max. Mirror what they actually said, notice one specific thing, and connect it gently to the sky (${phase.name}, Moon in ${mSign.name}). Don't be generic. Don't use filler affirmations. Speak like a wise friend, not a therapist.

${name ? 'Their name is ' + name + '.' : ''}${(function(){var _cb=parseContextBriefing(profile?.notes);return _cb.life?' Life context: '+_cb.life.slice(0,100)+'.':'';})()}
They wrote: "${entry.text.slice(0, 300)}"
Their qualities today: ${(entry.qualities||[]).join(', ')||'none tagged'}
Energy ${entry.energy}/10, Mood ${entry.mood}/10.

Write the reflection now. 2-3 sentences only.`;

  try{
    const res = await fetch('/api/reading', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({prompt})
    });
    if(!res.ok) throw new Error('API error');
    const data = await res.json();
    const text = data.text || '';
    if(text){
      reflectionEl.textContent = text;
      try{ localStorage.setItem(REK, JSON.stringify({key: cacheKey, text})); }catch(e){}
      if(_userTier==='plus'||_userTier==='pro'){var _rfw=document.getElementById('reflectFollowupWrap');if(_rfw){_rfw.style.display='block';document.getElementById('reflectFollowupHistory').innerHTML='';if(typeof _reflectHistory!=='undefined')_reflectHistory=[];}}
    }
    else reflectionWrap.style.display = 'none';
  } catch(e){
    reflectionWrap.style.display = 'none';
  }
}


// ─── COLLECTIVE HOROSCOPE ─────────────────────────────────────────────────────
const CK = 'lunations_collective_v1';

async function generateCollectiveReading(force=false){
  // No collective reading for guests
  if(!canUseAI()){
    const el=document.getElementById('collectiveText');
    if(el) el.innerHTML='<div class="collective-text" style="font-style:italic;color:rgba(245,240,232,.3);">Sign in to see the collective sky reading.</div>';
    return;
  }
  const todayKey = entryKey(new Date());
  if(!force){
    try{
      const c=JSON.parse(localStorage.getItem(CK)||'null');
      if(c&&c.date===todayKey){const ct=c.text.replace(/^#+\s*[^\n]*\n?/,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').trim();document.getElementById('collectiveText').innerHTML='<div class="collective-text">'+sanitizeAIText(ct)+'</div>';return;}
    } catch(e){}
  }

  document.getElementById('collectiveText').innerHTML=_themeFeatures?'<div class="skeleton skeleton-line" style="width:80%"></div><div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div>':'<span class="collective-loading">Reading the collective field\u2026</span>';

  const now=new Date(),phase=moonPhaseInfo(now),mSign=moonSignApprox(now),sSign=sunSignForDate(now);
  const planets=allPlanets(now).filter(p=>p&&p.sign).slice(0,7).map(p=>p.name+' in '+(p.sign?.name||'')).join(', ');
  const tithi=getTithi(now),nakshatra=getNakshatra(now);

  const prompt=`You are a collective astrologer writing a brief sky reading for everyone — not a personal reading, but what the sky is doing for humanity right now. 3-4 sentences. Be specific about the actual planetary positions. Mention one dominant theme or tension in the collective field, and one practical or spiritual invitation for the day. Direct, grounded, not vague.

Today's sky: ${phase.name}, Moon in ${mSign.name} (${mSign.keywords}), Sun in ${sSign.name}. Tithi: ${tithi.name}. Nakshatra: ${nakshatra.name}. Planets: ${planets}.

Write the collective reading.`;

  try{
    const res=await fetch('/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    if(!res.ok) throw new Error(res.status);
    const data=await res.json();
    const text=data.text||'';
    if(text){
      const clean=text.replace(/^#+\s*[^\n]*\n?/,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').trim();
      document.getElementById('collectiveText').innerHTML='<div class="collective-text">'+sanitizeAIText(clean)+'</div>';
      localStorage.setItem(CK,JSON.stringify({date:todayKey,text}));
    } else {
      document.getElementById('collectiveText').innerHTML='<span class="collective-loading">Reading unavailable today.</span>';
    }
  } catch(e){
    document.getElementById('collectiveText').innerHTML='<span class="collective-loading">Reading unavailable — check connection.</span>';
  }
}


// ─── TRADITION MODES ──────────────────────────────────────────────────────────
const MODES = {
  vedic: {
    name: 'Vedic',
    icon: '🕉',
    desc: 'Tithi, Nakshatra, Vara. Sanskrit-rooted precision.',
    tone: 'precise, practitioner, Sanskrit-grounded',
    readingLens: 'Use Vedic astrological language — tithi, nakshatra, graha. Reference Sanskrit concepts naturally. Speak to a serious practitioner.',
    phaseNames: { 0:'Amavasya', 5:'Purnima' },
    dailyCardLabel: 'Vedic Day',
  },
  goddess: {
    name: 'Goddess',
    icon: '🌹',
    desc: 'Mythological archetypes. The divine feminine speaks.',
    tone: 'mythological, archetypal, poetic, Jungian',
    readingLens: 'Speak through goddess archetypes and mythological symbolism. Reference Hecate, Isis, Artemis, Parvati, Kali, Aphrodite, Persephone. The moon is a living deity. Rich, poetic, feminine-divine tone.',
    dailyCardLabel: 'Goddess of the Day',
    phaseGoddesses: {
      0: {name:'Hecate', desc:'Queen of the crossroads. The void between worlds. Magic, shadow work, ancestors.'},
      1: {name:'Artemis', desc:'The huntress sets her bow. New intentions, wild beginnings, independence.'},
      2: {name:'Parvati', desc:'Devoted ascent. Will meets devotion. Build toward the sacred.'},
      3: {name:'Isis', desc:'Wings spread gathering power. Preparation, healing, gathering light.'},
      4: {name:'Selene', desc:'Full radiance. The goddess unveiled. Celebrate, offer, be seen.'},
      5: {name:'Demeter', desc:'Harvest and integration. Gratitude for what grew this cycle.'},
      6: {name:'Kali', desc:'The great dissolver. Release what no longer serves. Cut clean.'},
      7: {name:'Persephone', desc:'Descent before return. Rest in the underworld. The seed prepares.'},
    },
  },
  crystal: {
    name: 'Crystal',
    icon: '💎',
    desc: 'Stones, chakras, ritual. Sensory and sacred.',
    tone: 'warm, tactile, ritual-focused, accessible',
    readingLens: 'Speak through crystal energy, chakras, and ritual suggestion. Warm, practical, and sensory. Include what stone to work with, what chakra is active, and one ritual suggestion for the day.',
    dailyCardLabel: 'Crystal Energy',
    phaseStones: {
      0: {stone:'Black Tourmaline', chakra:'Root', ritual:'Cleanse your space. Set one protected intention.'},
      1: {stone:'Moonstone', chakra:'Crown', ritual:'Hold your stone and speak your new moon wish aloud.'},
      2: {stone:'Citrine', chakra:'Solar Plexus', ritual:'Carry citrine in your pocket. Take one courageous action.'},
      3: {stone:'Green Aventurine', chakra:'Heart', ritual:'Place stone on heart. Breathe into what you are growing.'},
      4: {stone:'Selenite', chakra:'Crown & Third Eye', ritual:'Charge your crystals under the full moon tonight.'},
      5: {stone:'Amethyst', chakra:'Third Eye', ritual:'Meditate with amethyst. Journal what you are grateful for.'},
      6: {stone:'Obsidian', chakra:'Root', ritual:'Release ritual: write what you are letting go, burn or bury.'},
      7: {stone:'Labradorite', chakra:'Throat', ritual:'Rest. Dream. Let labradorite reveal what needs to be seen.'},
    },
  },
  elemental: {
    name: 'Elemental',
    icon: '🔥',
    desc: 'Fire, water, earth, air. The ancient wheel turns.',
    tone: 'animist, Wiccan-adjacent, earthy, directional',
    readingLens: 'Speak through elemental forces — fire, water, earth, air, aether. Reference directions, seasons, the wheel of the year, and elemental correspondences. Animist and nature-based tone.',
    dailyCardLabel: 'Elemental Current',
    signElements: {
      Fire: {direction:'South', season:'Summer', quality:'transformation, will, passion'},
      Earth: {direction:'North', season:'Winter', quality:'grounding, manifestation, patience'},
      Air: {direction:'East', season:'Spring', quality:'clarity, communication, new beginnings'},
      Water: {direction:'West', season:'Autumn', quality:'emotion, intuition, release'},
    },
  },
  nature: {
    name: 'Nature',
    icon: '🌿',
    desc: 'Animal medicine, plant spirits, the body as landscape.',
    tone: 'indigenous-influenced, seasonal, embodied, quiet',
    readingLens: 'Speak through nature medicine — animal guides, plant spirits, seasonal rhythms, the body as earth. Indigenous-influenced wisdom. Quiet, grounded, embodied tone. No spiritual bypassing.',
    dailyCardLabel: 'Nature Medicine',
    phaseAnimals: {
      0: {animal:'Owl', medicine:'Deep seeing. What do you know that you have not yet named?'},
      1: {animal:'Deer', medicine:'Gentle new steps. Trust your sensitivity as a gift.'},
      2: {animal:'Hawk', medicine:'Rising vision. See the whole terrain before you move.'},
      3: {animal:'Bear', medicine:'Gathering strength. Prepare your den for what you are growing.'},
      4: {animal:'Wolf', medicine:'Full voice. Howl what is true. Your pack needs your song.'},
      5: {animal:'Salmon', medicine:'Return journey. What wisdom are you carrying back?'},
      6: {animal:'Snake', medicine:'Shedding time. What skin no longer fits?'},
      7: {animal:'Badger', medicine:'Rest in the underground. Roots deepen in the dark.'},
    },
  },
  source: {
    name: 'Source',
    icon: '✦',
    desc: 'Pure energy and field. No tradition, all traditions.',
    tone: 'universal, consciousness-first, frequency-based, inclusive',
    readingLens: 'Speak in the language of energy, frequency, and field. No specific tradition. Reference quantum coherence, resonance, the unified field, consciousness. Speak to anyone regardless of background. Warm, clear, universal.',
    dailyCardLabel: 'Field Reading',
  },
};

const MK = 'lunations_mode_v1';
function getCurrentMode(){ return localStorage.getItem(MK) || 'vedic'; }
function setMode(mode){
  localStorage.setItem(MK, mode);
  localStorage.removeItem(RK);
  renderToday();
  renderVedicPanel();
  // Refresh modal grids if open
  if(document.getElementById('settingsModal')?.classList.contains('open')){
    const smMG = document.getElementById('smModeGrid');
    if(smMG) smMG.querySelectorAll('[onclick]').forEach(el => {
      const isSelected = el.getAttribute('onclick')?.includes("'"+mode+"'");
      el.style.border = '1px solid '+(isSelected?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)');
      el.style.background = isSelected?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)';
      el.querySelector('div:last-child').style.color = isSelected?'var(--gold)':'rgba(245,240,232,.5)';
    });
  }
}
function getModeData(){ return MODES[getCurrentMode()] || MODES.vedic; }


// ─── MODE RENDERING ───────────────────────────────────────────────────────────
function renderModeGrid(){
  const current = getCurrentMode();
  const grid = document.getElementById('modeGrid');
  if(!grid) return;
  grid.innerHTML = Object.entries(MODES).map(([key, m]) => `
    <div onclick="setMode('${key}')" style="
      background:${current===key?'rgba(201,168,76,.1)':'rgba(245,240,232,.02)'};
      border:1px solid ${current===key?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)'};
      border-radius:8px;padding:14px 12px;cursor:pointer;transition:all .15s;text-align:center;">
      <div style="font-size:24px;margin-bottom:6px;">${m.icon}</div>
      <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;color:${current===key?'var(--gold)':'rgba(245,240,232,.5)'};text-transform:uppercase;margin-bottom:4px;">${m.name}</div>
      <div style="font-size:11px;color:rgba(245,240,232,.3);font-style:italic;line-height:1.4;">${m.desc}</div>
    </div>
  `).join('');
}

// Mode-aware Vedic panel dispatcher
let _vedicRendering = false;
function renderVedicPanel(){
  if(_vedicRendering) return; // recursion guard
  _vedicRendering = true;
  try {
    const mode = getModeData();
    if(!mode || mode.name === 'Vedic'){
      renderVedicPanelOrig();
      return;
    }

  // Find or create container
  let container = document.getElementById('vedicPanelWrap');
  if(!container){
    container = document.createElement('div');
    container.id = 'vedicPanelWrap';
    const anchor = document.getElementById('vedicAnchor');
    if(anchor){ anchor.innerHTML=''; anchor.appendChild(container); }
    else {
      const ct = document.getElementById('cycleTone');
      if(ct) ct.closest('.astro-card')?.after(container);
    }
  }
  if(!container) return;
  if(!getSetting('showVedic',true)){ container.innerHTML=''; return; }

  const now = new Date();
  const phase = moonPhaseInfo(now);
  const mSign = moonSignApprox(now);
  let cardHTML = '';

  if(mode.name === 'Goddess'){
    const g = mode.phaseGoddesses?.[phase.quarter] || {name:'Selene',desc:'The eternal moon.'};
    cardHTML = '<div class="astro-card" style="margin-bottom:20px;"><div class="card-label">' + mode.dailyCardLabel + '</div>' +
      '<div style="margin-top:12px;display:flex;align-items:flex-start;gap:16px;">' +
      '<div style="font-size:36px;">' + mode.icon + '</div>' +
      '<div><div style="font-family:Cinzel,serif;font-size:18px;color:var(--gold-pale);margin-bottom:6px;">' + g.name + '</div>' +
      '<div style="font-size:15px;color:rgba(245,240,232,.6);line-height:1.7;font-style:italic;">' + g.desc + '</div></div></div></div>';
  } else if(mode.name === 'Crystal'){
    const c = mode.phaseStones?.[phase.quarter] || {stone:'Clear Quartz',chakra:'Crown',ritual:'Set your intention.'};
    cardHTML = '<div class="astro-card" style="margin-bottom:20px;"><div class="card-label">' + mode.dailyCardLabel + '</div>' +
      '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      '<div style="background:rgba(245,240,232,.03);border-radius:6px;padding:12px;">' +
      '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);margin-bottom:6px;">STONE</div>' +
      '<div style="font-size:15px;color:rgba(245,240,232,.8);">' + mode.icon + ' ' + c.stone + '</div></div>' +
      '<div style="background:rgba(245,240,232,.03);border-radius:6px;padding:12px;">' +
      '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);margin-bottom:6px;">CHAKRA</div>' +
      '<div style="font-size:15px;color:rgba(245,240,232,.8);">' + c.chakra + '</div></div></div>' +
      '<div style="margin-top:12px;padding:12px;background:rgba(201,168,76,.05);border-radius:6px;font-size:14px;color:rgba(245,240,232,.55);font-style:italic;line-height:1.7;">' + c.ritual + '</div></div>';
  } else if(mode.name === 'Elemental'){
    const el = mode.signElements?.[mSign.element] || {direction:'Centre',season:'The Turning',quality:'all forces present'};
    cardHTML = '<div class="astro-card" style="margin-bottom:20px;"><div class="card-label">' + mode.dailyCardLabel + '</div>' +
      '<div style="margin-top:12px;text-align:center;padding:8px 0;">' +
      '<div style="font-size:42px;margin-bottom:8px;">' + mode.icon + '</div>' +
      '<div style="font-family:Cinzel,serif;font-size:16px;color:var(--gold-pale);margin-bottom:4px;">' + mSign.element + ' · ' + el.direction + '</div>' +
      '<div style="font-size:13px;color:rgba(245,240,232,.4);font-style:italic;">' + el.season + ' · ' + el.quality + '</div></div></div>';
  } else if(mode.name === 'Nature'){
    const a = mode.phaseAnimals?.[phase.quarter] || {animal:'Crow',medicine:'Watch. Listen. Adapt.'};
    cardHTML = '<div class="astro-card" style="margin-bottom:20px;"><div class="card-label">' + mode.dailyCardLabel + '</div>' +
      '<div style="margin-top:12px;display:flex;align-items:flex-start;gap:16px;">' +
      '<div style="font-size:36px;">' + mode.icon + '</div>' +
      '<div><div style="font-family:Cinzel,serif;font-size:16px;color:var(--gold-pale);margin-bottom:6px;">' + a.animal + ' Medicine</div>' +
      '<div style="font-size:15px;color:rgba(245,240,232,.6);line-height:1.75;font-style:italic;">' + a.medicine + '</div></div></div></div>';
  } else if(mode.name === 'Source'){
    const msgs = [
      'The field is coherent today. Your signal is clear. What frequency are you broadcasting?',
      'Interference patterns dissolve at the node points. You are at a node point.',
      'Resonance precedes manifestation. The quantum field collapses toward your attention.',
      'You are not in the universe. The universe is in you. Act accordingly.',
      'The observer and the observed are one. What you witness, you participate in.',
    ];
    const msg = msgs[new Date().getDate() % msgs.length];
    cardHTML = '<div class="astro-card" style="margin-bottom:20px;"><div class="card-label">' + mode.dailyCardLabel + '</div>' +
      '<div style="margin-top:10px;font-size:16px;color:rgba(245,240,232,.7);line-height:1.85;font-style:italic;">' + msg + '</div></div>';
  }

  container.innerHTML = cardHTML;
  } finally {
    _vedicRendering = false;
  }
}


// ─── DAILY PATTERN MESSAGE ────────────────────────────────────────────────────
function renderDailyPatternMessage(){
  const entries = loadEntries();
  const keys = Object.keys(entries).sort();
  if(keys.length < 7) return; // need at least a week

  const today = new Date();
  const todayPhase = moonPhaseInfo(today);
  const PHASES = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];

  // Find past entries on same phase
  const samePhaseKeys = keys.filter(k => {
    const e = entries[k];
    return e.phase === todayPhase.name && k !== entryKey(today);
  });

  if(!samePhaseKeys.length) return;

  const avgFn = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;
  const phaseEnergy = avgFn(samePhaseKeys.map(k => entries[k].energy||0));
  const phaseMood = avgFn(samePhaseKeys.map(k => entries[k].mood||0));
  const phaseQualities = {};
  samePhaseKeys.forEach(k => {
    (entries[k].qualities||[]).forEach(q => { phaseQualities[q] = (phaseQualities[q]||0)+1; });
  });
  const topQualities = Object.entries(phaseQualities).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([q])=>q);

  // Build the message
  let msg = '', type = 'insight';
  if(phaseEnergy !== null){
    if(phaseEnergy < 4){
      msg = `Historically your energy dips to ${phaseEnergy}/10 during ${todayPhase.name}. This is a pattern, not a problem — your system knows to conserve here.`;
      type = 'warning';
    } else if(phaseEnergy > 7){
      msg = `${todayPhase.name} tends to be a peak period for you — energy averages ${phaseEnergy}/10 across ${samePhaseKeys.length} past entries. Lean in.`;
      type = 'positive';
    } else {
      msg = `During past ${todayPhase.name} days you've averaged ${phaseEnergy}/10 energy, ${phaseMood}/10 mood across ${samePhaseKeys.length} entries.`;
    }
    if(topQualities.length){
      msg += ` You tend to feel ${topQualities.join(', ')} now.`;
    }
  }

  if(!msg) return;

  // Find or create the pattern message div
  let pmDiv = document.getElementById('dailyPatternMsg');
  if(!pmDiv){
    pmDiv = document.createElement('div');
    pmDiv.id = 'dailyPatternMsg';
    // Insert after the reading card
    const readingCard = document.querySelector('.reading-card');
    if(readingCard) readingCard.after(pmDiv);
    else return;
  }

  const colors = {
    warning: 'rgba(139,58,42,.1)',
    positive: 'rgba(60,120,60,.08)',
    insight: 'rgba(201,168,76,.05)',
  };
  const borders = {
    warning: 'rgba(200,100,70,.3)',
    positive: 'rgba(100,180,100,.3)',
    insight: 'rgba(201,168,76,.2)',
  };
  const icons = { warning:'⚡', positive:'✦', insight:'🌙' };

  pmDiv.innerHTML = `<div style="background:${colors[type]};border:1px solid ${borders[type]};border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start;">
    <div style="font-size:16px;flex-shrink:0;margin-top:1px;">${icons[type]}</div>
    <div>
      <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:rgba(245,240,232,.3);text-transform:uppercase;margin-bottom:5px;">Your Pattern Today</div>
      <div style="font-size:14px;color:rgba(245,240,232,.65);line-height:1.7;">${msg}</div>
    </div>
  </div>`;
}


// BUILD 20260321121006

// TODAY FORECAST CARD
function renderTodayForecastCard(){
  const el = document.getElementById('todayForecastCard');
  if(!el || typeof buildForecastDays === 'undefined') return;
  const today = new Date(); today.setHours(0,0,0,0);
  const days = buildForecastDays(today, 1);
  if(!days || !days.length){ el.style.display='none'; return; }
  const day = days[0];
  el.style.display = 'block';
  const isBirthday = day.tz.num === BIRTH_TZOLKIN.num && day.tz.signIdx === BIRTH_TZOLKIN.signIdx;
  const bg = isBirthday ? 'rgba(201,168,76,.08)' : day.score >= 4 ? 'rgba(100,80,180,.06)' : 'rgba(245,240,232,.02)';
  const border = isBirthday ? 'rgba(201,168,76,.3)' : day.score >= 4 ? 'rgba(140,100,220,.2)' : 'rgba(245,240,232,.08)';
  const fdColor = isBirthday ? 'rgba(201,168,76,.6)' :
                  day.tz.num === 13 ? 'rgba(140,100,220,.5)' :
                  day.tz.signIdx === 4 ? 'rgba(200,80,80,.5)' :
                  day.moonEvent === 'Full Moon' ? 'rgba(201,168,76,.45)' :
                  day.moonEvent === 'New Moon' ? 'rgba(100,140,220,.4)' : 'rgba(245,240,232,.12)';
  const tzStr = typeof tzolkinBadgeTip === 'function' ? tzolkinBadgeTip(day.tz) : day.tz.sign.glyph+' '+day.tz.num+' '+day.tz.sign.name;
  const nkStr = typeof nakshatraBadgeTip === 'function' ? nakshatraBadgeTip(day.nk) : day.nk.name;
  const moonStr = typeof moonPhaseBadgeTip === 'function' ? moonPhaseBadgeTip(day.phase) : day.phase.emoji+' '+day.phase.name;
  const xiuPill = day.xiu && typeof xiuBadgeTip === 'function' ? '<span class="fpill" style="font-size:11px;border-color:rgba(220,160,80,.2);color:rgba(220,160,80,.6);">'+xiuBadgeTip(day.xiu)+'</span>' : '';
  const moonEventPill = day.moonEvent ? '<span class="fpill lm" style="font-size:11px;border-color:rgba(201,168,76,.4);color:var(--gold);">'+day.moonEvent+'</span>' : '';

  // Badges
  var badges = [];
  if (day.moonEvent === 'Full Moon') badges.push('<span class="fday-badge fb-moon">Full Moon \uD83C\uDF15</span>');
  if (day.moonEvent === 'New Moon')  badges.push('<span class="fday-badge fb-nm">New Moon \uD83C\uDF11</span>');
  if (day.tz.num === 13)             badges.push('<span class="fday-badge fb-portal">Portal \u00b7 Tone 13</span>');
  if (day.tz.signIdx === 4)          badges.push('<span class="fday-badge fb-serpent">Serpent \uD83D\uDC0D</span>');
  if (isBirthday)                    badges.push('<span class="fday-badge fb-moon">\u2605 Galactic Birthday</span>');

  // Insight
  const insight = day.tz.sign.keywords + (day.nk.quality === 'sacred' || day.nk.quality === 'auspicious' ?
    ' \u00b7 ' + day.nk.name + ': ' + day.nk.keywords : '');

  // Sacred tithi note
  const tithiNote = day.tithi in (typeof SACRED_TITHIS!=='undefined'?SACRED_TITHIS:{})
    ? '<div style="font-size:12px;color:rgba(245,240,232,.35);margin-top:6px;font-style:italic;">'+SACRED_TITHIS[day.tithi].note+'</div>' : '';

  // Xiu note
  const xiuNote = day.xiu && (day.xiu.quality === 'auspicious' || day.xiu.quality === 'intense' || day.xiu.quality === 'caution')
    ? '<div style="font-size:12px;color:rgba(220,160,80,.4);margin-top:4px;font-style:italic;">'+day.xiu.ch+' '+day.xiu.name+': '+day.xiu.guidance+'</div>' : '';

  const noteTxt = day.journalNote ? '<div style="font-size:13px;color:rgba(245,240,232,.55);line-height:1.7;font-style:italic;margin-top:10px;">'+day.journalNote+'</div>' : '';

  el.innerHTML = '<div class="fday" style="--fd-color:'+fdColor+';background:'+bg+';border-color:'+border+';">'
    +'<div class="fday-header">'
    +'<div>'
    +'<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.15em;color:rgba(201,168,76,.5);text-transform:uppercase;">Daily Signature</div>'
    +'<div class="fday-date-sub" style="margin-top:2px;">'+day.phase.name+' \u00b7 Tithi '+day.tithi+' \u00b7 '+day.nk.name+(day.xiu?' \u00b7 '+day.xiu.ch+' '+day.xiu.name:'')+'</div>'
    +'</div>'
    +(badges.length?'<div class="fday-badges">'+badges.join('')+'</div>':'')
    +'</div>'
    +'<div class="fday-pills" style="margin-top:8px;">'
    +'<span class="fpill tz" style="font-size:11px;">'+tzStr+'</span>'
    +'<span class="fpill lm" style="font-size:11px;">'+moonStr+'</span>'
    +'<span class="fpill vd" style="font-size:11px;">'+nkStr+'</span>'
    +xiuPill
    +moonEventPill
    +'</div>'
    +'<div class="fday-insight" style="margin-top:8px;">'+insight+'</div>'
    +tithiNote
    +xiuNote
    +noteTxt
    +'</div>';
}


// ─── COMPACT SW STRIP FOR NOW SECTION ────────────────────────────────────────
function renderSwStrip(data){
  const el = document.getElementById('swStrip');
  if(!el) return;
  if(!data || data.error){ el.style.display='none'; return; }

  const kp = data.kp;
  const wind = data.solarWind;
  if(!kp?.current && kp?.current !== 0){ el.style.display='none'; return; }

  const cls = kp.classification || {};
  const color = cls.color || 'rgba(201,168,76,.5)';
  const kpVal = kp.current !== null ? kp.current.toFixed(1) : '—';
  const windStr = wind?.speed ? wind.speed + ' km/s' : '';
  const bzNum = wind?.bz ? parseFloat(wind.bz) : null;
  const bzColor = bzNum !== null ? (bzNum < -5 ? '#c07050' : bzNum > 0 ? '#4a9a6a' : 'rgba(245,240,232,.4)') : 'rgba(245,240,232,.3)';

  el.style.display = 'flex';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:rgba(245,240,232,.02);border:1px solid rgba(245,240,232,.07);border-radius:20px;flex-wrap:wrap;">
    <span style="font-size:10px;font-family:'Cinzel',serif;letter-spacing:.08em;color:rgba(245,240,232,.3);text-transform:uppercase;">Field</span>
    <span style="display:inline-flex;align-items:center;gap:5px;">
      <span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;box-shadow:0 0 6px ${color};"></span>
      <span style="font-family:'Cinzel',serif;font-size:11px;color:${color};">${cls.label||'—'}</span>
      <span style="font-size:10px;color:rgba(245,240,232,.25);">Kp ${kpVal}</span>
    </span>
    ${windStr ? `<span style="font-size:11px;color:rgba(245,240,232,.3);">· ${windStr}</span>` : ''}
    ${bzNum !== null ? `<span style="font-size:11px;color:${bzColor};">Bz ${wind.bz}nT</span>` : ''}
  </div>`;
}

// --- SPACE WEATHER ---
const SWK = 'lunations_sw_v1';

async function fetchSpaceWeather(force=false){
  // Cache for 10 minutes
  if(!force){
    try{
      const c = JSON.parse(localStorage.getItem(SWK)||'null');
      if(c && (Date.now()-new Date(c.timestamp).getTime()) < 600000){
        renderSpaceWeather(c);
        renderSwStrip(c);
        return;
      }
    } catch(e){}
  }

  try{
    const res = await fetch('/api/spaceweather');
    if(!res.ok) throw new Error(res.status);
    const data = await res.json();
    localStorage.setItem(SWK, JSON.stringify(data));
    renderSpaceWeather(data);
    renderSwStrip(data);
  } catch(e){
    const fallback = {error: true};
    ['swContent','swContentSky'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.innerHTML = '<span class="sw-loading">Field data unavailable — check back shortly</span>';
    });
  }
}

// ─── CALENDAR EVENTS IN NOW TAB ──────────────────────────────────────────────
function renderCalendarEvents() {
  var card = document.getElementById('calendarEventsCard');
  if (!card) return;
  var events = getTodayCalendarEvents();
  if (!events.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  var rows = events.map(function(ev) {
    var timeStr = ev.allDay ? '<span class="cal-allday">All day</span>' : '<span class="cal-time">' + formatCalTime(ev.start) + '</span>';
    return '<div class="cal-event">' + timeStr + '<span class="cal-title">' + (ev.title || '(no title)') + '</span></div>';
  }).join('');
  card.innerHTML = '<div class="cal-card"><div class="cal-card-title">\uD83D\uDCC5 Today\'s Events</div>' + rows + '</div>';
}

function renderSpaceWeather(data){
  const html = buildSwHTML(data);
  const compact = buildSwCompact(data);
  const full = document.getElementById('swContent');
  const sky = document.getElementById('swContentSky');
  if(full) full.innerHTML = html;  // Full view: The Sky section on Today
  if(sky) sky.innerHTML = html;   // Full view: Sky tab
  // Update card border color
  const kpColor = data.kp?.classification?.color || 'rgba(201,168,76,.3)';
  document.querySelectorAll('.sw-card').forEach(c => {
    c.style.setProperty('--sw-color', kpColor);
    c.style.borderColor = kpColor.replace(')', ',.25)').replace('rgb','rgba');
  });
}

function buildSwCompact(data){
  if(data.error) return '<span class="sw-loading">Unavailable</span>';
  const kp = data.kp || {};
  const cls = kp.classification || {};
  const wind = data.solarWind || {};

  const kpVal = kp.current !== null && kp.current !== undefined ? kp.current.toFixed(1) : '—';
  const kpPct = kp.current !== null ? Math.min(100,(kp.current/9)*100) : 0;

  let html = '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:10px;">';
  html += '<div style="display:flex;align-items:center;gap:10px;">';
  html += '<div style="font-family:Cinzel,serif;font-size:28px;color:' + (cls.color||'#c9a84c') + ';line-height:1;">' + kpVal + '</div>';
  html += '<div><div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.1em;color:' + (cls.color||'#c9a84c') + ';text-transform:uppercase;">' + (cls.label||'—') + '</div>';
  html += '<div style="font-size:11px;color:rgba(245,240,232,.3);margin-top:1px;">Kp Index</div></div></div>';

  if(wind.speed){
    html += '<div><div style="font-size:15px;color:rgba(245,240,232,.6);">' + wind.speed + '<span style="font-size:10px;color:rgba(245,240,232,.3);"> km/s</span></div>';
    html += '<div style="font-size:10px;color:rgba(245,240,232,.3);">Solar wind</div></div>';
  }
  if(wind.bz){
    const bzNum = parseFloat(wind.bz);
    const bzColor = bzNum < -5 ? '#c07050' : bzNum > 0 ? '#4a9a6a' : 'rgba(245,240,232,.5)';
    html += '<div><div style="font-size:15px;color:' + bzColor + ';">' + wind.bz + '<span style="font-size:10px;color:rgba(245,240,232,.3);"> nT Bz</span></div>';
    html += '<div style="font-size:10px;color:rgba(245,240,232,.3);">Interplanetary field</div></div>';
  }
  html += '</div>';

  // Kp bar
  html += '<div class="sw-kp-bar-wrap"><div class="sw-kp-bar" style="width:' + kpPct + '%;background:' + (cls.color||'#c9a84c') + ';"></div></div>';

  // Description
  if(cls.desc) html += '<div class="sw-desc">' + cls.desc + '</div>';

  return html;
}

function buildSwHTML(data){
  if(data.error) return '<span class="sw-loading">Field data unavailable</span>';
  const kp = data.kp || {};
  const cls = kp.classification || {};
  const wind = data.solarWind || {};

  let html = buildSwCompact(data);

  // Full metrics grid
  html += '<div class="sw-grid">';
  if(kp.max24h !== undefined){
    html += '<div class="sw-metric"><span class="sw-metric-val">' + kp.max24h.toFixed(1) + '</span><div class="sw-metric-label">Peak Kp (24h)</div></div>';
  }
  if(wind.speed){
    html += '<div class="sw-metric"><span class="sw-metric-val">' + wind.speed + '<span class="sw-metric-unit">km/s</span></span><div class="sw-metric-label">Solar wind speed</div><div style="font-size:10px;color:rgba(245,240,232,.25);margin-top:2px;">' + (wind.speedDesc||'') + '</div></div>';
  }
  if(wind.density){
    html += '<div class="sw-metric"><span class="sw-metric-val">' + wind.density + '<span class="sw-metric-unit">p/cm³</span></span><div class="sw-metric-label">Proton density</div></div>';
  }
  if(wind.bz){
    const bzNum = parseFloat(wind.bz);
    const bzColor = bzNum < -5 ? '#c07050' : bzNum > 0 ? '#4a9a6a' : 'rgba(245,240,232,.6)';
    html += '<div class="sw-metric"><span class="sw-metric-val" style="color:' + bzColor + ';">' + wind.bz + '<span class="sw-metric-unit">nT</span></span><div class="sw-metric-label">Bz component</div><div style="font-size:10px;color:rgba(245,240,232,.25);margin-top:2px;">' + (wind.bzDesc||'') + '</div></div>';
  }
  html += '</div>';

  // Kp sparkline
  if(kp.history && kp.history.length > 1){
    const vals = kp.history.map(h => h.kp);
    const max = Math.max(9, ...vals);
    const W = 300, H = 32;
    const pts = vals.map((v,i) => {
      const x = (i/(vals.length-1)) * W;
      const y = H - (v/max)*H;
      return x + ',' + y;
    }).join(' ');
    const fillPts = '0,' + H + ' ' + pts + ' ' + W + ',' + H;
    html += '<svg class="sw-sparkline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    html += '<polygon points="' + fillPts + '" fill="' + (cls.color||'#c9a84c') + '" opacity="0.12"/>';
    html += '<polyline points="' + pts + '" fill="none" stroke="' + (cls.color||'#c9a84c') + '" stroke-width="1.5" opacity="0.7"/>';
    html += '</svg>';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:rgba(245,240,232,.2);font-style:italic;"><span>24h ago</span><span>now</span></div>';
  }

  // Alerts
  if(data.alerts && data.alerts.length){
    html += '<div style="margin-top:12px;">';
    data.alerts.forEach(a => {
      html += '<div class="sw-alert">' + a.message + '</div>';
    });
    html += '</div>';
  }

  // Updated time
  const ago = data.timestamp ? Math.floor((Date.now()-new Date(data.timestamp).getTime())/60000) : null;
  if(ago !== null) html += '<div style="font-size:10px;color:rgba(245,240,232,.18);margin-top:8px;text-align:right;">Updated ' + ago + 'm ago</div>';

  return html;
}


// ─── FORCE SYNC ALL LOCAL TO CLOUD ───────────────────────────────────────────
async function forceSyncAll(){
  if(!currentUser || !sbClient){
    showToast('Sign in to sync to cloud');
    return;
  }
  const entries = loadEntries();
  const count = Object.keys(entries).length;
  if(!count){ showToast('No entries to sync'); return; }
  showToast('Syncing ' + count + ' entries…');
  try{
    const token = getAccessToken();
    if(!token){ showToast('Session expired — please sign in again'); return; }
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify({entries})
    });
    const data = await res.json();
    if(data.synced !== undefined){
      localStorage.setItem('lunations_last_sync', new Date().toLocaleDateString());
      showToast('✦ ' + data.synced + ' entries synced to cloud');
    } else {
      showToast('Sync failed: ' + (data.error||'unknown error'));
    }
  } catch(e){
    showToast('Sync error — check connection');
    console.error('forceSyncAll error:', e);
  }
}


// ─── EVENING CHECK-IN ────────────────────────────────────────────────────────
const EVE_KEY = 'lunations_eve_v1';

function loadEveningEntries(){
  try{ return JSON.parse(localStorage.getItem(EVE_KEY)||'{}'); }
  catch(e){ return {}; }
}

function saveEveningEntries(data){
  localStorage.setItem(EVE_KEY, JSON.stringify(data));
}

function renderEveningCheckin(){
  const wrap = document.getElementById('eveningCheckin');
  if(!wrap) return;

  const todayKey = entryKey(new Date());
  const morningEntry = loadEntries()[todayKey];
  if(!morningEntry){ wrap.style.display = 'none'; return; }

  // Only show if we're on the evening tab
  var currentMode = getLogMode();
  if(currentMode !== 'evening'){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  // Check EVE_KEY first, then fall back to eve* fields in main entry
  const eveEntries = loadEveningEntries();
  let eveEntry = eveEntries[todayKey];

  // Reconstruct from main entry if EVE_KEY was cleared
  if(!eveEntry && morningEntry?.eveTimestamp){
    eveEntry = {
      energy:    morningEntry.eveEnergy,
      mood:      morningEntry.eveMood,
      clarity:   morningEntry.eveClarity,
      creativity:morningEntry.eveCreativity,
      text:      morningEntry.eveText || '',
      timestamp: morningEntry.eveTimestamp,
      morningEnergy: morningEntry.energy,
      morningMood:   morningEntry.mood,
    };
    // Re-save to EVE_KEY so it persists
    eveEntries[todayKey] = eveEntry;
    saveEveningEntries(eveEntries);
  }

  if(eveEntry){
    showEveningSubmitted(eveEntry, morningEntry);
  } else {
    const hasInput = document.getElementById('eveText')?.value?.length > 0;
    if(!hasInput) showEveningForm(morningEntry);
    else document.getElementById('eveFormWrap').style.display = 'block';
  }
}

function showEveningForm(morningEntry){
  const form = document.getElementById('eveFormWrap');
  const submitted = document.getElementById('eveSubmittedCard');
  if(form) form.style.display = 'block';
  if(submitted) submitted.style.display = 'none';

  // Update sub text based on time of day
  const hour = new Date().getHours();
  const sub = document.getElementById('eveCardSub');
  if(sub){
    if(hour < 17) sub.textContent = 'Whenever the day feels complete.';
    else if(hour < 21) sub.textContent = 'The day is settling. How did it land?';
    else sub.textContent = 'Before you rest — how was the day?';
  }

  // Reset sliders to 5
  ['eveSliderEnergy','eveSliderMood','eveSliderClarity','eveSliderCreativity'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.value = 5; el.dispatchEvent(new Event('input')); }
  });
  const eveText = document.getElementById('eveText');
  if(eveText) eveText.value = '';

  // Show delta row if morning entry exists
  if(morningEntry) updateEveDelta();
}

function updateEveDelta(){
  const todayKey = entryKey(new Date());
  const morning = loadEntries()[todayKey];
  if(!morning) return;

  const deltaRow = document.getElementById('eveDeltaRow');
  if(deltaRow) deltaRow.style.display = 'block';

  function deltaEl(id, eveVal, mornVal){
    const el = document.getElementById(id);
    if(!el) return;
    const diff = +eveVal - +mornVal;
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const sign = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
    el.textContent = sign + Math.abs(diff);
    el.className = 'eve-delta ' + cls;
  }

  deltaEl('eveDeltaEnergy',
    document.getElementById('eveSliderEnergy')?.value||5, morning.energy);
  deltaEl('eveDeltaMood',
    document.getElementById('eveSliderMood')?.value||5, morning.mood);
  deltaEl('eveDeltaClarity',
    document.getElementById('eveSliderClarity')?.value||5, morning.clarity);
}

function saveEveningEntry(){
  const todayKey = entryKey(new Date());
  const morning = loadEntries()[todayKey];

  const eveData = {
    energy:    +document.getElementById('eveSliderEnergy').value,
    mood:      +document.getElementById('eveSliderMood').value,
    clarity:   +document.getElementById('eveSliderClarity').value,
    creativity:+document.getElementById('eveSliderCreativity').value,
    text:      document.getElementById('eveText').value.trim(),
    timestamp: new Date().toISOString(),
    morningEnergy:  morning?.energy || null,
    morningMood:    morning?.mood || null,
  };

  const eves = loadEveningEntries();
  eves[todayKey] = eveData;
  saveEveningEntries(eves);

  // Also push to DB by merging into the day's entry
  if(morning){
    const entries = loadEntries();
    entries[todayKey] = {
      ...entries[todayKey],
      eveEnergy:    eveData.energy,
      eveMood:      eveData.mood,
      eveClarity:   eveData.clarity,
      eveCreativity:eveData.creativity,
      eveText:      eveData.text,
      eveTimestamp: eveData.timestamp,
    };
    // Record evening snapshot
    var snaps=entries[todayKey].snapshots||[];
    snaps.push({type:'evening',time:eveData.timestamp,energy:eveData.energy,mood:eveData.mood,clarity:eveData.clarity,creativity:eveData.creativity});
    entries[todayKey].snapshots=snaps;
    try{ saveEntries(entries); }catch(e){ console.error('Save failed:', e); }
    pushEntryToCloud(todayKey, entries[todayKey]);
  }

  showToast('✦ Evening check-in saved');
  setTimeout(function(){setLogMode('daylog');},150);
}

function showEveningSubmitted(eveEntry, morningEntry){
  const form = document.getElementById('eveFormWrap');
  const submitted = document.getElementById('eveSubmittedCard');
  if(form) form.style.display = 'none';
  if(!submitted) return;
  submitted.style.display = 'block';

  const metrics = [
    {val: eveEntry.energy, label: 'Energy', morn: morningEntry?.energy},
    {val: eveEntry.mood, label: 'Mood', morn: morningEntry?.mood},
    {val: eveEntry.clarity, label: 'Clarity', morn: morningEntry?.clarity},
    {val: eveEntry.creativity, label: 'Creativity', morn: morningEntry?.creativity},
  ];

  const metricsEl = document.getElementById('eveSubmittedMetrics');
  if(metricsEl){
    metricsEl.innerHTML = metrics.map(m => {
      const diff = m.morn !== undefined ? m.val - m.morn : null;
      const delta = diff === null ? '' :
        `<span class="eve-delta ${diff>0?'up':diff<0?'down':'same'}">${diff>0?'↑':'↓'}${Math.abs(diff)}</span>`;
      return `<div class="eve-metric">
        <span class="eve-metric-val">${m.val}${delta}</span>
        <div class="eve-metric-label">${m.label}</div>
      </div>`;
    }).join('');
  }

  const textEl = document.getElementById('eveSubmittedText');
  if(textEl){
    textEl.textContent = eveEntry.text || '';
    textEl.style.display = eveEntry.text ? 'block' : 'none';
  }
}


// ─── STREAK ──────────────────────────────────────────────────────────────────
function renderStreak(){
  const entries = loadEntries();
  const keys = Object.keys(entries).sort().reverse();
  if(keys.length < 2){ document.getElementById('streakBar').style.display='none'; return; }

  const todayKey = entryKey(new Date());
  let streak = 0;
  const check = new Date();

  for(let i=0; i<1000; i++){
    const k = entryKey(check);
    if(entries[k]){ streak++; }
    else if(k === todayKey){ /* today not logged yet, don't break */ }
    else break;
    check.setDate(check.getDate()-1);
  }

  if(streak < 2){ document.getElementById('streakBar').style.display='none'; return; }

  const bar = document.getElementById('streakBar');
  const numEl = document.getElementById('streakNum');
  const msgEl = document.getElementById('streakMsg');
  if(!bar||!numEl||!msgEl) return;

  bar.style.display = 'flex';
  numEl.textContent = streak;

  const msgs = {
    2: 'two days in a row',
    3: 'three days — momentum building',
    7: 'a full week of tracking',
    14: 'two weeks of inner weather',
    21: 'twenty-one days — this is practice now',
    29: 'one full cycle',
    30: 'one full cycle',
  };
  const milestones = [29,21,14,7,3,2];
  const milestone = milestones.find(m => streak >= m);
  msgEl.textContent = streak === 1 ? '' :
    streak >= 365 ? '✦ one year of devotion' :
    streak >= 180 ? '✦ six months — the practice holds you now' :
    streak >= 90  ? '✦ three months — deeply rooted' :
    streak >= 58  ? '✦ two full cycles' :
    streak >= 29  ? '✦ one complete cycle' :
    streak >= 21  ? '✦ twenty-one days — this is a practice' :
    streak >= 14  ? '✦ two weeks of presence' :
    streak >= 7   ? '✦ one full week' :
    streak >= 3   ? streak + ' days in a row' :
    'two days in a row';
}


// ─── PWA INSTALL ─────────────────────────────────────────────────────────────
let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  // Show banner after 30 seconds if not dismissed
  const dismissed = localStorage.getItem('lunations_pwa_dismissed');
  if(!dismissed){
    setTimeout(() => {
      const banner = document.getElementById('pwaBanner');
      if(banner) banner.classList.add('show');
    }, 30000);
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem('lunations_pwa_installed', '1');
  const banner = document.getElementById('pwaBanner');
  if(banner) banner.classList.remove('show');
});

function pwsInstall(){
  if(_pwaPrompt){
    _pwaPrompt.prompt();
    _pwaPrompt.userChoice.then(r => {
      if(r.outcome === 'accepted') localStorage.setItem('lunations_pwa_installed','1');
      _pwaPrompt = null;
    });
  } else {
    // iOS Safari - show manual instructions
    showToast('Tap the Share button → "Add to Home Screen"');
  }
  const banner = document.getElementById('pwaBanner');
  if(banner) banner.classList.remove('show');
}

function pwaDismiss(){
  localStorage.setItem('lunations_pwa_dismissed', '1');
  const banner = document.getElementById('pwaBanner');
  if(banner) banner.classList.remove('show');
}

// Show install hint in hamburger menu
function getPWAStatus(){
  if(localStorage.getItem('lunations_pwa_installed')) return 'installed';
  if(window.matchMedia('(display-mode: standalone)').matches) return 'installed';
  return 'not-installed';
}


// ─── SHAREABLE CYCLE CARD ─────────────────────────────────────────────────────
function openShareCard(){
  const modal = document.getElementById('shareModal');
  if(!modal) return;
  renderSharePreview();
  modal.classList.add('open');
}

function renderInlineCycleCard(){
  var el=document.getElementById('inlineCycleCard');if(!el)return;
  var entries=loadEntries(),now=new Date(),phase=moonPhaseInfo(now),mSign=moonSignApprox(now);
  var nm=getCycleStart(0);
  var cycleKeys=Object.keys(entries).filter(function(k){var d=new Date(k+'T12:00:00');return d>=nm&&d<=now;});
  if(cycleKeys.length<2){el.innerHTML='';return;}
  var avg=function(arr){return arr.length?Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length*10)/10:'—';};
  var avgE=avg(cycleKeys.map(function(k){return entries[k].energy||0;}));
  var avgM=avg(cycleKeys.map(function(k){return entries[k].mood||0;}));
  var avgCl=avg(cycleKeys.map(function(k){return entries[k].clarity||0;}));
  var avgCr=avg(cycleKeys.map(function(k){return entries[k].creativity||0;}));
  var qualCounts={};cycleKeys.forEach(function(k){(entries[k].qualities||[]).forEach(function(q){qualCounts[q]=(qualCounts[q]||0)+1;});});
  var topQual=Object.entries(qualCounts).sort(function(a,b){return b[1]-a[1];})[0]?.[0]||'';
  el.innerHTML='<div class="share-preview">'
    +'<div class="share-stars">✦ ✦ ✦</div>'
    +'<div class="share-title">Lunations · Cycle '+Math.max(1,getCycleNum(nm))+'</div>'
    +'<span class="share-moon-big">'+phase.emoji+'</span>'
    +'<div class="share-phase">'+phase.name+'</div>'
    +'<div class="share-sign">Moon in '+mSign.name+' · '+cycleKeys.length+' days logged</div>'
    +'<div class="share-metrics">'
    +'<div class="share-metric"><span class="share-metric-val">'+avgE+'</span><span class="share-metric-label">Energy</span></div>'
    +'<div class="share-metric"><span class="share-metric-val">'+avgM+'</span><span class="share-metric-label">Mood</span></div>'
    +'<div class="share-metric"><span class="share-metric-val">'+avgCl+'</span><span class="share-metric-label">Clarity</span></div>'
    +'<div class="share-metric"><span class="share-metric-val">'+avgCr+'</span><span class="share-metric-label">Create</span></div>'
    +'</div>'
    +(topQual?'<div style="font-size:13px;color:rgba(245,240,232,.4);text-align:center;font-style:italic;margin-bottom:16px;">Most felt: '+topQual+'</div>':'')
    +'<div class="share-tagline">the sky remembers who you are · lunations.app</div>'
    +'</div>'
    +'<div style="text-align:center;margin-top:14px;">'
    +'<button onclick="shareInlineCard()" style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:11px 24px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.4);border-radius:3px;color:var(--gold);cursor:pointer;">Share &#8599;</button>'
    +'</div>';
}

function renderSharePreview(){
  const entries = loadEntries();
  const now = new Date();
  const phase = moonPhaseInfo(now);
  const mSign = moonSignApprox(now);
  const profile = loadProfile();

  // Get current cycle stats
  const nm = getCycleStart(0);
  const cycleKeys = Object.keys(entries).filter(k => {
    const d = new Date(k+'T12:00:00');
    return d >= nm && d <= now;
  });

  const avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*10)/10 : '—';
  const avgEnergy = avg(cycleKeys.map(k=>entries[k].energy||0));
  const avgMood = avg(cycleKeys.map(k=>entries[k].mood||0));
  const avgClarity = avg(cycleKeys.map(k=>entries[k].clarity||0));
  const avgCreativity = avg(cycleKeys.map(k=>entries[k].creativity||0));

  // Get most common quality this cycle
  const qualCounts = {};
  cycleKeys.forEach(k => (entries[k].qualities||[]).forEach(q => qualCounts[q]=(qualCounts[q]||0)+1));
  const topQual = Object.entries(qualCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';

  const preview = document.getElementById('sharePreviewContent');
  if(!preview) return;

  preview.innerHTML = `
    <div class="share-preview">
      <div class="share-stars">✦ ✦ ✦</div>
      <div class="share-title">Lunations · Cycle ${Math.max(1,getCycleNum(nm))}</div>
      <span class="share-moon-big">${phase.emoji}</span>
      <div class="share-phase">${phase.name}</div>
      <div class="share-sign">Moon in ${mSign.name} · ${cycleKeys.length} days logged</div>
      <div class="share-metrics">
        <div class="share-metric"><span class="share-metric-val">${avgEnergy}</span><span class="share-metric-label">Energy</span></div>
        <div class="share-metric"><span class="share-metric-val">${avgMood}</span><span class="share-metric-label">Mood</span></div>
        <div class="share-metric"><span class="share-metric-val">${avgClarity}</span><span class="share-metric-label">Clarity</span></div>
        <div class="share-metric"><span class="share-metric-val">${avgCreativity}</span><span class="share-metric-label">Create</span></div>
      </div>
      ${topQual ? `<div style="font-size:13px;color:rgba(245,240,232,.4);text-align:center;font-style:italic;margin-bottom:16px;">Most felt: ${topQual}</div>` : ''}
      <div class="share-tagline">the sky remembers who you are · lunations.app</div>
    </div>`;
}

async function shareCardImage(el){
  if(!el){showToast('Nothing to share');return;}
  showToast('Preparing image…');
  try{
    var canvas=await html2canvas(el,{backgroundColor:null,scale:2,useCORS:true});
    var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/png');});
    if(!blob){showToast('Could not create image');return;}
    var file=new File([blob],'lunations-cycle.png',{type:'image/png'});
    // Try native share with image file
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'My Lunations Cycle',url:'https://lunations.app'});
      return;
    }
    // Fallback: download the image
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='lunations-cycle.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Image saved — share it with lunations.app');
  }catch(e){
    if(e.name==='AbortError')return; // user cancelled share sheet
    console.warn('Share image error:',e);
    navigator.clipboard?.writeText('https://lunations.app').then(function(){showToast('Link copied — share with lunations.app');});
  }
}

async function shareCard(){
  var el=document.querySelector('#sharePreviewContent .share-preview');
  await shareCardImage(el);
}

async function shareInlineCard(){
  var el=document.querySelector('#inlineCycleCard .share-preview');
  await shareCardImage(el);
}


// ─── TOOLTIP HELPER ──────────────────────────────────────────────────────────
function tip(label, title, body){
  return `<span class="tip" tabindex="0">${label}<span class="tip-box"><span class="tip-title">${title}</span>${body}</span></span>`;
}

// Vedic term tooltips
const VEDIC_TIPS = {
  Tithi: ['Tithi', `The lunar day in the Vedic calendar. One of 30 phases in the lunar cycle, each with its own deity, quality, and guidance for action.`],
  Nakshatra: ['Nakshatra', `Lunar mansion. The moon moves through 27 star clusters, each with a ruling planet, symbol, and energy quality that shapes the emotional tone of the day.`],
  Vara: ['Vara', `The planetary weekday. Monday = Moon, Tuesday = Mars, Wednesday = Mercury, Thursday = Jupiter, Friday = Venus, Saturday = Saturn, Sunday = Sun.`],
  Ekadashi: ['Ekadashi', `The 11th tithi — the most sacred day in the Vaishnava tradition. Fasting and devotional practice are especially potent. Auspicious for prayer and spiritual work.`],
  Ashtami: ['Ashtami', `The 8th tithi — associated with Durga and Kali. Fierce energy, good for shadow work, facing difficulty, and fierce devotion.`],
  Amavasya: ['Amavasya', `New moon tithi. The darkest night — powerful for ancestor rituals, deep meditation, new intentions, and dissolution work.`],
  Purnima: ['Purnima', `Full moon tithi. The most luminous night — peak energy for celebration, offering, gratitude, and devotional practices.`],
  Pushya: ['Pushya Nakshatra', `The most nourishing nakshatra, ruled by Saturn with Jupiter energy. A day of blessings and spiritual grace. Excellent for beginning new practices.`],
  Rohini: ['Rohini Nakshatra', `The favorite nakshatra of the Moon, associated with beauty, fertility, and creative abundance. Krishna's birth star. Rich, sensual, growing energy.`],
  Ardra: ['Ardra Nakshatra', `The storm star — ruled by Rahu, associated with Rudra (Shiva). Intense dissolving energy. Good for clearing, cutting through illusion, fierce transformation.`],
  Mula: ['Mula Nakshatra', `The root — ruled by Ketu, associated with Nirriti. Goes to the root of things. Powerful but uprooting. Excellent for going deep, not for new beginnings.`],
};

// Tzolkin term tooltips
const TZOLKIN_TIPS = {
  Kin: ['Kin', `A single day in the Tzolkin calendar. Each kin combines a number (1-13) with a day sign (one of 20 glyphs) creating 260 unique combinations.`],
  Tzolkin: ['Tzolkin', `The 260-day sacred Mayan calendar, used for divination and ceremony. One complete cycle equals 9 lunar months — the length of human gestation.`],
  Tone: ['Galactic Tone', `The number 1-13 governing the kin. Each tone carries an intention: 1=Magnetic (purpose), 7=Resonant (channel), 13=Cosmic (transcend).`],
  Wavespell: ['Wavespell', `A 13-day journey through one day sign's teachings. Each wavespell is a mini-cycle of intention, refinement, and completion.`],
  Imix: ['Imix · Dragon', `Primal waters, birth, nurturing. The first seal — raw creative potential, the source, the mother. Dragon medicine: trust the primordial.`],
  Ik: ['Ik · Wind', `Spirit, breath, communication. The wind carries messages between worlds. Wind medicine: be a clear channel.`],
  Akbal: ['Akbal · Night', `Dreams, intuition, the abyss. The dark contains the seed. Night medicine: trust what lives in the dark.`],
  Kan: ['Kan · Seed', `Flowering, fertility, target. The seed holds the pattern of the whole tree. Seed medicine: plant your intention precisely.`],
  Chicchan: ['Chicchan · Serpent', `Life force, instinct, intimacy. Kundalini. The serpent knows the body's wisdom. Serpent medicine: embody the sacred.`],
  Cimi: ['Cimi · Worldbridger', `Death, surrender, release. The bridge between worlds. Worldbridger medicine: let go of what keeps you separate.`],
  Manik: ['Manik · Hand', `Accomplishment, healing, grasp. The hand that heals and creates. Hand medicine: completion as devotion.`],
  Lamat: ['Lamat · Star', `Harmony, elegance, beauty. The morning star. Star medicine: radiate your natural frequency.`],
  Muluc: ['Muluc · Moon', `Water, purification, universal flow. The moon's pull on all waters. Moon medicine: feel everything.`],
  Oc: ['Oc · Dog', `Love, loyalty, heart. The faithful companion. Dog medicine: unconditional love as path.`],
  Chuen: ['Chuen · Monkey', `Play, magic, illusion. The trickster weaver. Monkey medicine: creativity through spontaneity.`],
  Eb: ['Eb · Human', `Free will, harvest, wisdom. The path of the human. Human medicine: choose consciously.`],
  Ben: ['Ben · Skywalker', `Space, prophecy, exploration. Walks between worlds. Skywalker medicine: hold heaven and earth together.`],
  Ix: ['Ix · Wizard', `Timelessness, jaguar, shaman. The one who knows. Wizard medicine: align with eternal intelligence.`],
  Men: ['Men · Eagle', `Vision, mind, planet. Sees from above. Eagle medicine: expand your view to the highest perspective.`],
  Cib: ['Cib · Warrior', `Cosmic force, intelligence, grace. The fearless one. Warrior medicine: dissolve doubt through inner knowing.`],
  Caban: ['Caban · Earth', `Synchronicity, navigation, the mother. The living planet. Earth medicine: follow the signs.`],
  Etznab: ['Etznab · Mirror', `Endlessness, truth, illusion. The hall of mirrors. Mirror medicine: see clearly without distortion.`],
  Cauac: ['Cauac · Storm', `Purification, catalysis, self-generation. The thunder beings. Storm medicine: transformation through intensity.`],
  Ahau: ['Ahau · Sun', `Universal fire, solar lord, enlightenment. The 20th seal — completion and flowering. Sun medicine: radiate unconditional love.`],
};

function applyVedicTooltips(html){
  Object.entries(VEDIC_TIPS).forEach(([term, [title, body]]) => {
    const re = new RegExp(`\\b(${term})\\b`, 'g');
    html = html.replace(re, (match) => tip(match, title, body));
  });
  return html;
}

function applyTzolkinTooltips(html){
  Object.entries(TZOLKIN_TIPS).forEach(([term, [title, body]]) => {
    const re = new RegExp(`\\b(${term})\\b`, 'g');
    html = html.replace(re, (match) => tip(match, title, body));
  });
  return html;
}

// ─── TZOLKIN ENGINE ──────────────────────────────────────────────────────────
const TZOLKIN_ANCHOR = new Date(2012, 11, 21); // Dec 21 2012 = 4 Ahau (verified)
const TZOLKIN_ANCHOR_SIGN = 19; // Ahau index
const TZOLKIN_ANCHOR_NUM  = 4;

const TZOLKIN_SIGNS = [
  { name:'Imix',    glyph:'🌊', keywords:'Primal source, nurturing, origins, the void-womb' },
  { name:'Ik',      glyph:'💨', keywords:'Wind, spirit, breath, invisible forces, communication' },
  { name:'Akbal',   glyph:'🌑', keywords:'Night, dreaming, inner knowing, the dark house' },
  { name:'Kan',     glyph:'🌱', keywords:'Seed, fertility, abundance, the creative spark' },
  { name:'Chicchan',glyph:'🐍', keywords:'Serpent, Kundalini, life force, primal energy, body wisdom' },
  { name:'Cimi',    glyph:'💀', keywords:'Death, transformation, release, surrender, the great transition' },
  { name:'Manik',   glyph:'🦌', keywords:'Deer, healing hands, grace, the sacred journey' },
  { name:'Lamat',   glyph:'⭐', keywords:'Star, Venus, harmony, beauty, the light-bearer, abundance' },
  { name:'Muluc',   glyph:'💧', keywords:'Water, moon, offerings, emotional depth, purification' },
  { name:'Oc',      glyph:'🐕', keywords:'Dog, loyalty, heart, companionship, love as path' },
  { name:'Chuen',   glyph:'🐒', keywords:'Monkey, artisan, play, weaving time, the sacred trickster' },
  { name:'Eb',      glyph:'🌿', keywords:'Road, path, the pilgrim, human journey, grass' },
  { name:'Ben',     glyph:'🎋', keywords:'Reed, staff, pillars of heaven, the sky-walker, personal power' },
  { name:'Ix',      glyph:'🐆', keywords:'Jaguar, earth magic, shamanic power, feminine force, night vision' },
  { name:'Men',     glyph:'🦅', keywords:'Eagle, vision, global perspective, high mind, clarity from altitude' },
  { name:'Cib',     glyph:'🦅', keywords:'Vulture, owl, ancestral wisdom, forgiveness, karma, threshold keeper' },
  { name:'Caban',   glyph:'🌍', keywords:'Earth, synchronicity, navigation, the resonant field, quake' },
  { name:'Etznab',  glyph:'🔪', keywords:'Mirror, flint, clarity, truth, reflection, cutting through illusion' },
  { name:'Cauac',   glyph:'⛈',  keywords:'Storm, transformation, catalysis, purification, lightning' },
  { name:'Ahau',    glyph:'☀️', keywords:'Sun lord, flowering, enlightenment, ascension, unconditional love' },
];

const TZOLKIN_TONES = [
  { num:1,  name:'Magnetic',    desc:'Unify, attract, begin. Pure initiation.' },
  { num:2,  name:'Lunar',       desc:'Polarize, stabilize, challenge.' },
  { num:3,  name:'Electric',    desc:'Activate, bond, service.' },
  { num:4,  name:'Self-Existing',desc:'Define, measure, form.' },
  { num:5,  name:'Overtone',    desc:'Empower, command, radiance.' },
  { num:6,  name:'Rhythmic',    desc:'Organize, balance, equalize. (Your birth tone)' },
  { num:7,  name:'Resonant',    desc:'Channel, inspire, attune.' },
  { num:8,  name:'Galactic',    desc:'Harmonize, integrity, model.' },
  { num:9,  name:'Solar',       desc:'Pulse, realize, intention.' },
  { num:10, name:'Planetary',   desc:'Perfect, produce, manifest.' },
  { num:11, name:'Spectral',    desc:'Dissolve, liberate, release.' },
  { num:12, name:'Crystal',     desc:'Cooperate, dedicate, universalize.' },
  { num:13, name:'Cosmic',      desc:'Endure, transcend, presence. Portal tone.' },
];

// Personal Tzolkin data — Jeff born Feb 19 1988 = 6 Lamat
// BIRTH_TZOLKIN loaded from profile if available, defaults to Jeff's for now
function getBirthTzolkin(){
  const p = loadProfile();
  if(p?.dob){
    const bd = new Date(p.dob + 'T12:00:00');
    return tzolkinForDate(bd);
  }
  return { num: 6, signIdx: 7, sign: TZOLKIN_SIGNS?.[7] || {name:'Lamat'}, tone: TZOLKIN_TONES?.[5] || {} };
}
const BIRTH_TZOLKIN = { num: 6, signIdx: 7 }; // fallback - overridden at runtime
const BIRTH_WAVESPELL = 'Akbal'; // Dark House wavespell

function tzolkinForDate(d) {
  const msPerDay = 86400000;
  const delta = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
    new Date(TZOLKIN_ANCHOR.getFullYear(), TZOLKIN_ANCHOR.getMonth(), TZOLKIN_ANCHOR.getDate())) / msPerDay);
  const signIdx = ((TZOLKIN_ANCHOR_SIGN + delta) % 20 + 20) % 20;
  const num = (((TZOLKIN_ANCHOR_NUM - 1 + delta) % 13) + 13) % 13 + 1;
  return { num, signIdx, sign: TZOLKIN_SIGNS[signIdx], tone: TZOLKIN_TONES[num - 1] };
}

function getTzolkinAlert(tz) {
  const alerts = [];
  // Galactic birthday
  const birthTz2 = typeof getBirthTzolkin === 'function' ? getBirthTzolkin() : BIRTH_TZOLKIN;
  if (tz.num === birthTz2.num && tz.signIdx === birthTz2.signIdx) {
    alerts.push({ type: 'sacred', msg: '✦ Galactic Birthday — 6 Lamat. Your birth frequency is at peak. Channel is wide open.' });
  }
  // Red Serpent (Chicchan) — your birth wavespell sign
  if (tz.signIdx === 4) {
    alerts.push({ type: 'kundalini', msg: '🐍 Chicchan day — Serpent / Kundalini energy active. Strong for practice and somatic work.' });
  }
  // Tone 13 — portal
  if (tz.num === 13) {
    alerts.push({ type: 'portal', msg: '⊛ Tone 13 — Cosmic portal day. Transcendence frequency. The veil is thin.' });
  }
  // Lamat (Star/Venus) days
  if (tz.signIdx === 7) {
    alerts.push({ type: 'venus', msg: '⭐ Lamat day — Star / Venus frequency. Your sign archetype. Abundance and harmony available.' });
  }
  // Cib — threshold keeper (strong ancestral days)
  if (tz.signIdx === 15) {
    alerts.push({ type: 'ancestral', msg: '🦅 Cib day — Ancestral wisdom. The grandfathers are especially close today.' });
  }
  // Ix — earth magic, feminine shamanic
  if (tz.signIdx === 13) {
    alerts.push({ type: 'magic', msg: '🐆 Ix day — Earth magic and jaguar medicine. Strong for Kurukulla practice and feminine current work.' });
  }
  // Muluc — water/moon, lunar resonance
  if (tz.signIdx === 8) {
    alerts.push({ type: 'lunar', msg: '💧 Muluc day — Water and moon sign. Deep lunar resonance. Emotional and psychic field is open.' });
  }
  // Wavespell starts (tone 1 days)
  if (tz.num === 1) {
    alerts.push({ type: 'wave', msg: `✦ ${tz.sign.name} Wavespell opens today — 13 days of ${tz.sign.name} energy beginning. ${tz.signIdx === 4 ? 'Kundalini wavespell — significant.' : 'New current initiated.'}` });
  }
  return alerts;
}

function daysUntilNextTzolkin(targetNum, targetSignIdx, fromDate) {
  for (let i = 1; i <= 260; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const tz = tzolkinForDate(d);
    if (tz.num === targetNum && tz.signIdx === targetSignIdx) return { days: i, date: d };
  }
  return null;
}

// ─── LIFE EVENTS (user-configurable countdowns) ─────────────────────────────
var LIFE_EVENTS_KEY = 'lunations_life_events_v1';
function getLifeEvents() {
  try { return JSON.parse(localStorage.getItem(LIFE_EVENTS_KEY) || '[]'); } catch(e) { return []; }
}
function saveLifeEvents(events) {
  localStorage.setItem(LIFE_EVENTS_KEY, JSON.stringify(events));
}
function addLifeEvent() {
  var nameEl = document.getElementById('leNameInput');
  var dateEl = document.getElementById('leDateInput');
  if (!nameEl || !dateEl) return;
  var name = nameEl.value.trim();
  var date = dateEl.value;
  if (!name || !date) { showToast('Enter a name and date'); return; }
  var events = getLifeEvents();
  events.push({ id: 'le_' + Date.now(), name: name, month: parseInt(date.split('-')[1]), day: parseInt(date.split('-')[2]) });
  saveLifeEvents(events);
  nameEl.value = ''; dateEl.value = '';
  renderTzolkinPanel();
}
function removeLifeEvent(id) {
  saveLifeEvents(getLifeEvents().filter(function(e) { return e.id !== id; }));
  renderTzolkinPanel();
}
function renderLifeEventCountdowns(now, thisYear) {
  var events = getLifeEvents();
  if (!events.length) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">'
      + '<span style="font-size:12px;color:rgba(245,240,232,.2);font-style:italic;">Add dates that matter to you</span>'
      + '</div>';
  }
  return events.map(function(ev) {
    var ann = new Date(thisYear, ev.month - 1, ev.day);
    if (ann <= now) ann = new Date(thisYear + 1, ev.month - 1, ev.day);
    var days = Math.ceil((ann - now) / 86400000);
    var tz = tzolkinForDate(ann);
    var dateStr = ann.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(245,240,232,.05);">'
      + '<span style="font-size:13px;color:rgba(245,240,232,.4);">' + ev.name + '</span>'
      + '<span style="font-family:Cinzel,serif;font-size:12px;color:rgba(245,240,232,.6);">' + dateStr + ' \u00b7 ' + tz.num + ' ' + tz.sign.name + ' \u00b7 ' + days + 'd'
      + ' <a onclick="removeLifeEvent(\'' + ev.id + '\')" style="color:rgba(245,240,232,.15);cursor:pointer;font-size:10px;margin-left:4px;">\u00d7</a></span>'
      + '</div>';
  }).join('');
}

function renderTzolkinPanel() {
  const now = new Date();
  const tz = tzolkinForDate(now);
  const alerts = getTzolkinAlert(tz);
  const nextBirthday = daysUntilNextTzolkin(BIRTH_TZOLKIN.num, BIRTH_TZOLKIN.signIdx, now);
  const nextSerpent = daysUntilNextTzolkin(1, 4, now); // next Red Serpent wavespell

  // Quality color based on special days
  const isSpecial = tz.num === 13 || tz.signIdx === 7 || tz.signIdx === 4;
  const isBirthday = tz.num === BIRTH_TZOLKIN.num && tz.signIdx === BIRTH_TZOLKIN.signIdx;
  const bg   = isBirthday ? 'rgba(201,168,76,.12)' : isSpecial ? 'rgba(100,80,180,.1)' : 'rgba(245,240,232,.025)';
  const bord = isBirthday ? 'rgba(201,168,76,.4)'  : isSpecial ? 'rgba(140,100,220,.3)' : 'rgba(245,240,232,.07)';
  const col  = isBirthday ? '#e8d49a' : isSpecial ? 'rgba(180,150,255,.85)' : 'rgba(245,240,232,.75)';

  const alertHTML = alerts.length ? alerts.map(a => {
    const alertBg = a.type === 'sacred' ? 'rgba(201,168,76,.07)' :
                    a.type === 'kundalini' ? 'rgba(120,60,60,.1)' :
                    a.type === 'portal' ? 'rgba(80,60,140,.12)' : 'rgba(60,80,120,.1)';
    const alertCol = a.type === 'sacred' ? 'rgba(232,212,154,.7)' :
                     a.type === 'kundalini' ? 'rgba(220,120,100,.7)' :
                     a.type === 'portal' ? 'rgba(180,150,255,.7)' : 'rgba(140,180,220,.6)';
    return `<div style="margin-top:10px;padding:10px 14px;background:${alertBg};border-radius:4px;font-size:13px;color:${alertCol};font-style:italic;">${a.msg}</div>`;
  }).join('') : '';

  const countdownRows = [];
  if (nextBirthday) {
    const bd = nextBirthday.date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    countdownRows.push(`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(245,240,232,.05);">
      <span style="font-size:13px;color:rgba(245,240,232,.4);">Next galactic birthday (6 Lamat)</span>
      <span style="font-family:'Cinzel',serif;font-size:13px;color:rgba(245,240,232,.7);">${bd} · ${nextBirthday.days}d</span>
    </div>`);
  }
  if (nextSerpent) {
    const sd = nextSerpent.date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    countdownRows.push(`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;">
      <span style="font-size:13px;color:rgba(245,240,232,.4);">Next Red Serpent wavespell</span>
      <span style="font-family:'Cinzel',serif;font-size:13px;color:rgba(245,240,232,.7);">${sd} · ${nextSerpent.days}d</span>
    </div>`);
  }

  const thisYear = now.getFullYear();

  var birthSign = TZOLKIN_SIGNS[BIRTH_TZOLKIN.signIdx];
  var birthNatal = birthSign ? '<span style="font-size:11px;color:rgba(245,240,232,.35);font-style:italic;font-family:inherit;text-transform:none;letter-spacing:0;">' + birthSign.glyph + ' ' + BIRTH_TZOLKIN.num + ' ' + birthSign.name + ' · ' + BIRTH_WAVESPELL + ' wavespell</span>' : '';

  const html = `<div class="astro-card" style="margin-bottom:20px;" id="tzolkinPanel">
    <div class="card-label" style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;">
      <span>Tzolkin · Sacred Calendar</span>
      ${birthNatal}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px;">

      <div style="background:${bg};border:1px solid ${bord};border-radius:6px;padding:14px;">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:${col};opacity:.8;margin-bottom:6px;text-transform:uppercase;">Day Sign</div>
        <div style="font-size:24px;margin-bottom:4px;">${tz.sign.glyph}</div>
        <div style="font-size:17px;color:rgba(245,240,232,.9);margin-bottom:4px;">${tz.num} ${tz.sign.name}</div>
        <div style="font-size:13px;color:rgba(245,240,232,.45);line-height:1.6;font-style:italic;">${tz.sign.keywords}</div>
      </div>

      <div style="background:rgba(245,240,232,.025);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:14px;">
        <div style="font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:rgba(245,240,232,.4);opacity:.8;margin-bottom:6px;text-transform:uppercase;">Tone ${tz.num}</div>
        <div style="font-size:17px;color:rgba(245,240,232,.85);margin-bottom:4px;">${tz.tone.name}</div>
        <div style="font-size:13px;color:rgba(245,240,232,.45);line-height:1.6;font-style:italic;">${tz.tone.desc}</div>
      </div>

    </div>

    <div style="margin-top:12px;padding:12px 14px;background:rgba(245,240,232,.02);border-radius:4px;" id="lifeEventsSection">
      <div style="font-family:Cinzel,serif;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:rgba(245,240,232,.2);margin-bottom:6px;">Life Events</div>
      ${renderLifeEventCountdowns(now, thisYear)}
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center;">
        <input id="leNameInput" type="text" placeholder="Event name" maxlength="30" style="flex:1;min-width:0;background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.08);border-radius:4px;padding:5px 8px;color:rgba(245,240,232,.7);font-size:12px;font-family:inherit;">
        <input id="leDateInput" type="date" style="background:rgba(245,240,232,.04);border:1px solid rgba(245,240,232,.08);border-radius:4px;padding:5px 6px;color:rgba(245,240,232,.5);font-size:11px;font-family:inherit;width:auto;">
        <button onclick="addLifeEvent()" style="background:none;border:1px solid rgba(201,168,76,.2);border-radius:4px;color:rgba(201,168,76,.5);font-size:14px;padding:2px 8px;cursor:pointer;flex-shrink:0;">+</button>
      </div>
    </div>

    ${alertHTML}
  </div>`;

  let wrap = document.getElementById('tzolkinPanelWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'tzolkinPanelWrap';
    const vedicWrap = document.getElementById('vedicPanelWrap');
    if (vedicWrap) vedicWrap.after(wrap);
    else {
      const cycleTone = document.getElementById('cycleTone')?.closest('.astro-card');
      if (cycleTone) cycleTone.after(wrap);
    }
  }
  wrap.innerHTML = applyTzolkinTooltips(html);
}


// ─── CHINESE ASTROLOGY (干支) ─────────────────────────────────────────────────
var CN_STEMS = [
  {name:'Jiǎ',  ch:'甲', element:'Wood',  yin:false},
  {name:'Yǐ',   ch:'乙', element:'Wood',  yin:true},
  {name:'Bǐng', ch:'丙', element:'Fire',  yin:false},
  {name:'Dīng', ch:'丁', element:'Fire',  yin:true},
  {name:'Wù',   ch:'戊', element:'Earth', yin:false},
  {name:'Jǐ',   ch:'己', element:'Earth', yin:true},
  {name:'Gēng', ch:'庚', element:'Metal', yin:false},
  {name:'Xīn',  ch:'辛', element:'Metal', yin:true},
  {name:'Rén',  ch:'壬', element:'Water', yin:false},
  {name:'Guǐ',  ch:'癸', element:'Water', yin:true}
];
var CN_BRANCHES = [
  {name:'Zǐ',   ch:'子', animal:'Rat',     emoji:'\uD83D\uDC00', hours:'11pm-1am'},
  {name:'Chǒu', ch:'丑', animal:'Ox',      emoji:'\uD83D\uDC02', hours:'1am-3am'},
  {name:'Yín',   ch:'寅', animal:'Tiger',   emoji:'\uD83D\uDC05', hours:'3am-5am'},
  {name:'Mǎo',  ch:'卯', animal:'Rabbit',  emoji:'\uD83D\uDC07', hours:'5am-7am'},
  {name:'Chén', ch:'辰', animal:'Dragon',  emoji:'\uD83D\uDC09', hours:'7am-9am'},
  {name:'Sì',   ch:'巳', animal:'Snake',   emoji:'\uD83D\uDC0D', hours:'9am-11am'},
  {name:'Wǔ',   ch:'午', animal:'Horse',   emoji:'\uD83D\uDC0E', hours:'11am-1pm'},
  {name:'Wèi',  ch:'未', animal:'Goat',    emoji:'\uD83D\uDC10', hours:'1pm-3pm'},
  {name:'Shēn', ch:'申', animal:'Monkey',  emoji:'\uD83D\uDC12', hours:'3pm-5pm'},
  {name:'Yǒu',  ch:'酉', animal:'Rooster', emoji:'\uD83D\uDC13', hours:'5pm-7pm'},
  {name:'Xū',   ch:'戌', animal:'Dog',     emoji:'\uD83D\uDC15', hours:'7pm-9pm'},
  {name:'Hài',  ch:'亥', animal:'Pig',     emoji:'\uD83D\uDC16', hours:'9pm-11pm'}
];
var CN_XIU = [
  // Eastern Azure Dragon (春 Spring) — Xiu 1-7
  {name:'Ji\u01CEo', ch:'角', animal:'Dragon',   meaning:'beginnings, awakening',    group:'East',  element:'Wood',  quality:'auspicious', guidance:'Favorable for new ventures, planting seeds, starting projects. The Horn of the Dragon opens the way.'},
  {name:'K\u00E0ng', ch:'亢', animal:'Dragon',   meaning:'strength, elevation',      group:'East',  element:'Metal', quality:'mixed',      guidance:'High energy but volatility. Good for bold action, poor for delicate negotiations. The Neck demands courage.'},
  {name:'D\u01D0',   ch:'氐', animal:'Badger',   meaning:'foundation, roots',        group:'East',  element:'Earth', quality:'auspicious', guidance:'Excellent for building foundations \u2014 homes, relationships, long-term plans. The Root grounds intentions.'},
  {name:'F\u00E1ng', ch:'房', animal:'Hare',     meaning:'shelter, home',            group:'East',  element:'Water', quality:'auspicious', guidance:'One of the most favorable mansions. Good for weddings, moving, family matters, and celebration.'},
  {name:'X\u012Bn',  ch:'心', animal:'Fox',      meaning:'heart, passion',           group:'East',  element:'Fire',  quality:'intense',    guidance:'The Heart of the Dragon. Emotionally intense day \u2014 passions run high. Meditate before acting. Good for creative work.'},
  {name:'W\u011Bi',  ch:'尾', animal:'Tiger',    meaning:'completion, endings',      group:'East',  element:'Fire',  quality:'auspicious', guidance:'Favorable for completing projects, harvesting, and succession planning. The Tail sweeps clean.'},
  {name:'J\u012B',   ch:'箕', animal:'Leopard',  meaning:'wind, scattering',         group:'East',  element:'Water', quality:'mixed',      guidance:'The Winnowing Basket \u2014 separates wheat from chaff. Good for discernment and releasing, not for accumulation.'},
  // Northern Black Tortoise (冬 Winter) — Xiu 8-14
  {name:'D\u01D2u',  ch:'斗', animal:'Unicorn',  meaning:'measure, discernment',     group:'North', element:'Water', quality:'auspicious', guidance:'The Dipper measures fate. Excellent for divination, decision-making, and spiritual practice. Trust your intuition.'},
  {name:'Ni\u00FA',  ch:'牛', animal:'Ox',       meaning:'patience, labor',          group:'North', element:'Metal', quality:'neutral',    guidance:'Steady, methodical energy. Good for routine work and persistence. Not a day for shortcuts.'},
  {name:'N\u01DA',   ch:'女', animal:'Bat',      meaning:'femininity, weaving',      group:'North', element:'Earth', quality:'mixed',      guidance:'The Weaving Maiden \u2014 creative but bittersweet. Good for textile arts, crafts, and inner work. Avoid major commitments.'},
  {name:'X\u016B',   ch:'虚', animal:'Rat',      meaning:'void, emptiness',          group:'North', element:'Water', quality:'caution',    guidance:'The Void mansion. Rest, retreat, and reflection. Not favorable for beginning new things. Honor the emptiness.'},
  {name:'W\u0113i',  ch:'危', animal:'Swallow',  meaning:'danger, awareness',        group:'North', element:'Fire',  quality:'caution',    guidance:'Danger \u2014 proceed with heightened awareness. Good for demolition and clearing, not for building. Stay alert.'},
  {name:'Sh\u00EC',  ch:'室', animal:'Pig',      meaning:'enclosure, home',          group:'North', element:'Water', quality:'auspicious', guidance:'The Encampment \u2014 favorable for building, renovating, domestic affairs, and creating sanctuary.'},
  {name:'B\u00EC',   ch:'壁', animal:'Porcupine',meaning:'walls, protection',        group:'North', element:'Water', quality:'auspicious', guidance:'The Wall protects. Excellent for boundaries, defense, study, and library work. A scholarly day.'},
  // Western White Tiger (秋 Autumn) — Xiu 15-21
  {name:'Ku\u00ED',  ch:'奎', animal:'Wolf',     meaning:'stride, progress',         group:'West',  element:'Wood',  quality:'auspicious', guidance:'The Stride of the White Tiger. Favorable for travel, exploration, construction, and forward movement.'},
  {name:'L\u00F3u',  ch:'娄', animal:'Dog',      meaning:'gathering, bonds',         group:'West',  element:'Metal', quality:'auspicious', guidance:'The Bond \u2014 excellent for gatherings, alliances, contracts, and animal husbandry. Community day.'},
  {name:'W\u00E8i',  ch:'胃', animal:'Pheasant', meaning:'nourishment, digestion',   group:'West',  element:'Earth', quality:'auspicious', guidance:'The Stomach receives and transforms. Good for feasts, storage, wealth management, and receiving.'},
  {name:'M\u01CEo',  ch:'昴', animal:'Rooster',  meaning:'clarity, illumination',    group:'West',  element:'Fire',  quality:'mixed',      guidance:'The Pleiades \u2014 bright clarity but sharp edges. Good for funerals, endings, and cutting ties. Avoid new starts.'},
  {name:'B\u00EC',   ch:'毕', animal:'Crow',     meaning:'nets, catching',           group:'West',  element:'Water', quality:'auspicious', guidance:'The Net catches what you need. Favorable for hunting, foraging, business deals, and finding what was lost.'},
  {name:'Z\u012B',   ch:'觜', animal:'Monkey',   meaning:'discernment, beak',        group:'West',  element:'Fire',  quality:'neutral',    guidance:'The Turtle Beak \u2014 precise and particular. Good for detailed work, editing, and quality control.'},
  {name:'Sh\u0113n', ch:'参', animal:'Ape',      meaning:'alignment, reference',     group:'West',  element:'Water', quality:'mixed',      guidance:'The Three Stars (Orion). Powerful but unpredictable. Good for legal matters and confrontation, not for peace.'},
  // Southern Vermilion Bird (夏 Summer) — Xiu 22-28
  {name:'J\u01D0ng', ch:'井', animal:'Tapir',    meaning:'well, source',             group:'South', element:'Water', quality:'auspicious', guidance:'The Well \u2014 inexhaustible source. Excellent for education, deep study, and tapping into wisdom. Nourish yourself.'},
  {name:'Gu\u01D0',  ch:'鬼', animal:'Sheep',    meaning:'ancestors, spirit',        group:'South', element:'Metal', quality:'intense',    guidance:'The Ghost mansion \u2014 the veil is thin. Powerful for ancestor work, divination, and spirit communication. Avoid frivolity.'},
  {name:'Li\u01D4',  ch:'柳', animal:'Buck',     meaning:'flexibility, willow',      group:'South', element:'Earth', quality:'neutral',    guidance:'The Willow bends but does not break. Good for adaptability, going with the flow, and gentle persistence.'},
  {name:'X\u012Bng', ch:'星', animal:'Horse',    meaning:'stars, fame',              group:'South', element:'Fire',  quality:'auspicious', guidance:'The Star mansion brings recognition. Favorable for public appearances, performance, art, and celebration.'},
  {name:'Zh\u0101ng',ch:'张', animal:'Stag',     meaning:'expansion, bow',           group:'South', element:'Water', quality:'auspicious', guidance:'The Extended Net \u2014 cast wide. Excellent for expansion, ambition, hospitality, and generous offerings.'},
  {name:'Y\u00EC',   ch:'翼', animal:'Snake',    meaning:'wings, flight',            group:'South', element:'Fire',  quality:'neutral',    guidance:'The Wings carry you forward. Good for travel and music, but moves slowly. Patience is the virtue today.'},
  {name:'Zh\u011Bn', ch:'轸', animal:'Worm',     meaning:'foundations, carriage',    group:'South', element:'Water', quality:'auspicious', guidance:'The Chariot \u2014 journey\u2019s end. Favorable for completing travel, vehicle matters, and reaching destinations.'}
];
var CN_ELEMENTS = {
  Wood:  {emoji:'\uD83C\uDF33', color:'rgba(100,180,100,.6)', bg:'rgba(60,120,60,.12)', border:'rgba(100,180,100,.25)', keywords:'growth, creativity, expansion'},
  Fire:  {emoji:'\uD83D\uDD25', color:'rgba(220,120,80,.6)',  bg:'rgba(160,60,40,.12)',  border:'rgba(220,120,80,.25)',  keywords:'passion, energy, transformation'},
  Earth: {emoji:'\u26F0\uFE0F',  color:'rgba(180,160,100,.6)', bg:'rgba(140,120,60,.12)', border:'rgba(180,160,100,.25)', keywords:'stability, nourishment, grounding'},
  Metal: {emoji:'\u2694\uFE0F',  color:'rgba(180,200,220,.6)', bg:'rgba(120,140,160,.12)',border:'rgba(180,200,220,.25)', keywords:'clarity, discipline, precision'},
  Water: {emoji:'\uD83C\uDF0A', color:'rgba(100,150,220,.6)', bg:'rgba(50,80,140,.12)',  border:'rgba(100,150,220,.25)', keywords:'introspection, flow, depth'}
};

// Reference: Jan 1, 1900 is Sexagenary day 1 (甲子, Stem 0 Branch 0)
// JDN for Jan 1, 1900 = 2415021.5
var CN_EPOCH_JD = 2415020.5;

function getChineseDayInfo(date) {
  var jd = julianDay(date);
  var dayOffset = Math.floor(jd - CN_EPOCH_JD);
  var stemIdx = ((dayOffset % 10) + 10) % 10;
  var branchIdx = ((dayOffset % 12) + 12) % 12;
  var xiuIdx = ((dayOffset + 14) % 28 + 28) % 28;
  var stem = CN_STEMS[stemIdx];
  var branch = CN_BRANCHES[branchIdx];
  var xiu = CN_XIU[xiuIdx];
  var elData = CN_ELEMENTS[stem.element];
  return {
    stem: stem,
    branch: branch,
    xiu: xiu,
    element: stem.element,
    elData: elData,
    yinyang: stem.yin ? 'Yin' : 'Yang',
    pillar: stem.ch + branch.ch,
    pillarName: stem.name + '-' + branch.name,
    sexagenary: ((dayOffset % 60) + 60) % 60 + 1
  };
}

// Chinese year sign from birth year (approximate — ignores lunar new year cutoff for simplicity)
// Xiu for forecast (uses same epoch as getChineseDayInfo)
function getForecastXiu(d) {
  var jd = julianDay(d);
  var dayOffset = Math.floor(jd - CN_EPOCH_JD);
  var xiuIdx = ((dayOffset + 14) % 28 + 28) % 28;
  return CN_XIU[xiuIdx];
}

function xiuBadgeTip(xiu) {
  if (!xiu || !xiu.name) return '';
  var groupColors = {East:'rgba(100,180,100,.7)',North:'rgba(100,150,220,.7)',West:'rgba(180,200,220,.7)',South:'rgba(220,120,80,.7)'};
  var groupNames = {East:'Azure Dragon \u00b7 \u9752\u9F99',North:'Black Tortoise \u00b7 \u7384\u6B66',West:'White Tiger \u00b7 \u767D\u864E',South:'Vermilion Bird \u00b7 \u6731\u96C0'};
  var col = groupColors[xiu.group] || 'rgba(245,240,232,.5)';
  var body = xiu.guidance || xiu.meaning;
  if (xiu.group) body += '<div style="margin-top:4px;font-size:11px;color:rgba(245,240,232,.35);">' + (groupNames[xiu.group]||'') + ' \u00b7 ' + (xiu.element||'') + '</div>';
  return fcastTip(
    xiu.ch + ' ' + xiu.name,
    'Lunar Mansion \u00b7 ' + xiu.ch,
    body
  );
}

function getChineseYearSign(year) {
  var branchIdx = ((year - 4) % 12 + 12) % 12;
  var stemIdx = ((year - 4) % 10 + 10) % 10;
  return { branch: CN_BRANCHES[branchIdx], stem: CN_STEMS[stemIdx], element: CN_STEMS[stemIdx].element };
}

// Chinese astrology tooltips
var CN_TIPS = {
  'Heavenly Stem': ['Heavenly Stem \u00b7 \u5929\u5E72', 'One of 10 celestial stems cycling through Wood, Fire, Earth, Metal, and Water in yin/yang pairs. Combined with the Earthly Branch, they form the 60-day Sexagenary cycle \u2014 the oldest known calendrical system.'],
  'Earthly Branch': ['Earthly Branch \u00b7 \u5730\u652F', 'One of 12 terrestrial branches, each linked to a zodiac animal. The branch governs a 2-hour window of the day and carries the animal\u2019s archetypal energy into daily life.'],
  'Daily Pillar': ['Daily Pillar \u00b7 \u65E5\u67F1', 'The stem-branch pair for today. In Four Pillars astrology (BaZi), the Day Pillar is the most personal \u2014 it represents your core self and how you interact with the world today.'],
  'Lunar Mansion': ['Lunar Mansion \u00b7 \u5BBF', 'One of 28 Xiu (mansions) the moon passes through. Ancient Chinese astronomers mapped the sky into these segments for agriculture, ritual, and divination. Each mansion carries a specific animal spirit and energy.'],
  'Wu Xing': ['Five Elements \u00b7 \u4E94\u884C', 'Wood feeds Fire, Fire creates Earth, Earth bears Metal, Metal collects Water, Water nourishes Wood. The productive cycle. Each element also controls another \u2014 a dynamic balance that governs all natural processes.'],
  'Yin': ['Yin \u00b7 \u9634', 'The receptive, internal, reflective polarity. Moon energy, night, stillness, introspection. Yin days favor rest, contemplation, receiving, and inner work.'],
  'Yang': ['Yang \u00b7 \u9633', 'The active, external, expressive polarity. Sun energy, day, movement, action. Yang days favor initiative, outward effort, building, and visible progress.'],
  'Sexagenary': ['Sexagenary Cycle \u00b7 \u516D\u5341\u82B1\u7532', 'The 60-day cycle formed by pairing 10 Heavenly Stems with 12 Earthly Branches. Used continuously in China for over 3,000 years \u2014 every day, month, and year has a unique stem-branch designation.'],
  'Wood':  ['Wood \u00b7 \u6728', 'Growth, creativity, expansion, spring. Wood energy rises upward like a tree. Governs the liver and vision. Wood days favor new projects, creative work, and planting seeds.'],
  'Fire':  ['Fire \u00b7 \u706B', 'Passion, energy, transformation, summer. Fire energy radiates outward. Governs the heart and joy. Fire days favor expression, connection, visibility, and celebration.'],
  'Earth': ['Earth \u00b7 \u571F', 'Stability, nourishment, grounding, late summer. Earth energy settles and centers. Governs the spleen and thought. Earth days favor planning, organizing, and caring for others.'],
  'Metal': ['Metal \u00b7 \u91D1', 'Clarity, discipline, precision, autumn. Metal energy contracts and refines. Governs the lungs and grief. Metal days favor editing, discernment, letting go, and structure.'],
  'Water': ['Water \u00b7 \u6C34', 'Introspection, flow, depth, winter. Water energy descends and pools. Governs the kidneys and will. Water days favor rest, reflection, deep work, and listening.']
};

function applyChineseTooltips(html) {
  // Apply tooltips to specific terms
  var terms = ['Daily Pillar','Lunar Mansion','Wu Xing','Sexagenary','Heavenly Stem','Earthly Branch'];
  terms.forEach(function(term) {
    var t = CN_TIPS[term];
    if (!t) return;
    html = html.replace(new RegExp(term, 'g'), tip(term, t[0], t[1]));
  });
  return html;
}

function renderChinesePanel() {
  var wrap = document.getElementById('chinesePanelWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'chinesePanelWrap';
    var tzWrap = document.getElementById('tzolkinPanelWrap');
    var anchor = document.getElementById('vedicAnchor');
    if (tzWrap) { tzWrap.after(wrap); }
    else if (anchor) { anchor.after(wrap); }
    else return;
  }
  var info = getChineseDayInfo(new Date());
  var el = info.elData;
  var elTip = CN_TIPS[info.element];
  var yyTip = CN_TIPS[info.yinyang];

  // Element and yin/yang with tooltips
  var elLabel = elTip ? tip(info.element, elTip[0], elTip[1]) : info.element;
  var yyLabel = yyTip ? tip(info.yinyang, yyTip[0], yyTip[1]) : info.yinyang;

  // Birth year sign for title
  var cnNatal = '';
  try {
    var _cp = loadProfile();
    if (_cp && _cp.dob) {
      var _by = parseInt(_cp.dob.split('-')[0]);
      var _ys = getChineseYearSign(_by);
      cnNatal = '<span style="font-size:11px;color:rgba(245,240,232,.35);font-style:italic;font-family:inherit;text-transform:none;letter-spacing:0;">' + _ys.branch.emoji + ' ' + _ys.element + ' ' + _ys.branch.animal + '</span>';
    }
  } catch(e) {}

  var html = '<div class="astro-card" style="margin-bottom:20px;" id="chinesePanel">'
    + '<div class="card-label" style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:6px;color:' + el.color + ';"><span>Chinese Astrology \u00b7 \u5E72\u652F</span>' + cnNatal + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:12px;">';

  // Card 1: Daily Pillar
  html += '<div style="background:' + el.bg + ';border:1px solid ' + el.border + ';border-radius:6px;padding:14px;">'
    + '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:' + el.color + ';opacity:.7;margin-bottom:8px;">Daily Pillar \u00b7 \u5929\u5E72\u5730\u652F</div>'
    + '<div style="font-size:24px;margin-bottom:4px;">' + info.branch.emoji + '</div>'
    + '<div style="font-size:17px;color:rgba(245,240,232,.85);">' + info.pillar + ' \u00b7 ' + info.pillarName + '</div>'
    + '<div style="font-size:13px;color:rgba(245,240,232,.45);font-style:italic;line-height:1.6;margin-top:4px;">'
    + yyLabel + ' ' + elLabel + ' ' + info.branch.animal + '</div>'
    + '</div>';

  // Card 2: Lunar Mansion (Xiu)
  var groupNames = {East:'Azure Dragon \u9752\u9F99',North:'Black Tortoise \u7384\u6B66',West:'White Tiger \u767D\u864E',South:'Vermilion Bird \u6731\u96C0'};
  var qualColors = {auspicious:'rgba(100,180,100,.7)',intense:'rgba(220,120,80,.7)',caution:'rgba(220,80,80,.7)',mixed:'rgba(180,160,100,.7)',neutral:'rgba(245,240,232,.4)'};
  var qCol = qualColors[info.xiu.quality] || qualColors.neutral;
  html += '<div style="background:' + el.bg + ';border:1px solid ' + el.border + ';border-radius:6px;padding:14px;">'
    + '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:' + el.color + ';opacity:.7;margin-bottom:8px;">Lunar Mansion \u00b7 \u4E8C\u5341\u516B\u5BBF</div>'
    + '<div style="font-size:17px;color:rgba(245,240,232,.85);">' + info.xiu.ch + ' ' + info.xiu.name + '</div>'
    + '<div style="font-size:12px;color:' + qCol + ';margin-top:4px;">' + (info.xiu.quality||'') + ' \u00b7 ' + (groupNames[info.xiu.group]||'') + '</div>'
    + '<div style="font-size:13px;color:rgba(245,240,232,.45);font-style:italic;line-height:1.6;margin-top:6px;">'
    + (info.xiu.guidance || info.xiu.meaning) + '</div>'
    + '</div>';

  // Card 3: Element & Energy
  html += '<div style="background:' + el.bg + ';border:1px solid ' + el.border + ';border-radius:6px;padding:14px;">'
    + '<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:' + el.color + ';opacity:.7;margin-bottom:8px;">Wu Xing \u00b7 \u4E94\u884C</div>'
    + '<div style="font-size:24px;margin-bottom:4px;">' + el.emoji + '</div>'
    + '<div style="font-size:17px;color:rgba(245,240,232,.85);">' + elLabel + ' \u00b7 ' + yyLabel + '</div>'
    + '<div style="font-size:13px;color:rgba(245,240,232,.45);font-style:italic;line-height:1.6;margin-top:4px;">'
    + el.keywords + '</div>'
    + '</div>';

  html += '</div></div>';
  wrap.innerHTML = applyChineseTooltips(html);
}

// ─── TODAY SECTION TOGGLES ────────────────────────────────────────────────────
const SECTION_PREFS_KEY = 'lunations_sections_v1';

function getSectionPrefs(){
  try{ return JSON.parse(localStorage.getItem(SECTION_PREFS_KEY)||'{}'); }
  catch(e){ return {}; }
}

function toggleTodaySection(id){
  const section = document.getElementById(id);
  if(!section) return;
  const body = section.querySelector('.today-section-body');
  const chevron = section.querySelector('.today-section-chevron');
  const isCollapsed = section.classList.contains('today-section-collapsed');

  if(_themeFeatures){
    if(isCollapsed){
      body.style.display = 'block';
      body.style.maxHeight = body.scrollHeight + 'px';
      body.style.overflow = 'hidden';
      section.classList.remove('today-section-collapsed');
      chevron.style.transform = '';
      setTimeout(() => { body.style.maxHeight = ''; body.style.overflow = ''; }, 400);
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        body.style.maxHeight = '0px';
        section.classList.add('today-section-collapsed');
        chevron.style.transform = 'rotate(-90deg)';
      });
      setTimeout(() => { body.style.display = 'none'; }, 400);
    }
  } else {
    section.classList.toggle('today-section-collapsed');
    chevron.style.transform = isCollapsed ? '' : 'rotate(-90deg)';
    body.style.display = isCollapsed ? 'block' : 'none';
  }

  // Save preference
  const prefs = getSectionPrefs();
  prefs[id] = isCollapsed ? 'open' : 'collapsed';
  localStorage.setItem(SECTION_PREFS_KEY, JSON.stringify(prefs));
}

function initSectionStates(){
  const prefs = getSectionPrefs();
  // Default states: Now=open, Reading=open, MyDay=open, Sky=collapsed
  const defaults = { sectionNow:'open', sectionReading:'open', sectionMyDay:'open', sectionSky:'collapsed', secLastCycle:'open', secPatternReading:'open', secForecast:'open' };
  Object.entries(defaults).forEach(([id, defaultState]) => {
    const state = prefs[id] || defaultState;
    const section = document.getElementById(id);
    if(!section) return;
    const body = section.querySelector('.today-section-body');
    const chevron = section.querySelector('.today-section-chevron');
    if(state === 'collapsed'){
      section.classList.add('today-section-collapsed');
      if(body) body.style.display = 'none';
      if(chevron) chevron.style.transform = 'rotate(-90deg)';
    } else {
      section.classList.remove('today-section-collapsed');
      if(body) body.style.display = 'block';
      if(chevron) chevron.style.transform = '';
    }
  });
}

// ─── QUICK LOG ────────────────────────────────────────────────────────────────
const LOG_MODE_KEY = 'lunations_logmode_v1';

function setLogMode(mode){
  localStorage.setItem(LOG_MODE_KEY, mode);
  var hasEntry = !!loadEntries()[entryKey(new Date())];
  // Update tab active states
  ['btnFullLog','btnQuickLog','btnEvening','btnDayLog'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.classList.remove('active');
  });
  var activeBtn={full:'btnFullLog',quick:'btnQuickLog',evening:'btnEvening',daylog:'btnDayLog'}[mode];
  if(activeBtn){var ab=document.getElementById(activeBtn);if(ab)ab.classList.add('active');}

  // Hide all panels
  var panels=['quickLogWrap','dayLogWrap','entryFormWrap'];
  panels.forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
  var card=document.getElementById('entrySubmittedCard');
  var evc=document.getElementById('eveningCheckin');

  if(mode==='full'){
    if(hasEntry){
      // Morning tab: show submitted card
      if(card)card.style.display='block';
      if(evc)evc.style.display='none';
    } else {
      // No entry yet: show full form
      if(card)card.style.display='none';
      var efw=document.getElementById('entryFormWrap');if(efw)efw.style.display='block';
    }
  } else if(mode==='quick'){
    if(card)card.style.display='none';
    if(evc)evc.style.display='none';
    var qlw=document.getElementById('quickLogWrap');if(qlw)qlw.style.display='block';
    // Pre-populate sliders from existing entry
    setTimeout(function(){
      var existing=loadEntries()[entryKey(new Date())];
      if(existing){
        ['Energy','Mood','Clarity','Creativity'].forEach(function(m,i){
          var sid='qSlider'+m,vid='qVal'+m,fid='qFill'+m;
          var el=document.getElementById(sid);if(el&&existing[m.toLowerCase()]){el.value=existing[m.toLowerCase()];var v=document.getElementById(vid);if(v)v.textContent=existing[m.toLowerCase()];}
        });
      }
      ['qFillEnergy','qFillMood','qFillClarity','qFillCreativity'].forEach(function(id,i){
        var fill=document.getElementById(id);
        var val=document.getElementById(['qSliderEnergy','qSliderMood','qSliderClarity','qSliderCreativity'][i])?.value||5;
        var colors=[['rgba(201,168,76,.7)','rgba(201,168,76,.4)'],['rgba(180,120,100,.65)','rgba(180,120,100,.35)'],['rgba(100,150,210,.6)','rgba(100,150,210,.3)'],['rgba(150,100,200,.6)','rgba(150,100,200,.3)']];
        if(fill){fill.style.width=((val-1)/9*100)+'%';fill.style.background=colors[i][0];}
      });
    },50);
  } else if(mode==='evening'){
    if(card)card.style.display='none';
    if(evc){evc.style.display='block';renderEveningCheckin();}
  } else if(mode==='daylog'){
    if(card)card.style.display='none';
    if(evc)evc.style.display='none';
    var dlw=document.getElementById('dayLogWrap');if(dlw)dlw.style.display='block';
    renderDayLog();
  }
}

function getLogMode(){ return localStorage.getItem(LOG_MODE_KEY) || 'full'; }

function saveQuickLog(){
  const now = new Date();
  const key = entryKey(now);
  const entries = loadEntries();
  const phase = moonPhaseInfo(now);
  const mSign = moonSignApprox(now);
  const sSign = sunSignForDate(now);
  const tithi = getTithi(now);
  const nakshatra = getNakshatra(now);
  const vara = getVara(now);
  const planets = allPlanets(now).filter(p=>p&&p.sign).map(p=>p.symbol+(p.sign?.symbol||''));
  const transits = getTransitAlerts().map(function(a){return a.title;});

  var existing = entries[key] || {};
  var qNote = (document.getElementById('qNote')?.value||'').trim();
  // Append quick note to existing text if there is one
  var mergedText = existing.text || '';
  if(qNote){
    if(mergedText) mergedText += '\n\n[' + now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) + '] ' + qNote;
    else mergedText = qNote;
  }
  entries[key] = {
    ...existing,
    energy:    +document.getElementById('qSliderEnergy').value,
    mood:      +document.getElementById('qSliderMood').value,
    clarity:   +document.getElementById('qSliderClarity').value,
    creativity:+document.getElementById('qSliderCreativity').value,
    qualities: existing.qualities || [],
    text: mergedText,
    phase: existing.phase || phase.name, phaseAge: existing.phaseAge || Math.floor(phase.age), phasePct: existing.phasePct || phase.pct,
    moonSign: existing.moonSign || mSign.name, sunSign: existing.sunSign || sSign.name,
    tithi: existing.tithi || tithi.num+' '+tithi.name, tithiQuality: existing.tithiQuality || tithi.quality,
    nakshatra: existing.nakshatra || nakshatra.name, nakshatraPada: existing.nakshatraPada || nakshatra.pada,
    vara: existing.vara || vara.name, planets: existing.planets || planets, activeTransits: existing.activeTransits || transits,
    timestamp: existing.timestamp || now.toISOString(),
    lastQuickLog: now.toISOString(),
  };
  // Record quick log snapshot
  var snaps=entries[key].snapshots||[];
  snaps.push({type:'quick',time:now.toISOString(),energy:entries[key].energy,mood:entries[key].mood,clarity:entries[key].clarity,creativity:entries[key].creativity,note:qNote||''});
  entries[key].snapshots=snaps;

  try{ saveEntries(entries); }catch(e){ console.error('Save failed:', e); showToast('Storage full — entry saved to cloud only'); }
  pushEntryToCloud(key, entries[key]);
  var _qn=document.getElementById('qNote');if(_qn)_qn.value='';
  showToast('✦ Quick log saved');
  setTimeout(function(){setLogMode('daylog');},150);
}

function renderDayLog(){
  var el=document.getElementById('dayLogContent');if(!el)return;
  var key=entryKey(new Date());
  var entry=loadEntries()[key];
  if(!entry){el.innerHTML='<div style="color:rgba(245,240,232,.25);font-style:italic;">No entries yet today.</div>';return;}

  var html='';
  var snaps=entry.snapshots||[];

  // ── Current State (above timeline) ───────────────────────────────
  html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;margin-bottom:12px;padding:12px;background:rgba(245,240,232,.02);border:1px solid rgba(245,240,232,.05);border-radius:8px;">';
  [{l:'Energy',v:entry.energy},{l:'Mood',v:entry.mood},{l:'Clarity',v:entry.clarity},{l:'Creativity',v:entry.creativity}].forEach(function(m){
    var first=snaps.length>0?snaps[0][m.l.toLowerCase()]:null;
    var delta='';
    if(first!=null&&first!==m.v){var d=m.v-first;delta='<div style="font-size:10px;color:'+(d>0?'rgba(100,200,120,.6)':'rgba(200,100,100,.5)')+';">'+(d>0?'+':'')+d+'</div>';}
    html+='<div><div style="font-family:Cinzel,serif;font-size:20px;color:var(--gold);">'+(m.v||'—')+'</div><div style="font-size:10px;color:rgba(245,240,232,.3);">'+m.l+'</div>'+delta+'</div>';
  });
  html+='</div>';

  // ── Today's Energy Timeline ──────────────────────────────────────
  if(snaps.length>0){
    html+='<div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.06);border-radius:8px;padding:16px;margin-bottom:12px;">';
    html+='<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.12em;color:rgba(201,168,76,.5);text-transform:uppercase;margin-bottom:12px;">Today\'s Energy Timeline</div>';
    var metrics=['energy','mood','clarity','creativity'];
    var colors=['rgba(201,168,76,.7)','rgba(180,120,100,.65)','rgba(100,150,210,.6)','rgba(150,100,200,.6)'];
    var labels=['Energy','Mood','Clarity','Creativity'];
    metrics.forEach(function(metric,mi){
      html+='<div style="margin-bottom:8px;">';
      html+='<div style="font-size:10px;color:rgba(245,240,232,.3);margin-bottom:3px;">'+labels[mi]+'</div>';
      html+='<div style="display:flex;align-items:flex-end;gap:4px;height:24px;">';
      snaps.forEach(function(s){
        var val=s[metric]||5;
        var h=Math.max(6,val*2.2);
        html+='<div style="flex:1;height:'+h+'px;background:'+colors[mi]+';border-radius:2px;min-width:16px;position:relative;display:flex;align-items:center;justify-content:center;">'
          +'<span style="font-size:9px;font-weight:bold;color:rgba(0,0,0,.5);line-height:1;">'+val+'</span></div>';
      });
      html+='</div></div>';
    });
    // Timeline labels
    html+='<div style="display:flex;gap:4px;margin-top:4px;">';
    snaps.forEach(function(s){
      var t=new Date(s.time);
      var label=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      var icon=s.type==='morning'?'☀':s.type==='evening'?'🌙':'⚡';
      html+='<div style="flex:1;text-align:center;font-size:9px;color:rgba(245,240,232,.25);">'+icon+'<br>'+label+'</div>';
    });
    html+='</div>';
    html+='</div>';
  }

  // ── Qualities ────────────────────────────────────────────────────
  if(entry.qualities&&entry.qualities.length){
    html+='<div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px;">';
    entry.qualities.forEach(function(q){html+='<span style="background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.18);border-radius:12px;padding:3px 10px;font-size:12px;color:rgba(201,168,76,.6);">'+sanitizeAIText(q)+'</span>';});
    html+='</div>';
  }

  // ── Dreams + Intention + Sadhana (above journal) ─────────────────
  var extras=[];
  if(entry.dream)extras.push({label:'Dream',text:entry.dream,color:'rgba(140,100,200,.5)'});
  if(entry.intention)extras.push({label:'Intention',text:entry.intention,color:'rgba(100,170,140,.5)'});
  if(entry.sadhana)extras.push({label:'Sadhana',text:entry.sadhana,color:'rgba(201,168,76,.4)'});
  if(extras.length){
    extras.forEach(function(ex){
      html+='<div style="padding:10px 14px;margin-bottom:8px;border-left:2px solid '+ex.color+';"><span style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;color:'+ex.color+';text-transform:uppercase;">'+ex.label+'</span><div style="color:rgba(245,240,232,.45);font-size:14px;margin-top:3px;">'+sanitizeAIText(ex.text)+'</div></div>';
    });
  }

  // ── Journal (all text entries) ───────────────────────────────────
  if(entry.text){
    html+='<div style="background:rgba(245,240,232,.02);border:1px solid rgba(245,240,232,.05);border-radius:8px;padding:16px;margin-bottom:12px;">';
    html+='<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.12em;color:rgba(245,240,232,.3);text-transform:uppercase;margin-bottom:8px;">Journal</div>';
    var lines=entry.text.split('\n\n');
    lines.forEach(function(line){
      var trimmed=line.trim();if(!trimmed)return;
      var tsMatch=trimmed.match(/^\[(.+?)\]\s*(.*)/);
      if(tsMatch){
        html+='<div style="margin-bottom:10px;"><span style="font-size:11px;color:rgba(201,168,76,.4);font-family:Cinzel,serif;letter-spacing:.05em;">'+sanitizeAIText(tsMatch[1])+'</span><div style="margin-top:2px;color:rgba(245,240,232,.55);">'+sanitizeAIText(tsMatch[2])+'</div></div>';
      } else {
        html+='<div style="margin-bottom:10px;color:rgba(245,240,232,.55);">'+sanitizeAIText(trimmed)+'</div>';
      }
    });
    html+='</div>';
  }

  // ── Signs Card ────────────────────────────────────────────────────
  var allSigns=getSignsLocal();
  var todayStr=key; // YYYY-MM-DD
  var todaySigns=allSigns.filter(function(s){return s.timestamp&&s.timestamp.slice(0,10)===todayStr;});
  if(todaySigns.length>0){
    html+='<div style="background:rgba(201,168,76,.03);border:1px solid rgba(201,168,76,.12);border-radius:8px;padding:16px;margin-bottom:12px;">';
    html+='<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.12em;color:rgba(201,168,76,.5);text-transform:uppercase;margin-bottom:10px;">Signs Noticed Today</div>';
    todaySigns.forEach(function(s){
      var t=new Date(s.timestamp);
      var timeStr=t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      html+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,.06);">';
      html+='<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--gold);">✦</div>';
      html+='<div style="flex:1;min-width:0;">';
      html+='<div style="font-size:14px;color:rgba(245,240,232,.65);">'+sanitizeAIText(s.text)+'</div>';
      if(s.context)html+='<div style="font-size:12px;color:rgba(245,240,232,.3);font-style:italic;margin-top:2px;">while: '+sanitizeAIText(s.context)+'</div>';
      html+='<div style="font-size:10px;color:rgba(245,240,232,.2);margin-top:3px;">'+timeStr+' · '+sanitizeAIText(s.moon_phase||'')+'</div>';
      html+='</div></div>';
    });

    // ── Threads: scan past entries for matching sign text ──────────
    var allEntries=loadEntries();
    var allKeys=Object.keys(allEntries).sort().reverse();
    var threadMap={};
    todaySigns.forEach(function(s){
      var words=s.text.toLowerCase().split(/\s+/).filter(function(w){return w.length>3;});
      if(!words.length)return;
      var matches=[];
      allKeys.forEach(function(dk){
        if(dk===todayStr)return; // skip today
        var e=allEntries[dk];
        var searchable=((e.text||'')+' '+(e.dream||'')+' '+(e.qualities||[]).join(' ')).toLowerCase();
        var found=words.some(function(w){return searchable.indexOf(w)!==-1;});
        if(found)matches.push(dk);
      });
      // Also check past signs
      allSigns.forEach(function(ps){
        if(ps.id===s.id)return;
        var psDate=ps.timestamp?ps.timestamp.slice(0,10):'';
        if(!psDate||psDate===todayStr)return;
        var psText=ps.text.toLowerCase();
        var found=words.some(function(w){return psText.indexOf(w)!==-1;});
        if(found&&matches.indexOf(psDate)===-1)matches.push(psDate);
      });
      if(matches.length>0)threadMap[s.text]=matches.slice(0,5);
    });

    var threadKeys=Object.keys(threadMap);
    if(threadKeys.length>0){
      html+='<div style="margin-top:8px;padding-top:10px;border-top:1px solid rgba(201,168,76,.1);">';
      html+='<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;color:rgba(201,168,76,.35);text-transform:uppercase;margin-bottom:8px;">Threads</div>';
      threadKeys.forEach(function(signText){
        var dates=threadMap[signText];
        html+='<div style="margin-bottom:10px;">';
        html+='<div style="font-size:12px;color:rgba(245,240,232,.5);margin-bottom:4px;">✦ <span style="color:rgba(201,168,76,.5);">'+sanitizeAIText(signText)+'</span></div>';
        html+='<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        dates.forEach(function(dk){
          var d=new Date(dk+'T12:00:00');
          var e=allEntries[dk];
          var phase=e?e.phase:'';
          var label=d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
          html+='<button onclick="editEntry(\''+dk+'\')" style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.15);border-radius:12px;padding:3px 10px;font-size:11px;color:rgba(201,168,76,.5);cursor:pointer;font-family:inherit;transition:all .15s;" onmouseover="this.style.borderColor=\'rgba(201,168,76,.4)\'" onmouseout="this.style.borderColor=\'rgba(201,168,76,.15)\'">'
            +(phase?phase.split(' ')[0]+' ':'')
            +label+'</button>';
        });
        html+='</div></div>';
      });
      html+='</div>';
    }
    html+='</div>';
  }

  // ── Sky ──────────────────────────────────────────────────────────
  html+='<div style="font-size:12px;color:rgba(245,240,232,.2);font-style:italic;margin-top:8px;">';
  if(entry.phase) html+=entry.phase;
  if(entry.moonSign) html+=' · Moon in '+entry.moonSign;
  if(entry.sunSign) html+=' · Sun in '+entry.sunSign;
  if(snaps.length) html+=' · '+snaps.length+' check-in'+(snaps.length>1?'s':'');
  if(todaySigns.length) html+=' · '+todaySigns.length+' sign'+(todaySigns.length>1?'s':'');
  html+='</div>';

  el.innerHTML=html;
}

const FORECAST_NAKSHATRAS = [
  { name:'Ashwini',           ruler:'Ketu',    quality:'swift',      keywords:`Healing, swift action, new beginnings. Auspicious for starts.` },
  { name:'Bharani',           ruler:'Venus',   quality:'intense',    keywords:`Transformation, creativity, Venus energy. Potent, not gentle.` },
  { name:'Krittika',          ruler:'Sun',     quality:'fierce',     keywords:`The Pleiades. Purification by fire. Solar will, cutting clarity.` },
  { name:'Rohini',            ruler:'Moon',    quality:'sacred',     keywords:`Most beloved of the Moon. Fertile, creative, sensual abundance.` },
  { name:'Mrigashira',        ruler:'Mars',    quality:'curious',    keywords:`Gentle seeking, searching. Creative restlessness. Deer energy.` },
  { name:'Ardra',             ruler:'Rahu',    quality:'stormy',     keywords:`Rahu's nakshatra. Storms clear the air. Breakthrough after chaos.` },
  { name:'Punarvasu',         ruler:'Jupiter', quality:'auspicious', keywords:`Return of the good light. Renewal, restoration, Jupiter's blessing.` },
  { name:'Pushya',            ruler:'Saturn',  quality:'sacred',     keywords:`Most auspicious of all nakshatras. Nourishment, protection, Jupiter.` },
  { name:'Ashlesha',          ruler:'Mercury', quality:'deep',       keywords:`The coiled serpent. Kundalini wisdom, mystical penetration, insight.` },
  { name:'Magha',             ruler:'Ketu',    quality:'ancestral',  keywords:`The throne. Ancestral power, royal dignity, Pitru connection.` },
  { name:'Purva Phalguni',    ruler:'Venus',   quality:'creative',   keywords:`Creative pleasure, rest before fruition. Venus luxury and art.` },
  { name:'Uttara Phalguni',   ruler:'Sun',     quality:'generous',   keywords:`Solar generosity, partnership, fruition of creative work.` },
  { name:'Hasta',             ruler:'Moon',    quality:'skilled',    keywords:`The hand. Skilled craft, artisan energy. Strong for art and healing.` },
  { name:'Chitra',            ruler:'Mars',    quality:'brilliant',  keywords:`The architect. Creative brilliance, jewel of the sky, Vishwakarma.` },
  { name:'Swati',             ruler:'Rahu',    quality:'independent',keywords:`The independent one. Self-reliance, scattered wind, adaptability.` },
  { name:'Vishakha',          ruler:'Jupiter', quality:'fierce',     keywords:`The archway. Fierce purposeful determination. Jupiter-Mars fire.` },
  { name:'Anuradha',          ruler:'Saturn',  quality:'devoted',    keywords:`Devotion, friendship, loyalty. Strong for connection and love.` },
  { name:'Jyeshtha',          ruler:'Mercury', quality:'protective', keywords:`The eldest, the chief. Protective power, occult knowledge.` },
  { name:'Mula',              ruler:'Ketu',    quality:'root',       keywords:`The root star. Truth-cutting, dissolution of illusion, going to source.` },
  { name:'Purva Ashadha',     ruler:'Venus',   quality:'invincible', keywords:`The invincible one. Venus strength, purification, creative fire.` },
  { name:'Uttara Ashadha',    ruler:'Sun',     quality:'victorious', keywords:`The universal star. Solar victory, long-term achievement.` },
  { name:'Shravana',          ruler:'Moon',    quality:'listening',  keywords:`The cosmic ear. Clairaudience, Vishnu as preserver. Listening practice.` },
  { name:'Dhanishtha',        ruler:'Mars',    quality:'rhythmic',   keywords:`Wealth and rhythm. Musical energy. Mars abundance.` },
  { name:'Shatabhisha',       ruler:'Rahu',    quality:'healing',    keywords:`The hundred healers. Solitary healing, Rahu medicine, research.` },
  { name:'Purva Bhadrapada',  ruler:'Jupiter', quality:'fierce',     keywords:`Jupiter fire. Transformative asceticism, burning of old structures.` },
  { name:'Uttara Bhadrapada', ruler:'Saturn',  quality:'deep',       keywords:`The cosmic serpent Ahir Budhnya. Ancestral depths, Saturn wisdom.` },
  { name:'Revati',            ruler:'Mercury', quality:'completing', keywords:`Completion, nourishment, safe passage. Pushan protects travelers.` },
];


const SACRED_TITHIS = {
  5:  { note:'Tithi 5 · Naga/Serpent current — Kundalini energy amplified.' },
  8:  { note:'Tithi 8 · Ashtami — Durga/Kali fierce power. Deep practice.' },
  11: { note:'Tithi 11 · Ekadashi — Vishnu tithi. Devotional discipline.' },
  14: { note:'Tithi 14 · Chaturdashi — Shiva tithi. Potent for deep practice.' },
  15: { note:'Tithi 15 · Purnima — Full moon energy in Vedic calendar.' },
  29: { note:'Tithi 29 · Amavasya — Darkest night. Ancestral connection.' },
  30: { note:'Tithi 30 · Amavasya — New moon. Pitru work. Ancestors close.' },
};


// ─── SKY FORECAST ───────────────────────────────────────────────────────────────
let forecastOffset = 0; // months offset from today


// ─── FORECAST BADGE TOOLTIPS ─────────────────────────────────────────────────
function fcastTip(label, title, body, link){
  const linkHtml = link ? `<a href="${link}" rel="noopener" style="display:block;margin-top:6px;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;color:rgba(201,168,76,.6);text-decoration:none;">Learn more ↗</a>` : '';
  return `<span class="tip" tabindex="0">${label}<span class="tip-box" style="width:240px;"><span class="tip-title">${title}</span>${body}${linkHtml}</span></span>`;
}

function tzolkinBadgeTip(tz){
  if(!tz?.sign) return tz ? `${tz.num||'?'}` : '—';
  const t = TZOLKIN_TIPS[tz.sign.name];
  if(!t) return `${tz.sign.glyph||''} ${tz.num} ${tz.sign.name||''} · ${tz.tone?.name||''}`;
  const toneDescs = {
    1:'Magnetic — attract your purpose',2:'Lunar — identify the challenge',
    3:'Electric — activate your service',4:'Self-Existing — define the form',
    5:'Overtone — empower your core',6:'Rhythmic — organize your balance',
    7:'Resonant — channel your inspiration',8:'Galactic — harmonize your integrity',
    9:'Solar — pulse your intention',10:'Planetary — perfect your manifestation',
    11:'Spectral — dissolve what no longer serves',12:'Crystal — cooperate and dedicate',
    13:'Cosmic — transcend and endure'
  };
  const toneDesc = toneDescs[tz.num] || tz.tone.name;
  return fcastTip(
    `${tz.sign.glyph} ${tz.num} ${tz.sign.name} · ${tz.tone.name}`,
    t[0],
    `${t[1]}<br><br><span style="color:rgba(201,168,76,.6);font-style:normal;">Tone ${tz.num}: ${toneDesc}</span>`,
    'https://www.lawoftime.org/tzolkin.html'
  );
}

function nakshatraBadgeTip(nk){
  if(!nk?.name) return '✦';
  const t = VEDIC_TIPS[nk.name];
  if(!t) return `✦ ${nk.name}`;
  return fcastTip(
    `✦ ${nk.name}`,
    t[0],
    t[1],
    'https://www.astrosage.com/nakshatra/'
  );
}

function moonPhaseBadgeTip(phase){
  const phaseDescs = {
    'New Moon': 'The seed moment. Plant intentions here — what you begin at the new moon carries the energy of the whole cycle.',
    'Waxing Crescent': 'The sprout emerging. First efforts, early movement. Lean into what you set at the new moon.',
    'First Quarter': 'The decision point. Tension between intention and resistance. Push through — this friction is necessary.',
    'Waxing Gibbous': 'Refinement. Almost full — fine-tune, adjust, prepare for the peak.',
    'Full Moon': 'Peak illumination. What was hidden becomes visible. Completion, celebration, release.',
    'Waning Gibbous': 'Integration. The harvest. Gratitude and distribution of what you gathered.',
    'Last Quarter': 'Release. Let go of what no longer serves the next cycle. Internal work.',
    'Waning Crescent': 'Surrender. Rest, restore, dream. The cycle completes itself before the next new moon.',
  };
  const desc = phaseDescs[phase.name] || phase.name;
  return fcastTip(`${phase.emoji} ${phase.name}`, phase.name, desc);
}


// ─── BIRTH CHART QUICK LOOK ───────────────────────────────────────────────────



function toggleDailyReminder(on){
  if(!on){ localStorage.removeItem('lunations_reminder'); showToast('Reminder off'); return; }
  if(!('Notification' in window)){ showToast('Notifications not supported on this browser'); return; }
  Notification.requestPermission().then(perm => {
    if(perm === 'granted'){
      localStorage.setItem('lunations_reminder', '1');
      showToast('✦ Reminder set — re-open the app each morning to log');
    } else {
      document.getElementById('toggleReminder').checked = false;
      showToast('Permission denied — enable notifications in browser settings');
    }
  });
}

// ─── FIRST-TIME WALKTHROUGH ───────────────────────────────────────────────────
const WT_KEY = 'lunations_wt_done_v1';
let _wtStep = 0;

const WT_STEPS = [
  {
    icon: '🌙',
    title: 'Welcome to Lunations',
    body: 'A lunar journal. You will track your energy, mood, and patterns across every cycle of the year. The sky and your inner weather, mapped together.',
    target: null,
    position: 'center',
  },
  {
    icon: '📝',
    title: 'Log Your Day',
    body: 'The Today tab is your home base. Each morning, log four numbers — energy, mood, clarity, creativity — and a few words if you feel like it. Takes 60 seconds.',
    target: 'sectionMyDay',
    position: 'above',
  },
  {
    icon: '✦',
    title: 'Your Daily Reading',
    body: 'Every day you get a personalized reading based on the actual sky — your moon sign, phase, and natal chart. Tap "↺ Refresh" any time for a fresh one.',
    target: 'sectionReading',
    position: 'above',
  },
  {
    icon: '🌑',
    title: 'The Sky',
    body: 'Tap "The Sky" section to see Vedic day panel, space weather, and planetary influences. Hover any term for a tooltip explanation.',
    target: 'sectionSky',
    position: 'above',
  },
  {
    icon: '◈',
    title: 'Cycles',
    body: 'After a few weeks of logging, the Cycles tab shows your patterns — which moon phases lift your energy, which ones challenge you. Your personal lunar fingerprint.',
    target: null,
    position: 'center',
  },
  {
    icon: '⚙',
    title: 'Set Your Profile',
    body: 'Go to Settings → Birth Profile and add your birthday. It makes your readings specific to you — natal sun, moon, and if you add it, rising sign too.',
    target: null,
    position: 'center',
  },
  {
    icon: '🔥',
    title: 'You are in.',
    body: 'Log one entry today to start your record. The sky is already tracking — now you track yourself alongside it.',
    target: null,
    position: 'center',
  },
];

function startWalkthrough(force){
  if(!force && localStorage.getItem(WT_KEY)) return;
  if(!force && currentUser){localStorage.setItem(WT_KEY,'1');return;}
  if(!force && Object.keys(loadEntries()).length>0){localStorage.setItem(WT_KEY,'1');return;}
  _wtStep = 0;
  renderWalkthroughStep();
}

function renderWalkthroughStep(){
  // Remove any existing overlay
  document.getElementById('wtOverlay')?.remove();

  const step = WT_STEPS[_wtStep];
  if(!step) return finishWalkthrough();

  const overlay = document.createElement('div');
  overlay.className = 'wt-overlay';
  overlay.id = 'wtOverlay';

  // Spotlight
  const spotlight = document.createElement('div');
  spotlight.className = 'wt-spotlight';
  if(step.target){
    const el = document.getElementById(step.target);
    if(el){
      const r = el.getBoundingClientRect();
      spotlight.style.cssText = `left:${r.left-8}px;top:${r.top-8+window.scrollY}px;width:${r.width+16}px;height:${r.height+16}px;`;
    }
  } else {
    spotlight.style.cssText = 'display:none;';
  }
  overlay.appendChild(spotlight);

  // Card
  const card = document.createElement('div');
  card.className = 'wt-card';

  // Position card
  if(step.target && document.getElementById(step.target)){
    const r = document.getElementById(step.target).getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    if(spaceBelow > 220){
      card.style.top = (r.bottom + window.scrollY + 16) + 'px';
    } else {
      card.style.top = Math.max(16, r.top + window.scrollY - 220) + 'px';
    }
  } else {
    card.style.top = '50%';
    card.style.transform = 'translate(-50%,-50%)';
  }

  // Dots
  const dots = WT_STEPS.map((_,i) =>
    '<div class="wt-dot' + (i===_wtStep?' active':'') + '"></div>'
  ).join('');

  const isLast = _wtStep === WT_STEPS.length - 1;
  const isFirst = _wtStep === 0;

  card.innerHTML = '<div class="wt-card-top">'
    +'<div class="wt-step-dots">'+dots+'</div>'
    +'<button class="wt-skip" onclick="finishWalkthrough()">Skip</button>'
    +'</div>'
    +'<span class="wt-icon">'+step.icon+'</span>'
    +'<div class="wt-title">'+step.title+'</div>'
    +'<div class="wt-body">'+step.body+'</div>'
    +'<div class="wt-btns">'
    +(!isFirst ? '<button class="wt-btn-back" onclick="wtBack()">← Back</button>' : '')
    +'<button class="wt-btn-next" onclick="'+(isLast?'finishWalkthrough()':'wtNext()')+'">'+
      (isLast ? 'Start journaling ✦' : 'Next →')+'</button>'
    +'</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Scroll target into view
  if(step.target){
    const el = document.getElementById(step.target);
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      // Open section if collapsed
      if(el.classList.contains('today-section-collapsed')){
        toggleTodaySection(step.target);
      }
    }
  }
}

function wtNext(){ _wtStep++; renderWalkthroughStep(); }
function wtBack(){ if(_wtStep>0){ _wtStep--; renderWalkthroughStep(); } }

function finishWalkthrough(){
  document.getElementById('wtOverlay')?.remove();
  localStorage.setItem(WT_KEY, '1');
  // Focus the entry form
  const formWrap = document.getElementById('entryFormWrap');
  if(formWrap && formWrap.style.display !== 'none'){
    formWrap.scrollIntoView({behavior:'smooth', block:'start'});
  }
  showToast("✦ You are all set — log your first entry");
}


// ─── URL PARAM HANDLING ───────────────────────────────────────────────────────
(function handleUrlParams(){
  const params = new URLSearchParams(window.location.search);
  if(params.get('signin') === '1'){
    setTimeout(() => { if(!currentUser) openAuthModal(); }, 800);
  }
  if(params.get('openSigns') === '1'){
    // Deeplink from widget — open Signs modal after app loads
    setTimeout(() => {
      if(typeof openSignsModal === 'function') openSignsModal();
      // Clean URL so refreshing doesn't re-open
      if(window.history.replaceState) window.history.replaceState({}, '', window.location.pathname);
    }, 1200);
  }
})();


// Nudge to sign up after 3 entries if not signed in
function checkSignupNudge(){
  if(currentUser) return;
  const entries = loadEntries();
  const count = Object.keys(entries).length;
  const nudged = localStorage.getItem('lunations_nudged');
  if(count >= 3 && !nudged){
    localStorage.setItem('lunations_nudged', '1');
    setTimeout(() => {
      showToast('✦ Loving Lunations? Sign in to back up your entries');
    }, 2000);
  }
}

function sendPasswordReset(){
  const email = document.getElementById('authEmail')?.value?.trim();
  if(!email){ document.getElementById('authError').textContent = 'Enter your email first'; return; }
  if(!sbClient){ return; }
  sbClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/app'
  }).then(({error}) => {
    if(error) document.getElementById('authError').textContent = error.message;
    else {
      document.getElementById('authError').style.color = 'rgba(100,200,100,.7)';
      document.getElementById('authError').textContent = 'Reset email sent — check your inbox';
    }
  });
}

// ─── AUTH GATE FOR AI CALLS ───────────────────────────────────────────────────
var _readingInFlight=false,_readingQueue=false;
function canUseAI(){
  return !!currentUser; // Only signed-in users get AI readings
}

// Fallback horoscope text for non-logged-in users
// Pulled from a curated set based on phase + moon sign - no API needed
const PHASE_FALLBACKS = {
  "New Moon": [
    "The new moon marks a threshold. What you plant in stillness tonight takes root quietly. No force needed, just intention.",
    "Darkness before the first light. The field is empty and ready. Sit with what wants to begin.",
    "At the new moon the cycle breathes in. This is the moment of seeding, not striving.",
  ],
  "Waxing Crescent": [
    "The light returns in a thin edge. Lean toward what you set in motion. Small steps carry the new moon charge.",
    "First emergence. The seed is pushing upward. Tend the new direction without rushing the growth.",
    "Crescent energy is tentative and potent. What you nurture now has the full cycle behind it.",
  ],
  "First Quarter": [
    "The square of tension is also the square of decision. Something asks to be committed to or released.",
    "Half-light, half-dark. The friction here is generative. Push through it.",
    "First quarter asks: are you still aligned with what you set at the new moon? Adjust if needed.",
  ],
  "Waxing Gibbous": [
    "Nearly full. The work is in refinement now. What needs polishing before the peak?",
    "Waxing gibbous is the phase of patience. Almost there. Hold the intention clearly.",
    "The pressure before fullness. Stay with it. What you are building is close to completion.",
  ],
  "Full Moon": [
    "Full illumination. What has been hidden surfaces. What has been building arrives. Feel all of it.",
    "The moon at her peak. Completion energy is high. Celebrate what the cycle brought and release what it is done with.",
    "Peak transmission. The channel between inner and outer is wide open tonight.",
  ],
  "Waning Gibbous": [
    "The gratitude phase. The harvest is in. Now integrate what arrived at the full moon.",
    "Waning gibbous is for sharing and distributing what you gathered. Give some of it away.",
    "After the peak comes the gift of integration. Let the full moon revelations settle.",
  ],
  "Last Quarter": [
    "The second square. Release what the cycle revealed is done. Make space for what comes at the new moon.",
    "Last quarter asks for forgiveness and letting go. Nothing needs to be carried into the next cycle.",
    "The clearing begins. What no longer serves the next cycle, let it go here.",
  ],
  "Waning Crescent": [
    "The balsamic moon. Rest, dream, and restore. The cycle is completing itself.",
    "Surrender phase. Do less than you think you should. The next moon needs you rested.",
    "Waning crescent is for the inner world. Dreams carry information now. Listen to them.",
  ],
};

function getFallbackReading(phase, mSign, sSign, profile){
  const phaseTexts = PHASE_FALLBACKS[phase.name] || PHASE_FALLBACKS['New Moon'];
  const idx = new Date().getDate() % phaseTexts.length;
  let text = phaseTexts[idx];
  if(mSign) text += ' Moon moves through ' + mSign.name + ' — ' + (mSign.keywords.split(',')[0].trim()) + '.';
  return text;
}


// ─── AI READING TONE ──────────────────────────────────────────────────────────
const TONE_KEY = 'lunations_tone_v1';
const AI_TONES = [
  { id:'vedic',     label:'Vedic',     icon:'🕉',  desc:'Sanskrit-grounded. Tithi, nakshatra, planetary dharma.' },
  { id:'goddess',   label:'Goddess',   icon:'🌹',  desc:'Devotional. Divine Feminine. Goddess archetypes.' },
  { id:'mystic',    label:'Mystic',    icon:'✦',   desc:'Esoteric, poetic. Reads the symbolic layer.' },
  { id:'direct',    label:'Direct',    icon:'◈',   desc:'Clear, practical. No fluff, just insight.' },
  { id:'source',    label:'Source',    icon:'∞',   desc:'Unified field. Quantum-spiritual synthesis.' },
  { id:'elemental', label:'Elemental', icon:'🔥',  desc:'Fire, earth, air, water. Nature-based language.' },
  { id:'oracle',    label:'Oracle',    icon:'👁',  desc:'Full unlock. Therapeutic, diagnostic, every tradition.', pro:true },
];

function getAITone(){ return localStorage.getItem(TONE_KEY) || 'mystic'; }
function setAITone(id){
  var toneObj=AI_TONES.find(function(t){return t.id===id;});
  if(toneObj&&toneObj.pro&&_userTier!=='pro'){if(!requireTier('pro','Oracle mode is a Pro feature.'))return;}
  localStorage.setItem(TONE_KEY,id);
  renderToneGrid();
  updateToneLabel();
  localStorage.removeItem(RK);
  showToast('✦ Tone: '+(AI_TONES.find(t=>t.id===id)?.label||id));
  var p=loadProfile();if(p){p.tone=id;saveProfileData(p);}
  // Refresh modal grids if open
  if(document.getElementById('settingsModal')?.classList.contains('open')){
    const smTG = document.getElementById('smToneGrid');
    if(smTG) smTG.querySelectorAll('[onclick]').forEach(el => {
      const isSelected = el.getAttribute('onclick')?.includes("'"+id+"'");
      el.style.border = '1px solid '+(isSelected?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)');
      el.style.background = isSelected?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)';
      el.querySelector('div:last-child').style.color = isSelected?'var(--gold)':'rgba(245,240,232,.5)';
    });
  }
}

function updateToneLabel(){
  const t = AI_TONES.find(t => t.id === getAITone());
  const el = document.getElementById('readingToneName');
  if(el && t) el.textContent = t.label;
}

function renderToneGrid(){
  const grid = document.getElementById('toneGrid');
  if(!grid) return;
  const current = getAITone();
  grid.innerHTML = AI_TONES.map(t => `
    <div onclick="setAITone('${t.id}')" style="cursor:pointer;padding:12px;border-radius:8px;border:1px solid ${t.id===current?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)'};background:${t.id===current?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)'};transition:all .15s;">
      <div style="font-size:20px;margin-bottom:6px;">${t.icon}</div>
      <div style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.08em;color:${t.id===current?'var(--gold)':'rgba(245,240,232,.6)'};">${t.label}${t.pro?' <span style="font-size:8px;background:rgba(201,168,76,.15);color:var(--gold);padding:1px 5px;border-radius:3px;vertical-align:middle;letter-spacing:.05em;">PRO</span>':''}</div>
      <div style="font-size:11px;color:rgba(245,240,232,.3);margin-top:3px;font-style:italic;line-height:1.4;">${t.desc}</div>
    </div>`).join('');
}

function getTonePromptAddition(){
  const tone = getAITone();
  const t = AI_TONES.find(t => t.id === tone);
  const additions = {
    vedic:     'Write in a Vedic astrology register. Reference tithi, nakshatra, and planetary dharma. Sanskrit terms welcome where natural.',
    goddess:   'Write from a devotional, Divine Feminine perspective. Reference goddess archetypes when relevant. Warm, reverent, embodied.',
    mystic:    'Write with poetic, esoteric depth. Lean into symbol, myth, and the liminal. No cliches.',
    direct:    'Be direct and practical. No filler, no mystical padding. Concrete insight only.',
    source:    'Write from a unified field perspective — consciousness, frequency, quantum resonance. Synthesize spiritual and scientific.',
    elemental: 'Ground everything in the four elements. Speak the language of fire, earth, air, and water. Nature-based and embodied.',
    oracle:    '[ORACLE_MODE] You have full access to every framework: psychological (Jungian, somatic, attachment theory, IFS, shadow work), religious and mystical (Kabbalah, Sufism, Vedanta, Gnosticism, Buddhist dharma), astrological (Hellenistic, Vedic, evolutionary), akashic, alchemical, and scientific. Draw from whatever is most relevant to THIS person and THIS sky. Be frank. Name what you see — patterns, blind spots, wounds, gifts, developmental edges. You may offer observations that a skilled therapist or spiritual director would. Be warm but do not soften the truth. Say what a wise elder with every book ever written would say to this one person on this one day.',
  };
  return additions[tone] || additions.mystic;
}


// ─── MENSTRUAL CYCLE TRACKING ─────────────────────────────────────────────────
const CYCLE_KEY = 'lunations_cycle_v1';

function toggleCycleFields(on){
  const fields = document.getElementById('cycleFields');
  const thumb = document.getElementById('cycleToggleThumb');
  if(fields) fields.style.display = on ? 'block' : 'none';
  if(thumb) thumb.style.transform = on ? 'translateX(20px)' : '';
  if(thumb) thumb.style.background = on ? 'rgba(200,130,160,.9)' : 'rgba(245,240,232,.4)';
}

function saveCycleData(){
  const trackEl = document.getElementById('obTrackCycle');
  if(!trackEl || !trackEl.checked) return;
  const startEl = document.getElementById('obCycleStart');
  const lenEl = document.getElementById('obCycleLength');
  if(!startEl?.value) return;
  const data = {
    trackCycle: true,
    lastStart: startEl.value,
    cycleLength: parseInt(lenEl?.value) || 28,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CYCLE_KEY, JSON.stringify(data));
  return data;
}

function loadCycleData(){
  try{ return JSON.parse(localStorage.getItem(CYCLE_KEY)||'null'); }
  catch(e){ return null; }
}

function getCycleDay(){
  const data = loadCycleData();
  if(!data?.lastStart) return null;
  const start = new Date(data.lastStart + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const daysSince = Math.floor((today - start) / 86400000);
  const cycleLen = data.cycleLength || 28;
  const dayInCycle = (daysSince % cycleLen) + 1;
  // Determine phase
  let phase, color;
  if(dayInCycle <= 5){ phase = 'Menstrual'; color = 'rgba(180,80,100,.7)'; }
  else if(dayInCycle <= 13){ phase = 'Follicular'; color = 'rgba(100,160,120,.7)'; }
  else if(dayInCycle <= 16){ phase = 'Ovulatory'; color = 'rgba(201,168,76,.8)'; }
  else{ phase = 'Luteal'; color = 'rgba(140,100,180,.7)'; }
  return { day: dayInCycle, phase, color, cycleLen };
}

function renderCyclePhaseWidget(){
  const data = getCycleDay();
  if(!data) return;
  // Show in Today > Now section near the streak
  const streakBar = document.getElementById('streakBar');
  if(!streakBar) return;
  let cycleEl = document.getElementById('cyclePhaseWidget');
  if(!cycleEl){
    cycleEl = document.createElement('div');
    cycleEl.id = 'cyclePhaseWidget';
    cycleEl.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;';
    streakBar.after(cycleEl);
  }
  cycleEl.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:rgba(245,240,232,.02);border:1px solid rgba(180,100,140,.15);border-radius:20px;padding:5px 14px;">
    <span style="font-size:13px;">🌸</span>
    <span style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;color:${data.color};">${data.phase}</span>
    <span style="font-size:11px;color:rgba(245,240,232,.25);">Day ${data.day} of ${data.cycleLen}</span>
  </div>`;
}


function saveCycleFromSettings(){
  const startEl = document.getElementById('settingsCycleStart');
  const lenEl = document.getElementById('settingsCycleLength');
  if(!startEl?.value){ showToast('Enter your last period start date'); return; }
  const data = {
    trackCycle: true,
    lastStart: startEl.value,
    cycleLength: parseInt(lenEl?.value) || 28,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CYCLE_KEY, JSON.stringify(data));
  showToast('✦ Cycle data saved');
}

function renderProfileNudge(){
  const p = loadProfile();
  const el = document.getElementById('profileNudge');
  if(!el) return;
  if(p?.name && p?.dob){
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  const missing = [];
  if(!p?.name) missing.push('name');
  if(!p?.dob) missing.push('birth date');
  el.innerHTML = '<div style="background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.12);border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
    +'<div style="font-size:13px;color:rgba(245,240,232,.45);font-style:italic;">Add your '+ missing.join(' and ') +' for personalized readings</div>'
    +'<button onclick="openOnboarding()" style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding:6px 14px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.25);border-radius:4px;color:var(--gold);cursor:pointer;">Set up →</button>'
    +'</div>';
}

// ─── PDF CYCLE REPORT ─────────────────────────────────────────────────────────
function generateCycleReport(){
  if(typeof requireTier === 'function' && !requireTier('plus','Cycle Reports are a Plus feature. Upgrade to export beautiful PDF reports of your lunar cycles.')) return;
  const entries = loadEntries();
  const profile = loadProfile();
  const now = new Date();
  
  // Get current cycle entries
  const nm = getCycleStart(cycleOffset || 0);
  const cycleKeys = Object.keys(entries).filter(k => {
    const d = new Date(k + 'T12:00:00');
    return d >= nm && d <= now;
  }).sort();

  if(!cycleKeys.length){
    showToast('No entries in this cycle yet');
    return;
  }

  const phase = moonPhaseInfo(nm);
  const mSign = moonSignApprox(nm);
  const cycleNum = Math.max(1, Math.min(13, getCycleNum(nm)));

  // Calculate averages
  const avg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '—';
  const avgE = avg(cycleKeys.map(k=>entries[k].energy||0));
  const avgM = avg(cycleKeys.map(k=>entries[k].mood||0));
  const avgC = avg(cycleKeys.map(k=>entries[k].clarity||0));
  const avgCr = avg(cycleKeys.map(k=>entries[k].creativity||0));

  // Quality frequency
  const qualCounts = {};
  cycleKeys.forEach(k => (entries[k].qualities||[]).forEach(q => qualCounts[q]=(qualCounts[q]||0)+1));
  const topQuals = Object.entries(qualCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // Peak days
  const peakEnergy = cycleKeys.sort((a,b)=>(entries[b].energy||0)-(entries[a].energy||0))[0];
  const peakMood = cycleKeys.sort((a,b)=>(entries[b].mood||0)-(entries[a].mood||0))[0];

  // Entry excerpts (up to 5 meaningful ones)
  const excerpts = cycleKeys
    .filter(k => entries[k].text && entries[k].text.length > 30)
    .slice(0, 5);

  const nmDate = nm.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const reportDate = now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const name = profile?.name || 'Anonymous';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Lunations · Cycle ${cycleNum} Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; color:#1a1510; font-family:'EB Garamond',serif; font-size:14px; line-height:1.7; }
  .page { max-width:680px; margin:0 auto; padding:48px 40px; }
  .header { text-align:center; border-bottom:1px solid #d4b870; padding-bottom:28px; margin-bottom:32px; }
  .logo { font-family:'Cinzel',serif; font-size:11px; letter-spacing:.25em; color:#8a6a20; text-transform:uppercase; margin-bottom:8px; }
  .cycle-title { font-family:'Cinzel',serif; font-size:26px; color:#1a1510; margin-bottom:4px; }
  .cycle-sub { font-size:14px; color:#8a6a20; font-style:italic; }
  .meta { font-size:12px; color:#999; margin-top:8px; }
  .section { margin-bottom:28px; }
  .section-label { font-family:'Cinzel',serif; font-size:9px; letter-spacing:.18em; text-transform:uppercase; color:#8a6a20; margin-bottom:12px; border-bottom:1px solid #e8d49a; padding-bottom:6px; }
  .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:4px; }
  .metric { text-align:center; padding:12px; border:1px solid #e8d49a; border-radius:6px; }
  .metric-val { font-family:'Cinzel',serif; font-size:24px; color:#8a6a20; display:block; }
  .metric-label { font-size:11px; color:#999; margin-top:2px; }
  .quality-pills { display:flex; flex-wrap:wrap; gap:6px; }
  .quality-pill { font-size:12px; color:#8a6a20; border:1px solid #e8d49a; border-radius:20px; padding:3px 12px; }
  .excerpt { margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #f0e8d0; }
  .excerpt:last-child { border-bottom:none; }
  .excerpt-date { font-family:'Cinzel',serif; font-size:9px; letter-spacing:.1em; color:#8a6a20; text-transform:uppercase; margin-bottom:4px; }
  .excerpt-text { font-size:14px; color:#3a2e20; font-style:italic; line-height:1.75; }
  .footer { text-align:center; border-top:1px solid #e8d49a; padding-top:16px; margin-top:32px; font-size:11px; color:#bbb; font-family:'Cinzel',serif; letter-spacing:.1em; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">Lunations</div>
    <div class="cycle-title">Cycle ${cycleNum} · ${mSign.name}</div>
    <div class="cycle-sub">${nmDate} · ${cycleKeys.length} days logged</div>
    <div class="meta">Report for ${name} · Generated ${reportDate}</div>
  </div>

  <div class="section">
    <div class="section-label">Averages This Cycle</div>
    <div class="metrics">
      <div class="metric"><span class="metric-val">${avgE}</span><div class="metric-label">Energy</div></div>
      <div class="metric"><span class="metric-val">${avgM}</span><div class="metric-label">Mood</div></div>
      <div class="metric"><span class="metric-val">${avgC}</span><div class="metric-label">Clarity</div></div>
      <div class="metric"><span class="metric-val">${avgCr}</span><div class="metric-label">Creativity</div></div>
    </div>
  </div>

  ${topQuals.length ? `<div class="section">
    <div class="section-label">Most Present Qualities</div>
    <div class="quality-pills">${topQuals.map(([q,n])=>`<span class="quality-pill">${q} (${n}×)</span>`).join('')}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-label">Peak Days</div>
    <p style="color:#555;font-style:italic;">
      Highest energy: ${peakEnergy ? new Date(peakEnergy+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' — ' + (entries[peakEnergy]?.energy||0) + '/10' : '—'}<br>
      Highest mood: ${peakMood ? new Date(peakMood+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' — ' + (entries[peakMood]?.mood||0) + '/10' : '—'}
    </p>
  </div>

  ${excerpts.length ? `<div class="section">
    <div class="section-label">Journal Excerpts</div>
    ${excerpts.map(k => {
      const d = new Date(k+'T12:00:00');
      const e = entries[k];
      return `<div class="excerpt">
        <div class="excerpt-date">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} · ${moonPhaseInfo(d).name}</div>
        <div class="excerpt-text">${(e.text||'').slice(0,300)}${e.text?.length > 300 ? '…' : ''}</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <div class="footer">the sky remembers who you are · lunations.app</div>
</div>
`;

  // Open in new window for print/save as PDF
  if(typeof window.Capacitor!=='undefined'&&window.Capacitor.isNativePlatform?.()){showToast('Open on web to download PDF');return;}
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}


// ─── SETTINGS MODAL ──────────────────────────────────────────────────────────
function openAccountModal(){
  renderAccountModal();
  document.getElementById('accountModal').classList.add('open');
}
function closeAccountModal(){
  document.getElementById('accountModal').classList.remove('open');
}
function renderAccountModal(){
  const profile = loadProfile();
  const entries = loadEntries();
  const entryCount = Object.keys(entries).filter(k => !entries[k].isMockData).length;
  const el = document.getElementById('amAccountContent');
  if(!el) return;
  let html = '';

  // Avatar + profile identity
  const avatarUrl = localStorage.getItem('lunations_avatar_v1') || '';
  const displayName = profile?.name || (currentUser ? currentUser.email.split('@')[0] : 'Guest');
  html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">';
  html += '<div id="amAvatarWrap" style="position:relative;flex-shrink:0;">';
  if(avatarUrl){
    html += '<img src="'+avatarUrl+'" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid rgba(201,168,76,.3);">';
  } else {
    const initials = displayName.slice(0,2).toUpperCase();
    html += '<div style="width:64px;height:64px;border-radius:50%;background:rgba(201,168,76,.1);border:2px solid rgba(201,168,76,.25);display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-size:20px;color:rgba(201,168,76,.7);">'+initials+'</div>';
  }
  html += '<label style="position:absolute;bottom:0;right:0;background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.3);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;" title="Upload photo">'
    + '<input type="file" accept="image/*" onchange="uploadAvatar(this)" style="display:none;">\ud83d\udcf7</label>';
  html += '</div>';

  html += '<div style="flex:1;min-width:0;">';
  html += '<div style="font-family:Cinzel,serif;font-size:15px;color:rgba(245,240,232,.85);margin-bottom:2px;">'+displayName+'</div>';
  if(currentUser) html += '<div style="font-size:12px;color:rgba(245,240,232,.35);margin-bottom:6px;">'+currentUser.email+'</div>';
  if(profile?.dob){
    const bd=new Date(profile.dob+'T12:00:00'),ns=sunSignForDate(bd),nm=moonSignApprox(bd);
    html += '<div style="font-size:12px;color:rgba(245,240,232,.45);">'+ns.symbol+' '+ns.name+' \xb7 '+nm.symbol+' '+nm.name+(profile.rising?' \xb7 '+profile.rising+' \u2191':'')+'</div>';
    if(profile.birthCity) html += '<div style="font-size:11px;color:rgba(245,240,232,.25);margin-top:2px;">'+profile.birthCity+'</div>';
  } else {
    html += '<div style="font-size:12px;color:rgba(245,240,232,.3);font-style:italic;">Add your birth date for personalized readings.</div>';
  }
  html += '</div></div>';

  // Stats
  if(currentUser){
    const lastSync = localStorage.getItem('lunations_last_sync') || 'never';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">'
      +'<div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:10px;text-align:center;">'
      +'<div style="font-family:Cinzel,serif;font-size:20px;color:var(--gold);">'+entryCount+'</div>'
      +'<div style="font-size:10px;color:rgba(245,240,232,.3);margin-top:2px;">entries</div></div>'
      +'<div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:10px;text-align:center;">'
      +'<div style="font-family:Cinzel,serif;font-size:12px;color:rgba(245,240,232,.5);">'+lastSync+'</div>'
      +'<div style="font-size:10px;color:rgba(245,240,232,.3);margin-top:2px;">last sync</div></div></div>';
  }

  // Profile actions
  html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">';
  html += '<button class="save-btn" style="margin-top:0;" onclick="openOnboarding();closeAccountModal()">Edit Birth Data</button>';
  if(currentUser && _userTier && _userTier!=='free'){
    html += '<div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.18);border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;">'
      +'<div><span style="font-size:13px;color:rgba(201,168,76,.7);font-family:Cinzel,serif;letter-spacing:.05em;">'+_userTier.charAt(0).toUpperCase()+_userTier.slice(1)+'</span><span style="font-size:11px;color:rgba(245,240,232,.3);margin-left:8px;">Active</span></div>'
      +'<button class="save-btn" style="margin:0;padding:6px 14px;font-size:10px;" onclick="openBillingPortal()">Manage Billing</button></div>';
  } else if(currentUser){
    html += '<button class="save-btn" style="margin-top:0;border-color:rgba(201,168,76,.35);color:var(--gold);" onclick="openUpgradeModal();closeAccountModal()">\u2726 Upgrade to Plus</button>';
  }
  if(!currentUser){
    html += '<button class="save-btn" style="margin-top:0;" onclick="openAuthModal();closeAccountModal()">Sign In / Create Account</button>';
  }
  html += '</div>';

  // Account actions (signed in)
  if(currentUser){
    html += '<div style="display:flex;flex-direction:column;gap:8px;">'
      +'<button class="save-btn" style="margin-top:0;" onclick="openChangeEmailModal()">Change Email</button>'
      +'<button class="save-btn" style="margin-top:0;" onclick="openChangePasswordModal()">Change Password</button>'
      +'<div id="smEmailFormWrap"></div>'
      +'<div id="smPwFormWrap"></div>'
      +'<button class="save-btn" style="margin-top:4px;border-color:rgba(200,80,80,.3);color:rgba(220,100,100,.7);" onclick="confirmDeleteAccount()">Delete Account</button>'
      +'<button class="save-btn" style="margin-top:0;background:rgba(245,240,232,.02);border-color:rgba(245,240,232,.1);" onclick="confirmSignOut()">Sign Out</button>'
      +'</div>';
  }

  el.innerHTML = html;
}

function openSettingsModal(){
  renderSettingsModal();
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettingsModal(){
  document.getElementById('settingsModal').classList.remove('open');
}

function renderSettingsModal(){
  const profile = loadProfile();
  const entries = loadEntries();
  const entryCount = Object.keys(entries).filter(k => !entries[k].isMockData).length;

  // Theme grid
  var smThG = document.getElementById('smThemeGrid');
  if(smThG){
    smThG.innerHTML = Object.entries(THEMES).map(function(entry){
      var key=entry[0], t=entry[1], sel=_currentTheme===key;
      var canUse=t.tier==='free'||(typeof hasTier==='function'&&hasTier(t.tier));
      var bdr=sel?'rgba(201,168,76,.5)':canUse?'rgba(245,240,232,.08)':'rgba(245,240,232,.04)';
      var bg=sel?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)';
      var col=sel?'var(--gold)':canUse?'rgba(245,240,232,.5)':'rgba(245,240,232,.2)';
      var opacity=canUse?'1':'0.5';
      var onclick=canUse?"setTheme('"+key+"')":"requireTier('"+t.tier+"','Upgrade to Plus to unlock the "+t.label+" theme.')";
      var badge=t.tier!=='free'&&!canUse?' <span style="font-size:7px;background:rgba(201,168,76,.15);color:var(--gold);padding:1px 4px;border-radius:3px;vertical-align:middle;">PLUS</span>':'';
      return '<div onclick="'+onclick+'" style="cursor:pointer;padding:10px;border-radius:8px;border:1px solid '+bdr+';background:'+bg+';text-align:center;opacity:'+opacity+';"><div style="font-size:18px;margin-bottom:4px;">'+t.icon+'</div><div style="font-family:Cinzel,serif;font-size:10px;color:'+col+';">'+t.label+badge+'</div></div>';
    }).join('');
  }

  // Mode grid
  const smMG = document.getElementById('smModeGrid');
  if(smMG){
    const current = getCurrentMode();
    smMG.innerHTML = Object.entries(MODES).map(function(entry){
      var key=entry[0], m=entry[1], sel=current===key;
      var bdr=sel?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)';
      var bg=sel?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)';
      var col=sel?'var(--gold)':'rgba(245,240,232,.5)';
      return '<div onclick="setMode(\'' + key + '\')" style="cursor:pointer;padding:10px;border-radius:8px;border:1px solid '+bdr+';background:'+bg+';text-align:center;"><div style="font-size:18px;margin-bottom:4px;">'+m.icon+'</div><div style="font-family:Cinzel,serif;font-size:10px;color:'+col+';">'+m.name+'</div></div>';
    }).join('');
  }

  // Tone grid
  const smTG = document.getElementById('smToneGrid');
  if(smTG){
    const currentTone = getAITone();
    smTG.innerHTML = AI_TONES.map(function(t){
      var sel=t.id===currentTone;
      var bdr=sel?'rgba(201,168,76,.5)':'rgba(245,240,232,.08)';
      var bg=sel?'rgba(201,168,76,.08)':'rgba(245,240,232,.02)';
      var col=sel?'var(--gold)':'rgba(245,240,232,.5)';
      var proTag=t.pro?' <span style="font-size:7px;background:rgba(201,168,76,.15);color:var(--gold);padding:1px 4px;border-radius:3px;vertical-align:middle;">PRO</span>':'';
      return '<div onclick="setAITone(\'' + t.id + '\')" style="cursor:pointer;padding:10px;border-radius:8px;border:1px solid '+bdr+';background:'+bg+';text-align:center;"><div style="font-size:18px;margin-bottom:4px;">'+t.icon+'</div><div style="font-family:Cinzel,serif;font-size:10px;color:'+col+';">'+t.label+proTag+'</div></div>';
    }).join('');
  }

  // Toggles
  const tv = document.getElementById('smToggleVedic');
  const tt = document.getElementById('smToggleTransits');
  const ti = document.getElementById('smToggleIntention');
  if(tv) tv.checked = getSetting('showVedic', true);
  if(tt) tt.checked = getSetting('showTransits', true);
  if(ti) ti.checked = getSetting('showIntention', true);
  const tc = document.getElementById('smToggleChinese');
  if(tc) tc.checked = getSetting('showChinese', true);

  // Icon grid
  const smIG = document.getElementById('smIconGrid');
  if(smIG){
    const currentIcon = getSetting('icon','');
    smIG.innerHTML = ICON_OPTIONS.map(function(opt){
      var sel=opt.glyph===currentIcon;
      var displayGlyph=opt.glyph||moonPhaseInfo(new Date()).emoji;
      return '<div class="icon-option'+(sel?' selected':'')+'" onclick="setIcon('+JSON.stringify(opt.glyph)+',this)" style="padding:8px 12px;"><span class="icon-glyph">'+displayGlyph+'</span><span class="icon-label" style="font-size:10px;">'+opt.label+'</span></div>';
    }).join('');
  }

  // Storage info
  const smSI = document.getElementById('smStorageInfo');
  if(smSI){
    const totalSize = JSON.stringify(entries).length;
    const kb = (totalSize/1024).toFixed(1);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const keys = Object.keys(entries).sort();
    smSI.innerHTML = entryCount + ' entries recorded · ' + kb + ' KB<br>'
      + 'First: ' + (keys.length ? keys[0] : '—') + ' · Latest: ' + (keys.length ? keys[keys.length-1] : '—') + '<br>'
      + 'Timezone: ' + tz;
  }
  renderCalendarImportMeta();

  // Menstrual Cycle - conditional
  const smCycleSec = document.getElementById('smCycleSection');
  const smCycleDiv = document.getElementById('smCycleDivider');
  if(smCycleSec){
    const cd = loadCycleData();
    const tracking = profile?.trackCycle || cd?.trackCycle;
    if(tracking){
      if(smCycleDiv) smCycleDiv.style.display='';
      smCycleSec.innerHTML = '<div class="sm-section-label">Menstrual Cycle</div>'
        +'<div style="font-size:13px;color:rgba(245,240,232,.3);font-style:italic;margin-bottom:12px;">Track your cycle alongside the lunar calendar.</div>'
        +'<div class="ob-field" style="margin-bottom:10px;"><label class="ob-label">Last period start</label>'
        +'<input class="ob-input" type="date" id="smCycleStart" value="'+(cd&&cd.lastStart?cd.lastStart:'')+'"></div>'
        +'<div class="ob-field" style="margin-bottom:12px;"><label class="ob-label">Average cycle length (days)</label>'
        +'<input class="ob-input" type="number" id="smCycleLength" min="21" max="45" value="'+(cd&&cd.cycleLength?cd.cycleLength:28)+'"></div>'
        +'<div style="display:flex;gap:8px;">'
        +'<button class="save-btn" style="margin-top:0;flex:1;border-color:rgba(180,100,140,.3);color:rgba(200,130,160,.8);" onclick="saveCycleFromSettingsModal()">Save</button>'
        +'<button class="save-btn" style="margin-top:0;background:none;border-color:rgba(245,240,232,.08);color:rgba(245,240,232,.3);font-size:11px;" onclick="disableCycleTracking()">Turn off</button>'
        +'</div>';
    } else {
      if(smCycleDiv) smCycleDiv.style.display='none';
      smCycleSec.innerHTML = '';
    }
  }

  // Reading context fields
  var _profile=loadProfile();
  var _ctx=parseContextBriefing(_profile?.notes);
  var _lcEl=document.getElementById('smLifeContext');if(_lcEl){_lcEl.value=_ctx.life;if(_ctx.life)_lcEl.nextElementSibling.textContent=_ctx.life.length+'/200';}
  var _prEl=document.getElementById('smPractice');if(_prEl){_prEl.value=_ctx.practice;if(_ctx.practice)_prEl.nextElementSibling.textContent=_ctx.practice.length+'/150';}
  var _ppl=loadPeople();var _pSumEl=document.getElementById('smPeopleSummary');
  if(_pSumEl){if(_ppl.length>0){var _names=_ppl.slice(0,4).map(function(p){var r=parsePersonRole(p.notes);return p.name+(r.role?' ('+r.role+')':'');}).join(', ');_pSumEl.innerHTML=_ppl.length+' people tracked: '+_names+(_ppl.length>4?'...':'')+' — <a href="#" onclick="event.preventDefault();closeSettingsModal();openPeopleManager();" style="color:rgba(201,168,76,.5);">manage</a>';}else{_pSumEl.innerHTML='<a href="#" onclick="event.preventDefault();closeSettingsModal();openPeopleManager();" style="color:rgba(201,168,76,.4);">Add people</a> to enrich relationship readings.';}}
}

function saveCycleFromSettingsModal(){
  const startEl = document.getElementById('smCycleStart');
  const lenEl = document.getElementById('smCycleLength');
  if(!startEl?.value){ showToast('Enter your last period start date'); return; }
  const data = {
    trackCycle: true,
    lastStart: startEl.value,
    cycleLength: parseInt(lenEl?.value) || 28,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CYCLE_KEY, JSON.stringify(data));
  showToast('Cycle data saved');
  renderCyclePhaseWidget();
}

// Inline email/pw change forms (no prompt())
function openChangeEmailModal(){
  const wrap = document.getElementById('smEmailFormWrap');
  if(!wrap) return;
  wrap.innerHTML = '<div style="margin-top:8px;padding:12px;background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.1);border-radius:8px;">'
    + '<div style="font-size:12px;color:rgba(245,240,232,.4);margin-bottom:8px;">New email address</div>'
    + '<input id="newEmailInput" type="email" placeholder="new@email.com" style="width:100%;background:rgba(245,240,232,.05);border:1px solid rgba(245,240,232,.15);border-radius:6px;padding:10px;color:rgba(245,240,232,.8);font-size:14px;box-sizing:border-box;margin-bottom:8px;">'
    + '<button class="save-btn" style="margin-top:0;width:100%;" onclick="submitEmailChange()">Send Confirmation</button>'
    + '</div>';
  setTimeout(() => document.getElementById('newEmailInput')?.focus(), 50);
}

function submitEmailChange(){
  const v = document.getElementById('newEmailInput')?.value?.trim();
  if(!v || !v.includes('@')){ showToast('Enter a valid email'); return; }
  if(!sbClient) return;
  sbClient.auth.updateUser({email: v}).then(({error}) => {
    if(error) showToast('Error: ' + error.message);
    else { showToast('Confirmation sent — check your inbox'); document.getElementById('smEmailFormWrap').innerHTML = ''; }
  });
}

function openChangePasswordModal(){
  const wrap = document.getElementById('smPwFormWrap');
  if(!wrap) return;
  wrap.innerHTML = '<div style="margin-top:8px;padding:12px;background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.1);border-radius:8px;">'
    + '<div style="font-size:12px;color:rgba(245,240,232,.4);margin-bottom:8px;">New password (min 8 characters)</div>'
    + '<input id="newPwInput" type="password" placeholder="New password" style="width:100%;background:rgba(245,240,232,.05);border:1px solid rgba(245,240,232,.15);border-radius:6px;padding:10px;color:rgba(245,240,232,.8);font-size:14px;box-sizing:border-box;margin-bottom:8px;">'
    + '<button class="save-btn" style="margin-top:0;width:100%;" onclick="submitPasswordChange()">Update Password</button>'
    + '</div>';
  setTimeout(() => document.getElementById('newPwInput')?.focus(), 50);
}

function submitPasswordChange(){
  const v = document.getElementById('newPwInput')?.value;
  if(!v || v.length < 8){ showToast('Password must be at least 8 characters'); return; }
  if(!sbClient) return;
  sbClient.auth.updateUser({password: v}).then(({error}) => {
    if(error) showToast('Error: ' + error.message);
    else { showToast('Password updated'); document.getElementById('smPwFormWrap').innerHTML = ''; }
  });
}


function setIconFromEl(el){
  const glyph = el.dataset.glyph || el.getAttribute('data-glyph');
  if(glyph) setIcon(glyph, el);
}

function uploadAvatar(input){
  const file = input.files[0];
  if(!file) return;
  if(file.size > 500000){ showToast('Image too large — max 500KB'); return; }
  const reader = new FileReader();
  reader.onload = function(e){
    const dataUrl = e.target.result;
    localStorage.setItem('lunations_avatar_v1', dataUrl);
    showToast('✦ Avatar updated');
    renderSettingsModal(); // re-render to show new avatar
    updateSideMenuAccount(); // update sidebar
  };
  reader.readAsDataURL(file);
}

function disableCycleTracking(){
  const cd=loadCycleData()||{};
  cd.trackCycle=false;
  localStorage.setItem(CYCLE_KEY,JSON.stringify(cd));
  const p=loadProfile();
  if(p){p.trackCycle=false;saveProfileData(p);}
  renderSettingsModal();
  showToast('Cycle tracking turned off');
}

function toggleLastCycleEntry(){
  const full = document.getElementById('lcFullText');
  const ellipsis = document.getElementById('lcEllipsis');
  const btn = document.getElementById('lcExpandBtn');
  if(!full) return;
  const expanded = full.style.display !== 'none';
  full.style.display = expanded ? 'none' : 'inline';
  if(ellipsis) ellipsis.style.display = expanded ? 'inline' : 'none';
  if(btn) btn.innerHTML = expanded ? 'Read full entry ▾' : 'Collapse ▴';
}
// ─── LANDING ──────────────────────────────────────────────────────────────────
// enterApp defined at init

// ─── CYCLE INTENTION ─────────────────────────────────────────────────────────
const IK='lunations_intention_v1';
const loadIntentions=()=>{try{return JSON.parse(localStorage.getItem(IK)||'{}')}catch(e){return{}}};
const saveIntentions=i=>localStorage.setItem(IK,JSON.stringify(i));
function getCurrentCycleKey(){return entryKey(prevNewMoon(new Date()));}

function renderIntentionBanner(){
  if(!getSetting('showIntention',true)){document.getElementById('intentionBanner').style.display='none';return;}
  const text=loadIntentions()[getCurrentCycleKey()];
  const banner=document.getElementById('intentionBanner');
  if(text){
    document.getElementById('intentionBannerText').textContent=text;
    banner.querySelector('.intention-moon-icon').textContent=moonPhaseInfo(new Date()).emoji;
    banner.style.display='flex';
  } else {
    banner.style.display='none';
  }
}

function openIntentionModal(){
  document.getElementById('intentionInput').value=loadIntentions()[getCurrentCycleKey()]||'';
  document.getElementById('intentionModal').classList.add('open');
}
function closeIntentionModal(){document.getElementById('intentionModal').classList.remove('open');}
function saveIntention(){
  const text=document.getElementById('intentionInput').value.trim();
  if(!text)return;
  const i=loadIntentions();i[getCurrentCycleKey()]=text;saveIntentions(i);
  closeIntentionModal();renderIntentionBanner();
}
document.getElementById('intentionModal').onclick=function(e){if(e.target===this)closeIntentionModal();};

// ─── TRANSIT ALERTS ───────────────────────────────────────────────────────────
function getTransitAlerts(){
  const profile=loadProfile();
  if(!profile?.dob)return[];
  const now=new Date(),bd=new Date(profile.dob+'T12:00:00');
  const cp=allPlanets(now),np=allPlanets(bd),alerts=[];
  const highlighted=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
  for(const c of cp){
    if(!highlighted.includes(c.name))continue;
    // Planet return — back in its natal sign
    const natal=np.find(n=>n.name===c.name);
    if(natal&&c.sign?.name&&natal.sign?.name&&c.sign.name===natal.sign.name){
      alerts.push({title:`${c.symbol||''} ${c.name} in natal ${c.sign?.name||''} — a return`,desc:`${c.name} has cycled back to where it was at your birth. A cycle completes. ${c.sign?.keywords||''}.`,major:true});
    }
    // Cross-planet conjunctions in same sign
    for(const n of np){
      if(c.name===n.name)continue;
      if(c.sign?.name&&n.sign?.name&&c.sign.name===n.sign.name&&highlighted.includes(n.name)){
        alerts.push({title:`${c.symbol||''} ${c.name} conjunct natal ${n.symbol||''} ${n.name} in ${c.sign?.name||''}`,desc:(function(t,n2,sign){var PLANET_PAIRS={'Sun-Moon':'Identity and feeling align — a moment of unusual inner coherence.','Sun-Mercury':'Mind and will fuse. Communication carries extra authority today.','Sun-Venus':'Vitality meets beauty. Creative and relational energy is amplified.','Sun-Mars':'Drive is lit. Boldness comes naturally — use it with intention.','Sun-Jupiter':'Confidence expands. Doors open when you reach for them.','Sun-Saturn':'Focus sharpens. Discipline applied now builds something lasting.','Moon-Mercury':'Intuition and thought sync. Trust what rises before you analyze it.','Moon-Venus':'Emotional warmth is heightened. Connection flows easily.','Moon-Mars':'Feelings ignite action. Energy is available — watch for reactivity.','Moon-Jupiter':'Generosity and hope surface. The emotional field feels spacious.','Moon-Saturn':'Depth over surface. Old emotions ask to be witnessed.','Mercury-Venus':'Eloquence and charm are natural. A good day for important conversations.','Mercury-Mars':'Quick thinking, direct speech. Good for decisive action.','Mercury-Jupiter':'Big-picture thinking unlocks. Ideas want room to expand.','Mercury-Saturn':'Precision is your edge. Slow, careful thought pays off.','Venus-Mars':'Desire and beauty meet drive. Creative and relational magnetism is strong.','Venus-Jupiter':'Abundance and pleasure amplify each other. Enjoy without guilt.','Venus-Saturn':'What you love is being tested for depth. What endures is real.','Mars-Jupiter':'Ambition and vision align. Bold moves have favorable wind.','Mars-Saturn':'Controlled force. Discipline directs your power well today.','Jupiter-Saturn':'Expansion and structure in dialogue. Build the thing that lasts.'};var key=t+'-'+n2 in PLANET_PAIRS?t+'-'+n2:(n2+'-'+t in PLANET_PAIRS?n2+'-'+t:null);return (key?PLANET_PAIRS[key]+' ':'')+((sign?.keywords||'').split(',').slice(0,2).join(', ')+'.' || '');})((c.name),(n.name),(c.sign)),major:['Sun','Moon','Saturn','Jupiter'].includes(c.name)});
        break;
      }
    }
  }
  return alerts.slice(0,4);
}

function renderTransitAlerts(){
  const wrap=document.getElementById('transitAlertsWrap'),alerts=getTransitAlerts();
  if(!alerts.length){wrap.innerHTML='';return;}
  wrap.innerHTML=alerts.map(a=>`<div class="transit-alert" style="margin-bottom:8px;padding:10px 14px;background:rgba(201,168,76,.05);border:1px solid rgba(201,168,76,.15);border-radius:6px;">
    <div style="font-family:'Cinzel',serif;font-size:10px;letter-spacing:.08em;color:rgba(201,168,76,.7);margin-bottom:4px;">${a.title||''}</div>
    <div style="font-size:13px;color:rgba(245,240,232,.5);font-style:italic;line-height:1.6;">${a.desc||''}</div>
  </div>`).join('');
}


// ─── EXPORT ───────────────────────────────────────────────────────────────────
function exportEntries(){
  const data={exportDate:new Date().toISOString(),profile:loadProfile()||{},entries:loadEntries()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`lunar-journal-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(url);
}

// ─── SERVICE WORKER REGISTRATION ─────────────────────────────────────────────
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// ─── INIT ────────────────────────────────────────────────────────────────────
renderQualityTags();
renderAuthBadge();
// updateToneLabel called after full script parses
initHeartbeats();
initSliders();
initSectionStates(); // show guest badge immediately
// Init My Day form visibility — show the correct panel for the current log mode
try { setLogMode(getLogMode()); } catch(e) {}
initSupabase(); // then upgrade once Supabase CDN loads
// injectMockData() — disabled, use Settings > Import to load data
// Restore from IDB if localStorage was cleared, then render
restoreFromIDB().then(restored => {
  if(restored) console.log('Entries restored from IndexedDB');
  if(typeof reconcileEveningEntries==='function') reconcileEveningEntries();
  try { updateToneLabel(); } catch(e){}
  renderToday();
  setTimeout(restoreLastTab, 100);
  dismissLoadingScreen();
}).catch(function(){ dismissLoadingScreen(); });

// Safety net: always dismiss loading screen after 5s no matter what
setTimeout(dismissLoadingScreen, 5000);

function dismissLoadingScreen(){
  var el=document.getElementById('loadingScreen');
  if(!el||el.dataset.dismissed) return;
  el.dataset.dismissed='1';
  var elapsed=performance.now();
  var minMs=1200;
  var delay=Math.max(0,minMs-elapsed);
  setTimeout(function(){
    el.classList.add('fade-out');
    setTimeout(function(){ el.remove(); },600);
  },delay);
}

function enterApp(){
  localStorage.setItem('lj_entered','1');
  var ls=document.getElementById('landingScreen');if(ls)ls.classList.add('hidden');
  // Only open auth modal if user has never entered before (first visit)
  // Returning guests or users who dismissed it before can get straight to the app
  if(!localStorage.getItem('lj_auth_seen')){
    localStorage.setItem('lj_auth_seen','1');
    setTimeout(openAuthModal,200);
  }
}

(function(){
  var ls = document.getElementById('landingScreen');
  if(!ls) return;
  if(localStorage.getItem('lj_entered')){
    ls.classList.add('hidden');
    // Only fire walkthrough if user has no entries AND no wt_done flag
    // Returning signed-in users should never see the tour
    if(!localStorage.getItem('lunations_wt_done_v1')) {
      // Delay to let auth resolve — if user signs in, onSignedIn handles tour
      // Only show if still guest after 2s (no auth session)
      setTimeout(function() {
        var hasEntries = Object.keys(JSON.parse(localStorage.getItem('lunations_v1')||'{}')).length > 0;
        if(!localStorage.getItem('lunations_wt_done_v1') && !hasEntries && !currentUser) {
          startWalkthrough();
        } else if(hasEntries) {
          // Has entries — mark wt_done so tour never fires
          localStorage.setItem('lunations_wt_done_v1','1');
        }
      }, 2000);
    }
  }
})();



function renderSkyForecast() {
  const wrap = document.getElementById('skyForecastCards');
  if (!wrap) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() + forecastOffset * 30);

  const labelEl = document.getElementById('forecastRangeLabel');
  if (labelEl) {
    const end = new Date(start); end.setDate(end.getDate() + 29);
    labelEl.textContent = start.toLocaleDateString('en-US',{month:'short',day:'numeric'}) +
      ' – ' + end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }

  const days = buildForecastDays(start, 30);
  // Only render days with score >= 2, or every 3rd day as context
  const rendered = days.filter((d, i) => d.score >= 2 || i % 5 === 0);

  if (!rendered.length) { wrap.innerHTML = '<div class="forecast-empty">No significant days found in this range.</div>'; return; }

  const html = rendered.map(({ d, tz, xiu, nk, tithi, phase, moonEvent, tzAlerts, score, journalNote }) => {
    const isToday = d.getTime() === today.getTime();
    const isBirthday = tz.num === BIRTH_TZOLKIN.num && tz.signIdx === BIRTH_TZOLKIN.signIdx;

    // Card class
    let cls = 'fday';
    if (isBirthday || score >= 5) cls += ' major';
    else if (tz.num === 13) cls += ' portal';
    else if (tz.signIdx === 4) cls += ' kundalini';
    else if (moonEvent === 'New Moon') cls += ' newmoon';
    else if (moonEvent === 'Full Moon') cls += ' fullmoon';

    // Color var
    const fdColor = isBirthday ? 'rgba(201,168,76,.6)' :
                    tz.num === 13 ? 'rgba(140,100,220,.5)' :
                    tz.signIdx === 4 ? 'rgba(200,80,80,.5)' :
                    moonEvent === 'Full Moon' ? 'rgba(201,168,76,.45)' :
                    moonEvent === 'New Moon' ? 'rgba(100,140,220,.4)' : 'rgba(245,240,232,.12)';

    const dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const tzStr   = `${tz.num} ${tz.sign.name}`;

    // Badges
    const badges = [];
    if (isToday) badges.push('<span class="fday-badge" style="border-color:rgba(201,168,76,.5);color:#e8d49a;">Today</span>');
    if (moonEvent === 'Full Moon') badges.push('<span class="fday-badge fb-moon">Full Moon 🌕</span>');
    if (moonEvent === 'New Moon')  badges.push('<span class="fday-badge fb-nm">New Moon 🌑</span>');
    if (tz.num === 13)             badges.push('<span class="fday-badge fb-portal">Portal · Tone 13</span>');
    if (tz.signIdx === 4)          badges.push('<span class="fday-badge fb-serpent">Serpent 🐍</span>');
    if (isBirthday)                badges.push('<span class="fday-badge fb-moon">★ Galactic Birthday</span>');

    // Pills
    const pills = [
      `<span class="fpill tz">${tzolkinBadgeTip(tz)}</span>`,
      `<span class="fpill lm">${moonPhaseBadgeTip(phase)}</span>`,
      `<span class="fpill vd">${nakshatraBadgeTip(nk)}</span>`,
    ];
    if (xiu) pills.push(`<span class="fpill" style="border-color:rgba(220,160,80,.2);color:rgba(220,160,80,.6);">${xiuBadgeTip(xiu)}</span>`);
    if (tithi in SACRED_TITHIS){
      const tithiTip = fcastTip(
        SACRED_TITHIS[tithi].note.split('·')[0].trim(),
        'Tithi ' + tithi,
        SACRED_TITHIS[tithi].note,
      );
      pills.push(`<span class="fpill vd">${tithiTip}</span>`);
    }

    // Insight
    const insight = tz.sign.keywords + (nk.quality === 'sacred' || nk.quality === 'auspicious' ?
      ` · ${nk.name}: ${nk.keywords}` : '');

    const journalHTML = journalNote
      ? `<div class="fday-journal">${journalNote}</div>` : '';

    const tithiNote = tithi in SACRED_TITHIS
      ? `<div style="font-size:12px;color:rgba(245,240,232,.35);margin-top:6px;font-style:italic;">${SACRED_TITHIS[tithi].note}</div>` : '';

    const xiuNote = xiu && (xiu.quality === 'auspicious' || xiu.quality === 'intense' || xiu.quality === 'caution')
      ? `<div style="font-size:12px;color:rgba(220,160,80,.4);margin-top:4px;font-style:italic;">${xiu.ch} ${xiu.name}: ${xiu.guidance}</div>` : '';

    return `<div class="${cls}" style="--fd-color:${fdColor}">
      <div class="fday-header">
        <div>
          <div class="fday-date">${dateStr}</div>
          <div class="fday-date-sub">${phase.name} · Tithi ${tithi} · ${nk.name}${xiu ? ' · ' + xiu.ch + ' ' + xiu.name : ''}</div>
        </div>
        <div class="fday-badges">${badges.join('')}</div>
      </div>
      <div class="fday-pills">${pills.join('')}</div>
      <div class="fday-insight">${insight}</div>
      ${tithiNote}
      ${xiuNote}
      ${journalHTML}
    </div>`;
  }).join('');

  wrap.innerHTML = html;
}


function forecastShift(dir) {
  if (dir === 0) forecastOffset = 0;
  else forecastOffset += dir;
  renderSkyForecast();
}


function buildForecastDays(startDate, days) {
  const results = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);

    const tz    = tzolkinForDate(d);
    const xiu   = getForecastXiu(d);
    const nk    = getForecastNakshatra(d);
    const tithi = getForecastTithi(d);
    const phase = forecastMoonPhase(d);
    const moonEvent = isExactMoonEvent(d);
    const tzAlerts  = getTzolkinAlert(tz);

    // Score significance
    let score = 0;
    if (moonEvent) score += 3;
    if (tz.num === 13) score += 2;
    if (tz.num === 1)  score += 1;
    if (tz.signIdx === BIRTH_TZOLKIN.signIdx && tz.num === BIRTH_TZOLKIN.num) score += 4;
    if (tz.signIdx === 4) score += 2; // Chicchan
    if (tz.signIdx === 7) score += 1; // Lamat
    if (tz.signIdx === 8) score += 1; // Muluc
    if (['Pushya','Rohini','Shravana','Chitra','Vishakha','Punarvasu','Mula','Ashlesha','Uttara Bhadrapada'].includes(nk.name)) score += 1;
    if (tithi in SACRED_TITHIS) score += 1;
    if (phase.name === 'Full Moon' || phase.name === 'New Moon') score += 1;
    if (xiu && (xiu.quality === 'auspicious' || xiu.quality === 'intense')) score += 1;
    if (xiu && xiu.quality === 'caution') score += 1;

    const journalNote = getJournalNote(tz, nk, moonEvent, tithi);

    results.push({ d, tz, xiu, nk, tithi, phase, moonEvent, tzAlerts, score, journalNote });
  }

  return results;
}


function forecastMoonPhase(d) {
  // Known new moon reference Jan 29 2025
  const ref = new Date(2025, 0, 29);
  const msDay = 86400000, cycle = 29.53059;
  const pos = ((d - ref) / msDay % cycle + cycle) % cycle;
  if (pos < 1.5)    return { name:'New Moon',        emoji:'🌑', pos };
  if (pos < 7.4)    return { name:'Waxing Crescent', emoji:'🌒', pos };
  if (pos < 8.9)    return { name:'First Quarter',   emoji:'🌓', pos };
  if (pos < 13.8)   return { name:'Waxing Gibbous',  emoji:'🌔', pos };
  if (pos < 15.3)   return { name:'Full Moon',       emoji:'🌕', pos };
  if (pos < 21.2)   return { name:'Waning Gibbous',  emoji:'🌖', pos };
  if (pos < 22.7)   return { name:'Last Quarter',    emoji:'🌗', pos };
  return              { name:'Waning Crescent',      emoji:'🌘', pos };
}


function getForecastTithi(d) {
  const n = (d - new Date(2000, 0, 1)) / 86400000;
  const sunL = (280.460 + 0.9856474*n) % 360;
  const sunG = (357.528 + 0.9856003*n) % 360 * Math.PI / 180;
  const sunLon = (sunL + 1.915*Math.sin(sunG) + 0.020*Math.sin(2*sunG) + 360) % 360;
  const moonL = (218.316 + 13.176396*n) % 360;
  const moonM = (134.963 + 13.064993*n) % 360 * Math.PI / 180;
  const moonF = (93.272  + 13.229350*n) % 360 * Math.PI / 180;
  const moonLon = ((moonL + 6.289*Math.sin(moonM) - 1.274*Math.sin(2*moonF-moonM) + 0.658*Math.sin(2*moonF)) % 360 + 360) % 360;
  const diff = (moonLon - sunLon + 360) % 360;
  return Math.floor(diff / 12) + 1;
}


function getForecastNakshatra(d) {
  const n = (d - new Date(2000, 0, 1)) / 86400000;
  const L = (218.316 + 13.176396 * n) % 360;
  const M = (134.963 + 13.064993 * n) % 360 * Math.PI / 180;
  const F = (93.272  + 13.229350 * n) % 360 * Math.PI / 180;
  const lon = ((L + 6.289 * Math.sin(M) - 1.274 * Math.sin(2*F - M) + 0.658 * Math.sin(2*F)) % 360 + 360) % 360;
  return FORECAST_NAKSHATRAS[Math.floor(lon / (360/27)) % 27];
}


function isExactMoonEvent(d) {
  // Check if today crosses new/full moon threshold vs yesterday
  const prev = new Date(d); prev.setDate(prev.getDate() - 1);
  const pPos = forecastMoonPhase(prev).pos;
  const cPos = forecastMoonPhase(d).pos;
  if (pPos > 27 && cPos < 3)   return 'New Moon';
  if (pPos < 14.765 && cPos >= 14.765) return 'Full Moon';
  return null;
}


function getJournalNote(tz, nk, moonEvent, tithi) {
  const sign = tz.sign.name, num = tz.num, nkName = nk.name;
  // Get birth kin from profile
  const birthTz = typeof getBirthTzolkin === 'function' ? getBirthTzolkin() : BIRTH_TZOLKIN;

  // Galactic birthday
  if (num === birthTz.num && tz.signIdx === birthTz.signIdx)
    return 'Your galactic birthday — birth frequency at peak. The channel is fully open. Whatever arises today carries your clearest signal.';

  // Kundalini current combinations
  if (sign === 'Chicchan' && num === 13)
    return 'Tone 13 portal + Serpent sign — same quality as your Kundalini anniversary (13 Cib). This is a formal practice day. Full session: Kara Nyasa, trataka, mantra.';
  if (sign === 'Chicchan' && moonEvent === 'New Moon')
    return 'Resonant Serpent on the new moon — the strongest seed-planting window in both systems. What you consciously initiate today carries Kundalini current behind it.';
  if (sign === 'Chicchan')
    return 'Your birth wavespell sign. Kundalini current amplified. Body-based practice — somatic work, the shoulder clearing exercises, Brahmari. The serpent is awake today.';

  // Portal tone days
  if (num === 13 && nkName === 'Shravana')
    return 'Obsidian mirror at the cosmic ear. Your clairaudience is at its sharpest. Document everything the auditory channel brings. First songs on waking, sounds that answer thoughts, transmission in meditation.';
  if (num === 13)
    return 'Tone 13 — cosmic portal day. The veil between the frequencies thins. What the field wants you to know is most accessible today.';

  // Creative days (Lamat + Chitra/Hasta)
  if (sign === 'Lamat' && (nkName === 'Chitra' || nkName === 'Hasta'))
    return 'Your star sign in the artisan nakshatra — this is a painting day. Specifically: start with the surrendered first mark, not the planned one. Let Sarasvati\'s hands move before the mind decides.';
  if (sign === 'Lamat')
    return 'Your Venus/Star sign. Abundance and beauty available. Creative work started today carries the light-bearer frequency.';

  // Full moon significant nakshatras
  if (moonEvent === 'Full Moon' && nkName === 'Vishakha')
    return 'Full moon in Vishakha — the archway nakshatra. Vishakha asks: what threshold are you committed to walking through? This full moon wants a named intention. Write it.';
  if (moonEvent === 'Full Moon' && nkName === 'Rohini')
    return 'Full moon in Rohini — the Moon\'s most beloved. Creative and feminine energy at its most abundant. Strong for devotional practice and for feeling the Luna connection.';
  if (moonEvent === 'Full Moon')
    return 'Peak transmission window. The field is loudest. Practice, vision work, and creative output carry amplified frequency tonight.';

  // New moon
  if (moonEvent === 'New Moon' && nkName === 'Pushya')
    return 'New moon in Pushya — the most auspicious nakshatra under Jupiter\'s protection. Intentions set here are considered under divine blessing. Formal intention-writing tonight.';
  if (moonEvent === 'New Moon')
    return 'New moon — the seed moment. What you consciously plant tonight determines the quality of the next 29-day arc. Write the intention before sleep.';

  // Ancestor/depth days
  if ((sign === 'Cib' || nkName === 'Uttara Bhadrapada' || nkName === 'Magha') && tithi === 29)
    return 'Ancestral threshold — Cib, the deep serpent nakshatra, and Amavasya converging. The grandfathers are particularly close today. Speak to them directly.';
  if (sign === 'Cib')
    return 'Cib — your threshold keeper archetype and ancestral wisdom sign. The grandfathers are close. Strong for ancestral connection work and for processing old material.';

  // Clairaudience specific
  if (nkName === 'Shravana')
    return 'Shravana — the cosmic ear nakshatra. Your clairaudience is your primary gift and Shravana is its Vedic home. Music oracle practice, hypnagogic listening, mantra with ears fully open.';

  // Earth magic / root days
  if (sign === 'Ix' && (nkName === 'Mula' || nkName === 'Ashlesha'))
    return 'Jaguar medicine in the root-truth nakshatra. If anything from the deeper biography wants to surface, it surfaces on days like this. Journal extensively. Don\'t force — just stay open and receptive.';
  if (sign === 'Ix')
    return 'Ix — the feminine shamanic current and earth magic. Strong for Kurukulla practice and for the Luna work. The jaguar sees in the dark.';

  // Rohini moon
  if (nkName === 'Rohini')
    return 'Rohini — the Moon\'s most beloved nakshatra. Sensual, fertile, creative abundance. Strong for any work involving the divine feminine current and for feeling into the Luna connection.';

  // Pushya
  if (nkName === 'Pushya')
    return 'Pushya — most auspicious of all 27 nakshatras. Jupiter as divine teacher presiding. Whatever you do today under conscious intention is under protection.';

  // Punarvasu — return
  if (nkName === 'Punarvasu')
    return 'Punarvasu — return of the good light. Aditi (the boundless mother) presides. Named for restoration of what was lost. Watch for something returning — light, connection, creative fire.';

  // Wavespell openings
  if (num === 1 && tz.signIdx === 4)
    return 'Red Serpent Wavespell opens — 13 days of Kundalini current. Your birth wavespell energy. Begin significant work today. What initiates now runs with the serpent fire behind it.';
  if (num === 1)
    return `${sign} Wavespell opens today — a new 13-day current begins. The quality of this wavespell colors everything initiated within it.`;

  // Ekadashi
  if (tithi === 11)
    return 'Ekadashi — Vishnu tithi of devotional discipline. Traditional fasting day. Whatever form your practice takes, doing it with full intention today carries unusual weight.';

  return null;
}



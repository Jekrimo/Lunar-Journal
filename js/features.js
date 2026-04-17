// ─── EVENING ENTRY EDITOR ────────────────────────────────────────────────────
function openEveningEditor(dateKey){
  const modal = document.getElementById('eveningEditorModal');
  const date = new Date(dateKey + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  // Pre-fill existing data
  const eveEntries = loadEveningEntries();
  const existing = eveEntries[dateKey] || {};
  const mainEntries = loadEntries();
  const morning = mainEntries[dateKey];

  // Merge from main entry if needed
  if(!existing.energy && morning?.eveEnergy){
    existing.energy = morning.eveEnergy;
    existing.mood = morning.eveMood;
    existing.clarity = morning.eveClarity;
    existing.creativity = morning.eveCreativity;
    existing.text = morning.eveText || '';
  }

  document.getElementById('eveEditorDate').textContent = dateStr;
  document.getElementById('eveEditorDateKey').value = dateKey;
  document.getElementById('eveEditorText').value = existing.text || '';

  // Set slider values
  const fields = [
    ['eveEditorEnergy', 'eveEditorFillEnergy', existing.energy || 5],
    ['eveEditorMood',   'eveEditorFillMood',   existing.mood   || 5],
    ['eveEditorClarity','eveEditorFillClarity', existing.clarity|| 5],
    ['eveEditorCreativity','eveEditorFillCreativity', existing.creativity||5],
  ];
  fields.forEach(([sliderId, fillId, val]) => {
    const slider = document.getElementById(sliderId);
    const fill = document.getElementById(fillId);
    if(slider) slider.value = val;
    const pct = ((val-1)/9*100);
    if(fill) fill.style.width = pct + '%';
    const valEl = document.getElementById(sliderId.replace('eveEditor','eveEditorVal'));
    if(valEl) valEl.textContent = val;
  });

  modal.classList.add('open');
}

function saveEveningEditor(){
  const dateKey = document.getElementById('eveEditorDateKey').value;
  const eveData = {
    energy:    +document.getElementById('eveEditorEnergy').value,
    mood:      +document.getElementById('eveEditorMood').value,
    clarity:   +document.getElementById('eveEditorClarity').value,
    creativity:+document.getElementById('eveEditorCreativity').value,
    text:      document.getElementById('eveEditorText').value.trim(),
    timestamp: new Date().toISOString(),
  };

  // Save to EVE_KEY
  const eves = loadEveningEntries();
  eves[dateKey] = eveData;
  saveEveningEntries(eves);

  // Merge into main entry and push to cloud
  const entries = loadEntries();
  if(entries[dateKey]){
    entries[dateKey] = {
      ...entries[dateKey],
      eveEnergy: eveData.energy, eveMood: eveData.mood,
      eveClarity: eveData.clarity, eveCreativity: eveData.creativity,
      eveText: eveData.text, eveTimestamp: eveData.timestamp,
    };
    saveEntries(entries);
    pushEntryToCloud(dateKey, entries[dateKey]);
  }

  document.getElementById('eveningEditorModal').classList.remove('open');
  showToast('✦ Evening entry saved');

  // Refresh today if editing today
  if(dateKey === entryKey(new Date())) setTimeout(function(){setLogMode('daylog');},150);
}


// ─── QoL: MISC IMPROVEMENTS ──────────────────────────────────────────────────

// 1. Toast queue - now handled in app.js (queued + deduped showToast)

// 2. Confirm before leaving if entry form has unsaved text
function hasUnsavedEntry(){
  const text = document.getElementById('entryText')?.value?.trim();
  const formVisible = document.getElementById('entryFormWrap')?.style.display !== 'none';
  return formVisible && text && text.length > 10;
}

window.addEventListener('beforeunload', e => {
  if(hasUnsavedEntry()){
    e.preventDefault();
    e.returnValue = '';
  }
});

// 3. Double-tap nav tab to scroll to top of that view
let _lastNavTap = { view: null, time: 0 };
function navTabTap(view, btn){
  if(_themeFeatures){
    // Auto-save draft if leaving Today with unsaved entry
    if(_lastNavTap.view === 'today' && view !== 'today' && hasUnsavedEntry()){
      const text = document.getElementById('entryText')?.value?.trim();
      if(text) {
        localStorage.setItem('lunations_draft', JSON.stringify({ text, ts: Date.now() }));
        showToast('Draft saved');
      }
    }
  }
  if(view==='sky')setTimeout(renderBirthChart,150);
  const now = Date.now();
  if(_lastNavTap.view === view && now - _lastNavTap.time < 400){
    window.scrollTo({top:0, behavior:'smooth'});
  }
  _lastNavTap = { view, time: now };
  if(_themeFeatures){
    document.querySelectorAll('.nav-tab[role="tab"]').forEach(function(t){ t.setAttribute('aria-selected','false'); });
    if(btn) btn.setAttribute('aria-selected','true');
  }
  switchView(view, btn);
  if(_themeFeatures && view === 'today'){
    const draft = localStorage.getItem('lunations_draft');
    if(draft){
      try {
        const d = JSON.parse(draft);
        if(Date.now() - d.ts < 3600000){
          const tx = document.getElementById('entryText');
          if(tx && !tx.value?.trim()){ tx.value = d.text; showToast('Draft restored'); }
        }
        localStorage.removeItem('lunations_draft');
      } catch(e){}
    }
  }
}

// 4. Entry character count feedback
function updateEntryCharCount(){
  const text = document.getElementById('entryText')?.value || '';
  const counter = document.getElementById('entryCharCount');
  if(!counter) return;
  const len = text.length;
  counter.textContent = len > 20 ? len + ' chars' : '';
  counter.style.color = len > 500 ? 'rgba(201,168,76,.5)' : 'rgba(245,240,232,.2)';
}

// 5. Keyboard shortcut: Cmd/Ctrl+Enter to save entry
document.addEventListener('keydown', e => {
  if((e.metaKey || e.ctrlKey) && e.key === 'Enter'){
    const formVisible = document.getElementById('entryFormWrap')?.style.display !== 'none';
    const eveVisible = document.getElementById('eveFormWrap')?.style.display !== 'none';
    if(formVisible) saveEntry();
    else if(eveVisible) saveEveningEntry();
  }
});

// 6. Auto-resize textareas
function autoResize(el){
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 400) + 'px';
}

// 7. Restore last active tab on reload
const LAST_TAB_KEY = 'lunations_last_tab';
function saveLastTab(name){ localStorage.setItem(LAST_TAB_KEY, name); }
function restoreLastTab(){
  let last = localStorage.getItem(LAST_TAB_KEY) || 'today';
  // Migrate old tab names to new
  if(last === 'compare' || last === 'patterns') last = 'cycles';
  if(last !== 'today'){
    const btn = document.querySelector(`.nav-tab[onclick*="'${last}'"]`);
    if(btn && document.getElementById('view-'+last)) switchView(last, btn);
  }
}


// ─── ACCOUNT SETTINGS ────────────────────────────────────────────────────────
function renderAccountSettings(){
  const el = document.getElementById('accountSettingsContent');
  if(!el) return;

  if(!currentUser){
    el.innerHTML = '<div style="font-size:14px;color:rgba(245,240,232,.3);font-style:italic;margin-bottom:12px;">Not signed in — your data is stored locally only.</div>' +
      '<button class="save-btn" style="margin-top:0;" onclick="openAuthModal()">Sign In / Create Account</button>';
    return;
  }

  const lastSync = localStorage.getItem('lunations_last_sync') || '—';
  const entryCount = Object.keys(loadEntries()).length;

  el.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;color:rgba(245,240,232,.3);font-style:italic;margin-bottom:4px;">Signed in as</div>
      <div style="font-size:16px;color:rgba(245,240,232,.7);">${currentUser.email}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:12px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:22px;color:var(--gold);">${entryCount}</div>
        <div style="font-size:11px;color:rgba(245,240,232,.3);margin-top:2px;">entries</div>
      </div>
      <div style="background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.07);border-radius:6px;padding:12px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:13px;color:rgba(245,240,232,.5);">${lastSync}</div>
        <div style="font-size:11px;color:rgba(245,240,232,.3);margin-top:2px;">last sync</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <button class="save-btn" style="margin-top:0;background:rgba(201,168,76,.05);" onclick="forceSyncAll()">↑ Sync All to Cloud</button>
      <button class="save-btn" style="margin-top:0;" onclick="openChangeEmailModal()">Change Email</button>
      <button class="save-btn" style="margin-top:0;" onclick="openChangePasswordModal()">Change Password</button>
      <button class="save-btn" style="margin-top:0;border-color:rgba(200,80,80,.3);color:rgba(220,100,100,.7);" onclick="confirmDeleteAccount()">Delete Account</button>
      <div style="margin-top:20px;font-size:12px;color:rgba(245,240,232,.2);text-align:center;font-style:italic;">
        <a href="/privacy" style="color:rgba(201,168,76,.3);">Privacy</a> &nbsp;&middot;&nbsp;
        <a href="/terms" style="color:rgba(201,168,76,.3);">Terms</a> &nbsp;&middot;&nbsp;
        <a href="/wellness" style="color:rgba(201,168,76,.3);">Wellness &amp; AI</a> &nbsp;&middot;&nbsp;
        <a href="/science" style="color:rgba(201,168,76,.3);">The Science</a>
      </div>
    </div>`;
}

function closeInlineForm(id){const el=document.getElementById(id);if(el)el.remove();}

function openChangeEmailModal(){
  const el=document.getElementById('accountSettingsContent');
  if(!el)return;
  document.getElementById('changeEmailForm')?.remove();
  const form=document.createElement('div');
  form.id='changeEmailForm';
  form.style.cssText='margin-top:14px;padding:14px;background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.1);border-radius:8px;';
  form.innerHTML='<div style="font-size:12px;color:rgba(245,240,232,.4);margin-bottom:8px;">New email address</div>'
    +'<input id="newEmailInput" type="email" placeholder="new@email.com" style="width:100%;background:rgba(245,240,232,.05);border:1px solid rgba(245,240,232,.15);border-radius:6px;padding:10px 12px;color:rgba(245,240,232,.8);font-size:14px;box-sizing:border-box;margin-bottom:8px;">'
    +'<div style="display:flex;gap:8px;">'
    +'<button class="save-btn" style="margin-top:0;flex:1;" onclick="submitEmailChange()">Send Confirmation</button>'
    +'</div>';
  el.appendChild(form);
  setTimeout(()=>document.getElementById('newEmailInput')?.focus(),50);
}
function submitEmailChange(){
  const v=document.getElementById('newEmailInput')?.value?.trim();
  if(!v||!v.includes('@')){showToast('Enter a valid email');return;}
  if(!sbClient)return;
  sbClient.auth.updateUser({email:v}).then(({error})=>{
    if(error)showToast('Error: '+error.message);
    else{showToast('Confirmation sent — check inbox');document.getElementById('changeEmailForm')?.remove();}
  });
}

function openChangePasswordModal(){
  const el=document.getElementById('accountSettingsContent');
  if(!el)return;
  document.getElementById('changePasswordForm')?.remove();
  const form=document.createElement('div');
  form.id='changePasswordForm';
  form.style.cssText='margin-top:14px;padding:14px;background:rgba(245,240,232,.03);border:1px solid rgba(245,240,232,.1);border-radius:8px;';
  form.innerHTML='<div style="font-size:12px;color:rgba(245,240,232,.4);margin-bottom:8px;">New password (min 8 characters)</div>'
    +'<input id="newPwInput" type="password" placeholder="New password" style="width:100%;background:rgba(245,240,232,.05);border:1px solid rgba(245,240,232,.15);border-radius:6px;padding:10px 12px;color:rgba(245,240,232,.8);font-size:14px;box-sizing:border-box;margin-bottom:8px;">'
    +'<div style="display:flex;gap:8px;">'
    +'<button class="save-btn" style="margin-top:0;flex:1;" onclick="submitPasswordChange()">Update Password</button>'
    +'</div>';
  el.appendChild(form);
  setTimeout(()=>document.getElementById('newPwInput')?.focus(),50);
}
function submitPasswordChange(){
  const v=document.getElementById('newPwInput')?.value;
  if(!v||v.length<8){showToast('Password must be at least 8 characters');return;}
  if(!sbClient)return;
  sbClient.auth.updateUser({password:v}).then(({error})=>{
    if(error)showToast('Error: '+error.message);
    else{showToast('Password updated');document.getElementById('changePasswordForm')?.remove();}
  });
}

async function confirmDeleteAccount(){
  const count = Object.keys(loadEntries()).length;
  if(!confirm('Delete your Lunations account?\n\nThis will permanently delete all ' + count + ' entries and your profile. This cannot be undone.')) return;
  if(!confirm('Last chance — are you absolutely sure?')) return;
  if(!sbClient || !currentUser) return;
  showToast('Deleting account…');
  try {
    const token = getAccessToken();
    if(!token){ showToast('Session expired — please sign in again'); return; }
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
    });
    const data = await res.json();
    if(data.success){
      // Clear everything locally
      Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
      showToast('Account deleted. Goodbye.');
      setTimeout(() => window.location.href = '/', 1500);
    } else {
      showToast('Error: ' + (data.error || 'Could not delete account'));
    }
  } catch(e) {
    showToast('Error deleting account — please try again');
    console.error('Delete account error:', e);
  }
}


// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// PEOPLE PROFILES (Relationship Overlay + Multi-person tracking)
// ═══════════════════════════════════════════════════════════════════
var PEOPLE_KEY = 'lunations_people_v1';

function loadPeople() {
  try { return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '[]'); } catch(e) { return []; }
}
function savePeople(people) {
  localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}
function getPersonById(id) {
  return loadPeople().find(p => p.id === id) || null;
}
async function deletePerson(id) {
  // Remove locally first (instant UI)
  var people = loadPeople().filter(p => p.id !== id);
  savePeople(people);
  // Remove from cloud if person has a cloudId
  if (currentUser && sbClient) {
    var person = loadPeople().find(p => p.id === id); // already filtered, use original
    // cloudId is stored on the person object
    var allPrev = JSON.parse(localStorage.getItem(PEOPLE_KEY + '_deleted') || '[]');
    // Find cloudId from the full list before filter
    var all = JSON.parse(localStorage.getItem(PEOPLE_KEY) || '[]');
    var target = all.find(p => p.id === id);
    if (target?.cloudId) {
      try {
        var token = getAccessToken();
        if (token) await fetch('/api/people?id=' + encodeURIComponent(target.cloudId), {
          method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
      } catch(e) { console.warn('deletePerson cloud:', e.message); }
    }
  }
  // Re-save filtered list
  savePeople(people);
}

// Push a single person to cloud — only sends computed signs, never DOB
async function pushPersonToCloud(person) {
  if (!currentUser || !sbClient) return null;
  try {
    var token = getAccessToken();
    if (!token) return null;
    // Compute signs client-side from DOB — these are what we store in cloud
    var signs = person.dob ? getPersonSigns(person) : null;
    var payload = {
      cloudId: person.cloudId || null,
      name: person.name,
      sunSign: signs?.sun || null,
      moonSign: signs?.moon || null,
      risingSign: person.rising || null,
      notes: person.notes || null,
    };
    var res = await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ person: payload })
    });
    var data = await res.json();
    if (data.id) return data.id; // cloud UUID
    console.warn('pushPersonToCloud:', data.error);
    return null;
  } catch(e) { console.warn('pushPersonToCloud:', e.message); return null; }
}

// Pull people from cloud and merge into local (preserving DOB which only exists locally)
async function pullPeopleFromCloud() {
  if (!currentUser || !sbClient) return;
  try {
    var token = getAccessToken();
    if (!token) return;
    var res = await fetch('/api/people', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return;
    var { people: cloudPeople } = await res.json();
    if (!cloudPeople?.length) return;
    // Merge: match by cloudId, update name/notes/signs from cloud, preserve local DOB
    var local = loadPeople();
    var merged = local.slice();
    cloudPeople.forEach(function(cp) {
      var existing = merged.find(function(lp) { return lp.cloudId === cp.id; });
      if (existing) {
        // Update mutable fields from cloud (name, notes) but keep local DOB
        existing.name = cp.name;
        existing.notes = cp.notes || existing.notes;
        // Update signs if we don't have local DOB to compute them
        if (!existing.dob) {
          existing.sunSign = cp.sun_sign;
          existing.moonSign = cp.moon_sign;
        }
      } else {
        // Cloud person not in local — add with cloud signs (no DOB)
        merged.push({
          id: 'p_cloud_' + cp.id,
          cloudId: cp.id,
          name: cp.name,
          dob: '', // no DOB in cloud by design
          time: '',
          notes: cp.notes || '',
          sunSign: cp.sun_sign,
          moonSign: cp.moon_sign,
        });
      }
    });
    savePeople(merged);
    renderPeopleManager();
    renderRelationshipSelect();
    console.log('People synced from cloud:', cloudPeople.length);
  } catch(e) { console.warn('pullPeopleFromCloud:', e.message); }
}

// ── PEOPLE MANAGEMENT MODAL ──────────────────────────────────────
var _editingPersonId = null;

function openPeopleManager() {
  if(!requireTier('plus', 'People & Relationship Overlay is a Plus feature. Upgrade to track cycles for partners, family, or clients.')) return;
  renderPeopleManager();
  document.getElementById('peopleModal')?.classList.add('open');
}
function closePeopleManager() {
  document.getElementById('peopleModal')?.classList.remove('open');
  _editingPersonId = null;
}

function renderPeopleManager() {
  var people = loadPeople();
  var list = document.getElementById('peopleList');
  if(!list) return;
  if(people.length === 0) {
    list.innerHTML = '<div style="font-size:14px;color:rgba(245,240,232,.25);font-style:italic;text-align:center;padding:20px 0;">No people added yet.</div>';
    return;
  }
  var html = '';
  for(var i=0;i<people.length;i++){
    var p=people[i];
    var sub = p.dob ? 'Born ' + p.dob : 'No birth date';
    var _pr=parsePersonRole(p.notes);if(_pr.role)sub+=' · '+_pr.role;if(_pr.detail)sub+=' ('+_pr.detail.slice(0,20)+')';
    var pid = p.id;
    html += '<div class="people-card" onclick="editPerson(\'' + pid + '\')">'
      + '<div class="people-card-name">' + p.name + '</div>'
      + '<div class="people-card-sub">' + sub + '</div>'
      + '<button onclick="event.stopPropagation();(async()=>{var all=loadPeople();var t=all.find(p=>p.id===\'' + pid + '\');var filtered=all.filter(p=>p.id!==\'' + pid + '\');savePeople(filtered);renderPeopleManager();renderRelationshipSelect();if(currentUser&&sbClient&&t&&t.cloudId){try{var tok=getAccessToken();if(tok)await fetch(\'/api/people?id=\'+encodeURIComponent(t.cloudId),{method:\'DELETE\',headers:{Authorization:\'Bearer \'+tok}});}catch(e){console.warn(\'delete cloud:\',e.message);}}})()" '
      + 'style="position:absolute;top:10px;right:12px;background:none;border:none;color:rgba(245,240,232,.2);cursor:pointer;font-size:16px;">×</button>'
      + '</div>';
  }
  list.innerHTML = html;
}
function showPersonForm(personId) {
  var form = document.getElementById('personForm');
  if(!form) return;
  _editingPersonId = personId || null;
  var person = personId ? getPersonById(personId) : null;
  document.getElementById('personFormTitle').textContent = person ? 'Edit Person' : 'Add Person';
  document.getElementById('personName').value = person ? person.name : '';
  document.getElementById('personDob').value = person ? (person.dob || '') : '';
  document.getElementById('personTime').value = person ? (person.time || '') : '';
  if(person){var _pr=parsePersonRole(person.notes);document.getElementById('personRole').value=_pr.role;document.getElementById('personNotes').value=_pr.detail;}else{document.getElementById('personRole').value='';document.getElementById('personNotes').value='';}
  form.classList.add('open');
  document.getElementById('personName').focus();
}
function editPerson(id) { showPersonForm(id); }
function hidePersonForm() {
  document.getElementById('personForm')?.classList.remove('open');
  _editingPersonId = null;
}

function savePersonForm() {
  var name = (document.getElementById('personName')?.value || '').trim();
  if(!name) { showToast('Enter a name'); return; }
  var existing = _editingPersonId ? getPersonById(_editingPersonId) : null;
  var person = {
    id: _editingPersonId || ('p_' + Date.now()),
    cloudId: existing?.cloudId || null, // preserve existing cloud UUID
    name: name,
    dob: (document.getElementById('personDob')?.value || '').trim(),
    time: (document.getElementById('personTime')?.value || '').trim(),
    notes: buildPersonNotes((document.getElementById('personRole')?.value||'').trim(),(document.getElementById('personNotes')?.value||'').trim()),
  };
  var people = loadPeople();
  var idx = people.findIndex(p => p.id === person.id);
  if(idx >= 0) people[idx] = person;
  else people.push(person);
  savePeople(people);
  hidePersonForm();
  renderPeopleManager();
  renderRelationshipSelect();
  showToast('\u2726 ' + name + ' saved');
  // Push to cloud async — update cloudId when we get the UUID back
  pushPersonToCloud(person).then(function(cloudId) {
    if (!cloudId) return;
    var latest = loadPeople();
    var p = latest.find(function(p) { return p.id === person.id; });
    if (p && p.cloudId !== cloudId) {
      p.cloudId = cloudId;
      savePeople(latest);
    }
  });
}

// ── RELATIONSHIP OVERLAY ────────────────────────────────────────
var _selectedPersonId = null;
var _relReadingCache = {};

function renderRelationshipSelect() {
  var sel = document.getElementById('relPersonSelect');
  if(!sel) return;
  var people = loadPeople();
  sel.innerHTML = '<option value="">' + (people.length ? 'Select a person…' : 'No people added yet…') + '</option>'
    + people.map(p => '<option value="' + p.id + '">' + p.name + '</option>').join('');
  if(_selectedPersonId) sel.value = _selectedPersonId;
  // Update empty state based on whether people exist
  var content = document.getElementById('relReadingContent');
  if(content && !_selectedPersonId) {
    if(people.length === 0) {
      content.innerHTML = '<div style="font-size:13px;color:rgba(245,240,232,.25);line-height:1.7;">Add someone to see how the current sky lands on your dynamic.<br><button onclick="closeSideMenu();setTimeout(openPeopleManager,50)" style="margin-top:10px;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:6px 16px;background:rgba(180,140,220,.08);border:1px solid rgba(180,140,220,.25);border-radius:3px;color:rgba(180,140,220,.7);cursor:pointer;">Add a Person →</button></div>';
    } else {
      content.innerHTML = '<div style="font-size:13px;color:rgba(245,240,232,.2);font-style:italic;">Select a person above to see the overlay.</div>';
    }
  }
}

function onRelPersonChange(val) {
  _selectedPersonId = val || null;
  if(_selectedPersonId) generateRelationshipReading();
  else {
    var people = loadPeople();
    var content = document.getElementById('relReadingContent');
    if(content) content.innerHTML = people.length === 0
      ? '<div style="font-size:13px;color:rgba(245,240,232,.25);line-height:1.7;">Add someone to see how the current sky lands on your dynamic.<br><button onclick="closeSideMenu();setTimeout(openPeopleManager,50)" style="margin-top:10px;font-family:\'Cinzel\',serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:6px 16px;background:rgba(180,140,220,.08);border:1px solid rgba(180,140,220,.25);border-radius:3px;color:rgba(180,140,220,.7);cursor:pointer;">Add a Person →</button></div>'
      : '<div style="font-size:13px;color:rgba(245,240,232,.2);font-style:italic;">Select a person above to see the overlay.</div>';
    document.getElementById('relPersonGrid').style.display = 'none';
    var tw = document.getElementById('relTransitAlerts'); if(tw) tw.innerHTML = '';
  }
}

function getPersonSigns(person) {
  if(!person) return null;
  // If we have a DOB, compute signs client-side (most accurate)
  if(person.dob) {
    try {
      var bd = new Date(person.dob + 'T12:00:00');
      var sun = sunSignForDate(bd);
      var moon = moonSignApprox(bd);
      return { sun: sun.name, sunSym: sun.symbol, moon: moon.name, moonSym: moon.symbol };
    } catch(e) {}
  }
  // Fall back to stored signs (from cloud sync, no DOB on this device)
  if(person.sunSign || person.moonSign) {
    return {
      sun: person.sunSign || '?',
      sunSym: '',
      moon: person.moonSign || '?',
      moonSym: ''
    };
  }
  return null;
}

async function generateRelationshipReading(force) {
  if(!requireTier('plus', 'Relationship Overlay is a Plus feature.')) return;
  var person = getPersonById(_selectedPersonId);
  if(!person) return;

  var cacheKey = _selectedPersonId + '_' + new Date().toDateString();
  if(!force && _relReadingCache[cacheKey]) {
    renderRelationshipContent(_relReadingCache[cacheKey], person);
    return;
  }

  var content = document.getElementById('relReadingContent');
  if(content) content.innerHTML = '<span style="color:rgba(245,240,232,.25);font-style:italic;">Reading the connection…</span>';

  var myProfile = loadProfile();
  var now = new Date();
  var phase = moonPhaseInfo(now);
  var mSign = moonSignApprox(now);

  var mySigns = myProfile?.dob ? getPersonSigns({dob: myProfile.dob}) : null;
  var theirSigns = getPersonSigns(person);

  var myCtx = myProfile?.name
    ? (myProfile.name + (mySigns ? ', Sun ' + mySigns.sun + ', Moon ' + mySigns.moon : ''))
    : 'Unknown';
  var theirCtx = person.name
    + (theirSigns ? ', Sun ' + theirSigns.sun + ', Moon ' + theirSigns.moon : ', birth data not set');
  var _theirRole=parsePersonRole(person.notes);
  var roleCtx=_theirRole.role?'Relationship: this is your '+_theirRole.role+(_theirRole.detail?' ('+_theirRole.detail+')':'')+'. ':'';

  var prompt = 'You are a relationship astrologer. Write a brief (3-4 sentences) sky reading for two people under the current moon. '
    + 'Current sky: ' + phase.name + ', Moon in ' + mSign.name + '. '
    + 'Person 1: ' + myCtx + '. Person 2: ' + theirCtx + '. '
    + roleCtx
    + 'Comment on how this moon phase affects their dynamic specifically. '
    + 'One tension or gift, one practical suggestion for their interaction today. '
    + 'Second person plural (you two). Direct, specific, no filler.';

  try {
    var res = await fetch('/api/reading', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt})});
    var data = await res.json();
    var text = data.text || 'Reading unavailable — try refreshing.';
    _relReadingCache[cacheKey] = text;
    renderRelationshipContent(text, person);
  } catch(e) {
    if(content) content.innerHTML = '<span style="color:rgba(245,240,232,.3);font-style:italic;">Could not generate reading.</span>';
  }
}

function renderRelationshipContent(text, person) {
  var myProfile = loadProfile();
  var mySigns = myProfile?.dob ? getPersonSigns({dob: myProfile.dob}) : null;
  var theirSigns = getPersonSigns(person);

  var grid = document.getElementById('relPersonGrid');
  var content = document.getElementById('relReadingContent');
  if(grid) {
    grid.style.display = 'grid';
    var youCol = document.getElementById('relYouCol');
    var themCol = document.getElementById('relThemCol');
    if(youCol) youCol.innerHTML = '<div class="rel-person-label">You</div>'
      + '<div class="rel-person-name">' + (myProfile?.name || 'You') + '</div>'
      + '<div class="rel-person-signs">'
      + (mySigns ? mySigns.sunSym + ' ' + mySigns.sun + ' sun<br>' + mySigns.moonSym + ' ' + mySigns.moon + ' moon' : 'Add birth date in profile')
      + '</div>';
    if(themCol) themCol.innerHTML = '<div class="rel-person-label">' + person.name + '</div>'
      + '<div class="rel-person-name">' + person.name + '</div>'
      + '<div class="rel-person-signs">'
      + (theirSigns ? theirSigns.sunSym + ' ' + theirSigns.sun + ' sun<br>' + theirSigns.moonSym + ' ' + theirSigns.moon + ' moon' : 'Add birth date for full reading')
      + '</div>';
  }
  if(content) content.innerHTML = '<div class="rel-reading">' + sanitizeAIText(text) + '</div>';
  // Render their transit alerts
  renderPersonTransitAlerts(person);
}

// ── RELATIONSHIP TRANSIT ALERTS ─────────────────────────────────
function getPersonTransitAlerts(person) {
  if(!person || !person.dob) return [];
  var now = new Date(), bd = new Date(person.dob + 'T12:00:00');
  var cp = allPlanets(now), np = allPlanets(bd), alerts = [];
  // Focus on relationship-relevant planets
  var relPlanets = ['Venus','Mars','Moon','Jupiter','Saturn'];
  var REL_INTERP = {
    'Venus return':  'Their Venus has returned to its natal sign. Love language, aesthetic preferences, and relational needs are amplified right now.',
    'Mars return':   'Their Mars is back in its natal sign. Drive and assertiveness patterns from their core nature are surfacing. Be aware of friction or passion.',
    'Moon return':   'Their emotional baseline is being revisited today. They may be more sensitive or reactive than usual.',
    'Jupiter return':'Expansion energy is touching their natal Jupiter. Optimism and generosity may be heightened \u2014 a good window for big conversations.',
    'Saturn return': 'Saturn is activating their natal position. Themes of responsibility, boundaries, or old patterns may surface. Give space.',
    'Venus-Mars':    'Current Venus is activating their natal Mars. Desire, attraction, and creative tension are in play between you.',
    'Venus-Moon':    'Current Venus is touching their natal Moon. Emotional warmth and affection are flowing more easily for them right now.',
    'Venus-Saturn':  'Current Venus meets their natal Saturn. What they value is being tested for depth. They may need reassurance.',
    'Mars-Venus':    'Current Mars is activating their natal Venus. Passion meets their love nature \u2014 intensity in connection is likely.',
    'Mars-Moon':     'Current Mars is touching their natal Moon. Emotions may run hot. Be gentle with reactivity.',
    'Mars-Saturn':   'Current Mars meets their natal Saturn. They may feel blocked or frustrated. Patience is the offering here.',
    'Moon-Venus':    'Today\u2019s Moon touches their natal Venus. They\u2019re more open to tenderness and beauty. A good day to connect.',
    'Moon-Mars':     'Today\u2019s Moon activates their natal Mars. Emotional energy meets drive \u2014 they may be more assertive or restless.',
    'Jupiter-Venus': 'Current Jupiter expands their natal Venus. Generosity and pleasure are amplified. Enjoy each other.',
    'Jupiter-Mars':  'Current Jupiter amplifies their natal Mars. Ambition and confidence are running high for them.',
    'Saturn-Venus':  'Current Saturn is testing their natal Venus. Themes of commitment, value, and what endures in love.',
    'Saturn-Mars':   'Current Saturn meets their natal Mars. Their energy may feel restricted. Don\u2019t push \u2014 structure supports them now.'
  };

  for (var i = 0; i < cp.length; i++) {
    var c = cp[i];
    if (relPlanets.indexOf(c.name) < 0) continue;
    // Planet return
    var natal = null;
    for (var j = 0; j < np.length; j++) { if (np[j].name === c.name) { natal = np[j]; break; } }
    if (natal && c.sign && natal.sign && c.sign.name === natal.sign.name) {
      var rKey = c.name + ' return';
      alerts.push({ title: (c.symbol||'') + ' ' + person.name + '\u2019s ' + c.name + ' return in ' + c.sign.name, desc: REL_INTERP[rKey] || '', type: 'return' });
    }
    // Cross-planet conjunctions (current planet in same sign as their natal planet)
    for (var k = 0; k < np.length; k++) {
      var n = np[k];
      if (c.name === n.name) continue;
      if (relPlanets.indexOf(n.name) < 0) continue;
      if (c.sign && n.sign && c.sign.name === n.sign.name) {
        var pKey = c.name + '-' + n.name;
        var interp = REL_INTERP[pKey];
        if (interp) {
          alerts.push({ title: (c.symbol||'') + ' ' + c.name + ' activating ' + person.name + '\u2019s ' + (n.symbol||'') + ' ' + n.name + ' in ' + c.sign.name, desc: interp, type: 'conjunction' });
        }
        break;
      }
    }
  }
  // Only return the most relevant (max 3)
  return alerts.slice(0, 3);
}

function renderPersonTransitAlerts(person) {
  var wrap = document.getElementById('relTransitAlerts');
  if (!wrap) return;
  var alerts = getPersonTransitAlerts(person);
  if (!alerts.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(180,140,220,.1);">'
    + '<div style="font-family:Cinzel,serif;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:rgba(180,140,220,.4);margin-bottom:8px;">Their Sky Today</div>'
    + alerts.map(function(a) {
      return '<div style="margin-bottom:8px;padding:10px 14px;background:rgba(140,100,200,.06);border:1px solid rgba(180,140,220,.18);border-radius:6px;">'
        + '<div style="font-family:Cinzel,serif;font-size:10px;letter-spacing:.06em;color:rgba(180,140,220,.7);margin-bottom:4px;">' + a.title + '</div>'
        + '<div style="font-size:13px;color:rgba(245,240,232,.5);font-style:italic;line-height:1.6;">' + a.desc + '</div>'
        + '</div>';
    }).join('')
    + '</div>';
}

// ── CUSTOM JOURNAL PROMPTS ──────────────────────────────────────
var _promptCache = null;
var _promptCacheDate = '';

async function generateJournalPrompts(force) {
  if(!requireTier('plus', 'Custom journal prompts are a Plus feature.')) return;
  var wrap = document.getElementById('promptSuggestionsWrap');
  if(!wrap) return;

  var today = new Date().toDateString();
  if(!force && _promptCache && _promptCacheDate === today) {
    renderPromptPills(_promptCache);
    return;
  }

  var pillsEl = document.getElementById('promptPills');
  if(pillsEl) pillsEl.innerHTML = '<span style="font-size:12px;color:rgba(245,240,232,.2);font-style:italic;">Generating prompts…</span>';

  var now = new Date();
  var phase = moonPhaseInfo(now);
  var mSign = moonSignApprox(now);
  var profile = loadProfile();
  var entries = loadEntries();
  var recentKeys = Object.keys(entries).sort().slice(-5);
  var avgEnergy = recentKeys.length
    ? (recentKeys.reduce((s,k) => s + (entries[k].energy||5), 0) / recentKeys.length).toFixed(1)
    : '5';

  var natCtx = '';
  if(profile?.dob) {
    var bd = new Date(profile.dob + 'T12:00:00');
    natCtx = 'Natal Sun: ' + sunSignForDate(bd).name + ', Natal Moon: ' + moonSignApprox(bd).name + '. ';
    if(profile.rising) natCtx += 'Rising: ' + profile.rising + '. ';
  }
  if(profile?.notes){var _cb=parseContextBriefing(profile.notes);if(_cb.life)natCtx+='Life now: '+_cb.life.slice(0,80)+'. ';}

  var prompt = 'Generate exactly 3 journal prompts for someone\'s lunar journal. '
    + 'Current sky: ' + phase.name + ', Moon in ' + mSign.name + '. '
    + natCtx
    + 'Recent average energy: ' + avgEnergy + '/10. '
    + 'Prompts should be specific to this sky and this person\'s chart, not generic. '
    + 'Each prompt: one sentence, personal, inviting, begins with a verb or question. '
    + 'Return ONLY a JSON array of 3 strings, nothing else. Example: ["What...", "Notice...", "Where..."]';

  try {
    var res = await fetch('/api/reading', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt})});
    var data = await res.json();
    var text = (data.text || '').trim();
    var arr = JSON.parse(text.replace(/```json|```/g,'').trim());
    if(Array.isArray(arr) && arr.length) {
      _promptCache = arr;
      _promptCacheDate = today;
      renderPromptPills(arr);
    }
  } catch(e) {
    if(pillsEl) pillsEl.innerHTML = '<span style="font-size:12px;color:rgba(245,240,232,.2);font-style:italic;">Tap to generate prompts</span>';
  }
}

function renderPromptPills(prompts) {
  var pillsEl = document.getElementById('promptPills');
  if(!pillsEl) return;
  pillsEl.innerHTML = prompts.map(function(p) {
    var escaped = p.replace(/'/g, "\'");
    return '<span class="prompt-pill" onclick="applyPrompt(\'' + escaped + '\')">' + p + '</span>';
  }).join('');
}

function applyPrompt(text) {
  var ta = document.getElementById('entryText');
  if(!ta) return;
  var cur = ta.value.trim();
  ta.value = cur ? cur + '\n\n' + text + ' ' : text + ' ';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}


// ═══════════════════════════════════════════════════════════════════
// SCHUMANN RESONANCE — live spectrogram (multi-source with fallback)
// ═══════════════════════════════════════════════════════════════════
var _schumannLoaded = false;
var _schumannRetryTimer = null;
var _schumannCountdown = null;
var _schumannIsDown = false;
var SCHUMANN_RETRY_SECONDS = 300; // 5 minutes

function refreshSchumann(force) {
  var img = document.getElementById('schumannImg');
  var meta = document.getElementById('schumannMeta');
  if(!img) return;
  var wrap = document.getElementById('schumannImgWrap');
  // Clear any existing retry timer
  if(_schumannRetryTimer) { clearInterval(_schumannRetryTimer); _schumannRetryTimer = null; }
  if(_schumannCountdown) { clearInterval(_schumannCountdown); _schumannCountdown = null; }
  // Use our proxy API which caches and retries multiple sources
  var bucket = force ? Date.now() : Math.floor(Date.now() / 900000) * 900000;
  var url = '/api/spaceweather?type=schumann&t=' + bucket;
  if(force) url += '&force=1';
  // If recovering from down state, restore the img element
  if(_schumannIsDown) {
    wrap.innerHTML = '<img id="schumannImg" src="" alt="Schumann resonance spectrogram">';
    img = document.getElementById('schumannImg');
  }
  img.onload = function() {
    _schumannIsDown = false;
    if(meta) {
      meta.textContent = 'Refreshed ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      meta.style.color = '';
    }
  };
  img.onerror = function() {
    handleSchumannError();
  };
  img.src = url;
}

function handleSchumannError() {
  _schumannIsDown = true;
  var wrap = document.getElementById('schumannImgWrap');
  var meta = document.getElementById('schumannMeta');
  if(!wrap) return;
  var remaining = SCHUMANN_RETRY_SECONDS;
  wrap.innerHTML =
    '<div style="padding:20px 14px;text-align:center;">' +
      '<div style="font-size:22px;margin-bottom:8px;opacity:.4;">\uD83C\uDF10</div>' +
      '<div style="font-size:13px;color:rgba(245,240,232,.35);font-style:italic;margin-bottom:6px;">Schumann spectrogram temporarily unavailable</div>' +
      '<div style="font-size:11px;color:rgba(245,240,232,.2);margin-bottom:10px;">All observatory sources are currently unreachable. This happens occasionally — will auto-retry shortly.</div>' +
      '<div id="schumannCountdownWrap" style="font-size:11px;color:rgba(201,168,76,.4);letter-spacing:.04em;">Checking again in <span id="schumannCountdownNum">' + formatCountdown(remaining) + '</span></div>' +
    '</div>';
  if(meta) {
    meta.textContent = 'Last checked ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    meta.style.color = 'rgba(245,240,232,.15)';
  }
  // Countdown display
  _schumannCountdown = setInterval(function() {
    remaining--;
    var el = document.getElementById('schumannCountdownNum');
    if(el) el.textContent = formatCountdown(remaining);
    if(remaining <= 0) {
      clearInterval(_schumannCountdown);
      _schumannCountdown = null;
    }
  }, 1000);
  // Auto-retry after countdown
  _schumannRetryTimer = setTimeout(function() {
    _schumannRetryTimer = null;
    refreshSchumann(true);
  }, SCHUMANN_RETRY_SECONDS * 1000);
}

function formatCountdown(s) {
  var m = Math.floor(s / 60);
  var sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Load Schumann when Sky tab is first opened
(function() {
  var origNavTabTap = null;
  function patchNav() {
    if(typeof navTabTap === 'undefined') { setTimeout(patchNav, 500); return; }
    origNavTabTap = navTabTap;
    window.navTabTap = function(view, el) {
      origNavTabTap(view, el);
      if(view === 'sky' && !_schumannLoaded) {
        _schumannLoaded = true;
        setTimeout(refreshSchumann, 100);
      }
    };
  }
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchNav);
  } else {
    setTimeout(patchNav, 500);
  }
})();


// ═══════════════════════════════════════════════════════════════════
// BAROMETRIC PRESSURE — Open-Meteo free API (no key needed)
// ═══════════════════════════════════════════════════════════════════
var BARO_CACHE_KEY = 'lunations_baro_v1';
var BARO_LOC_KEY = 'lunations_baro_loc';

function getBaroLocation() {
  try { return JSON.parse(localStorage.getItem(BARO_LOC_KEY)); } catch(e) { return null; }
}

function requestBaroLocation() {
  var btn = document.querySelector('.baro-loc-btn');
  if(btn) { btn.textContent = 'Locating…'; btn.disabled = true; }
  if(!navigator.geolocation) {
    if(btn) { btn.textContent = 'Geolocation not supported'; btn.disabled = false; }
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos) {
    var loc = { lat: Math.round(pos.coords.latitude*100)/100, lon: Math.round(pos.coords.longitude*100)/100 };
    localStorage.setItem(BARO_LOC_KEY, JSON.stringify(loc));
    fetchBaroPressure(true);
  }, function(err) {
    if(btn) { btn.textContent = 'Location denied — tap to retry'; btn.disabled = false; }
  }, { timeout: 10000 });
}

async function fetchBaroPressure(force) {
  var loc = getBaroLocation();
  if(!loc) { showBaroPrompt(); return; }
  // Check cache (30-min TTL)
  if(!force) {
    try {
      var cached = JSON.parse(localStorage.getItem(BARO_CACHE_KEY));
      if(cached && Date.now() - cached.ts < 1800000) { renderBaro(cached); return; }
    } catch(e) {}
  }
  try {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon
      + '&hourly=surface_pressure&past_hours=24&forecast_hours=1&timezone=auto';
    var res = await fetch(url);
    if(!res.ok) throw new Error('API ' + res.status);
    var json = await res.json();
    var times = json.hourly.time || [];
    var pressures = json.hourly.surface_pressure || [];
    var data = { ts: Date.now(), times: times, pressures: pressures, lat: loc.lat, lon: loc.lon };
    localStorage.setItem(BARO_CACHE_KEY, JSON.stringify(data));
    renderBaro(data);
  } catch(e) {
    var el = document.getElementById('baroDesc');
    if(el) el.textContent = 'Unable to fetch pressure data — tap ↺ to retry';
  }
}

function showBaroPrompt() {
  var prompt = document.getElementById('baroPrompt');
  var reading = document.getElementById('baroReading');
  if(prompt) prompt.style.display = '';
  if(reading) reading.style.display = 'none';
}

function renderBaro(data) {
  var prompt = document.getElementById('baroPrompt');
  var reading = document.getElementById('baroReading');
  if(prompt) prompt.style.display = 'none';
  if(reading) reading.style.display = '';

  var pressures = data.pressures.filter(function(v) { return v !== null; });
  if(!pressures.length) return;
  var current = pressures[pressures.length - 1];
  var prev = pressures.length > 3 ? pressures[pressures.length - 4] : pressures[0];
  var diff = current - prev;

  // Current value
  var valEl = document.getElementById('baroValue');
  if(valEl) valEl.textContent = Math.round(current);

  // Trend arrow
  var trendEl = document.getElementById('baroTrend');
  if(trendEl) {
    if(diff > 1) { trendEl.textContent = '↑'; trendEl.style.color = 'rgba(140,220,180,.8)'; }
    else if(diff < -1) { trendEl.textContent = '↓'; trendEl.style.color = 'rgba(220,140,140,.8)'; }
    else { trendEl.textContent = '→'; trendEl.style.color = 'rgba(245,240,232,.3)'; }
  }

  // Description
  var descEl = document.getElementById('baroDesc');
  if(descEl) {
    var label = current >= 1025 ? 'High pressure · clear, stable' :
                current >= 1013 ? 'Normal pressure · settled' :
                current >= 1000 ? 'Low pressure · unsettled' :
                'Very low pressure · stormy';
    var trend = diff > 1.5 ? ' · rising' : diff < -1.5 ? ' · falling' : ' · steady';
    descEl.textContent = label + trend;
  }

  // Draw SVG graph
  drawBaroGraph(data);

  // Meta
  var metaEl = document.getElementById('baroMeta');
  if(metaEl) metaEl.textContent = '24h history · updated ' + new Date(data.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function drawBaroGraph(data) {
  var graphEl = document.getElementById('baroGraph');
  if(!graphEl) return;
  var pts = data.pressures.filter(function(v) { return v !== null; });
  if(pts.length < 2) { graphEl.innerHTML = '<div style="font-size:11px;color:rgba(245,240,232,.2);text-align:center;padding:8px;">Insufficient data</div>'; return; }
  var W = 320, H = 80, padL = 0, padR = 0, padT = 6, padB = 14;
  var min = Math.min.apply(null, pts) - 1;
  var max = Math.max.apply(null, pts) + 1;
  if(max - min < 4) { min -= 2; max += 2; } // ensure visible range
  var xStep = (W - padL - padR) / (pts.length - 1);
  var coords = pts.map(function(v, i) {
    var x = padL + i * xStep;
    var y = padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    return x.toFixed(1) + ',' + y.toFixed(1);
  });
  // Area fill
  var areaCoords = coords.slice();
  areaCoords.push((padL + (pts.length - 1) * xStep).toFixed(1) + ',' + (H - padB));
  areaCoords.push(padL + ',' + (H - padB));
  // Time labels (first, mid, last)
  var times = data.times || [];
  var fmtTime = function(t) { try { return new Date(t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); } catch(e) { return ''; } };
  var labels = '';
  if(times.length >= 2) {
    var mid = Math.floor(times.length / 2);
    labels = '<text x="' + padL + '" y="' + H + '" fill="rgba(245,240,232,.2)" font-size="8" text-anchor="start">' + fmtTime(times[0]) + '</text>'
           + '<text x="' + (W/2) + '" y="' + H + '" fill="rgba(245,240,232,.2)" font-size="8" text-anchor="middle">' + fmtTime(times[mid]) + '</text>'
           + '<text x="' + W + '" y="' + H + '" fill="rgba(245,240,232,.2)" font-size="8" text-anchor="end">' + fmtTime(times[times.length-1]) + '</text>';
  }
  // Horizontal reference line at 1013 hPa (standard pressure) if in range
  var refLine = '';
  if(1013 >= min && 1013 <= max) {
    var refY = padT + (1 - (1013 - min) / (max - min)) * (H - padT - padB);
    refLine = '<line x1="0" y1="' + refY.toFixed(1) + '" x2="' + W + '" y2="' + refY.toFixed(1) + '" stroke="rgba(120,200,160,.15)" stroke-dasharray="3,3"/>'
            + '<text x="' + W + '" y="' + (refY - 2).toFixed(1) + '" fill="rgba(120,200,160,.25)" font-size="7" text-anchor="end">1013</text>';
  }
  graphEl.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    + refLine
    + '<polygon points="' + areaCoords.join(' ') + '" fill="rgba(120,200,160,.08)"/>'
    + '<polyline points="' + coords.join(' ') + '" fill="none" stroke="rgba(140,220,180,.6)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + coords[coords.length-1].split(',')[0] + '" cy="' + coords[coords.length-1].split(',')[1] + '" r="2.5" fill="rgba(140,220,180,.9)"/>'
    + labels
    + '</svg>';
}

// Auto-load baro when Sky tab opens (piggyback on Schumann's navTabTap patch)
(function() {
  var _baroPatched = false;
  function patchBaroNav() {
    if(_baroPatched) return;
    if(typeof navTabTap === 'undefined') { setTimeout(patchBaroNav, 500); return; }
    var _prev = window.navTabTap;
    _baroPatched = true;
    window.navTabTap = function(view, el) {
      _prev(view, el);
      if(view === 'sky') fetchBaroPressure(false);
    };
  }
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchBaroNav);
  } else {
    setTimeout(patchBaroNav, 600);
  }
})();


// ─── BIRTH CITY GEOCODING (OpenStreetMap Nominatim) ──────────────────────────
var _geocodeTimer = null;
function debouncedGeocodeCity() {
  clearTimeout(_geocodeTimer);
  _geocodeTimer = setTimeout(geocodeBirthCity, 600);
}
async function geocodeBirthCity() {
  var cityEl = document.getElementById('obBirthCity');
  var latEl = document.getElementById('obBirthLat');
  var lngEl = document.getElementById('obBirthLng');
  var meta = document.getElementById('cityGeocodeMeta');
  var status = document.getElementById('cityGeocodeStatus');
  if(!cityEl || !latEl || !lngEl) return;
  var city = cityEl.value.trim();
  if(city.length < 3) {
    if(latEl) latEl.value = '';
    if(lngEl) lngEl.value = '';
    if(meta) meta.textContent = '';
    if(status) status.style.display = 'none';
    return;
  }
  if(meta) meta.textContent = 'Looking up coordinates…';
  try {
    var url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(city) + '&format=json&limit=1&addressdetails=0';
    var res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'Lunations/1.0' } });
    var data = await res.json();
    if(data && data[0]) {
      var lat = parseFloat(data[0].lat);
      var lng = parseFloat(data[0].lon);
      latEl.value = lat;
      lngEl.value = lng;
      var displayName = data[0].display_name.split(',').slice(0,3).join(', ');
      if(meta) meta.textContent = '✔ ' + displayName;
      if(status) status.style.display = 'inline';
      // Fetch timezone for birth chart accuracy
      var tzEl = document.getElementById('obBirthTz');
      var tz = await fetchBirthTimezone(lat, lng);
      if(tzEl) tzEl.value = tz || 'LMT';
      if(tz && meta) meta.textContent = '✔ ' + displayName + ' · ' + tz;
    } else {
      if(meta) meta.textContent = 'City not found — try being more specific';
      if(status) status.style.display = 'none';
    }
  } catch(e) {
    if(meta) meta.textContent = 'Geocoding unavailable — coordinates not saved';
  }
}

async function fetchBirthTimezone(lat, lng) {
  try {
    var url = 'https://timeapi.io/api/timezone/coordinate?latitude=' + lat + '&longitude=' + lng;
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    return data.timeZone || null;
  } catch(e) { return null; }
}

// Compute UTC offset (in hours) for a given date string + IANA timezone
function birthUtcOffset(dateStr, timeStr, tz, lng) {
  if (tz && tz !== 'LMT') {
    try {
      var parts = dateStr.split('-');
      var yr = parseInt(parts[0]), mo = parseInt(parts[1]), dy = parseInt(parts[2]);
      var tp = (timeStr || '12:00').split(':');
      var h = parseInt(tp[0]) || 12, m = parseInt(tp[1]) || 0;
      var refDate = new Date(Date.UTC(yr, mo - 1, dy, h, m, 0));
      var utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
      var tzStr = refDate.toLocaleString('en-US', { timeZone: tz });
      var utcMs = new Date(utcStr).getTime();
      var tzMs = new Date(tzStr).getTime();
      return (tzMs - utcMs) / 3600000;
    } catch(e) { /* fall through to LMT */ }
  }
  if (lng) return lng / 15;
  return 0;
}

var _birthTzMigrating = false;

// ═══════════════════════════════════════════════════════════════════
// FOLLOW-UP QUESTIONS (Plus feature)
// Smart context: keeps last 3 exchanges + original reading
// Monthly rescope: AI refreshes user understanding once/month
// ═══════════════════════════════════════════════════════════════════
var _followupHistory = []; // [{q, a}] — max 3 per session, resets each day
var FOLLOWUP_RESCOPE_KEY = 'lunations_rescope_v1';

function toggleFollowup() {
  if(!requireTier('plus', 'Follow-up questions are a Plus feature. Upgrade to explore your daily reading deeper.')) return;
  var wrap = document.getElementById('followupInputWrap');
  var label = document.getElementById('followupToggleLabel');
  if(!wrap) return;
  var isOpen = wrap.classList.contains('open');
  wrap.classList.toggle('open', !isOpen);
  if(label) label.textContent = isOpen ? 'Ask a follow-up' : 'Close';
  if(!isOpen) setTimeout(function(){ document.getElementById('followupInput')?.focus(); }, 50);
}

async function sendFollowupQuestion() {
  if(!requireTier('plus', 'Follow-up questions are a Plus feature.')) return;
  var inputEl = document.getElementById('followupInput');
  var sendBtn = document.getElementById('followupSendBtn');
  var histEl = document.getElementById('followupHistory');
  if(!inputEl || !sendBtn) return;

  var question = inputEl.value.trim();
  if(!question) return;

  // Disable UI
  sendBtn.disabled = true;
  sendBtn.textContent = 'Thinking…';
  inputEl.disabled = true;

  // Get original reading as context
  var originalReading = document.getElementById('readingText')?.textContent?.trim() || '';

  // Build context — original reading + last 3 exchanges (token-efficient)
  var now = new Date();
  var phase = moonPhaseInfo(now);
  var mSign = moonSignApprox(now);
  var profile = loadProfile();
  var profileCtx = '';
  if(profile?.name) profileCtx = profile.name + ', ';
  if(profile?.dob) {
    var bd = new Date(profile.dob + 'T12:00:00');
    profileCtx += 'natal Sun ' + sunSignForDate(bd).name + ', Moon ' + moonSignApprox(bd).name;
    if(profile.rising) profileCtx += ', ' + profile.rising + ' Rising';
  }
  if(profile?.notes){var _cb=parseContextBriefing(profile.notes);var _brief=[_cb.chart,_cb.life].filter(Boolean).map(function(s){return s.slice(0,40);}).join('; ');if(_brief)profileCtx+=' ('+_brief+')';}

  // Monthly rescope — once a month, give the AI a full user summary to re-anchor
  var lastRescope = localStorage.getItem(FOLLOWUP_RESCOPE_KEY);
  var rescopeCtx = '';
  var today = new Date().toISOString().slice(0,7); // YYYY-MM
  if(lastRescope !== today) {
    // Include richer user context this session
    var entries = loadEntries();
    var allKeys = Object.keys(entries).sort();
    var recentKeys = allKeys.slice(-14);
    var avgE = recentKeys.length ? (recentKeys.reduce(function(s,k){return s+(entries[k].energy||5);},0)/recentKeys.length).toFixed(1) : '5';
    var avgM = recentKeys.length ? (recentKeys.reduce(function(s,k){return s+(entries[k].mood||5);},0)/recentKeys.length).toFixed(1) : '5';
    var topQ = {};
    recentKeys.forEach(function(k){(entries[k].qualities||[]).forEach(function(q){topQ[q]=(topQ[q]||0)+1;});});
    var quals = Object.entries(topQ).sort(function(a,b){return b[1]-a[1];}).slice(0,4).map(function(e){return e[0];}).join(', ');
    rescopeCtx = '\n[Monthly context: ' + allKeys.length + ' total entries, last 14 days avg energy ' + avgE + '/10 mood ' + avgM + '/10, recurring qualities: ' + (quals||'varied') + ']';
    localStorage.setItem(FOLLOWUP_RESCOPE_KEY, today);
  }

  // Prior exchanges (max 3, oldest first)
  var historyCtx = '';
  var recentExchanges = _followupHistory.slice(-3);
  if(recentExchanges.length) {
    historyCtx = '\n\nPrior exchanges today:\n' + recentExchanges.map(function(e){
      return 'Q: ' + e.q + '\nA: ' + e.a;
    }).join('\n\n');
  }

  var prompt = 'You are a personal astrologer in an ongoing conversation. Keep answers under 80 words — direct, specific, personal. No filler.\n\n'
    + 'Person: ' + (profileCtx || 'unknown chart') + '.'
    + rescopeCtx
    + '\nCurrent sky: ' + phase.name + ', Moon in ' + mSign.name + '.'
    + '\n\nToday\'s reading they received: \"' + originalReading.slice(0, 300) + (originalReading.length > 300 ? '...' : '') + '\"'
    + historyCtx
    + '\n\nFollow-up question: ' + question;

  try {
    var res = await fetch('/api/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt })
    });
    var data = await res.json();
    var answer = data.text || 'Unable to generate a response — please try again.';

    // Store exchange (keep max 3)
    _followupHistory.push({ q: question, a: answer });
    if(_followupHistory.length > 3) _followupHistory.shift();

    // Render exchange in history
    if(histEl) {
      var ex = document.createElement('div');
      ex.className = 'followup-exchange';
      ex.innerHTML = '<div class="followup-q">' + sanitizeAIText(question) + '</div>'
        + '<div class="followup-a">' + sanitizeAIText(answer) + '</div>';
      histEl.appendChild(ex);
      ex.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Clear input, close input wrap
    inputEl.value = '';
    document.getElementById('followupInputWrap')?.classList.remove('open');
    var label = document.getElementById('followupToggleLabel');
    if(label) label.textContent = 'Ask another';

  } catch(e) {
    showToast('Could not reach the sky — try again');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Ask ↗';
    inputEl.disabled = false;
  }
}


// handleSchumannError is defined in the Schumann section above

async function pullEntriesFromCloud() {
  if(!currentUser || !sbClient) return;
  try {
    const { data, error } = await sbClient.from('entries').select('*').eq('user_id', currentUser.id).order('entry_date', {ascending:false}).limit(500);
    if(error || !data || !data.length) return;
    const cloud = {};
    data.forEach(function(row) {
      cloud[row.entry_date] = {
        energy:row.energy, mood:row.mood, clarity:row.clarity, creativity:row.creativity,
        qualities:row.qualities||[], text:row.text||'', dream:row.dream||'',
        intention:row.intention||'', sadhana:row.sadhana||'',
        phase:row.phase||'', moonSign:row.moon_sign||'', sunSign:row.sun_sign||'',
        tithi:row.tithi||'', nakshatra:row.nakshatra||'', vara:row.vara||'',
        planets:row.planets||[], activeTransits:row.active_transits||[],
        timestamp:row.created_at||row.entry_date+'T12:00:00.000Z',
        eveEnergy:row.eve_energy, eveMood:row.eve_mood,
        eveClarity:row.eve_clarity, eveCreativity:row.eve_creativity,
        eveText:row.eve_text||'', eveTimestamp:row.eve_timestamp,
        snapshots:row.snapshots||[],
      };
    });
    const local = loadEntries();
    const clean = Object.fromEntries(Object.entries(local).filter(function([k,v]){ return k>='2024-01-01'&&!v.isMockData; }));
    var merged = Object.assign({}, clean);
    Object.entries(cloud).forEach(function([k,cv]){
      var lv=merged[k];
      if(!lv){merged[k]=cv;return;}
      var ct=cv.timestamp?new Date(cv.timestamp).getTime():0;
      var lt=lv.timestamp?new Date(lv.timestamp).getTime():0;
      if(ct>=lt){var ls=(lv.snapshots||[]),cs=(cv.snapshots||[]);merged[k]=cv;if(ls.length>cs.length)merged[k].snapshots=ls;}
    });
    saveEntries(merged);
    console.log('Pulled', data.length, 'entries from cloud, merged to', Object.keys(merged).length);
  } catch(e) { console.warn('pullEntriesFromCloud:', e.message); }
}

// Reconcile EVE_KEY → main entries on startup so eve data survives page refresh
function reconcileEveningEntries() {
  try {
    var eveAll = loadEveningEntries();
    var mainAll = loadEntries();
    var changed = false;
    Object.keys(eveAll).forEach(function(k) {
      var eve = eveAll[k];
      var main = mainAll[k];
      if(main && eve && !main.eveTimestamp && eve.timestamp) {
        mainAll[k] = Object.assign({}, main, {
          eveEnergy: eve.energy, eveMood: eve.mood,
          eveClarity: eve.clarity, eveCreativity: eve.creativity,
          eveText: eve.text || '', eveTimestamp: eve.timestamp
        });
        changed = true;
      }
    });
    if(changed) {
      saveEntries(mainAll);
      console.log('Reconciled evening entries into main store');
    }
  } catch(e) { console.warn('reconcileEveningEntries:', e.message); }
}

var SIGNS_LOCAL_KEY='lunations_signs_v1',SIGNS_CORR_KEY='lunations_signs_corr_v1',_signCats=['synchronicity'];
// Push signs to Android home screen widget via Capacitor plugin
function pushSignsToWidget(){
  if(typeof Capacitor==='undefined'||!Capacitor.isNativePlatform()) return;
  try{
    var signs=getSignsLocal().slice(0,10);
    var slim=signs.map(function(s){return{text:s.text,categories:s.categories,moon_phase:s.moon_phase,moon_sign:s.moon_sign,timestamp:s.timestamp};});
    Capacitor.Plugins.SignsWidget.updateSigns({signs:JSON.stringify(slim)});
  }catch(e){}
}
function openSignsModal(){
  var m=document.getElementById('signsModal');if(!m)return;
  m.classList.add('open');
  var i=document.getElementById('signInput'),x=document.getElementById('signContext');
  if(i)i.value='';if(x)x.value='';
  _signCats=['synchronicity'];
  document.querySelectorAll('.sign-category-btn').forEach(function(b){b.classList.toggle('selected',b.dataset.cat==='synchronicity');});
  // Always show local immediately, then merge cloud in background
  loadSignsList();
  if(currentUser && sbClient) {
    loadSignsFromCloud().then(loadSignsList);
  }
}
function closeSignsModal(){document.getElementById('signsModal')?.classList.remove('open');}
function toggleSignCategory(btn){var cat=btn.dataset.cat,idx=_signCats.indexOf(cat);if(idx>=0){if(_signCats.length>1){_signCats.splice(idx,1);btn.classList.remove('selected');}}else{_signCats.push(cat);btn.classList.add('selected');}}
function getSignsLocal(){try{return JSON.parse(localStorage.getItem(SIGNS_LOCAL_KEY)||'[]');}catch(e){return[];}}
function saveSignsLocal(s){try{localStorage.setItem(SIGNS_LOCAL_KEY,JSON.stringify(s));}catch(e){}}
async function saveSign(){
  try{
    var text=(document.getElementById('signInput')?.value||'').trim();
    if(!text){showToast('Describe the sign first');return;}
    var ctx=(document.getElementById('signContext')?.value||'').trim();
    var now=new Date();
    var phaseName='',mSignName='';
    try{phaseName=moonPhaseInfo(now).name;mSignName=moonSignApprox(now).name;}catch(e){}
    var localId='sign_'+Date.now();
    var sign={id:localId,text:text,context:ctx,categories:_signCats.slice(),moon_phase:phaseName,moon_sign:mSignName,timestamp:now.toISOString()};
    var signs=getSignsLocal();signs.unshift(sign);
    if(signs.length>200)signs=signs.slice(0,200);
    saveSignsLocal(signs);
    // Verify save actually persisted
    var check=getSignsLocal();
    if(!check.length||check[0].id!==localId){showToast('Could not save — storage may be full');return;}
    // UI feedback immediately — don't wait for cloud
    showToast('\u2726 Sign logged');
    document.getElementById('signInput').value='';
    document.getElementById('signContext').value='';
    _signCats=['synchronicity'];
    document.querySelectorAll('.sign-category-btn').forEach(function(b){b.classList.toggle('selected',b.dataset.cat==='synchronicity');});
    var fab=document.getElementById('signsFab');if(fab)fab.style.display='flex';
    loadSignsList();
    if(typeof renderDayLog==='function')renderDayLog();
    pushSignsToWidget();
    // Cloud save in background
    if(currentUser&&sbClient){
      try{
        var r=await sbClient.from('signs').insert({user_id:currentUser.id,text:sign.text,context:sign.context||null,categories:sign.categories,moon_phase:sign.moon_phase,moon_sign:sign.moon_sign,timestamp:sign.timestamp}).select().single();
        if(r.error){console.warn('Signs cloud:', r.error.message);}
        else if(r.data){
          var ls=getSignsLocal();
          var idx=ls.findIndex(function(s){return s.id===localId;});
          if(idx>=0){ls[idx].id=r.data.id;saveSignsLocal(ls);}
        }
      }catch(e){console.warn('Signs cloud:', e.message);}
    }
  }catch(e){
    console.error('saveSign error:', e);
    showToast('Error saving sign — please try again');
  }
}
async function loadSignsFromCloud(){
  if(!currentUser||!sbClient)return;
  try{
    var r=await sbClient.from('signs').select('*').eq('user_id',currentUser.id).order('timestamp',{ascending:false}).limit(200);
    if(r.error){console.warn('Signs load:', r.error.message);return;}
    if(r.data&&r.data.length){
      // Merge: cloud is source of truth for UUID-keyed rows, but preserve any local-only rows (temp IDs)
      var cloudMap={};
      r.data.forEach(function(s){cloudMap[s.id]=s;});
      var local=getSignsLocal();
      var cloudRows=r.data.map(function(s){return{id:s.id,text:s.text,context:s.context||'',categories:s.categories||[],moon_phase:s.moon_phase||'',moon_sign:s.moon_sign||'',timestamp:s.timestamp};});
      // Keep any local rows not already in the cloud response
      var localOnly=local.filter(function(s){return s.id&&!cloudMap[s.id];});
      var merged=localOnly.concat(cloudRows);
      merged.sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);});
      if(merged.length>200)merged=merged.slice(0,200);
      saveSignsLocal(merged);
      console.log('Signs merged: '+localOnly.length+' local-only + '+cloudRows.length+' cloud = '+merged.length);
    }
  }catch(e){console.warn('Signs load:', e.message);}
  pushSignsToWidget();
}
function loadSignsList(){
  var list=document.getElementById('signsList');if(!list)return;
  var signs=getSignsLocal();
  // Only show signs from the last 3 days in the modal
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-3);cutoff.setHours(0,0,0,0);
  var recentSigns=signs.filter(function(s){return s.timestamp&&new Date(s.timestamp)>=cutoff;});
  if(!recentSigns.length){list.innerHTML='<div class="signs-empty">'+(signs.length?'No signs in the last 3 days.<br>Older signs appear on your calendar.':'No signs logged yet.<br>What are you noticing?')+'</div>';return;}
  list.innerHTML=recentSigns.slice(0,30).map(function(s){
    var d=new Date(s.timestamp);
    var ds=d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    var tags=(s.categories||[]).map(function(cat){return'<span class="sign-tag">'+cat+'</span>';}).join('');
    var sky=s.moon_phase?('<span>'+s.moon_phase+' \u00b7 '+s.moon_sign+'</span>'):'';
    var ctx2=s.context?('<div style="font-size:12px;color:rgba(245,240,232,.35);margin-top:4px;font-style:italic;">\u201c'+s.context+'\u201d</div>'):'';
    return'<div class="sign-log-entry"><div class="sign-log-meta"><span>'+ds+'</span>'+sky+'</div><div class="sign-log-text">'+s.text+'</div>'+ctx2+(tags?'<div class="sign-log-tags">'+tags+'</div>':'')+'<button onclick="deleteSign(\''+s.id+'\')" style="position:absolute;top:8px;right:8px;background:none;border:none;color:rgba(245,240,232,.15);cursor:pointer;font-size:14px;">\u00d7</button></div>';
  }).join('');
}
function deleteSign(id){
  saveSignsLocal(getSignsLocal().filter(function(s){return s.id!=id;}));
  if(currentUser&&sbClient)sbClient.from('signs').delete().eq('id',id).then(function(){}).catch(function(){});
  loadSignsList();
  pushSignsToWidget();
}
var _signsCorrCache=null;
async function loadSignsCorrelation(force){
  var wrap=document.getElementById('signsCorrelation');if(!wrap)return;
  // Use cached result if available and not forced
  if(!force&&_signsCorrCache){wrap.style.display='block';wrap.innerHTML=_signsCorrCache;return;}
  var signs=getSignsLocal();
  if(signs.length<2){wrap.style.display='none';return;}
  // Last 3 days of signs
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-3);cutoff.setHours(0,0,0,0);
  var recentSigns=signs.filter(function(s){return s.timestamp&&new Date(s.timestamp)>=cutoff;});
  if(recentSigns.length<1){wrap.style.display='none';return;}
  wrap.style.display='block';
  wrap.innerHTML='<div style="font-size:13px;color:rgba(245,240,232,.25);font-style:italic;">Finding patterns\u2026</div>';
  // Last 30 days of journal entries
  var entries=loadEntries();
  var allKeys=Object.keys(entries).sort();
  var eSum=allKeys.slice(-30).map(function(k){var e=entries[k];return k+': energy '+e.energy+', mood '+e.mood+(e.text?', "'+e.text.slice(0,50)+'"':'');}).join('\n');
  var sSum=recentSigns.map(function(s){return new Date(s.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric'})+' ['+(s.categories||[]).join(',')+'] '+s.moon_phase+': '+s.text+(s.context?' (while: '+s.context+')':'');}).join('\n');
  var prompt='Find 1-2 genuine patterns between these recent signs and the past month of journal entries. Be specific and concise. STRICT LIMIT: under 50 words total. Second person.\n\nJournal (30 days):\n'+(eSum||'No entries')+'\n\nSigns (last 3 days):\n'+sSum;
  try{
    var res=await fetch('/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    if(res.status===429){wrap.innerHTML='<div style="font-size:13px;color:rgba(245,240,232,.25);font-style:italic;">Reading limit reached \u2014 try again in a few minutes.</div>';return;}
    var data=await res.json();var text=data.text||'';
    if(text){var html='<div style="font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(201,168,76,.4);margin-bottom:8px;">\u2726 Pattern Reading</div><div class="signs-correlation">'+sanitizeAIText(text)+'</div>';_signsCorrCache=html;wrap.innerHTML=html;}
    else wrap.style.display='none';
  }catch(e){wrap.style.display='none';}
}
async function runDailySignsCorrelation(){if(!currentUser)return;var signs=getSignsLocal();if(signs.length<3)return;var today=new Date().toDateString();if(localStorage.getItem(SIGNS_CORR_KEY)===today)return;localStorage.setItem(SIGNS_CORR_KEY,today);await loadSignsCorrelation(false);}
function initSignsFab(){var signs=getSignsLocal();var fab=document.getElementById('signsFab');if(fab&&signs.length>0)fab.style.display='flex';pushSignsToWidget();}

// _reflectHistory hoisted to core.js
function toggleReflectFollowup(){if(!requireTier('plus','Follow-up questions are a Plus feature.'))return;var wrap=document.getElementById('reflectFollowupInputWrap');var label=document.getElementById('reflectFollowupLabel');if(!wrap)return;var isOpen=wrap.classList.contains('open');wrap.classList.toggle('open',!isOpen);if(label)label.textContent=isOpen?'Ask a follow-up':'Close';if(!isOpen)setTimeout(function(){document.getElementById('reflectFollowupInput')?.focus();},50);}
async function sendReflectFollowup(){if(!requireTier('plus','Follow-up questions are a Plus feature.'))return;var inputEl=document.getElementById('reflectFollowupInput'),sendBtn=document.getElementById('reflectFollowupSendBtn'),histEl=document.getElementById('reflectFollowupHistory');if(!inputEl||!sendBtn)return;var q=inputEl.value.trim();if(!q)return;sendBtn.disabled=true;sendBtn.textContent='Thinking\u2026';inputEl.disabled=true;var rt=document.getElementById('reflectionText')?.textContent?.trim()||'';var entry=(loadEntries()[entryKey(new Date())])||{};var now=new Date();var phase=moonPhaseInfo(now),mSign=moonSignApprox(now);var profile=loadProfile();var pCtx=profile?.name?(profile.name+', '):'';if(profile?.dob){var bd=new Date(profile.dob+'T12:00:00');pCtx+='natal Sun '+sunSignForDate(bd).name+', Moon '+moonSignApprox(bd).name;}if(profile?.notes){var _cb=parseContextBriefing(profile.notes);var _brief=[_cb.chart,_cb.life].filter(Boolean).map(function(s){return s.slice(0,40);}).join('; ');if(_brief)pCtx+=' ('+_brief+')';}var hCtx='';var recent=_reflectHistory.slice(-3);if(recent.length)hCtx='\n\nPrior:\n'+recent.map(function(e){return 'Q: '+e.q+'\nA: '+e.a;}).join('\n\n');var prompt='Astrologer. Under 80 words.\n\nPerson: '+(pCtx||'unknown')+'.\nSky: '+phase.name+', Moon in '+mSign.name+'.\nThey wrote: "'+(entry.text||'').slice(0,200)+'".\nSky reflected: "'+rt.slice(0,200)+'".'+hCtx+'\n\nFollow-up: '+q;try{var res=await fetch('/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});var data=await res.json();var answer=data.text||'Try again.';_reflectHistory.push({q:q,a:answer});if(_reflectHistory.length>3)_reflectHistory.shift();if(histEl){var ex=document.createElement('div');ex.className='followup-exchange';ex.innerHTML='<div class="followup-q">'+sanitizeAIText(q)+'</div><div class="followup-a">'+sanitizeAIText(answer)+'</div>';histEl.appendChild(ex);ex.scrollIntoView({behavior:'smooth',block:'nearest'});}inputEl.value='';document.getElementById('reflectFollowupInputWrap')?.classList.remove('open');var lbl=document.getElementById('reflectFollowupLabel');if(lbl)lbl.textContent='Ask another';}catch(e){showToast('Could not reach the sky');}finally{sendBtn.disabled=false;sendBtn.textContent='Ask \u2197';inputEl.disabled=false;}}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR IMPORT (.ics)
// ═══════════════════════════════════════════════════════════════════
var CAL_KEY = 'lunations_calendar_v1';

function getCalendarData() {
  try { return JSON.parse(localStorage.getItem(CAL_KEY)); } catch(e) { return null; }
}

function getTodayCalendarEvents() {
  var data = getCalendarData();
  if (!data || !data.events) return [];
  var today = new Date();
  var todayStr = today.toISOString().slice(0, 10);
  return data.events.filter(function(ev) {
    return ev.start && ev.start.slice(0, 10) === todayStr;
  }).sort(function(a, b) {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.start < b.start ? -1 : 1;
  });
}

function formatCalTime(isoStr) {
  try {
    var d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch(e) { return ''; }
}

function parseICS(text) {
  // Unfold long lines (RFC 5545: continuation lines start with space or tab)
  var unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = unfolded.split('\n');
  var events = [];
  var inEvent = false, ev = {};

  var now = Date.now();
  var minTime = now - 7 * 86400000;    // 7 days ago
  var maxTime = now + 60 * 86400000;   // 60 days ahead

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') { inEvent = true; ev = {}; continue; }
    if (line === 'END:VEVENT') {
      inEvent = false;
      if (ev.title && ev.start) {
        var startMs = new Date(ev.start).getTime();
        if (startMs >= minTime && startMs <= maxTime) {
          events.push(ev);
        }
      }
      continue;
    }
    if (!inEvent) continue;

    var colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    var key = line.substring(0, colonIdx);
    var val = line.substring(colonIdx + 1);

    // Strip parameters from key (e.g., DTSTART;TZID=America/Denver → DTSTART)
    var baseKey = key.split(';')[0];

    if (baseKey === 'SUMMARY') {
      ev.title = val.replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\\\/g, '\\');
    } else if (baseKey === 'LOCATION') {
      ev.location = val.replace(/\\n/g, ' ').replace(/\\,/g, ',');
    } else if (baseKey === 'UID') {
      ev.uid = val;
    } else if (baseKey === 'DTSTART') {
      var parsed = parseICSDate(val, key);
      ev.start = parsed.iso;
      ev.allDay = parsed.allDay;
    } else if (baseKey === 'DTEND') {
      var parsed2 = parseICSDate(val, key);
      ev.end = parsed2.iso;
    }
  }

  events.sort(function(a, b) { return a.start < b.start ? -1 : 1; });
  return events;
}

function parseICSDate(val, fullKey) {
  // All-day: VALUE=DATE → 20260401
  if (fullKey.indexOf('VALUE=DATE') >= 0 || val.length === 8) {
    var y = val.substring(0, 4), m = val.substring(4, 6), d = val.substring(6, 8);
    return { iso: y + '-' + m + '-' + d + 'T00:00:00', allDay: true };
  }
  // Timed: 20260401T090000Z or 20260401T090000
  var clean = val.replace(/[^0-9TZ]/g, '');
  var yr = clean.substring(0, 4), mo = clean.substring(4, 6), dy = clean.substring(6, 8);
  var hr = clean.substring(9, 11) || '00', mi = clean.substring(11, 13) || '00', se = clean.substring(13, 15) || '00';
  var isoStr = yr + '-' + mo + '-' + dy + 'T' + hr + ':' + mi + ':' + se;
  if (clean.endsWith('Z')) {
    // Convert UTC to local
    var utc = new Date(isoStr + 'Z');
    isoStr = utc.getFullYear() + '-' + String(utc.getMonth() + 1).padStart(2, '0') + '-' + String(utc.getDate()).padStart(2, '0') + 'T' + String(utc.getHours()).padStart(2, '0') + ':' + String(utc.getMinutes()).padStart(2, '0') + ':' + String(utc.getSeconds()).padStart(2, '0');
  }
  return { iso: isoStr, allDay: false };
}

function importCalendar(evt) {
  var file = evt.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var events = parseICS(e.target.result);
      if (!events.length) { showToast('No upcoming events found in file'); return; }
      var data = { importedAt: new Date().toISOString(), source: file.name, events: events };
      localStorage.setItem(CAL_KEY, JSON.stringify(data));
      showToast('\u2726 ' + events.length + ' events imported');
      renderCalendarImportMeta();
      if (typeof renderCalendarEvents === 'function') renderCalendarEvents();
    } catch(err) {
      showToast('Could not read .ics file');
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

function clearCalendar() {
  localStorage.removeItem(CAL_KEY);
  showToast('Calendar cleared');
  renderCalendarImportMeta();
  if (typeof renderCalendarEvents === 'function') renderCalendarEvents();
}

function renderCalendarImportMeta() {
  var el = document.getElementById('calendarImportMeta');
  if (!el) return;
  var data = getCalendarData();
  if (!data) { el.innerHTML = ''; return; }
  var count = data.events ? data.events.length : 0;
  el.innerHTML = '<div style="font-size:12px;color:rgba(245,240,232,.3);font-style:italic;margin-top:6px;">' + count + ' events from ' + (data.source || 'calendar') + ' \u00b7 <a onclick="clearCalendar()" style="color:rgba(201,168,76,.4);cursor:pointer;text-decoration:underline;">Clear</a></div>';
}


function dateToJD(year,month,day,hour){hour=hour||0;if(month<=2){year-=1;month+=12;}var A=Math.floor(year/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+B-1524.5+hour/24;}
function norm360(a){return((a%360)+360)%360;}
function lahiriAyanamsha(jd){var T=(jd-2451545)/36525;return 23.853+1.39722*T+0.000309*T*T;}
function sunLongitude(jd){var T=(jd-2451545)/36525;var L0=norm360(280.46646+36000.76983*T);var M=norm360(357.52911+35999.05029*T-0.0001537*T*T);var Mr=M*Math.PI/180;var C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)+(0.019993-0.000101*T)*Math.sin(2*Mr)+0.000289*Math.sin(3*Mr);var sl=L0+C;var omega=norm360(125.04-1934.136*T);return norm360(sl-0.00569-0.00478*Math.sin(omega*Math.PI/180));}
function moonLongitude(jd){var T=(jd-2451545)/36525;var L=norm360(218.3165+481267.8813*T);var Mp=norm360(134.9634+477198.8676*T);var D=norm360(297.8502+445267.1115*T);var M2=norm360(357.5291+35999.0503*T);var F=norm360(93.2721+483202.0175*T);var Mpr=Mp*Math.PI/180,Dr=D*Math.PI/180,M2r=M2*Math.PI/180,Fr=F*Math.PI/180;return norm360(L+6.2888*Math.sin(Mpr)+1.274*Math.sin(2*Dr-Mpr)+0.6583*Math.sin(2*Dr)+0.2136*Math.sin(2*Mpr)-0.1851*Math.sin(M2r)-0.1143*Math.sin(2*Fr)+0.0588*Math.sin(2*Dr-2*Mpr)+0.0572*Math.sin(2*Dr-M2r-Mpr)+0.0533*Math.sin(2*Dr+Mpr)+0.0458*Math.sin(2*Dr-M2r)+0.0409*Math.sin(Mpr-M2r)-0.0347*Math.sin(Dr));}
function planetLon(jd,name){var d={Mercury:[252.2509,4.092338],Venus:[181.9798,1.602136],Mars:[355.433,0.524039],Jupiter:[34.3515,0.083056],Saturn:[50.0774,0.03346],Rahu:[125.0445,-0.052954]};var dp=d[name];if(!dp)return 0;return norm360(dp[0]+dp[1]*(jd-2451545));}
function tropToVedic(lon,ayan){return Math.floor(norm360(lon-ayan)/30)%12;}
function calcAscendant(jd,lat,lon){var T=(jd-2451545)/36525;var eps=(23.439291-0.013004*T)*Math.PI/180;var gmst=norm360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T);var ramc=norm360(gmst+lon);var ramcR=ramc*Math.PI/180,latR=lat*Math.PI/180;var y=-Math.cos(ramcR),x=Math.sin(eps)*Math.tan(latR)+Math.cos(eps)*Math.sin(ramcR);var asc=norm360(Math.atan2(y,x)*180/Math.PI);if(ramc>=0&&ramc<180&&asc<180)asc+=180;if(ramc>=180&&ramc<360&&asc>=180)asc+=180;return norm360(asc);}

// PAYMENTS, TIER & WELCOME
// ═══════════════════════════════════════════════════════════════════
// _userTier hoisted to core.js
var _billingInterval='monthly', _billingPortalUrl=null;
var _tierLoading=false; // true while billing API is in-flight — blocks paywall render
var PRICES = {plus:{monthly:'',yearly:''}, pro:{monthly:'',yearly:''}};
var TIER_RANK = {free:0, plus:1, pro:2};
function isWebView(){ return typeof window.Capacitor!=='undefined'&&!!(window.Capacitor.isNativePlatform?.()); }
window.STRIPE_PRICE_PLUS_MONTHLY = window.STRIPE_PRICE_PLUS_MONTHLY||'';
window.STRIPE_PRICE_PLUS_YEARLY  = window.STRIPE_PRICE_PLUS_YEARLY ||'';
window.STRIPE_PRICE_PRO_MONTHLY  = window.STRIPE_PRICE_PRO_MONTHLY ||'';
window.STRIPE_PRICE_PRO_YEARLY   = window.STRIPE_PRICE_PRO_YEARLY  ||'';
function hasTier(r){return TIER_RANK[_userTier]>=TIER_RANK[r];}

async function loadUserTier(){
  if(!currentUser||!sbClient){_userTier='free';return;}
  _tierLoading=true;
  try{
    var tok=getAccessToken();
    if(!tok)return;
    var res=await fetch('/api/billing',{headers:{Authorization:'Bearer '+tok}});
    if(res.ok){
      var d=await res.json();
      _userTier=d.tier||'free';
      _billingPortalUrl=d.portalUrl||null;
      PRICES.plus.monthly=window.STRIPE_PRICE_PLUS_MONTHLY;
      PRICES.plus.yearly =window.STRIPE_PRICE_PLUS_YEARLY;
      PRICES.pro.monthly =window.STRIPE_PRICE_PRO_MONTHLY;
      PRICES.pro.yearly  =window.STRIPE_PRICE_PRO_YEARLY;
      renderTierBadge(); renderAuthBadge();
      if(_userTier==='plus'||_userTier==='pro'){
        var _pw2=document.getElementById('promptSuggestionsWrap');if(_pw2&&_pw2.style.display==='none'){_pw2.style.display='block';setTimeout(generateJournalPrompts,400);}
        renderRelationshipSelect();
        var _fw2=document.getElementById('followupWrap');if(_fw2)_fw2.style.display='block';
      }
      // Remove paywall + clear usage for paid users, then re-evaluate
      if(_userTier!=='free'){
        document.querySelectorAll('.reading-paywall').forEach(function(el){el.remove();});
        var rt=document.getElementById('readingText');
        if(rt){rt.style.webkitMaskImage='none';rt.style.maskImage='none';}
        localStorage.removeItem(READING_USAGE_KEY);
      }
      // Always re-evaluate after tier resolves — fixes race on page load
      setTimeout(renderReadingPaywall, 0);
    }
  }catch(e){console.warn('loadUserTier:',e.message);}
  finally{_tierLoading=false;}
}

function renderTierBadge(){
  var b=document.getElementById('tierBadge');
  if(!b)return;
  b.className='tier-badge '+_userTier;
  b.textContent={free:'Free',plus:'Plus \u2726',pro:'Pro \u2726'}[_userTier]||'Free';
}

function openUpgradeModal(reason){
  PRICES.plus.monthly=window.STRIPE_PRICE_PLUS_MONTHLY;
  PRICES.plus.yearly =window.STRIPE_PRICE_PLUS_YEARLY;
  PRICES.pro.monthly =window.STRIPE_PRICE_PRO_MONTHLY;
  PRICES.pro.yearly  =window.STRIPE_PRICE_PRO_YEARLY;
  var m=document.getElementById('upgradeModal');
  if(!m)return;
  if(reason){var el=document.getElementById('upgradeModalReason');if(el)el.textContent=reason;}
  m.classList.add('open');
}
function closeUpgradeModal(){document.getElementById('upgradeModal')?.classList.remove('open');}

function setBillingInterval(i){
  _billingInterval=i;
  document.getElementById('billingMonthly')?.classList.toggle('active',i==='monthly');
  document.getElementById('billingYearly')?.classList.toggle('active',i==='yearly');
  var y=i==='yearly';
  document.getElementById('plusPrice').textContent=y?'$4':'$7';
  document.getElementById('plusPriceSub').textContent=y?'per month, billed $49/yr':'per month';
  document.getElementById('proPrice').textContent=y?'$7':'$13';
  document.getElementById('proPriceSub').textContent=y?'per month, billed $89/yr':'per month';
}

async function startCheckout(plan){
  if(!currentUser){closeUpgradeModal();openAuthModal();return;}
  var priceId=PRICES[plan]?.[_billingInterval];
  if(!priceId){showToast('Payments coming soon \u2014 check back shortly');return;}
  showToast('Opening checkout\u2026');
  try{
    var tok=getAccessToken();
    var res=await fetch('/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({priceId:priceId})});
    if(!res.ok){var e=await res.json().catch(function(){return{error:res.status};});showToast('Checkout error: '+(e.error||res.status));return;}
    var data=await res.json();
    if(data.url)window.location.href=data.url;
    else showToast('Could not open checkout \u2014 please try again');
  }catch(e){showToast('Something went wrong');}
}

async function openBillingPortal(){
  if(_billingPortalUrl){if(isWebView())window.location.href=_billingPortalUrl;else window.open(_billingPortalUrl,'_blank');return;}
  showToast('Loading\u2026'); await loadUserTier();
  if(_billingPortalUrl){if(isWebView())window.location.href=_billingPortalUrl;else window.open(_billingPortalUrl,'_blank');}
  else showToast('No active subscription found');
}

function checkUpgradeRedirect(){
  var p=new URLSearchParams(window.location.search);
  if(p.get('upgraded')==='1'){
    window.history.replaceState({},'','/app');
    // Poll for tier update then show success
    var attempts=0;
    var poll=setInterval(async function(){
      attempts++;
      await loadUserTier();
      if(_userTier!=='free'||attempts>6){
        clearInterval(poll);
        if(_userTier!=='free'){
          // Show banner, remove paywall, refresh reading
          var b=document.getElementById('upgradeBanner');
          if(b){b.classList.add('show');setTimeout(function(){b.classList.remove('show');},5000);}
          document.querySelector('.reading-paywall')?.remove();
          var rt=document.getElementById('readingText');
          if(rt){rt.style.webkitMaskImage='';localStorage.removeItem('lunations_reading_v1');}
          setTimeout(function(){generateReading(true);},500);
          showToast('\u2728 Welcome to '+_userTier.charAt(0).toUpperCase()+_userTier.slice(1)+'! '+ (_userTier==='pro'?'Full practitioner features unlocked.':'Unlimited readings unlocked.'));
        }
      }
    },2000);
    return;
  }
  var plan=p.get('plan');
  if(plan){
    window.history.replaceState({},'','/app');
    var planMap={
      'plus_monthly':{plan:'plus',interval:'monthly'},
      'plus_yearly' :{plan:'plus',interval:'yearly'},
      'pro_monthly' :{plan:'pro', interval:'monthly'},
      'pro_yearly'  :{plan:'pro', interval:'yearly'}
    };
    var mapped=planMap[plan];
    if(mapped){
      _billingInterval=mapped.interval;
      setTimeout(function(){
        if(currentUser)startCheckout(mapped.plan);
        else openUpgradeModal('Create an account or sign in to begin your '+mapped.plan+' subscription.');
      },800);
    }
  }
}

function requireTier(tier,reason){
  if(hasTier(tier))return true;
  openUpgradeModal(reason||'Upgrade to access this feature.');
  return false;
}

var WELCOME_KEY='lunations_welcomed_v1';
function showWelcomeModal(){
  if(localStorage.getItem(WELCOME_KEY))return;
  if(Object.keys(loadEntries()).length>0){localStorage.setItem(WELCOME_KEY,'1');return;}
  document.getElementById('welcomeModal')?.classList.add('open');
}
function closeWelcomeModal(){
  localStorage.setItem(WELCOME_KEY,'1');
  var m=document.getElementById('welcomeModal');
  if(m){m.style.transition='opacity .4s';m.style.opacity='0';setTimeout(function(){m.classList.remove('open');m.style.opacity='';},400);}
  var p=loadProfile();
  if(!p||!p.dob)setTimeout(function(){showToast('\u2726 Add your birth date in Settings for personalized readings');},2000);
}

// ═══════════════════════════════════════════════════════════════════
// READING PAYWALL
// ═══════════════════════════════════════════════════════════════════
var READING_USAGE_KEY='lunations_reading_usage_v1';
function getReadingUsage(){
  try{
    var d=JSON.parse(localStorage.getItem(READING_USAGE_KEY)||'{}');
    var today=new Date().toDateString();
    if(d.date!==today)return{date:today,count:0};
    return d;
  }catch(e){return{date:new Date().toDateString(),count:0};}
}
function incrementReadingUsage(){
  if(_userTier==='plus'||_userTier==='pro')return; // paid users have no daily cap
  var u=getReadingUsage();u.count=(u.count||0)+1;
  localStorage.setItem(READING_USAGE_KEY,JSON.stringify(u));
}
function canGetFullReading(){
  if(!currentUser)return false;
  if(_tierLoading)return true;  // still resolving — don't lock the user out
  if(_userTier==='plus'||_userTier==='pro')return true;
  return(getReadingUsage().count||0)<1;
}
function updateReadingCapLabel(){
  var el = document.getElementById('readingCapLabel');
  if(!el) return;
  // Only show for free signed-in users
  if(!currentUser || _userTier==='plus' || _userTier==='pro' || _tierLoading){
    el.style.display='none'; return;
  }
  var used = getReadingUsage().count || 0;
  if(used >= 1){
    el.textContent = '1 of 1 used today';
    el.style.display = 'block';
  } else {
    el.textContent = '1 free reading';
    el.style.display = 'block';
  }
}
function renderReadingPaywall(){
  updateReadingCapLabel();
  var card=document.querySelector('.reading-card');
  if(!card)return;
  card.querySelector('.reading-paywall')?.remove();
  if(_tierLoading)return; // billing API still in-flight — don't lock prematurely
  if(_userTier==='plus'||_userTier==='pro'){
    var rt=document.getElementById('readingText');
    if(rt){rt.style.webkitMaskImage='none';rt.style.maskImage='none';}
    localStorage.removeItem(READING_USAGE_KEY);
    return;
  }
  if(canGetFullReading()||!currentUser)return;
  var rt=document.getElementById('readingText');
  if(rt)rt.style.webkitMaskImage='linear-gradient(to bottom,black 35%,transparent 85%)';
  // Personalise with streak + entry count
  var entries=loadEntries();
  var totalEntries=Object.keys(entries).length;
  var streakEl=document.querySelector('.streak-count');
  var streakDays=streakEl?parseInt(streakEl.textContent)||0:0;
  var streakMsg='';
  if(streakDays>=30)streakMsg=streakDays+'-day streak \u2014 your record is building.';
  else if(totalEntries>=14)streakMsg=totalEntries+' entries logged across your cycles.';
  var pw=document.createElement('div');
  pw.className='reading-paywall';
  pw.innerHTML='<div class="reading-paywall-inner">'
    +(streakMsg?'<div class="reading-paywall-streak">'+streakMsg+'</div>':'')
    +'<div class="reading-paywall-icon">\u2726</div>'
    +'<div class="reading-paywall-title">Unlock Daily Readings</div>'
    +'<div class="reading-paywall-sub">You\'ve used your 1 free reading today. Plus gives you unlimited personalized readings every day.</div>'
    +'<button class="reading-paywall-btn" onclick="openUpgradeModal(\'Unlock unlimited daily AI readings tailored to your natal chart.\')">Upgrade to Plus &mdash; $7/mo</button>'
    +'<div class="reading-paywall-reset">1 free reading per day &middot; resets at midnight &middot; cancel anytime</div>'
    +'</div>';
  card.appendChild(pw);
}

// ═══════════════════════════════════════════════════════════════════
// AI CYCLE SUMMARY
// ═══════════════════════════════════════════════════════════════════
var CSK='lunations_cycle_summary_v1';
async function generateCycleSummaryAI(force){
  force=force||false;
  var textEl=document.getElementById('cycleSummaryAIText');
  var metaEl=document.getElementById('cycleSummaryMeta');
  if(!textEl)return;
  if(!force){
    try{
      var c=JSON.parse(localStorage.getItem(CSK)||'{}');
      if(c.text&&c.date===new Date().toDateString()){
        textEl.textContent=c.text;
        if(metaEl&&c.meta)metaEl.textContent=c.meta;
        return;
      }
    }catch(e){}
  }
  textEl.innerHTML='<span style="color:rgba(245,240,232,.25);">Reading your cycle\u2026</span>';
  var entries=loadEntries(),now=new Date(),nm=prevNewMoon(now);
  var cycleStart=new Date(nm),dayInCycle=Math.floor((now-nm)/86400000)+1;
  var cycleKeys=Object.keys(entries).filter(function(k){
    var d=new Date(k+'T12:00:00');return d>=cycleStart&&d<=now;
  }).sort();
  if(cycleKeys.length<2){textEl.textContent='Log a few more entries in this cycle to generate a reading.';return;}
  var ce=cycleKeys.map(function(k){return entries[k];}).filter(Boolean);
  var avgE=(ce.reduce(function(s,e){return s+(e.energy||5);},0)/ce.length).toFixed(1);
  var avgM=(ce.reduce(function(s,e){return s+(e.mood||5);},0)/ce.length).toFixed(1);
  var avgCl=(ce.reduce(function(s,e){return s+(e.clarity||5);},0)/ce.length).toFixed(1);
  var allQ=[...new Set(ce.flatMap(function(e){return e.qualities||[];}))];
  var texts=ce.slice(-3).filter(function(e){return e.text&&e.text.length>10;}).map(function(e){return'"'+e.text.slice(0,80)+'"';}).join(' / ');
  var profile=loadProfile(),phase=moonPhaseInfo(now),mSign=moonSignApprox(now);
  var half=Math.floor(ce.length/2);
  var e1=ce.slice(0,half).reduce(function(s,e){return s+(e.energy||5);},0)/half;
  var e2=ce.slice(half).reduce(function(s,e){return s+(e.energy||5);},0)/(ce.length-half);
  var trend=Math.abs(e2-e1)>0.5?(e2>e1?'rising':'falling'):'steady';
  var pname=(profile&&profile.name)?profile.name:'the journaler';
  var psun='';
  if(profile&&profile.dob){try{psun=', natal Sun '+sunSignForDate(new Date(profile.dob+'T12:00:00')).name;}catch(ex){}}
  var _csCtx='';if(profile&&profile.notes){var _cb=parseContextBriefing(profile.notes);if(_cb.life)_csCtx+='. Life focus: '+_cb.life;if(_cb.practice)_csCtx+='. Practice: '+_cb.practice.slice(0,60);}
  var prompt='You are writing a personal cycle reading for someone\'s lunar journal. Synthesize their '+ce.length+'-day record into 4-5 direct, specific sentences. Speak in second person. End with one forward-looking observation.\n\nPerson: '+pname+psun+_csCtx+'.\nCurrent sky: Day '+dayInCycle+' of cycle, '+phase.name+', Moon in '+mSign.name+'.\nCycle so far ('+ce.length+' entries): avg energy '+avgE+'/10, mood '+avgM+'/10, clarity '+avgCl+'/10. Energy trend: '+trend+'. Recurring qualities: '+(allQ.slice(0,6).join(', ')||'varied')+'. Recent: '+(texts||'no text entries yet')+'.\n\nWrite the cycle reading now. No filler. Their specific record.';
  try{
    var res=await fetch('/api/reading',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt})});
    if(!res.ok)throw new Error(res.status);
    var data=await res.json();
    if(data.text){
      textEl.textContent=data.text;
      var meta=ce.length+' entries \u00b7 Day '+dayInCycle+' of cycle \u00b7 '+cycleStart.toLocaleDateString('en',{month:'short',day:'numeric'})+' \u2013 today';
      if(metaEl)metaEl.textContent=meta;
      localStorage.setItem(CSK,JSON.stringify({text:data.text,meta:meta,date:now.toDateString()}));
    }
  }catch(e){textEl.textContent='Could not generate cycle reading right now \u2014 try again shortly.';}
}

// ═══════════════════════════════════════════════════════════════════
// VEDIC BIRTH CHART
// ═══════════════════════════════════════════════════════════════════
var VEDIC_SIGNS=[
  {name:'Aries',    skt:'Mesha',     ruler:'Mars',    sym:'\u2648',exalt:'Sun',   debil:'Saturn'},
  {name:'Taurus',   skt:'Vrishabha', ruler:'Venus',   sym:'\u2649',exalt:'Moon',  debil:''},
  {name:'Gemini',   skt:'Mithuna',   ruler:'Mercury', sym:'\u264a',exalt:'',      debil:''},
  {name:'Cancer',   skt:'Karka',     ruler:'Moon',    sym:'\u264b',exalt:'Jupiter',debil:'Mars'},
  {name:'Leo',      skt:'Simha',     ruler:'Sun',     sym:'\u264c',exalt:'',      debil:''},
  {name:'Virgo',    skt:'Kanya',     ruler:'Mercury', sym:'\u264d',exalt:'Mercury',debil:'Venus'},
  {name:'Libra',    skt:'Tula',      ruler:'Venus',   sym:'\u264e',exalt:'Saturn',debil:'Sun'},
  {name:'Scorpio',  skt:'Vrishchika',ruler:'Mars',    sym:'\u264f',exalt:'',      debil:'Moon'},
  {name:'Sagittarius',skt:'Dhanus',  ruler:'Jupiter', sym:'\u2650',exalt:'',      debil:''},
  {name:'Capricorn',skt:'Makara',    ruler:'Saturn',  sym:'\u2651',exalt:'Mars',  debil:'Jupiter'},
  {name:'Aquarius', skt:'Kumbha',    ruler:'Saturn',  sym:'\u2652',exalt:'',      debil:''},
  {name:'Pisces',   skt:'Meena',     ruler:'Jupiter', sym:'\u2653',exalt:'Venus', debil:'Mercury'}
];
var VEDIC_HOUSES=[
  {n:1, name:'Tanu',    key:'Self, body, personality'},
  {n:2, name:'Dhana',   key:'Wealth, speech, family'},
  {n:3, name:'Sahaja',  key:'Siblings, courage, comms'},
  {n:4, name:'Sukha',   key:'Home, mother, happiness'},
  {n:5, name:'Putra',   key:'Children, creativity, intellect'},
  {n:6, name:'Ripu',    key:'Enemies, health, service'},
  {n:7, name:'Kalatra', key:'Spouse, partnerships'},
  {n:8, name:'Mrityu',  key:'Transformation, hidden knowledge'},
  {n:9, name:'Dharma',  key:'Luck, father, philosophy'},
  {n:10,name:'Karma',   key:'Career, status, authority'},
  {n:11,name:'Labha',   key:'Gains, income, friends'},
  {n:12,name:'Vyaya',   key:'Liberation, foreign lands'}
];
var PLANET_DATA={
  Sun:    {e:'\u2609',skt:'Surya',  exalt:'Aries',    debil:'Libra'},
  Moon:   {e:'\u263d',skt:'Chandra',exalt:'Taurus',   debil:'Scorpio'},
  Mercury:{e:'\u263f',skt:'Budha',  exalt:'Virgo',    debil:'Pisces'},
  Venus:  {e:'\u2640',skt:'Shukra', exalt:'Pisces',   debil:'Virgo'},
  Mars:   {e:'\u2642',skt:'Mangala',exalt:'Capricorn',debil:'Cancer'},
  Jupiter:{e:'\u2644',skt:'Guru',   exalt:'Cancer',   debil:'Capricorn'},
  Saturn: {e:'\u2643',skt:'Shani',  exalt:'Libra',    debil:'Aries'}
};
function vedicSignIdxFromDate(d,lagDays){var dd=new Date(d);if(lagDays)dd.setDate(dd.getDate()+lagDays);var jd=dateToJD(dd.getFullYear(),dd.getMonth()+1,dd.getDate(),12);return tropToVedic(sunLongitude(jd),lahiriAyanamsha(jd));}
// ═══════════════════════════════════════════════════════════════════════════════
// UI OVERHAUL — INTERSECTION OBSERVER, FOCUS TRAP, BOTTOM SHEET, SPARKLINES,
//               COUNT-UP, PULL-TO-REFRESH, AMBIENT GLOW
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SCROLL-TRIGGERED CARD REVEALS ───
let _revealObserver = null;
function initRevealObserver(){
  if(_revealObserver) return;
  _revealObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        _revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  observeRevealElements();
}
function observeRevealElements(){
  if(!_revealObserver) return;
  document.querySelectorAll('.astro-card,.reading-card,.pattern-chart,.today-section,.collective-card,.entry-submitted-card,.people-card,.sw-card,.schumann-card,.baro-card,.fday').forEach(function(el){
    if(!el.classList.contains('visible') && !el.dataset.revealed){
      el.classList.add('reveal');
      _revealObserver.observe(el);
      el.dataset.revealed = '1';
    }
  });
}
// Re-observe after dynamic content renders
function refreshReveals(){ setTimeout(observeRevealElements, 100); }

// ─── MODAL FOCUS TRAP ───
let _focusTrapState = { previous: null, handler: null, modal: null };
function trapFocus(modalEl){
  _focusTrapState.previous = document.activeElement;
  _focusTrapState.modal = modalEl;
  const focusable = modalEl.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
  if(focusable.length) focusable[0].focus();
  _focusTrapState.handler = function(e){
    if(e.key === 'Escape'){
      const closeBtn = modalEl.querySelector('.modal-close');
      if(closeBtn) closeBtn.click();
      return;
    }
    if(e.key !== 'Tab') return;
    const focs = modalEl.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])');
    if(!focs.length) return;
    const first = focs[0], last = focs[focs.length-1];
    if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
    else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
  };
  document.addEventListener('keydown', _focusTrapState.handler);
}
function releaseFocus(){
  if(_focusTrapState.handler) document.removeEventListener('keydown', _focusTrapState.handler);
  if(_focusTrapState.previous) try { _focusTrapState.previous.focus(); } catch(e){}
  _focusTrapState = { previous: null, handler: null, modal: null };
}
// Auto-attach focus traps to existing modal open/close patterns
(function(){
  if(!_themeFeatures) return;
  const origOpen = {};
  // Observe modal overlays for open class changes
  const mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      if(m.type !== 'attributes' || m.attributeName !== 'class') return;
      const el = m.target;
      if(!el.classList.contains('modal-overlay')) return;
      if(el.classList.contains('open')){
        const box = el.querySelector('.modal-box');
        if(box) trapFocus(box);
      } else {
        releaseFocus();
      }
    });
  });
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.modal-overlay').forEach(function(ov){
      mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
    });
  });
})();

// ─── BOTTOM SHEET SWIPE-TO-DISMISS (MOBILE) ───
(function(){
  if(!_themeFeatures) return;
  let startY = 0, currentY = 0, isDragging = false, modalBox = null;
  function onTouchStart(e){
    // Never intercept touches on inputs/textareas — breaks swipe typing on Android
    const tag = e.target.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
    const handle = e.target.closest('.modal-handle');
    const box = e.target.closest('.modal-box');
    if(!box || window.innerWidth > 600) return;
    if(!handle && box.scrollTop > 5) return; // only swipe from top or handle
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    modalBox = box;
    modalBox.style.transition = 'none';
  }
  function onTouchMove(e){
    if(!isDragging || !modalBox) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if(dy > 0) {
      modalBox.style.transform = 'translateY(' + dy + 'px)';
      e.preventDefault();
    }
  }
  function onTouchEnd(){
    if(!isDragging || !modalBox) return;
    const dy = currentY - startY;
    modalBox.style.transition = '';
    if(dy > 100){
      // Close modal
      const overlay = modalBox.closest('.modal-overlay');
      if(overlay){
        const closeBtn = overlay.querySelector('.modal-close');
        if(closeBtn) closeBtn.click();
        else overlay.classList.remove('open');
      }
    }
    modalBox.style.transform = '';
    isDragging = false;
    modalBox = null;
  }
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
})();

// ─── INJECT MODAL HANDLES ───
document.addEventListener('DOMContentLoaded', function(){
  if(!_themeFeatures) return;
  document.querySelectorAll('.modal-box').forEach(function(box){
    if(!box.querySelector('.modal-handle')){
      var h = document.createElement('div');
      h.className = 'modal-handle';
      box.insertBefore(h, box.firstChild);
    }
  });
});

// ─── SPARKLINES ───
function sparkline(data, color){
  if(!data || data.length < 2) return '';
  var w = 60, h = 20, pad = 2;
  var min = Math.min.apply(null, data), max = Math.max.apply(null, data);
  var range = max - min || 1;
  var points = data.map(function(v, i){
    var x = pad + (i / (data.length - 1)) * (w - pad * 2);
    var y = h - pad - ((v - min) / range) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return '<svg class="sparkline-svg" viewBox="0 0 ' + w + ' ' + h + '" style="width:60px;height:20px;display:inline-block;vertical-align:middle;margin-left:8px;opacity:.5;"><polyline points="' + points + '" fill="none" stroke="' + (color || 'rgba(201,168,76,.6)') + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

// ─── METRIC COUNT-UP ───
function countUp(el, target, duration){
  if(!el || isNaN(target)) return;
  var start = 0, startTime = null;
  var isFloat = target % 1 !== 0;
  function step(ts){
    if(!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / (duration || 800), 1);
    var ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    var val = start + (target - start) * ease;
    el.textContent = isFloat ? val.toFixed(1) : Math.round(val);
    if(progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
// Apply count-up to visible stat values
function initCountUps(){
  if(!_revealObserver) return;
  var countObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var el = entry.target;
        var val = parseFloat(el.textContent);
        if(!isNaN(val) && !el.dataset.counted){
          el.dataset.counted = '1';
          countUp(el, val, 900);
        }
        countObserver.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.stat-card-val,.compare-metric-val,.entry-submitted-metric-val,.sw-metric-val,.schumann-freq,.baro-value').forEach(function(el){
    if(!el.dataset.counted) countObserver.observe(el);
  });
}

// ─── PULL TO REFRESH (Today view) ───
(function(){
  if(!_themeFeatures) return;
  var pullIndicator = null, startY = 0, pulling = false, refreshing = false;
  function createIndicator(){
    if(pullIndicator) return pullIndicator;
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%) translateY(-60px);z-index:100;font-size:28px;transition:transform .3s var(--spring);pointer-events:none;filter:drop-shadow(0 0 8px rgba(201,168,76,.4));';
    el.textContent = '\uD83C\uDF19';
    document.body.appendChild(el);
    pullIndicator = el;
    return el;
  }
  document.addEventListener('touchstart', function(e){
    if(refreshing) return;
    var view = document.querySelector('.view.active');
    if(!view || view.id !== 'view-today') return;
    if(window.scrollY > 5) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive: true });
  document.addEventListener('touchmove', function(e){
    if(!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if(dy < 0){ pulling = false; return; }
    if(dy > 10){
      var ind = createIndicator();
      var offset = Math.min(dy * 0.5, 80);
      ind.style.transform = 'translateX(-50%) translateY(' + (offset - 60) + 'px) rotate(' + (offset * 4) + 'deg)';
    }
  }, { passive: true });
  document.addEventListener('touchend', function(){
    if(!pulling) return;
    pulling = false;
    if(pullIndicator){
      var dy = parseInt(pullIndicator.style.transform.match(/translateY\(([^)]+)\)/)?.[1]) || -60;
      if(dy > 10){
        refreshing = true;
        pullIndicator.style.transform = 'translateX(-50%) translateY(20px) rotate(360deg)';
        // Trigger refresh
        if(typeof generateReading === 'function') generateReading(true);
        if(typeof renderToday === 'function') renderToday();
        showToast('Refreshing...');
        setTimeout(function(){
          if(pullIndicator) pullIndicator.style.transform = 'translateX(-50%) translateY(-60px)';
          refreshing = false;
        }, 1500);
      } else {
        pullIndicator.style.transform = 'translateX(-50%) translateY(-60px)';
      }
    }
  });
})();

// ─── AMBIENT GLOW INIT ───
function initAmbientGlow(){
  var sc = document.getElementById('schumannCard');
  if(sc) sc.classList.add('glow-blue');
  var bc = document.getElementById('baroCard');
  if(bc) bc.classList.add('glow-green');
  document.querySelectorAll('.people-card').forEach(function(c){ c.classList.add('glow-purple'); });
}

// ─── INIT ON DOM READY ───
document.addEventListener('DOMContentLoaded', function(){
  if(!_themeFeatures) return;
  initRevealObserver();
  initAmbientGlow();
  setTimeout(initCountUps, 500);
  // Add ARIA to modals
  document.querySelectorAll('.modal-overlay').forEach(function(ov){
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');
  });
  // Keyboard arrow-key nav for tabs
  var tabList = document.querySelector('.nav-tabs[role="tablist"]');
  if(tabList){
    tabList.addEventListener('keydown', function(e){
      var tabs = Array.from(tabList.querySelectorAll('.nav-tab'));
      var idx = tabs.indexOf(document.activeElement);
      if(idx === -1) return;
      var next = -1;
      if(e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length;
      else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
      if(next >= 0){
        e.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════

function renderBirthChart(){var container=document.getElementById('birthChartContent');var subtitle=document.getElementById('bcSubtitle');if(!container)return;var profile=loadProfile();if(!profile||!profile.dob){container.innerHTML='<div style="text-align:center;padding:16px 0 8px;color:rgba(245,240,232,.3);font-size:14px;font-style:italic;">Add your birth date for your Vedic birth chart.<br><button onclick="openOnboarding()" style="margin-top:10px;font-family:Cinzel,serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;padding:7px 18px;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);border-radius:3px;color:var(--gold);cursor:pointer;">Add Birth Profile</button></div>';if(subtitle)subtitle.textContent='Birth date needed';return;}var dobP=profile.dob.split('-');var yr=parseInt(dobP[0]),mo=parseInt(dobP[1]),dy=parseInt(dobP[2]);var hr=12;if(profile.time){try{var tp=profile.time.split(':');hr=parseInt(tp[0])+(parseInt(tp[1])||0)/60;}catch(ex){}}var _tzOff=birthUtcOffset(profile.dob,profile.time,profile.birthTz,parseFloat(profile.birthLng||profile.birth_lng||0));var utHr=hr-_tzOff;var jd=dateToJD(yr,mo,dy,utHr);var ayan=lahiriAyanamsha(jd);var sunT=sunLongitude(jd);var moonT=moonLongitude(jd);var planets=[{name:'Sun',lon:sunT,idx:tropToVedic(sunT,ayan)},{name:'Moon',lon:moonT,idx:tropToVedic(moonT,ayan)},{name:'Mercury',lon:planetLon(jd,'Mercury'),idx:tropToVedic(planetLon(jd,'Mercury'),ayan)},{name:'Venus',lon:planetLon(jd,'Venus'),idx:tropToVedic(planetLon(jd,'Venus'),ayan)},{name:'Mars',lon:planetLon(jd,'Mars'),idx:tropToVedic(planetLon(jd,'Mars'),ayan)},{name:'Jupiter',lon:planetLon(jd,'Jupiter'),idx:tropToVedic(planetLon(jd,'Jupiter'),ayan)},{name:'Saturn',lon:planetLon(jd,'Saturn'),idx:tropToVedic(planetLon(jd,'Saturn'),ayan)},{name:'Rahu',lon:planetLon(jd,'Rahu'),idx:tropToVedic(planetLon(jd,'Rahu'),ayan)}];planets.push({name:'Ketu',lon:0,idx:(planets.find(function(p){return p.name==='Rahu';}).idx+6)%12});var lagnaIdx=null;var lat=parseFloat(profile.birthLat||profile.birth_lat||0);var lng=parseFloat(profile.birthLng||profile.birth_lng||0);if(profile.time&&lat&&lng){lagnaIdx=tropToVedic(calcAscendant(jd,lat,lng),ayan);}var ascIdx=lagnaIdx!==null?lagnaIdx:planets[0].idx;var dobStr=new Date(profile.dob+'T12:00:00').toLocaleDateString('en',{month:'long',day:'numeric',year:'numeric'});var sub=(profile.name||'')+' · '+dobStr;if(lagnaIdx!==null)sub+=' · '+VEDIC_SIGNS[lagnaIdx].name+' Rising';else if(profile.time&&!lat)sub+=' · Add birth city for Rising sign';if(subtitle)subtitle.textContent=sub;function degInSign(lon2){return(norm360(lon2-ayan)%30).toFixed(1);}var pHtml='';for(var i=0;i<planets.length;i++){var p=planets[i],s=VEDIC_SIGNS[p.idx],pd=PLANET_DATA[p.name];var hl=(lagnaIdx!==null&&p.idx===lagnaIdx);var note='';if(pd){if(s.name===pd.exalt)note='<span class="exalt"> exalted</span>';else if(s.name===pd.debil)note='<span class="debil"> debilitated</span>';}var degStr=(p.name!=='Rahu'&&p.name!=='Ketu')?("<span style='font-size:10px;color:rgba(245,240,232,.2);margin-left:3px;'>"+degInSign(p.lon)+'°</span>'):'';pHtml+='<div class="bc-cell'+(hl?' bc-hl':'')+'"><div class="bc-planet">'+(pd?pd.e:p.name[0])+'</div><div class="bc-label">'+(pd?pd.skt:p.name)+'</div><div class="bc-sign">'+s.sym+' '+s.name+degStr+'</div><div class="bc-note">'+s.skt+' · '+s.ruler+note+'</div></div>';}if(lagnaIdx!==null){var ls=VEDIC_SIGNS[lagnaIdx];pHtml+='<div class="bc-cell bc-hl"><div class="bc-planet">☆</div><div class="bc-label">Lagna</div><div class="bc-sign">'+ls.sym+' '+ls.name+'</div><div class="bc-note">'+ls.skt+' Rising</div></div>';}var hHtml='';for(var j=0;j<VEDIC_HOUSES.length;j++){var h=VEDIC_HOUSES[j],sIdx=(ascIdx+j)%12,hs=VEDIC_SIGNS[sIdx];var hPlanets=planets.filter(function(p2){return p2.idx===sIdx;});var pIcons=hPlanets.map(function(p2){return PLANET_DATA[p2.name]?PLANET_DATA[p2.name].e:p2.name[0];}).join(' ');hHtml+='<div class="house-cell"><div class="house-num">H'+h.n+' · '+h.name+'</div><div class="house-sign">'+hs.sym+' '+hs.name+'</div><div class="house-meaning">'+h.key.split(',')[0]+'</div>'+(pIcons?'<div class="house-planets">'+pIcons+'</div>':'')+'</div>';}var disclaimer='Sidereal zodiac · Lahiri ayanamsha · ~1° accuracy';if(!profile.time)disclaimer+=' · <a onclick="openOnboarding()" style="color:rgba(201,168,76,.4);cursor:pointer;">add birth time</a>';if(profile.time&&!lat)disclaimer+=' · <a onclick="openOnboarding()" style="color:rgba(201,168,76,.4);cursor:pointer;">add birth city</a> for Lagna';container.innerHTML='<div style="font-size:11px;color:rgba(245,240,232,.22);font-style:italic;margin-bottom:12px;">'+disclaimer+'</div>'+'<div class="bc-grid">'+pHtml+'</div>'+'<div style="font-family:Cinzel,serif;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,240,232,.2);margin:16px 0 8px;">12 Houses (Bhavas)</div>'+'<div class="houses-grid">'+hHtml+'</div>';if(!profile.birthTz&&lat&&lng&&!_birthTzMigrating){_birthTzMigrating=true;fetchBirthTimezone(lat,lng).then(function(tz){_birthTzMigrating=false;if(tz){profile.birthTz=tz;saveProfileData(profile);renderBirthChart();}});}}


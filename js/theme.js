// ═══ THEME SYSTEM ═══════════════════════════════════════════════════════════
var THEMES = {
  classic:    { label:'Classic',     icon:'\uD83C\uDF19', css:null,                       features:false, tier:'free' },
  ethereal:   { label:'Ethereal',    icon:'\u2726',       css:'/css/theme-ethereal.css',   features:true,  tier:'plus' },
  maximalist: { label:'Maximalist',  icon:'\u25C6',       css:'/css/theme-maximalist.css', features:true,  tier:'plus' }
};
var THEME_STORAGE_KEY = 'lunations_theme_v1';
var _themeStyleEl = null;

function loadThemePreference(){
  try { return localStorage.getItem(THEME_STORAGE_KEY) || 'classic'; }
  catch(e){ return 'classic'; }
}

function saveThemePreference(themeId){
  localStorage.setItem(THEME_STORAGE_KEY, themeId);
  syncThemeToCloud(themeId);
}

function syncThemeToCloud(themeId){
  try {
    var profile = loadProfile();
    if(!profile) return;
    profile.settings = profile.settings || {};
    profile.settings.theme = themeId;
    saveProfileData(profile);
  } catch(e){}
}

function applyTheme(themeId){
  var theme = THEMES[themeId];
  if(!theme){ themeId = 'classic'; theme = THEMES.classic; }

  // Tier check — downgrade if user lost subscription
  if(theme.tier !== 'free' && typeof hasTier === 'function' && !hasTier(theme.tier)){
    themeId = 'classic';
    theme = THEMES.classic;
    localStorage.setItem(THEME_STORAGE_KEY, 'classic');
  }

  var prevTheme = _currentTheme;
  _currentTheme = themeId;
  _themeFeatures = theme.features;
  document.documentElement.setAttribute('data-theme', themeId);

  // Load/unload theme CSS — skip if same theme already loaded
  var currentHref = _themeStyleEl ? _themeStyleEl.getAttribute('href') : null;
  if(currentHref !== (theme.css || null)){
    if(_themeStyleEl){ _themeStyleEl.remove(); _themeStyleEl = null; }
    if(theme.css){
      _themeStyleEl = document.createElement('link');
      _themeStyleEl.rel = 'stylesheet';
      _themeStyleEl.href = theme.css;
      _themeStyleEl.id = 'theme-css';
      document.head.appendChild(_themeStyleEl);
    }
  }

  // Toggle aurora visibility
  var aurora = document.querySelector('.aurora');
  if(aurora) aurora.style.display = theme.features ? '' : 'none';

  // Toggle modal handles
  document.querySelectorAll('.modal-handle').forEach(function(h){
    h.style.display = theme.features ? '' : 'none';
  });

  // Init or tear down UX features
  if(theme.features){
    if(typeof initRevealObserver === 'function') initRevealObserver();
    if(typeof initAmbientGlow === 'function') initAmbientGlow();
    if(typeof initCountUps === 'function') setTimeout(initCountUps, 200);
  } else {
    // Remove reveal classes so cards show immediately
    document.querySelectorAll('.reveal').forEach(function(el){
      el.classList.remove('reveal','visible');
    });
    // Remove glow classes
    document.querySelectorAll('.glow-gold,.glow-blue,.glow-green,.glow-purple').forEach(function(el){
      el.classList.remove('glow-gold','glow-blue','glow-green','glow-purple');
    });
    // Remove toast container
    var tc = document.querySelector('.toast-container');
    if(tc) tc.remove();
    if(typeof _toastState !== 'undefined') _toastState.container = null;
  }
}

function setTheme(themeId){
  var theme = THEMES[themeId];
  if(!theme) return;
  if(theme.tier !== 'free' && typeof hasTier === 'function' && !hasTier(theme.tier)){
    if(typeof requireTier === 'function') requireTier(theme.tier, 'Upgrade to Plus to unlock the ' + theme.label + ' theme.');
    return;
  }
  saveThemePreference(themeId);
  applyTheme(themeId);
  showToast('Theme: ' + theme.label);
  // Re-render settings grid so active highlight updates
  if(typeof renderSettingsModal === 'function' && document.getElementById('settingsModal')?.classList.contains('open')){
    renderSettingsModal();
  }
}

// Apply immediately on script parse (before DOMContentLoaded) to prevent FOUC
(function(){
  var pref = loadThemePreference();
  _currentTheme = pref;
  var theme = THEMES[pref];
  _themeFeatures = theme ? theme.features : false;
  document.documentElement.setAttribute('data-theme', pref);
  if(theme && theme.css){
    _themeStyleEl = document.createElement('link');
    _themeStyleEl.rel = 'stylesheet';
    _themeStyleEl.href = theme.css;
    _themeStyleEl.id = 'theme-css';
    document.head.appendChild(_themeStyleEl);
  }
})();

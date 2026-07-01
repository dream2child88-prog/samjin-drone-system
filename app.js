// fixed: avoid global name conflict with Supabase CDN
'use strict';
const $ = id => document.getElementById(id);
const LS = 'drone_contact_rebuilt_v1_';
const REMOTE_KEYS = ['users','villages','visibleRounds','uploadHistory','years','activeYear','roundOrder','roundOrderByYear','visibleRoundsByYear','briefings'];
const REMOTE_TABLE = 'app_state';
const REMOTE_ID = 'main';
let supabaseClient = null;
let remoteReady = false;
let remoteLoading = false;
let remoteSaveTimer = null;
let remoteSavePending = false;
let remoteChannel = null;
try {
  if (window.SAMJIN_SUPABASE && window.SAMJIN_SUPABASE.url && window.SAMJIN_SUPABASE.key && window.supabase) {
    supabaseClient = window.supabase.createClient(window.SAMJIN_SUPABASE.url, window.SAMJIN_SUPABASE.key);
  }
} catch (e) { console.error(e); }
const defaultRoundOrder = ['1차 방제','2차 방제','3차 방제'];
let years = load('years', null) || [String(new Date().getFullYear())];
let activeYear = load('activeYear', null) || years[0] || String(new Date().getFullYear());
if(!years.includes(activeYear)) years.unshift(activeYear);
let roundOrderByYear = load('roundOrderByYear', null) || {};
let visibleRoundsByYear = load('visibleRoundsByYear', null) || {};
let roundOrder = roundOrderByYear[activeYear] || defaultRoundOrder.slice();
let visibleRounds = visibleRoundsByYear[activeYear] || roundOrder.slice();
function syncYearContext(){ if(!years.includes(activeYear)) years.unshift(activeYear); if(!Array.isArray(roundOrderByYear[activeYear])) roundOrderByYear[activeYear] = roundOrder && roundOrder.length ? roundOrder.slice() : defaultRoundOrder.slice(); roundOrder = roundOrderByYear[activeYear]; if(!Array.isArray(visibleRoundsByYear[activeYear])) visibleRoundsByYear[activeYear] = roundOrder.slice(); visibleRounds = visibleRoundsByYear[activeYear].filter(r=>roundOrder.includes(r)); visibleRoundsByYear[activeYear] = visibleRounds; }
const townOrder = ['진전면','진북면','진동면','구산면','현동'];
const defaultUsers = [
  {id:'admin', name:'관리자', phone:'', password:'1234', role:'admin'},
  {id:'lee01', name:'이학준', phone:'', password:'1234', role:'worker'},
  {id:'kim01', name:'김철수', phone:'', password:'1234', role:'worker'},
  {id:'park01', name:'박영수', phone:'', password:'1234', role:'worker'}
];
const defaultVillages = [
  {id:'v001', eup:'진전면', village:'양촌마을', chief:'최성호', phone:'010-4444-4444'},
  {id:'v002', eup:'진전면', village:'오서마을', chief:'강민호', phone:'010-5555-1111'},
  {id:'v003', eup:'진북면', village:'이목마을', chief:'홍길동', phone:'010-1111-1111'},
  {id:'v004', eup:'진북면', village:'부산마을', chief:'김영수', phone:'010-2222-2222'},
  {id:'v005', eup:'진동면', village:'신촌마을', chief:'박민수', phone:'010-3333-3333'},
  {id:'v006', eup:'진동면', village:'태봉마을', chief:'정기호', phone:'010-5555-2222'},
  {id:'v007', eup:'구산면', village:'수정마을', chief:'이성민', phone:'010-5555-3333'},
  {id:'v008', eup:'현동', village:'현동마을', chief:'윤정호', phone:'010-5555-4444'}
];
let users = load('users', null) || importOldUsers() || defaultUsers;
let villages = (load('villages', null) || importOldVillages() || defaultVillages).map(migrateVillage);
let uploadHistory = load('uploadHistory', null) || [];
let briefings = load('briefings', null) || {};
let currentUser = load('currentUser', null);
let selectedRound = load('selectedRound', '');
let selectedTown = load('selectedTown', '');
let selectedVillageId = '';
let editingVillageId = '';
let editingUserId = '';
function load(k, fallback){ try{ const v = localStorage.getItem(LS+k); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function save(k, v){ localStorage.setItem(LS+k, JSON.stringify(v)); if(REMOTE_KEYS.includes(k)) scheduleRemoteSave(); }
function remoteSnapshot(){ syncYearContext(); return {users, villages, years, activeYear, roundOrderByYear, visibleRoundsByYear, visibleRounds, uploadHistory, briefings, updatedAt: new Date().toISOString()}; }
function applyRemoteSnapshot(data){ if(!data || typeof data !== 'object') return; if(Array.isArray(data.users)) users = data.users; if(Array.isArray(data.years)) years = data.years.map(String); if(data.activeYear) activeYear = String(data.activeYear); if(data.roundOrderByYear && typeof data.roundOrderByYear==='object') roundOrderByYear = data.roundOrderByYear; if(data.visibleRoundsByYear && typeof data.visibleRoundsByYear==='object') visibleRoundsByYear = data.visibleRoundsByYear; if(Array.isArray(data.visibleRounds) && !visibleRoundsByYear[activeYear]) visibleRoundsByYear[activeYear] = data.visibleRounds; syncYearContext(); if(Array.isArray(data.villages)) villages = data.villages.map(migrateVillage); if(Array.isArray(data.uploadHistory)) uploadHistory = data.uploadHistory; if(data.briefings && typeof data.briefings==='object') briefings = data.briefings; localStorage.setItem(LS+'users', JSON.stringify(users)); localStorage.setItem(LS+'villages', JSON.stringify(villages)); localStorage.setItem(LS+'years', JSON.stringify(years)); localStorage.setItem(LS+'activeYear', JSON.stringify(activeYear)); localStorage.setItem(LS+'roundOrderByYear', JSON.stringify(roundOrderByYear)); localStorage.setItem(LS+'visibleRoundsByYear', JSON.stringify(visibleRoundsByYear)); localStorage.setItem(LS+'visibleRounds', JSON.stringify(visibleRounds)); localStorage.setItem(LS+'uploadHistory', JSON.stringify(uploadHistory)); localStorage.setItem(LS+'briefings', JSON.stringify(briefings)); }
function scheduleRemoteSave(){ if(!supabaseClient || !remoteReady || remoteLoading) return; remoteSavePending = true; clearTimeout(remoteSaveTimer); remoteSaveTimer = setTimeout(saveRemoteNow, 350); }
async function saveRemoteNow(){ if(!supabaseClient || !remoteReady || !remoteSavePending || remoteLoading) return; remoteSavePending = false; const payload = remoteSnapshot(); const { error } = await supabaseClient.from(REMOTE_TABLE).upsert({ id: REMOTE_ID, data: payload, updated_at: new Date().toISOString() }); if(error) showError('실시간 저장 오류: '+error.message); }
async function loadRemoteState(){ if(!supabaseClient) return; remoteLoading = true; const { data, error } = await supabaseClient.from(REMOTE_TABLE).select('data').eq('id', REMOTE_ID).maybeSingle(); if(error){ remoteLoading = false; showError('Supabase 연결 오류: '+error.message); return; } if(data && data.data){ applyRemoteSnapshot(data.data); } else { await supabaseClient.from(REMOTE_TABLE).upsert({ id: REMOTE_ID, data: remoteSnapshot(), updated_at: new Date().toISOString() }); } remoteReady = true; remoteLoading = false; }
function subscribeRemote(){ if(!supabaseClient || remoteChannel) return; remoteChannel = supabaseClient.channel('samjin-app-state').on('postgres_changes', {event:'*', schema:'public', table:REMOTE_TABLE, filter:'id=eq.'+REMOTE_ID}, payload=>{ if(payload && payload.new && payload.new.data){ remoteLoading = true; applyRemoteSnapshot(payload.new.data); remoteLoading = false; render(); } }).subscribe(); }
function showError(msg){ const el=$('errorBox'); if(!el) return; el.classList.remove('hidden'); el.textContent=msg; }
function importOldUsers(){ try{ const x = JSON.parse(localStorage.getItem('users') || 'null'); return Array.isArray(x) ? x : null; }catch(e){ return null; } }
function importOldVillages(){ try{ const x = JSON.parse(localStorage.getItem('villages') || 'null'); return Array.isArray(x) ? x : null; }catch(e){ return null; } }
function blank(){ return {status:'pending', completedBy:'', completedAt:'', completedList:[], note:'', noteBy:'', noteAt:'', noteImportant:false, history:[]}; }
function migrateVillage(v){
  const base = {id:v.id || uid(), eup:v.eup || '진전면', village:v.village || '', chief:v.chief || '', phone:v.phone || '', chiefHistory:Array.isArray(v.chiefHistory)?v.chiefHistory:[]};
  base.roundsByYear = v.roundsByYear && typeof v.roundsByYear === 'object' ? v.roundsByYear : {};
  if(!base.roundsByYear[activeYear]){
    base.roundsByYear[activeYear] = v.rounds && typeof v.rounds === 'object' ? v.rounds : {};
  }
  base.rounds = base.roundsByYear[activeYear];
  roundOrder.forEach(r=>{ if(!base.rounds[r]) base.rounds[r] = blank(); if(!Array.isArray(base.rounds[r].history)) base.rounds[r].history = []; if(!Array.isArray(base.rounds[r].completedList)) base.rounds[r].completedList = base.rounds[r].completedBy ? [{user:base.rounds[r].completedBy, at:base.rounds[r].completedAt || '', canceled:false}] : []; if(base.rounds[r].noteImportant===undefined) base.rounds[r].noteImportant=false; syncContactSummary(base.rounds[r]); });
  if(v.status || v.completedBy || v.note){ Object.assign(base.rounds[roundOrder[0] || '1차 방제'], {status:v.status||'pending', completedBy:v.completedBy||'', completedAt:v.completedAt||'', completedList:v.completedBy?[{user:v.completedBy, at:v.completedAt||''}]:[], note:v.note||'', noteBy:v.noteBy||'', noteAt:v.noteAt||'', history:Array.isArray(v.history)?v.history:[]}); }
  return base;
}
function persistAll(){ syncYearContext(); save('users', users); save('villages', villages); save('years', years); save('activeYear', activeYear); save('roundOrderByYear', roundOrderByYear); save('visibleRoundsByYear', visibleRoundsByYear); save('visibleRounds', visibleRounds); save('uploadHistory', uploadHistory); save('briefings', briefings); if(currentUser) save('currentUser', currentUser); }
function uid(){ return 'v' + Date.now() + Math.random().toString(36).slice(2,7); }
function safe(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function norm(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,''); }
function now(){ return new Date().toLocaleString('ko-KR', {hour12:false}); }
function activeRound(){ return selectedRound || visibleRounds[0] || roundOrder[0]; }
function rec(v, round=activeRound()){ if(!v.roundsByYear) v.roundsByYear={}; if(!v.roundsByYear[activeYear]) v.roundsByYear[activeYear]={}; v.rounds = v.roundsByYear[activeYear]; if(!v.rounds[round]) v.rounds[round]=blank(); return v.rounds[round]; }

function allContactEntries(r){ if(!Array.isArray(r.completedList)) r.completedList = r.completedBy ? [{user:r.completedBy, at:r.completedAt || '', canceled:false}] : []; return r.completedList; }
function activeContactEntries(r){ return allContactEntries(r).filter(x=>!x.canceled); }
function contactEntries(r){ return activeContactEntries(r); }
function contactNames(r){ const names=[...new Set(activeContactEntries(r).map(x=>x.user).filter(Boolean))]; return names.join(', '); }
function lastContactAt(r){ const list=activeContactEntries(r); return list.length ? (list[list.length-1].at || '') : ''; }
function syncContactSummary(r){ const names=contactNames(r); r.completedBy=names; r.completedAt=lastContactAt(r); r.status=names ? 'done' : 'pending'; }
function changeChief(v, newChief, newPhone, source){ const oldChief=v.chief||'', oldPhone=v.phone||''; const chiefChanged=oldChief!==newChief, phoneChanged=oldPhone!==newPhone; if((chiefChanged||phoneChanged) && (oldChief||oldPhone)){ if(!Array.isArray(v.chiefHistory)) v.chiefHistory=[]; v.chiefHistory.unshift({at:now(), user:currentUser?currentUser.name:'-', source:source||'수정', oldChief, newChief, oldPhone, newPhone, text:`${source||'수정'}: ${oldChief||'-'} → ${newChief||'-'} / ${oldPhone||'-'} → ${newPhone||'-'}`}); } v.chief=newChief; v.phone=newPhone; }
function isImportantNote(r){ return !!r.noteImportant; }

function visible(){ return roundOrder.filter(r=>visibleRounds.includes(r)); }
function towns(){ const set = new Set(villages.map(v=>v.eup)); return [...townOrder.filter(t=>set.has(t)), ...[...set].filter(t=>!townOrder.includes(t)).sort((a,b)=>a.localeCompare(b,'ko'))]; }
async function init(){
  syncYearContext();
  villages = villages.map(migrateVillage);
  $('todayText').textContent = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  bind();
  if(supabaseClient){ await loadRemoteState(); subscribeRemote(); } else { showError('Supabase 설정이 없습니다. config.js에 URL과 Publishable Key를 입력하세요. 현재는 이 기기 안에서만 저장됩니다.'); }
  persistAll(); render();
}
function bind(){
  $('loginBtn').onclick = login; $('logoutBtn').onclick = logout; $('showSignupBtn').onclick = ()=>showAuth('signup'); $('showPasswordResetBtn').onclick = ()=>showAuth('reset'); $('backLoginBtn').onclick=()=>showAuth('login'); $('backLoginFromResetBtn').onclick=()=>showAuth('login'); $('signupBtn').onclick=signup; $('resetPasswordBtn').onclick=resetPassword;
  $('contactTab').onclick=()=>showPage('contact'); $('adminTab').onclick=()=>showPage('admin'); $('searchInput').oninput=renderContact; $('statusFilter').onchange=renderContact; $('workerFilter').onchange=renderContact; $('pendingOnlyBtn').onclick=()=>{ $('statusFilter').value='pending'; renderContact(); }; 
  $('backToRoundsBtn').onclick=()=>{selectedRound='';selectedTown='';save('selectedRound','');save('selectedTown','');renderContact();};
  $('backToTownsBtn').onclick=()=>{selectedTown='';save('selectedTown','');renderContact();};
  $('roundList').onclick=e=>{ const card=e.target.closest('[data-round]'); if(card) {selectedRound=card.dataset.round; selectedTown=''; save('selectedRound',selectedRound); save('selectedTown',''); renderContact();} };
  $('townList').onclick=e=>{ const card=e.target.closest('[data-town]'); if(card) {selectedTown=card.dataset.town; save('selectedTown',selectedTown); renderContact();} };
  $('villageList').onclick=e=>{ const card=e.target.closest('[data-village]'); if(card) openVillage(card.dataset.village); };
  $('closeDialogBtn').onclick=()=>{$('villageDialog').close();}; $('completeBtn').onclick=completeContact; const saveChiefBtn=$('saveChiefContactBtn'); if(saveChiefBtn) saveChiefBtn.onclick=saveChiefContact; $('saveNoteBtn').onclick=saveNote; $('contactHistoryList').onclick=e=>{ const btn=e.target.closest('[data-cancel-contact]'); if(btn) cancelContact(btn.dataset.cancelContact); }; const quickBox=$('quickMessageBox'); if(quickBox) quickBox.onclick=e=>{ const btn=e.target.closest('[data-quick-message]'); if(btn) sendQuickMessage(btn.dataset.quickMessage); };
  $('saveRoundVisibilityBtn').onclick=saveRoundVisibility; $('saveVillageBtn').onclick=saveVillage; $('clearVillageFormBtn').onclick=clearVillageForm; $('saveUserBtn').onclick=saveUser; $('clearUserFormBtn').onclick=clearUserForm; $('importVillageBtn').onclick=importVillageFile; $('downloadTemplateBtn').onclick=downloadVillageTemplate; $('exportVillageBtn').onclick=exportVillages;
  $('villageTable').onclick=e=>{ const edit=e.target.closest('[data-edit-village]'); const del=e.target.closest('[data-delete-village]'); if(edit) editVillage(edit.dataset.editVillage); if(del) deleteVillage(del.dataset.deleteVillage); };
  $('userTable').onclick=e=>{ const edit=e.target.closest('[data-edit-user]'); const del=e.target.closest('[data-delete-user]'); if(edit) editUser(edit.dataset.editUser); if(del) deleteUser(del.dataset.deleteUser); };
  if($('activeYearSelect')) $('activeYearSelect').onchange=changeActiveYear; if($('createYearBtn')) $('createYearBtn').onclick=createNewYear; if($('addRoundBtn')) $('addRoundBtn').onclick=addRound; if($('roundManageTable')) $('roundManageTable').onclick=handleRoundManageClick; if($('briefingRoundSelect')) $('briefingRoundSelect').onchange=loadBriefingForm; if($('saveBriefingBtn')) $('saveBriefingBtn').onclick=saveBriefingForm; if($('dialogBriefingBox')){ $('dialogBriefingBox').onchange=handleChecklistClick; $('dialogBriefingBox').onclick=handleChecklistClick; }
}
function showAuth(mode){ $('loginSection').classList.toggle('hidden', mode!=='login'); $('signupSection').classList.toggle('hidden', mode!=='signup'); $('passwordResetSection').classList.toggle('hidden', mode!=='reset'); }
function resetPassword(){ const id=norm($('resetId').value); const phone=norm($('resetPhone').value); const pw=$('resetPw').value; const pw2=$('resetPw2').value; if(!id||!phone||!pw) return alert('아이디, 연락처, 새 비밀번호를 입력하세요.'); if(pw!==pw2) return alert('새 비밀번호가 서로 다릅니다.'); const u=users.find(x=>norm(x.id)===id && norm(x.phone)===phone); if(!u) return alert('아이디와 가입 연락처가 일치하는 계정을 찾지 못했습니다. 관리자에게 문의하세요.'); u.password=pw; save('users',users); ['resetId','resetPhone','resetPw','resetPw2'].forEach(id=>$(id).value=''); $('loginId').value=u.id; $('loginPw').value=''; showAuth('login'); alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.'); }
function login(){ const id=norm($('loginId').value); const pw=$('loginPw').value; const u=users.find(x=>norm(x.id)===id && x.password===pw); if(!u) return alert('아이디 또는 비밀번호가 맞지 않습니다.'); currentUser={id:u.id,name:u.name,phone:u.phone||'',role:u.role}; save('currentUser', currentUser); render(); }
function logout(){ currentUser=null; selectedRound=''; selectedTown=''; ['currentUser','selectedRound','selectedTown'].forEach(k=>localStorage.removeItem(LS+k)); render(); }
function signup(){ const name=$('signupName').value.trim(), id=norm($('signupId').value), phone=$('signupPhone').value.trim(), pw=$('signupPw').value; if(!name||!id||!pw) return alert('이름, 아이디, 비밀번호를 입력하세요.'); if(users.some(u=>norm(u.id)===id)) return alert('이미 사용 중인 아이디입니다.'); users.push({id,name,phone,password:pw,role:'worker'}); save('users',users); $('loginId').value=id; $('loginPw').value=pw; ['signupName','signupId','signupPhone','signupPw'].forEach(id=>$(id).value=''); showAuth('login'); alert('가입되었습니다.'); }
function render(){ const logged=!!currentUser; $('loginSection').classList.toggle('hidden',logged); $('signupSection').classList.add('hidden'); $('passwordResetSection').classList.add('hidden'); $('appSection').classList.toggle('hidden',!logged); $('logoutBtn').classList.toggle('hidden',!logged); $('userBadge').classList.toggle('hidden',!logged); if(logged){ $('userBadge').textContent=`${currentUser.name} · ${currentUser.role==='admin'?'관리자':'방제사'}`; $('adminTab').classList.toggle('hidden', currentUser.role!=='admin'); renderWorkerFilter(); renderContact(); renderAdmin(); } }
function showPage(page){ if(page==='admin'&&currentUser.role!=='admin') page='contact'; $('contactPage').classList.toggle('hidden',page!=='contact'); $('adminPage').classList.toggle('hidden',page!=='admin'); $('contactTab').classList.toggle('active',page==='contact'); $('adminTab').classList.toggle('active',page==='admin'); if(page==='admin') renderAdmin(); }
function isWorkerAssigned(r, filterValue){ const list=activeContactEntries(r); if(filterValue==='all') return true; if(filterValue==='me') return !!currentUser && list.some(x=>(x.userId&&x.userId===currentUser.id)||x.user===currentUser.name); if(filterValue.startsWith('user:')){ const uid=filterValue.slice(5); return list.some(x=>x.userId===uid || users.some(u=>u.id===uid && x.user===u.name)); } return true; }
function renderWorkerFilter(){ const el=$('workerFilter'); if(!el || !currentUser) return; const prev=el.value || 'all'; const opts=['<option value="all">전체 담당자</option>','<option value="me">내 담당 이장만</option>']; if(currentUser.role==='admin'){ users.filter(u=>u.role!=='admin').forEach(u=>opts.push(`<option value="user:${safe(u.id)}">${safe(u.name)} 담당</option>`)); } el.innerHTML=opts.join(''); el.value=[...el.options].some(o=>o.value===prev)?prev:'all'; }
function filteredVillages(){ const q=$('searchInput').value.trim(); const f=$('statusFilter').value; const wf=$('workerFilter') ? $('workerFilter').value : 'all'; return villages.filter(v=>{ const r=rec(v); const text=`${v.eup} ${v.village} ${v.chief} ${v.phone} ${contactNames(r)} ${r.note}`; return (!q||text.includes(q)) && isWorkerAssigned(r,wf) && (f==='all'||(f==='pending'&&r.status!=='done')||(f==='done'&&r.status==='done')||(f==='note'&&r.note)||(f==='important'&&isImportantNote(r))); }); }
function stats(list=villages, round=activeRound()){ const total=list.length, done=list.filter(v=>contactEntries(rec(v,round)).length>0).length, note=list.filter(v=>rec(v,round).note).length; return {total,done,pending:total-done,note,rate:total?Math.round(done/total*100):0}; }
function renderSummary(){ const list=filteredVillages(); const s=stats(list); $('totalCount').textContent=s.total; $('doneCount').textContent=s.done; $('pendingCount').textContent=s.pending; $('rateText').textContent=s.rate+'%'; }
function renderContact(){ renderContactBriefing(); if(selectedRound && !visible().includes(selectedRound)){ selectedRound=''; selectedTown=''; } renderSummary(); if(!selectedRound) return renderRoundView(); if(!selectedTown) return renderTownView(); return renderVillageView(); }
function renderRoundView(){ $('roundView').classList.remove('hidden'); $('townView').classList.add('hidden'); $('villageView').classList.add('hidden'); $('breadcrumb').classList.add('hidden'); const list=visible(); $('roundList').innerHTML=list.length?list.map(r=>{ const s=stats(villages,r); return `<article class="card town-card" data-round="${safe(r)}"><div class="town-name">${safe(r)}</div><div class="town-stats"><span class="badge done">완료 ${s.done}</span><span class="badge pending">미연락 ${s.pending}</span>${s.note?`<span class="badge note">특이사항 ${s.note}</span>`:''}</div><div class="progress"><span style="width:${s.rate}%"></span></div><div class="meta">전체 ${s.total}개 마을 · 완료율 ${s.rate}%</div></article>`; }).join(''):'<div class="card">관리자가 공개한 차수가 없습니다.</div>'; }
function notePreviewForTown(t){ const notes=villages.filter(v=>v.eup===t).map(v=>({v,r:rec(v)})).filter(x=>x.r.note).slice(0,3); if(!notes.length) return ''; return `<div class="note-preview-list">${notes.map(x=>`<div class="note-preview-row ${isImportantNote(x.r)?'important':''}"><strong>${safe(x.v.village)}</strong> ${safe(x.r.note)}</div>`).join('')}${stats(villages.filter(v=>v.eup===t)).note>3?'<div class="meta">외 특이사항 더 있음</div>':''}</div>`; }
function renderTownView(){ $('roundView').classList.add('hidden'); $('townView').classList.remove('hidden'); $('villageView').classList.add('hidden'); $('breadcrumb').classList.remove('hidden'); $('breadcrumb').textContent=activeYear + '년 · ' + selectedRound; const fv=filteredVillages(); const wf=$('workerFilter') ? $('workerFilter').value : 'all'; const townItems=towns().filter(t=>wf==='all'||fv.some(v=>v.eup===t)); $('townList').innerHTML=townItems.map(t=>{ const list=villages.filter(v=>v.eup===t), shown=fv.filter(v=>v.eup===t), s=stats(fv.filter(v=>v.eup===t).length?fv.filter(v=>v.eup===t):list); return `<article class="card town-card" data-town="${safe(t)}"><div class="town-name">${safe(t)}</div><div class="town-stats"><span class="badge done">완료 ${s.done}</span><span class="badge pending">미연락 ${s.pending}</span>${s.note?`<span class="badge note">특이사항 ${s.note}</span>`:''}</div><div class="progress"><span style="width:${s.rate}%"></span></div><div class="meta">전체 ${s.total}개 마을 · 완료율 ${s.rate}%${shown.length!==list.length?` · 검색결과 ${shown.length}개`:''}</div>${notePreviewForTown(t)}</article>`; }).join('') || '<div class="card">등록된 마을이 없습니다.</div>'; }
function renderVillageView(){ $('roundView').classList.add('hidden'); $('townView').classList.add('hidden'); $('villageView').classList.remove('hidden'); $('breadcrumb').classList.remove('hidden'); $('breadcrumb').textContent=`${activeYear}년 · ${selectedRound} > ${selectedTown}`; const all=villages.filter(v=>v.eup===selectedTown), s=stats(all); $('selectedTownTitle').textContent=selectedTown; $('selectedTownDesc').textContent=`전체 ${s.total}개 · 완료 ${s.done} · 미연락 ${s.pending} · 특이사항 ${s.note} · 완료율 ${s.rate}%`; const list=filteredVillages().filter(v=>v.eup===selectedTown); $('villageList').innerHTML=list.length?list.map(v=>{ const r=rec(v); return `<article class="card village-card" data-village="${safe(v.id)}"><div class="village-title"><strong>${safe(v.village)}</strong><span class="badge ${r.status==='done'?'done':'pending'}">${r.status==='done'?'완료':'미연락'}</span></div><div class="chief">이장님: ${safe(v.chief)}</div><div class="meta">연락처: ${safe(v.phone)}</div><div class="meta">담당 방제사: ${safe(contactNames(r)||'연락 전')}</div>${lastContactAt(r)?`<div class="meta">최근 연락 완료: ${safe(lastContactAt(r))}</div>`:''}${r.note?`<div class="note-card ${isImportantNote(r)?'important':''}"><div class="note-card-title">${isImportantNote(r)?'중요 특이사항':'특이사항'}</div><div>${safe(r.note)}</div><div class="meta">작성: ${safe(r.noteBy||'-')} · ${safe(r.noteAt||'-')}</div></div>`:''}</article>`; }).join(''):'<div class="card">조건에 맞는 마을이 없습니다.</div>'; }
function openVillage(id){ const v=villages.find(x=>x.id===id); if(!v) return; selectedVillageId=id; const r=rec(v); $('dialogTitle').textContent=`${activeYear}년 · ${selectedRound} · ${v.eup} ${v.village}`; $('dialogSub').textContent=`담당 방제사: ${contactNames(r)||'연락 전'}`; $('chiefName').textContent=v.chief; $('chiefPhone').textContent=v.phone; $('assignedDisplay').textContent=contactNames(r)||'연락 전'; $('callBtn').href='tel:'+v.phone.replace(/[^0-9]/g,''); $('noteInput').value=r.note||''; $('noteImportantCheck').checked=!!r.noteImportant; drawDialog(v); $('villageDialog').showModal(); }
function drawDialog(v){
  const r=rec(v);
  syncContactSummary(r);
  $('statusBox').innerHTML=r.status==='done'?`<strong>연락 완료</strong><br>${safe(r.completedBy)} / ${safe(r.completedAt)}`:'<strong>아직 연락 전입니다.</strong>';
  $('dialogSub').textContent=`담당 방제사: ${contactNames(r)||'연락 전'}`;
  $('assignedDisplay').textContent=contactNames(r)||'연락 전';
  renderDialogBriefing(v);
  const contacts=[];
  roundOrder.forEach(round=>{
    const rr=rec(v,round);
    allContactEntries(rr).forEach((c,i)=>contacts.push({round, index:i, ...c}));
  });
  $('contactHistoryList').innerHTML=contacts.length?contacts.reverse().map(c=>`<div class="history-item ${c.canceled?'canceled':''}"><strong>${safe(c.round)} · ${c.canceled?'연락완료 취소':'연락완료'}</strong> - ${safe(c.user)}<time>${safe(c.at||'-')}</time>${c.canceled?`<div class="danger-text">취소: ${safe(c.cancelBy||'-')} · ${safe(c.cancelAt||'-')} · ${safe(c.cancelReason||'사유 없음')}</div>`:''}${(!c.canceled && currentUser.role==='admin')?`<button class="mini danger" data-cancel-contact="${safe(c.round)}|${c.index}">연락완료 취소</button>`:''}</div>`).join(''):'<p class="muted">아직 연락완료 이력이 없습니다.</p>';
  const chiefLogs=(v.chiefHistory||[]).map(x=>({type:'이장 변경',user:x.user,at:x.at,text:x.text||`${x.oldChief||'-'} → ${x.newChief||'-'}`}));
  const h=[...(r.history||[]), ...chiefLogs].sort((a,b)=>String(b.at).localeCompare(String(a.at),'ko'));
  $('historyList').innerHTML=h.length?h.map(x=>`<div class="history-item"><strong>${safe(x.type)}</strong> - ${safe(x.user)}<time>${safe(x.at)}</time><div>${safe(x.text||'')}</div></div>`).join(''):'<p class="muted">아직 기록이 없습니다.</p>';
}
function completeContact(){ const v=villages.find(x=>x.id===selectedVillageId); if(!v) return alert('마을을 다시 선택하세요.'); const r=rec(v); syncChecklistFromDialog(); if(!isBriefingChecklistComplete(r)){ return alert('필수 확인 체크리스트를 모두 확인해야 연락완료를 기록할 수 있습니다.'); } const at=now(); const list=allContactEntries(r); if(activeContactEntries(r).some(x=>x.userId===currentUser.id)){ return alert('이미 이 차수에서 연락완료 기록이 있습니다. 추가 연락자는 다른 계정으로 기록해 주세요.'); } list.push({user:currentUser.name, userId:currentUser.id, role:currentUser.role, at, canceled:false}); syncContactSummary(r); r.history.push({type:'연락 완료',user:currentUser.name,at,text:`${selectedRound} / ${v.eup} ${v.village} / 담당 추가: ${currentUser.name}`}); save('villages',villages); drawDialog(v); renderContact(); alert('연락완료가 기록되었습니다.'); }
function cancelContact(key){ if(currentUser.role!=='admin') return alert('관리자만 연락완료를 취소할 수 있습니다.'); const [round, idxText]=String(key).split('|'); const idx=Number(idxText); const v=villages.find(x=>x.id===selectedVillageId); if(!v) return alert('마을을 다시 선택하세요.'); const r=rec(v,round); const item=allContactEntries(r)[idx]; if(!item || item.canceled) return alert('취소할 연락완료 기록을 찾지 못했습니다.'); const reason=prompt('취소 사유를 입력하세요.', '잘못 누름') || '사유 미입력'; item.canceled=true; item.cancelBy=currentUser.name; item.cancelAt=now(); item.cancelReason=reason; syncContactSummary(r); r.history.push({type:'연락완료 취소',user:currentUser.name,at:item.cancelAt,text:`${round} / ${v.eup} ${v.village} / ${item.user} 기록 취소 / ${reason}`}); save('villages',villages); drawDialog(v); renderContact(); alert('취소 이력으로 기록되었습니다.'); }
function vcardEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function downloadBlob(filename, content, type){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0); }
function isAndroid(){ return /Android/i.test(navigator.userAgent||''); }
function openAndroidContactInsert(displayName, phone){
  const intent='intent://contacts/people/#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/contact;S.name='+encodeURIComponent(displayName)+';S.phone='+encodeURIComponent(phone)+';end';
  window.location.href=intent;
}
function openVcfFile(filename, vcf){
  const blob=new Blob([vcf],{type:'text/vcard;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.target='_blank';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},1500);
}
async function saveChiefContact(){
  const v=villages.find(x=>x.id===selectedVillageId);
  if(!v) return alert('마을을 다시 선택하세요.');
  const phone=String(v.phone||'').replace(/[^0-9+]/g,'');
  if(!phone) return alert('저장할 이장님 연락처가 없습니다.');
  const displayName=`${v.eup} ${v.village} 이장 ${v.chief||''}`.trim();
  const note=`삼진항공방제단 이장 연락처 / ${v.eup} ${v.village}`;
  const vcf=[
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${vcardEscape(displayName)}`,
    `N:${vcardEscape(displayName)};;;;`,
    `TEL;TYPE=CELL:${phone}`,
    `ORG:${vcardEscape('삼진항공방제단')}`,
    `NOTE:${vcardEscape(note)}`,
    'END:VCARD'
  ].join('\r\n');
  const filename=(`${v.eup}_${v.village}_이장_${v.chief||'연락처'}.vcf`).replace(/[\\/:*?"<>|\s]+/g,'_');

  if(isAndroid()){
    const ok=confirm('연락처 저장 화면을 바로 열까요?\n\n저장 화면이 열리면 우측 상단의 저장 버튼을 눌러주세요.');
    if(ok){
      openAndroidContactInsert(displayName, phone);
      setTimeout(()=>{
        if(confirm('연락처 저장 화면이 열리지 않았다면 VCF 파일로 저장하시겠습니까?')) openVcfFile(filename, vcf);
      },1200);
      return;
    }
  }

  try{
    const file=new File([vcf], filename, {type:'text/vcard;charset=utf-8'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:displayName, text:'이장님 연락처를 저장합니다.'});
      return;
    }
  }catch(e){ /* 파일 공유 미지원 시 VCF 열기 */ }

  openVcfFile(filename, '\ufeff'+vcf);
  alert('연락처 파일을 열었습니다. 휴대폰에서 연락처 저장 또는 가져오기를 선택해 주세요.');
}
function saveNote(){ const v=villages.find(x=>x.id===selectedVillageId); if(!v) return alert('마을을 다시 선택하세요.'); const r=rec(v), text=$('noteInput').value.trim(), important=$('noteImportantCheck').checked; if(r.note && currentUser.role!=='admin' && r.noteBy!==currentUser.name) return alert('특이사항은 작성자 또는 관리자만 수정할 수 있습니다.'); if(r.note!==text || !!r.noteImportant!==!!important){ r.note=text; r.noteImportant=!!important; r.noteBy=text?currentUser.name:''; r.noteAt=text?now():''; r.history.push({type:important?'중요 특이사항 저장':'특이사항 저장',user:currentUser.name,at:now(),text:text||'내용 삭제'}); save('villages',villages); } drawDialog(v); renderContact(); alert('저장되었습니다.'); }

function setQuickMessageStatus(text){ const el=$('quickMessageStatus'); if(el) el.textContent=text||''; }
function cleanPhone(phone){ return String(phone||'').replace(/[^0-9]/g,''); }
function getCurrentLocationLink(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error('이 기기에서는 위치 기능을 사용할 수 없습니다.'));
    navigator.geolocation.getCurrentPosition(pos=>{
      const lat=pos.coords.latitude.toFixed(6);
      const lng=pos.coords.longitude.toFixed(6);
      resolve(`https://maps.google.com/?q=${lat},${lng}`);
    }, err=>{
      reject(new Error(err && err.message ? err.message : '현재 위치를 가져오지 못했습니다.'));
    }, {enableHighAccuracy:true, timeout:12000, maximumAge:30000});
  });
}
function askEta(defaultMin='10'){
  const v=prompt('도착 예정 시간을 입력하세요. 예: 5, 10, 20, 30', defaultMin);
  if(v===null) return null;
  const text=String(v).trim().replace(/분/g,'');
  if(!text) return defaultMin;
  return text;
}
function buildQuickMessage(type, village, locationLink, eta){
  const villageName=`${village.eup} ${village.village}`.trim();
  if(type==='depart') return `안녕하세요.\n삼진항공방제단입니다.\n\n현재 ${villageName}으로 이동 중입니다.\n약 ${eta}분 후 도착 예정입니다.\n\n현재 위치\n${locationLink}`;
  if(type==='location') return `안녕하세요.\n삼진항공방제단입니다.\n\n현재 위치입니다.\n${locationLink}`;
  if(type==='eta10') return `안녕하세요.\n삼진항공방제단입니다.\n\n현재 ${villageName}으로 이동 중입니다.\n약 10분 후 도착 예정입니다.\n\n현재 위치\n${locationLink}`;
  if(type==='working') return `안녕하세요.\n삼진항공방제단입니다.\n\n현재 방제 작업 중입니다.\n작업이 끝나는 대로 ${villageName}으로 이동하겠습니다.\n\n현재 위치\n${locationLink}`;
  if(type==='start') return `안녕하세요.\n삼진항공방제단입니다.\n\n${villageName} 방제를 시작하였습니다.\n감사합니다.`;
  if(type==='done') return `안녕하세요.\n삼진항공방제단입니다.\n\n${villageName} 방제가 완료되었습니다.\n감사합니다.`;
  if(type==='rain') return `안녕하세요.\n삼진항공방제단입니다.\n\n현재 우천으로 인해 작업이 지연되고 있습니다.\n기상 상황을 확인 후 다시 연락드리겠습니다.`;
  if(type==='call') return `안녕하세요.\n삼진항공방제단입니다.\n\n문의사항이 있어 연락 부탁드립니다.`;
  return '';
}
async function sendQuickMessage(type){
  const v=villages.find(x=>x.id===selectedVillageId);
  if(!v) return alert('마을을 다시 선택하세요.');
  const phone=cleanPhone(v.phone);
  if(!phone) return alert('이장님 연락처가 없습니다.');
  let eta='';
  if(type==='depart'){
    eta=askEta('10');
    if(eta===null) return;
  }
  const needsLocation=['depart','location','eta10','working'].includes(type);
  let link='';
  try{
    if(needsLocation){
      setQuickMessageStatus('현재 위치를 가져오는 중입니다...');
      link=await getCurrentLocationLink();
    }
    const message=buildQuickMessage(type, v, link, eta);
    if(!message) return alert('메시지를 만들지 못했습니다.');
    try{ await navigator.clipboard.writeText(message); setQuickMessageStatus('문자 내용이 클립보드에 복사되었습니다. 문자 앱에서 전송 버튼만 누르세요.'); }catch(e){ setQuickMessageStatus('문자 앱을 여는 중입니다.'); }
    const smsUrl=`sms:${phone}?body=${encodeURIComponent(message)}`;
    window.location.href=smsUrl;
  }catch(err){
    setQuickMessageStatus('');
    alert('위치 공유 메시지를 만들지 못했습니다. 위치 권한을 허용했는지 확인하세요.\n'+(err.message||err));
  }
}

function cleanHeader(h){ return String(h||'').trim().replace(/\s+/g,''); }
function pick(row, names){ for(const n of names){ if(row[n]!==undefined && row[n]!==null && String(row[n]).trim()!=='') return String(row[n]).trim(); } return ''; }
function normalizeVillageRow(row){ const m={}; Object.keys(row).forEach(k=>m[cleanHeader(k)]=row[k]); const eup=pick(m,['읍면','면','지역','행정구역']); const village=pick(m,['마을명','마을','리','동리','법정리']); const chief=pick(m,['이장명','이장님','이장','성명','이름']); const phone=pick(m,['연락처','이장연락처','전화번호','휴대폰','핸드폰']); if(!eup||!village||!chief||!phone) return null; return {eup, village, chief, phone}; }
function parseCsv(text){ const rows=[]; let row=[], cell='', q=false; for(let i=0;i<text.length;i++){ const c=text[i], n=text[i+1]; if(c==='"'){ if(q&&n==='"'){cell+='"';i++;} else q=!q; } else if((c===','||c==='\t')&&!q){ row.push(cell); cell=''; } else if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&n==='\n') i++; row.push(cell); if(row.some(x=>String(x).trim()!=='')) rows.push(row); row=[]; cell=''; } else cell+=c; } row.push(cell); if(row.some(x=>String(x).trim()!=='')) rows.push(row); if(!rows.length) return []; const headers=rows.shift().map(cleanHeader); return rows.map(r=>{ const o={}; headers.forEach((h,i)=>o[h]=r[i]||''); return o; }); }
function rowsFromWorkbook(wb){ const sheet=wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(sheet,{defval:''}); }
function readVillageFile(file){ return new Promise((resolve,reject)=>{ const ext=file.name.split('.').pop().toLowerCase(); const reader=new FileReader(); reader.onerror=()=>reject(new Error('파일을 읽을 수 없습니다.')); if(['xlsx','xls'].includes(ext)){ reader.onload=e=>{ try{ if(typeof XLSX==='undefined') throw new Error('엑셀 파일을 읽는 라이브러리를 불러오지 못했습니다. 인터넷 연결이 안 되면 CSV로 저장 후 업로드해 주세요.'); const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'}); resolve(rowsFromWorkbook(wb)); }catch(err){ reject(err); } }; reader.readAsArrayBuffer(file); } else { reader.onload=e=>{ try{ resolve(parseCsv(e.target.result)); }catch(err){ reject(err); } }; reader.readAsText(file,'utf-8'); } }); }
async function importVillageFile(){ try{ const input=$('villageFileInput'); const file=input.files && input.files[0]; if(!file) return alert('업로드할 파일을 선택하세요.'); $('importStatus').textContent='파일을 읽는 중입니다...'; const raw=await readVillageFile(file); const rows=raw.map(normalizeVillageRow).filter(Boolean); if(!rows.length){ $('importStatus').textContent='등록 가능한 행이 없습니다. 양식의 열 이름을 확인하세요.'; return alert('등록 가능한 행이 없습니다. 열 이름은 읍면, 마을명, 이장명, 연락처를 사용해 주세요.'); }
    const overwrite=$('overwriteVillageCheck').checked; let added=0, updated=0, skipped=0; rows.forEach(row=>{ const idx=villages.findIndex(v=>norm(v.eup)===norm(row.eup)&&norm(v.village)===norm(row.village)); if(idx>=0){ if(overwrite){ changeChief(villages[idx], row.chief, row.phone, '엑셀 업로드'); updated++; } else skipped++; } else { villages.push(migrateVillage({id:uid(),eup:row.eup,village:row.village,chief:row.chief,phone:row.phone})); added++; } }); const hist={at:now(), user:currentUser?currentUser.name:'-', file:file.name, total:rows.length, added, updated, skipped}; uploadHistory.unshift(hist); save('villages',villages); save('uploadHistory',uploadHistory); input.value=''; $('importStatus').textContent=`업로드 완료: 신규 ${added}건, 수정 ${updated}건, 건너뜀 ${skipped}건`; renderContact(); renderAdmin(); alert(`이장 리스트 업로드 완료\n신규 ${added}건 / 수정 ${updated}건 / 건너뜀 ${skipped}건`); }catch(err){ console.error(err); $('importStatus').textContent='업로드 오류: '+err.message; alert('업로드 중 오류가 발생했습니다. '+err.message); } }
function csvCell(v){ const s=String(v??''); return /[",\n\t]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function downloadCsv(filename, rows){ const csv=rows.map(r=>r.map(csvCell).join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},0); }
function downloadVillageTemplate(){ downloadCsv('이장리스트_업로드양식.csv', [['읍면','마을명','이장명','연락처'], ['진북면','이목마을','홍길동','010-0000-0000']]); }
function exportVillages(){ const rows=[['읍면','마을명','이장명','연락처','등록ID']].concat(villages.map(v=>[v.eup,v.village,v.chief,v.phone,v.id])); downloadCsv('현재_이장리스트.csv', rows); }
function renderUploadHistory(){ const el=$('uploadHistoryTable'); if(!el) return; el.innerHTML=`<table><thead><tr><th>업로드 일시</th><th>업로드 관리자</th><th>파일명</th><th>총 행</th><th>신규</th><th>수정</th><th>건너뜀</th></tr></thead><tbody>${uploadHistory.map(h=>`<tr><td>${safe(h.at)}</td><td>${safe(h.user)}</td><td>${safe(h.file)}</td><td>${safe(h.total)}</td><td>${safe(h.added)}</td><td>${safe(h.updated)}</td><td>${safe(h.skipped)}</td></tr>`).join('')||'<tr><td colspan="7">아직 업로드 이력이 없습니다.</td></tr>'}</tbody></table>`; }


function renderYearManager(){
  const sel=$('activeYearSelect'); if(!sel) return;
  years=[...new Set(years.map(String))].sort((a,b)=>Number(b)-Number(a));
  sel.innerHTML=years.map(y=>`<option value="${safe(y)}" ${String(y)===String(activeYear)?'selected':''}>${safe(y)}년</option>`).join('');
  const st=$('yearManageStatus'); if(st) st.textContent=`현재 운영 연도: ${activeYear}년 · 차수 ${roundOrder.length}개 · 마을 ${villages.length}개`;
}
function changeActiveYear(){
  const y=$('activeYearSelect').value;
  if(!y || y===activeYear) return;
  activeYear=String(y); syncYearContext(); villages=villages.map(migrateVillage); selectedRound=''; selectedTown='';
  save('activeYear',activeYear); save('selectedRound',''); save('selectedTown',''); persistAll(); render();
}
function createNewYear(){
  const base=String(activeYear);
  const y=prompt('새로 만들 연도를 입력하세요.', String(Number(base)+1));
  if(!y) return;
  const yy=String(y).replace(/[^0-9]/g,'');
  if(!/^20\d{2}$/.test(yy)) return alert('연도는 2027처럼 4자리 숫자로 입력하세요.');
  if(years.includes(yy)) return alert('이미 있는 연도입니다.');
  if(!confirm(`${base}년의 이장 리스트와 차수명을 ${yy}년으로 복사하고, 연락완료/특이사항은 모두 초기화할까요?`)) return;
  years.push(yy);
  roundOrderByYear[yy]=(roundOrderByYear[base]||roundOrder||defaultRoundOrder).slice();
  visibleRoundsByYear[yy]=(visibleRoundsByYear[base]||visibleRounds||roundOrderByYear[yy]).slice();
  villages.forEach(v=>{ if(!v.roundsByYear) v.roundsByYear={}; v.roundsByYear[yy]={}; roundOrderByYear[yy].forEach(r=>v.roundsByYear[yy][r]=blank()); });
  activeYear=yy; syncYearContext(); villages=villages.map(migrateVillage); selectedRound=''; selectedTown=''; persistAll(); render(); alert(`${yy}년이 생성되었습니다. 이장 정보는 유지되고 연락기록은 초기화되었습니다.`);
}
function renderRoundManager(){
  const el=$('roundManageTable'); if(!el) return;
  el.innerHTML=`<table><thead><tr><th>순서</th><th>차수/구역명</th><th>공개</th><th>기록</th><th>관리</th></tr></thead><tbody>${roundOrder.map((r,i)=>{ const count=villages.filter(v=>contactEntries(rec(v,r)).length || rec(v,r).note || (rec(v,r).history||[]).length).length; return `<tr><td>${i+1}</td><td><strong>${safe(r)}</strong></td><td>${visibleRounds.includes(r)?'공개':'숨김'}</td><td>${count}개 마을</td><td><button class="mini secondary" data-round-up="${i}">↑</button> <button class="mini secondary" data-round-down="${i}">↓</button> <button class="mini secondary" data-round-rename="${safe(r)}">이름변경</button> <button class="mini danger" data-round-delete="${safe(r)}">삭제</button></td></tr>`; }).join('')||'<tr><td colspan="5">등록된 차수가 없습니다.</td></tr>'}</tbody></table>`;
}
function addRound(){
  const input=$('newRoundName'); const name=(input?input.value:'').trim();
  if(!name) return alert('추가할 차수/구역명을 입력하세요.');
  if(roundOrder.includes(name)) return alert('이미 같은 이름이 있습니다.');
  roundOrder.push(name); visibleRounds.push(name); roundOrderByYear[activeYear]=roundOrder; visibleRoundsByYear[activeYear]=visibleRounds;
  villages.forEach(v=>rec(v,name)); persistAll(); if(input) input.value=''; renderContact(); renderAdmin(); alert('추가되었습니다.');
}
function handleRoundManageClick(e){
  const up=e.target.closest('[data-round-up]'); const down=e.target.closest('[data-round-down]'); const ren=e.target.closest('[data-round-rename]'); const del=e.target.closest('[data-round-delete]');
  if(up) return moveRound(Number(up.dataset.roundUp), -1);
  if(down) return moveRound(Number(down.dataset.roundDown), 1);
  if(ren) return renameRound(ren.dataset.roundRename);
  if(del) return deleteRound(del.dataset.roundDelete);
}
function moveRound(i, dir){
  const j=i+dir; if(j<0 || j>=roundOrder.length) return;
  [roundOrder[i], roundOrder[j]]=[roundOrder[j], roundOrder[i]]; roundOrderByYear[activeYear]=roundOrder; persistAll(); renderContact(); renderAdmin();
}
function renameRound(oldName){
  const newName=prompt('새 차수/구역명을 입력하세요.', oldName);
  if(!newName || newName.trim()===oldName) return;
  const name=newName.trim();
  if(roundOrder.includes(name)) return alert('이미 같은 이름이 있습니다.');
  roundOrder=roundOrder.map(r=>r===oldName?name:r); visibleRounds=visibleRounds.map(r=>r===oldName?name:r);
  villages.forEach(v=>{ if(!v.roundsByYear) v.roundsByYear={}; const ry=v.roundsByYear[activeYear]||{}; if(ry[oldName]){ ry[name]=ry[oldName]; delete ry[oldName]; } v.roundsByYear[activeYear]=ry; v.rounds=ry; });
  if(selectedRound===oldName) selectedRound=name;
  roundOrderByYear[activeYear]=roundOrder; visibleRoundsByYear[activeYear]=visibleRounds; persistAll(); renderContact(); renderAdmin(); alert('이름이 변경되었습니다.');
}
function deleteRound(name){
  const hasRecords=villages.some(v=>{ const r=rec(v,name); return contactEntries(r).length || r.note || (r.history||[]).length; });
  const msg=hasRecords ? `${name}에는 연락기록/특이사항이 있습니다. 정말 삭제할까요? 삭제하면 해당 차수 기록도 함께 삭제됩니다.` : `${name} 차수를 삭제할까요?`;
  if(!confirm(msg)) return;
  roundOrder=roundOrder.filter(r=>r!==name); visibleRounds=visibleRounds.filter(r=>r!==name);
  villages.forEach(v=>{ if(v.roundsByYear && v.roundsByYear[activeYear]) delete v.roundsByYear[activeYear][name]; });
  if(selectedRound===name){ selectedRound=''; selectedTown=''; }
  roundOrderByYear[activeYear]=roundOrder; visibleRoundsByYear[activeYear]=visibleRounds; persistAll(); renderContact(); renderAdmin(); alert('삭제되었습니다.');
}
function renderAdmin(){ if(!currentUser || currentUser.role!=='admin') return; syncYearContext(); renderYearManager(); renderRoundManager(); renderBriefingAdmin(); $('roundVisibilityList').innerHTML=roundOrder.map(r=>`<label><input type="checkbox" value="${safe(r)}" ${visibleRounds.includes(r)?'checked':''}> ${safe(r)}</label>`).join(''); $('roundVisibilityStatus').textContent=`${activeYear}년 현재 공개: `+(visible().join(', ')||'없음'); renderUploadHistory(); renderChiefChangeHistory(); renderVillageTable(); renderUserTable(); }
function saveRoundVisibility(){ visibleRounds=[...$('roundVisibilityList').querySelectorAll('input:checked')].map(x=>x.value); visibleRoundsByYear[activeYear]=visibleRounds; save('visibleRoundsByYear',visibleRoundsByYear); save('visibleRounds',visibleRounds); if(selectedRound&&!visible().includes(selectedRound)){selectedRound='';selectedTown='';save('selectedRound','');save('selectedTown','');} renderContact(); renderAdmin(); alert('저장되었습니다.'); }
function renderChiefChangeHistory(){ const el=$('chiefChangeHistoryTable'); if(!el) return; const logs=[]; villages.forEach(v=>(v.chiefHistory||[]).forEach(h=>logs.push({...h,eup:v.eup,village:v.village}))); logs.sort((a,b)=>String(b.at).localeCompare(String(a.at),'ko')); el.innerHTML=`<table><thead><tr><th>변경 일시</th><th>읍면</th><th>마을</th><th>변경 내용</th><th>처리자</th><th>출처</th></tr></thead><tbody>${logs.map(h=>`<tr><td>${safe(h.at)}</td><td>${safe(h.eup)}</td><td>${safe(h.village)}</td><td>${safe(h.oldChief||'-')} → ${safe(h.newChief||'-')}<br><span class="muted">${safe(h.oldPhone||'-')} → ${safe(h.newPhone||'-')}</span></td><td>${safe(h.user)}</td><td>${safe(h.source||'-')}</td></tr>`).join('')||'<tr><td colspan="6">아직 이장 변경 이력이 없습니다.</td></tr>'}</tbody></table>`; }
function renderVillageTable(){ $('villageTable').innerHTML=`<table><thead><tr><th>읍면</th><th>마을</th><th>이장님</th><th>연락처</th><th>연락자</th><th>관리</th></tr></thead><tbody>${villages.map(v=>`<tr><td>${safe(v.eup)}</td><td>${safe(v.village)}</td><td>${safe(v.chief)}</td><td>${safe(v.phone)}</td><td>${roundOrder.map(r=>`${r}: ${contactNames(rec(v,r))||'-'}`).join('<br>')}</td><td><button class="mini secondary" data-edit-village="${safe(v.id)}">수정</button> <button class="mini danger" data-delete-village="${safe(v.id)}">삭제</button></td></tr>`).join('')||'<tr><td colspan="6">등록된 마을이 없습니다.</td></tr>'}</tbody></table>`; }
function saveVillage(){ const eup=$('adminEup').value.trim(), village=$('adminVillage').value.trim(), chief=$('adminChief').value.trim(), phone=$('adminPhone').value.trim(); if(!eup||!village||!chief||!phone) return alert('읍면, 마을명, 이장님 성함, 연락처를 입력하세요.'); if(editingVillageId){ const v=villages.find(x=>x.id===editingVillageId); v.eup=eup; v.village=village; changeChief(v, chief, phone, '관리자 직접 수정'); } else villages.push(migrateVillage({id:uid(),eup,village,chief,phone})); save('villages',villages); clearVillageForm(); renderContact(); renderAdmin(); alert('저장되었습니다.'); }
function editVillage(id){ const v=villages.find(x=>x.id===id); if(!v) return; editingVillageId=id; $('adminEup').value=v.eup; $('adminVillage').value=v.village; $('adminChief').value=v.chief; $('adminPhone').value=v.phone; window.scrollTo({top:0,behavior:'smooth'}); }
function deleteVillage(id){ const v=villages.find(x=>x.id===id); if(v&&confirm(`${v.eup} ${v.village}을 삭제할까요?`)){ villages=villages.filter(x=>x.id!==id); save('villages',villages); renderContact(); renderAdmin(); } }
function clearVillageForm(){ editingVillageId=''; $('adminEup').value='진전면'; ['adminVillage','adminChief','adminPhone'].forEach(id=>$(id).value=''); }
function renderUserTable(){ $('userTable').innerHTML=`<table><thead><tr><th>이름</th><th>아이디</th><th>연락처</th><th>권한</th><th>관리</th></tr></thead><tbody>${users.map(u=>`<tr><td>${safe(u.name)}</td><td>${safe(u.id)}</td><td>${safe(u.phone||'-')}</td><td>${u.role==='admin'?'관리자':'방제사'}</td><td><button class="mini secondary" data-edit-user="${safe(u.id)}">수정</button> <button class="mini danger" data-delete-user="${safe(u.id)}" ${u.id==='admin'?'disabled':''}>삭제</button></td></tr>`).join('')}</tbody></table>`; }
function saveUser(){ const name=$('adminUserName').value.trim(), id=norm($('adminUserId').value), phone=$('adminUserPhone').value.trim(), password=$('adminUserPw').value.trim(), role=$('adminUserRole').value; if(!name||!id||!password) return alert('이름, 아이디, 비밀번호를 입력하세요.'); const dup=users.find(u=>norm(u.id)===id); if(editingUserId){ if(editingUserId!==id && dup) return alert('이미 사용 중인 아이디입니다.'); const u=users.find(x=>x.id===editingUserId); Object.assign(u,{id,name,phone,password,role}); if(currentUser.id===editingUserId){currentUser={id,name,phone,role};save('currentUser',currentUser);} } else { if(dup) return alert('이미 사용 중인 아이디입니다.'); users.push({id,name,phone,password,role}); } save('users',users); clearUserForm(); render(); alert('저장되었습니다.'); }
function editUser(id){ const u=users.find(x=>x.id===id); if(!u) return; editingUserId=id; $('adminUserName').value=u.name; $('adminUserId').value=u.id; $('adminUserPhone').value=u.phone||''; $('adminUserPw').value=u.password; $('adminUserRole').value=u.role; window.scrollTo({top:0,behavior:'smooth'}); }
function deleteUser(id){ if(id==='admin') return alert('기본 관리자는 삭제할 수 없습니다.'); const u=users.find(x=>x.id===id); if(u&&confirm(`${u.name} 계정을 삭제할까요?`)){ users=users.filter(x=>x.id!==id); save('users',users); renderAdmin(); } }
function clearUserForm(){ editingUserId=''; ['adminUserName','adminUserId','adminUserPhone','adminUserPw'].forEach(id=>$(id).value=''); $('adminUserRole').value='worker'; }


function defaultBriefing(){ return {notice:'■ 주변 양봉농가 여부를 반드시 확인하세요.\n■ 친환경 재배농가 및 민원 우려 지점을 확인하세요.\n■ 비닐하우스·특수작물·진입 곤란 구역을 확인하세요.', checklist:['주변 양봉농가 여부 확인','친환경 재배농가 여부 확인','비닐하우스·특수작물 여부 확인','드론 접근이 어려운 구역 확인','작업 예정 시간 안내'], script:'안녕하세요. 삼진항공방제단입니다.\n\n공동방제 관련하여 몇 가지 확인드리겠습니다.\n1. 주변에 양봉농가가 있습니까?\n2. 친환경 재배농가가 있습니까?\n3. 비닐하우스나 특수작물이 있습니까?\n4. 드론 진입이 어렵거나 특별히 주의할 곳이 있습니까?\n\n확인해주셔서 감사합니다.'}; }
function ensureBriefing(year=activeYear, round=activeRound()){ if(!briefings || typeof briefings!=='object') briefings={}; if(!briefings[year]) briefings[year]={}; if(!briefings[year][round]) briefings[year][round]=defaultBriefing(); if(!Array.isArray(briefings[year][round].checklist)){ briefings[year][round].checklist=String(briefings[year][round].checklist||'').split('\n').map(x=>x.trim()).filter(Boolean); } return briefings[year][round]; }
function briefingItems(b){ return Array.isArray(b.checklist)?b.checklist.map(x=>String(x).trim()).filter(Boolean):String(b.checklist||'').split('\n').map(x=>x.trim()).filter(Boolean); }
function renderContactBriefing(){ const el=$('contactBriefingBox'); if(!el) return; if(!selectedRound){ el.classList.add('hidden'); el.innerHTML=''; return; } const b=ensureBriefing(activeYear, selectedRound); const items=briefingItems(b); el.classList.remove('hidden'); el.innerHTML=`<div class="briefing-title">📋 오늘의 브리핑 · ${safe(activeYear)}년 ${safe(selectedRound)}</div>${b.notice?`<div class="briefing-notice">${safe(b.notice).replace(/\n/g,'<br>')}</div>`:''}${items.length?`<div class="briefing-checklist-preview">${items.map(x=>`<div>☐ ${safe(x)}</div>`).join('')}</div>`:''}${b.script?`<details class="briefing-script-preview"><summary>📞 전화 스크립트 보기</summary><pre>${safe(b.script)}</pre></details>`:''}`; }
function renderBriefingAdmin(){ const sel=$('briefingRoundSelect'); if(!sel) return; syncYearContext(); const prev=sel.value || activeRound(); sel.innerHTML=roundOrder.map(r=>`<option value="${safe(r)}">${safe(r)}</option>`).join(''); sel.value=roundOrder.includes(prev)?prev:(roundOrder[0]||''); loadBriefingForm(); }
function loadBriefingForm(){ const round=$('briefingRoundSelect') ? $('briefingRoundSelect').value : activeRound(); if(!round) return; const b=ensureBriefing(activeYear, round); if($('briefingNoticeInput')) $('briefingNoticeInput').value=b.notice||''; if($('briefingChecklistInput')) $('briefingChecklistInput').value=briefingItems(b).join('\n'); if($('briefingScriptInput')) $('briefingScriptInput').value=b.script||''; }
function saveBriefingForm(){ const round=$('briefingRoundSelect') ? $('briefingRoundSelect').value : activeRound(); if(!round) return alert('차수/구역을 먼저 선택하세요.'); const notice=$('briefingNoticeInput').value.trim(); const checklist=$('briefingChecklistInput').value.split('\n').map(x=>x.trim()).filter(Boolean); const script=$('briefingScriptInput').value.trim(); if(!briefings[activeYear]) briefings[activeYear]={}; briefings[activeYear][round]={notice, checklist, script}; save('briefings', briefings); renderContactBriefing(); alert('브리핑이 저장되었습니다.'); }
function renderDialogBriefing(v){ const box=$('dialogBriefingBox'); const scriptEl=$('dialogCallScriptText'); if(!box) return; const b=ensureBriefing(activeYear, selectedRound||activeRound()); const items=briefingItems(b); const r=rec(v); if(!r.checklistDone || typeof r.checklistDone!=='object' || Array.isArray(r.checklistDone)) r.checklistDone={...r.checklistDone}; box.innerHTML=`${b.notice?`<div class="briefing-notice">${safe(b.notice).replace(/\n/g,'<br>')}</div>`:''}${items.length?`<div class="dialog-checklist-title">필수 확인 체크리스트</div><div id="briefingChecklistBox">${items.map((x,i)=>`<label class="check-inline briefing-check-item"><input type="checkbox" data-checklist-index="${i}" ${r.checklistDone[i]?'checked':''}> ${safe(x)}</label>`).join('')}</div>`:''}`; if(scriptEl) scriptEl.textContent=b.script||''; box.querySelectorAll('[data-checklist-index]').forEach(input=>{ input.addEventListener('change', syncChecklistFromDialog); input.addEventListener('click', ()=>setTimeout(syncChecklistFromDialog,0)); }); updateCompleteButtonState(r); }
function syncChecklistFromDialog(){ const v=villages.find(x=>x.id===selectedVillageId); if(!v) return false; const r=rec(v); if(!r.checklistDone || typeof r.checklistDone!=='object' || Array.isArray(r.checklistDone)) r.checklistDone={}; document.querySelectorAll('#dialogBriefingBox [data-checklist-index]').forEach(input=>{ r.checklistDone[input.dataset.checklistIndex]=!!input.checked; }); save('villages', villages); updateCompleteButtonState(r); return isBriefingChecklistComplete(r); }
function handleChecklistClick(e){ const input=e && e.target && e.target.closest ? e.target.closest('[data-checklist-index]') : null; if(!input) return; setTimeout(syncChecklistFromDialog, 0); }
function isBriefingChecklistComplete(r){ const b=ensureBriefing(activeYear, selectedRound||activeRound()); const items=briefingItems(b); if(!items.length) return true; const done=r.checklistDone||{}; return items.every((_,i)=>done[i]===true || done[String(i)]===true); }
function updateCompleteButtonState(r){ const btn=$('completeBtn'); if(!btn) return; const ok=isBriefingChecklistComplete(r); if(ok){ btn.disabled=false; btn.removeAttribute('disabled'); btn.classList.remove('disabled'); btn.title=''; btn.textContent='✓ 연락 완료'; } else { btn.disabled=true; btn.setAttribute('disabled','disabled'); btn.classList.add('disabled'); btn.title='필수 확인 체크리스트를 모두 확인해야 연락완료가 가능합니다.'; btn.textContent='✓ 체크리스트 확인 필요'; } }

window.addEventListener('error', e=>{ $('errorBox').classList.remove('hidden'); $('errorBox').textContent='오류: '+(e.message||'알 수 없는 오류'); console.error(e.error||e.message); });
window.addEventListener('DOMContentLoaded', init);

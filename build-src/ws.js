/* ================= WORKSPACES ================= */
const SWATCHES=['#1e6b58','#2c6bc9','#b5452f','#7a4bb8','#b07a12','#1c8296','#a0436e','#4e6b1e'];
let WS=[];      // workspace list (metadata only)
let newFile=null;
const now=()=>Date.now();
const wsid=()=>'ws_'+now().toString(36)+Math.random().toString(36).slice(2,6);
async function loadWsList(){WS=(await idb.get('ws:list'))||[];return WS}
async function saveWsList(){await idb.set('ws:list',WS)}
function curWs(){return WS.find(w=>w.id===S.key)}
let metaT=0;
function touchMeta(patch){const w=curWs();if(!w)return;Object.assign(w,patch);clearTimeout(metaT);metaT=setTimeout(saveWsList,400)}

async function createWorkspace(name,file){
  const w={id:wsid(),name:(name||'').trim()||(file?file.name.replace(/\.pdf$/i,''):'Untitled workspace'),pdfName:'',pages:0,lastPage:1,
    clips:0,prTotal:0,prRight:0,created:now(),opened:now(),color:SWATCHES[WS.length%SWATCHES.length]};
  WS.unshift(w);await saveWsList();
  await openWorkspace(w.id);
  if(file)await attachPdf(file);
  return w}

function resetReader(){if(S.pdf){try{S.pdf.destroy()}catch(e){}}S.pdf=null;S.n=0;S.cur=1;
  if(io)io.disconnect();S.rendered.clear();pagesEl.innerHTML='';S.wraps=[null];
  $('pgIn').value='–';$('pgTot').textContent='/ –';$('empty').hidden=false;$('tocList').innerHTML='<p class="empty">Add a PDF to see its chapters.</p>';
  setClip(false)}

async function openWorkspace(id){
  await flushAll();
  const w=WS.find(x=>x.id===id);if(!w)return;
  resetReader();S.key=id;w.opened=now();saveWsList();ls.set('lastWs',id);
  $('wsName').textContent=w.name;$('wsName').title=w.name;document.title=w.name+' · PolyStudy';
  $('docName').textContent='';
  $('drop').querySelector('h1').textContent='Add your textbook to "'+w.name+'"';
  S.clips=(await idb.get('clips:'+id))||[];renderBoard();
  $('notes').value=(await idb.get('notes:'+id))||'';$('saved').textContent='';
  S.practice=(await idb.get('practice:'+id))||[];renderPractice();
  await loadChat();
  await loadDesmosState(id);
  hideHome();
  updateOpenLabel();
  const pdf=await idb.get('pdf:'+id);
  if(pdf&&pdf.data&&S.key===id)await loadDoc(pdf.data,pdf.name);
}
function updateOpenLabel(){const w=curWs();const l=$('openBtn').querySelector('.label');if(l)l.textContent=w&&w.pdfName?'Replace PDF':'Add PDF'}

async function attachPdf(f){if(!S.key){return createWorkspace('',f)}
  const buf=await f.arrayBuffer();const ok=await loadDoc(buf,f.name);if(!ok)return;
  await idb.set('pdf:'+S.key,{name:f.name,data:buf});
  touchMeta({pdfName:f.name,pages:S.n});updateOpenLabel();
  toast('Saved "'+f.name.replace(/\.pdf$/i,'')+'" in this workspace.')}

async function loadDoc(buf,name){
  let doc;
  try{doc=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise}
  catch(e){toast('Could not open that file. Use a PDF that is not password-protected.',4000);return false}
  if(S.pdf){try{S.pdf.destroy()}catch(e){}}
  S.pdf=doc;S.n=doc.numPages;S.name=name;
  $('docName').textContent=name.replace(/\.pdf$/i,'');$('docName').title=name;
  $('pgTot').textContent='/ '+S.n;$('empty').hidden=true;
  const vp=(await doc.getPage(1)).getViewport({scale:1});
  S.sizes=Array.from({length:S.n+1},()=>({w:vp.width,h:vp.height}));
  if(!ls.get('scale',null))S.scale=fitScale();
  updZoom();buildPages();buildOutline();
  const last=await idb.get('page:'+S.key);
  requestAnimationFrame(()=>{scrollToPage(last||1);onScroll()});
  return true}

/* ---- home screen ---- */
function showHome(){renderHome();$('home').hidden=false;$('homeBack').hidden=!S.key;setClip(false);setTimeout(()=>$('newName').focus(),30)}
function hideHome(){$('home').hidden=true}
function ago(t){const s=(now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';
  const d=Math.round(s/86400);return d===1?'yesterday':d<30?d+' days ago':new Date(t).toLocaleDateString()}
function renderHome(){const g=$('wsGrid');g.innerHTML='';
  const list=[...WS].sort((a,b)=>b.opened-a.opened);
  $('wsCount').textContent=list.length?list.length+(list.length===1?' workspace':' workspaces'):'';
  if(!list.length){g.innerHTML='<div class="ws-empty">No workspaces yet. Name one above and choose your textbook PDF to begin.</div>';return}
  list.forEach((w,i)=>{const c=document.createElement('article');c.className='ws-card'+(i===0?' recent':'');c.tabIndex=0;
    const pct=w.pages?Math.round(100*(w.lastPage||1)/w.pages):0;
    c.innerHTML='<div class="ws-top"><div class="ws-swatch"></div><div style="min-width:0;flex:1"><h3 class="ws-title"></h3><div class="ws-pdf"></div></div></div>'+
      '<div class="ws-prog" title="How far into the book you are"><span></span></div>'+
      '<div class="ws-stats"></div>'+
      '<div class="ws-foot"><span class="when"></span><button class="btn act-rename">Rename</button><button class="btn danger act-del">Delete</button></div>';
    if(i===0){const t=document.createElement('span');t.className='ws-tag';t.textContent='Continue';c.append(t)}
    c.querySelector('.ws-swatch').style.background=w.color||SWATCHES[0];c.querySelector('.ws-swatch').textContent=(w.name.trim()[0]||'?').toUpperCase();
    c.querySelector('.ws-title').textContent=w.name;
    c.querySelector('.ws-pdf').textContent=w.pdfName?w.pdfName.replace(/\.pdf$/i,''):'No PDF yet';
    c.querySelector('.ws-prog span').style.width=pct+'%';
    c.querySelector('.ws-stats').innerHTML=(w.pages?'<span>p. '+(w.lastPage||1)+' / '+w.pages+'</span>':'')+'<span>'+(w.clips||0)+' clips</span><span>'+(w.prRight||0)+'/'+(w.prTotal||0)+' practice</span>';
    c.querySelector('.when').textContent='Opened '+ago(w.opened);
    c.onclick=e=>{if(e.target.closest('.ws-foot')||e.target.closest('input'))return;openWorkspace(w.id)};
    c.onkeydown=e=>{if(e.key==='Enter'&&e.target===c)openWorkspace(w.id)};
    c.querySelector('.act-rename').onclick=()=>{const h=c.querySelector('.ws-title');const inp=document.createElement('input');inp.className='ws-rename';inp.value=w.name;inp.maxLength=60;h.replaceWith(inp);inp.focus();inp.select();
      const done=async save=>{if(save&&inp.value.trim()){w.name=inp.value.trim();await saveWsList();if(S.key===w.id){$('wsName').textContent=w.name;document.title=w.name+' · PolyStudy'}}renderHome()};
      inp.onkeydown=e=>{if(e.key==='Enter')done(true);if(e.key==='Escape')done(false)};inp.onblur=()=>done(true)};
    c.querySelector('.act-del').onclick=()=>{const f=c.querySelector('.ws-foot');f.innerHTML='<span class="when" style="color:var(--danger)">Delete this workspace and everything in it?</span><button class="btn act-no">Keep</button><button class="btn danger act-yes">Delete</button>';
      f.querySelector('.act-no').onclick=()=>renderHome();
      f.querySelector('.act-yes').onclick=async()=>{WS=WS.filter(x=>x.id!==w.id);await saveWsList();
        for(const k of ['pdf','clips','notes','chat','page','practice','desmos'])await idb.del(k+':'+w.id);
        if(S.key===w.id){S.key=null;resetReader();S.clips=[];S.practice=[];renderBoard();renderPractice();$('notes').value='';TU.turns=[];renderChat();$('wsName').textContent='';$('homeBack').hidden=true}
        renderHome();toast('Workspace deleted')}};
    g.append(c)})}
$('homeBtn').onclick=showHome;
$('homeBack').onclick=hideHome;
$('homeSettings').onclick=openSettings;
$('newPick').onclick=()=>$('newFileIn').click();
$('newFileIn').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;newFile=f;$('newFile').textContent='PDF: '+f.name;$('newFile').classList.add('has');
  if(!$('newName').value.trim())$('newName').value=f.name.replace(/\.pdf$/i,'').slice(0,60)};
async function createFromForm(){const name=$('newName').value.trim();if(!name&&!newFile){$('newName').focus();toast('Give the workspace a name or choose a PDF.');return}
  const f=newFile;newFile=null;$('newName').value='';$('newFile').textContent='No PDF chosen yet. You can add one later.';$('newFile').classList.remove('has');
  await createWorkspace(name,f)}
$('newCreate').onclick=createFromForm;
$('newName').addEventListener('keydown',e=>{if(e.key==='Enter')createFromForm()});

/* migrate the single book saved by earlier versions into a workspace */
async function migrateLegacy(){
  if(await idb.get('ws:list'))return;
  const old=await idb.get('lastPdf');
  if(!old||!old.data){await idb.set('ws:list',[]);return}
  const w={id:wsid(),name:old.name.replace(/\.pdf$/i,''),pdfName:old.name,pages:0,lastPage:1,clips:0,prTotal:0,prRight:0,created:now(),opened:now(),color:SWATCHES[0]};
  try{const doc=await pdfjsLib.getDocument({data:new Uint8Array(old.data.slice(0))}).promise;w.pages=doc.numPages;
    const oldKey=old.name+'|'+doc.numPages+'|'+old.data.byteLength;doc.destroy();
    for(const k of ['clips','notes','chat','page']){const v=await idb.get(k+':'+oldKey);if(v!==undefined)await idb.set(k+':'+w.id,v)}
    const cl=await idb.get('clips:'+w.id);w.clips=cl?cl.length:0;w.lastPage=(await idb.get('page:'+w.id))||1;
  }catch(e){}
  await idb.set('pdf:'+w.id,{name:old.name,data:old.data});
  const st=ls.get('desmos',null);if(st)await idb.set('desmos:'+w.id,st);
  WS=[w];await saveWsList();await idb.del('lastPdf')}

/* ================= PRACTICE ================= */
S.practice=[];let prFilter='all',prT=0;
const PR_STATUS={todo:'To do',tried:'Tried',review:'Needs review',right:'Got it'};
function savePractice(){clearTimeout(prT);const key=S.key,list=S.practice;prT=setTimeout(()=>{if(key)idb.set('practice:'+key,list.map(q=>{const o={...q};delete o.busy;return o}))},400);
  if(S.key===key)touchMeta({prTotal:S.practice.length,prRight:S.practice.filter(q=>q.status==='right').length})}
function prProgress(){const t=S.practice.length,r=S.practice.filter(q=>q.status==='right').length;
  $('prBar').style.width=(t?100*r/t:0)+'%';$('prCount').textContent=t?r+' of '+t+' got it':'No questions yet'}
function addPractice(q){S.practice.unshift(Object.assign({id:'q_'+now().toString(36)+Math.random().toString(36).slice(2,5),title:'',page:S.pdf?S.cur:null,text:'',img:null,answer:'',status:'todo',feedback:'',verdict:'',created:now()},q));
  prFilter='all';document.querySelectorAll('.pr-filter button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f==='all'));
  savePractice();renderPractice();
  if(mobile())app.classList.add('board-open');else app.classList.remove('board-hidden');showTab('practice');$('prList').scrollTop=0}
function renderPractice(){const box=$('prList');box.innerHTML='';prProgress();
  const list=S.practice.filter(q=>prFilter==='all'||(prFilter==='todo'?(q.status==='todo'||q.status==='tried'):q.status===prFilter));
  if(!S.practice.length){box.innerHTML='<div class="board-empty"><div class="ghost">§2.3 · Problem 12</div>Keep the textbook\'s practice problems here, separate from your clips and notes. <b>Clip a question</b> straight from the page (or press <b>Q</b>), write your answer under it, then ask for a hint or a check.</div>';return}
  if(!list.length){box.innerHTML='<div class="board-empty">Nothing in this filter.</div>';return}
  list.forEach(q=>box.append(practiceCard(q)))}
function practiceCard(q){const el=document.createElement('article');el.className='pq';el.dataset.status=q.status;el.dataset.id=q.id;
  el.innerHTML='<header><input aria-label="Question name" placeholder="Name it, e.g. 2.3 #12"><select aria-label="Status"></select>'+
    (q.page?'<button class="pref q-src" title="Show it in the book">p. '+q.page+' →</button>':'')+'<button class="x" aria-label="Delete question" title="Delete">×</button></header>'+
    (q.img?'<div class="q-img"><img alt=""></div>':'<textarea class="q-text" rows="2" placeholder="Type or paste the question…"></textarea>')+
    '<div class="q-lab">Your answer</div><textarea class="q-ans" rows="3" placeholder="Work it out here. Plain text is fine: d/dx x^3 = 3x^2"></textarea>'+
    '<div class="q-acts"><button class="btn solid q-check">Check my answer</button><button class="btn q-hint">Hint</button><button class="btn q-tutor" title="Discuss it in the Tutor tab">Ask tutor</button></div>'+
    '<div class="q-fb" hidden></div>';
  const ti=el.querySelector('header input');ti.value=q.title;ti.id='pqt-'+q.id;ti.oninput=()=>{q.title=ti.value;savePractice()};
  const sel=el.querySelector('select');sel.id='pqs-'+q.id;for(const k in PR_STATUS){const o=document.createElement('option');o.value=k;o.textContent=PR_STATUS[k];sel.append(o)}
  sel.value=q.status;sel.onchange=()=>{q.status=sel.value;el.dataset.status=q.status;savePractice();prProgress()};
  const src=el.querySelector('.q-src');if(src)src.onclick=()=>{if(q.rect)jumpTo({page:q.page,rect:q.rect});else scrollToPage(q.page)};
  el.querySelector('.x').onclick=()=>{const f=el.querySelector('.q-acts');f.innerHTML='<span style="flex:1;font-size:12.5px;color:var(--danger);align-self:center">Delete this question and your answer?</span><button class="btn q-keep">Keep</button><button class="btn q-del" style="color:var(--danger)">Delete</button>';
    f.querySelector('.q-keep').onclick=()=>renderPractice();f.querySelector('.q-del').onclick=()=>{S.practice=S.practice.filter(x=>x!==q);savePractice();renderPractice()}};
  if(q.img){const im=el.querySelector('.q-img img');im.src=q.img;if(q.w)im.style.width=Math.round(q.w*1.3)+'px';
    el.querySelector('.q-img').onclick=()=>openLb({img:q.img,w:q.w||300,label:q.title||'Practice question',page:q.page,rect:q.rect})}
  else{const qt=el.querySelector('.q-text');qt.id='pqq-'+q.id;qt.value=q.text;qt.oninput=()=>{q.text=qt.value;savePractice()}}
  const ans=el.querySelector('.q-ans');ans.id='pqa-'+q.id;ans.value=q.answer;
  ans.oninput=()=>{q.answer=ans.value;if(q.status==='todo'&&ans.value.trim()){q.status='tried';sel.value='tried';el.dataset.status='tried';prProgress()}savePractice()};
  el.querySelector('.q-check').onclick=()=>practiceAI(q,'check',el);
  el.querySelector('.q-hint').onclick=()=>practiceAI(q,'hint',el);
  el.querySelector('.q-tutor').onclick=()=>practiceToTutor(q);
  showFeedback(q,el);
  if(q.busy){el.querySelectorAll('.q-acts .btn').forEach(b=>b.disabled=true)}
  return el}
function showFeedback(q,el){const fb=el.querySelector('.q-fb');if(!q.feedback&&!q.busy){fb.hidden=true;return}fb.hidden=false;
  const cls={correct:'right','partly correct':'partly',incorrect:'wrong',hint:'hint','no answer':'partly'}[q.verdict]||'';
  const lab={correct:'Correct','partly correct':'Partly correct',incorrect:'Not quite',hint:'Hint','no answer':'No answer yet'}[q.verdict]||'';
  fb.innerHTML=(lab?'<span class="verdict '+cls+'">'+lab+'</span>':'')+(q.busy&&!q.feedback?'<div class="thinking">Thinking</div>':mdLite(q.feedback));
  if(!q.busy)typeset(fb)}
async function practiceAI(q,mode,el){
  if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings first.');openSettings();return}
  if(mode==='check'&&!q.answer.trim()){toast('Write your answer first, then check it.');el.querySelector('.q-ans').focus();return}
  if(!q.img&&!q.text.trim()){toast('Add the question first.');return}
  q.busy=true;q.feedback='';q.verdict=mode==='hint'?'hint':'';el.querySelectorAll('.q-acts .btn').forEach(b=>b.disabled=true);showFeedback(q,el);
  const content=[];
  if(q.img){const b=b64Blob(q.img);content.push({type:'image',source:{type:'base64',media_type:b.type==='image/png'?'image/png':'image/jpeg',data:q.img.split(',')[1]}})}
  const instr=mode==='check'?
    'Check the student\'s answer. Your reply must start with exactly one line: "VERDICT: correct", "VERDICT: partly correct", "VERDICT: incorrect" or "VERDICT: no answer". Then, in under 120 words: if it is correct, confirm briefly and mention anything to tighten up. If not, point to the first mistake and give a hint to fix it, but do not give the corrected final answer. Verify the math carefully before judging.':
    'Give one short hint for the next step without solving the problem or revealing the answer. Build on the student\'s work so far if there is any. Under 80 words.';
  content.push({type:'text',text:'Practice problem'+(q.title?' "'+q.title+'"':'')+' from "'+(S.name||'the textbook')+'"'+(q.page?', page '+q.page:'')+'.\n'+
    (q.img?'The problem is in the attached image.':'Problem: '+q.text)+'\n\nStudent\'s answer and work so far:\n'+(q.answer.trim()||'(nothing yet)')+'\n\n'+instr});
  const system='You are a patient, rigorous math tutor inside a textbook study app. You help the student learn rather than handing over answers. Write math in LaTeX: $...$ inline, $$...$$ display. Plain paragraphs only, no headings.';
  let acc='';
  const live=()=>{const card=$('prList').querySelector('[data-id="'+q.id+'"]');return card||el};
  try{const {promise}=window.desk.claudeStart({system,messages:[{role:'user',content}]},d=>{acc+=d;const shown=acc.replace(/^\s*VERDICT:[^\n]*\n?/i,'');q.feedback=shown;showFeedback(q,live())});
    const res=await promise;
    if(res.error){q.feedback='';toast(ERRS[res.error.code]||res.error.message,5000)}
    else{const m=acc.match(/^\s*VERDICT:\s*(correct|partly correct|incorrect|no answer)/i);
      if(mode==='check'){q.verdict=m?m[1].toLowerCase():'';
        if(q.verdict==='correct')q.status='right';else if(q.verdict==='incorrect'||q.verdict==='partly correct')q.status='review'}
      q.feedback=acc.replace(/^\s*VERDICT:[^\n]*\n?/i,'').trim()}}
  catch(e){toast('The tutor could not be reached. Try again.')}
  finally{q.busy=false;savePractice();renderPractice()}}
async function practiceToTutor(q){if(mobile())app.classList.add('board-open');showTab('tutor');if(!SET.hasAnthropicKey)return;
  if(q.img){if(imgCount()>=MAX_IMGS)return toast('That is the most images for one message.');const blob=b64Blob(q.img);
    TU.atts.push({blob,type:blob.type,desc:'a practice question from textbook page '+(q.page||'?')+(q.title?' ("'+q.title+'")':''),label:q.title||'Question',thumb:await thumbOf(blob)});renderAtts()}
  const it=document.querySelector('.intents button[data-intent="check"]');if(q.answer.trim()&&it)it.click();
  $('ask').value=(q.img?'':'Question: '+q.text+'\n')+(q.answer.trim()?'My answer: '+q.answer.trim():'Can you help me start this one?');autoGrow();$('ask').focus()}
$('prClip').onclick=()=>{if(!S.pdf)return toast('Add a PDF to this workspace first.');setClip(true,'practice')};
$('prType').onclick=()=>{addPractice({title:'',img:null});setTimeout(()=>{const t=$('prList').querySelector('.q-text');t&&t.focus()},50)};
document.querySelectorAll('.pr-filter button').forEach(b=>b.onclick=()=>{prFilter=b.dataset.f;document.querySelectorAll('.pr-filter button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderPractice()});

/* ---- save everything (used before switching workspaces and when the window closes) ---- */
async function flushAll(){if(!S.key)return;const id=S.key;
  const jobs=[idb.set('notes:'+id,$('notes').value),idb.set('clips:'+id,S.clips),
    idb.set('practice:'+id,S.practice.map(q=>{const o={...q};delete o.busy;return o})),saveWsList()];
  if(S.pdf)jobs.push(idb.set('page:'+id,S.cur));
  if(calc){try{jobs.push(idb.set('desmos:'+id,calc.getState()))}catch(e){}}
  clearTimeout(noteT);clearTimeout(prT);await Promise.all(jobs)}
try{window.desk.onFlush(flushAll)}catch(e){}


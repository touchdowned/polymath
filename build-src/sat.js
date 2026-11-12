/* ================= SAT PRACTICE ================= */
const SAT={list:[],id:null,data:null,test:null,calc:null,states:{},reviewMode:false,timerIv:null};
const DOMAINS=['Algebra','Advanced Math','Problem-Solving and Data Analysis','Geometry and Trigonometry'];
const SEC_PER_Q=35*60/22;   // digital SAT math pace
async function satLoadList(){SAT.list=(await idb.get('sat:list'))||[]}
async function satSaveList(){await idb.set('sat:list',SAT.list)}
function satMeta(){return SAT.list.find(s=>s.id===SAT.id)}
let satSaveT=0;
function satSave(){clearTimeout(satSaveT);const id=SAT.id,data=SAT.data;satSaveT=setTimeout(()=>{if(id&&data)idb.set('sat:'+id,data)},300);
  const m=satMeta();if(m&&SAT.data){const st=satStats();Object.assign(m,{count:SAT.data.questions.length,tried:st.tried,right:st.right,tests:SAT.data.history.length});satSaveList()}}
function satStats(){const qs=SAT.data?SAT.data.questions:[];let tried=0,right=0;
  for(const q of qs){if(q.attempts&&q.attempts.length){tried++;if(q.attempts[q.attempts.length-1].ok)right++}}
  return{tried,right,keyed:qs.filter(q=>q.answer).length}}

/* ---- home cards ---- */
function renderSatHome(){const g=$('satGrid');if(!g)return;g.innerHTML='';
  $('satCount').textContent=SAT.list.length?SAT.list.length+(SAT.list.length===1?' set':' sets'):'';
  const add=document.createElement('article');add.className='ws-card sat-add';add.tabIndex=0;
  add.innerHTML='<div class="sat-add-plus">+</div><div><h3 class="ws-title">Add SAT math PDF</h3><div class="ws-pdf">Question bank exports or practice tests. Questions and answers are read on your computer.</div></div>';
  add.onclick=()=>$('satFile').click();add.onkeydown=e=>{if(e.key==='Enter')$('satFile').click()};g.append(add);
  [...SAT.list].sort((a,b)=>(b.opened||0)-(a.opened||0)).forEach(s=>{const c=document.createElement('article');c.className='ws-card';c.tabIndex=0;
    const acc=s.tried?Math.round(100*s.right/s.tried):null;
    c.innerHTML='<div class="ws-top"><div class="ws-swatch sat-sw">SAT</div><div style="min-width:0;flex:1"><h3 class="ws-title"></h3><div class="ws-pdf"></div></div></div>'+
      '<div class="ws-prog"><span></span></div><div class="ws-stats"></div><div class="ws-foot"><span class="when"></span><button class="btn solid act-go">Practice</button></div>';
    c.querySelector('.ws-title').textContent=s.name;c.querySelector('.ws-pdf').textContent=(s.count||0)+' math questions';
    c.querySelector('.ws-prog span').style.width=(s.count?100*(s.tried||0)/s.count:0)+'%';
    c.querySelector('.ws-stats').innerHTML='<span>'+(s.tried||0)+'/'+(s.count||0)+' tried</span><span>'+(acc==null?'–':acc+'%')+' right</span><span>'+(s.tests||0)+' tests</span>';
    c.querySelector('.when').textContent=s.opened?'Opened '+ago(s.opened):'New';
    c.onclick=()=>satOpenSet(s.id);c.onkeydown=e=>{if(e.key==='Enter')satOpenSet(s.id)};g.append(c)})}
$('satFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)satImport(f)};

/* ---- overlay views ---- */
function satView(v){$('sat').hidden=false;for(const k of ['satImport','satSet','satTest','satResults'])$(k).hidden=k!==v;
  $('satBarTest').hidden=v!=='satTest';$('sat').dataset.view=v}
function satClose(){satStopTimer();satSaveCalc();$('sat').hidden=true;SAT.test=null;renderSatHome();renderHome()}
$('satHome').onclick=()=>{if(SAT.test&&!SAT.test.done&&!SAT.reviewMode&&SAT.test.mode==='test'){if(!$('satHome').dataset.armed){$('satHome').dataset.armed='1';$('satHome').textContent='Leave? Progress is lost';setTimeout(()=>{delete $('satHome').dataset.armed;$('satHome').textContent='← Start menu'},2500);return}}
  delete $('satHome').dataset.armed;$('satHome').textContent='← Start menu';
  if(SAT.test&&$('sat').dataset.view!=='satSet'){satStopTimer();satSaveCalc();SAT.test=null;satOpenSet(SAT.id);return}satClose()};

/* ---- reading a PDF ---- */
async function pageLines(page){const vp=page.getViewport({scale:1});const tc=await page.getTextContent();
  const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:vp.height-i.transform[5],h:Math.abs(i.transform[3])||Math.abs(i.height)||10}));
  items.sort((a,b)=>a.y-b.y||a.x-b.x);const lines=[];
  for(const it of items){const L=lines[lines.length-1];if(L&&Math.abs(L.y-it.y)<Math.max(2.5,it.h*.45)){L.parts.push(it);L.h=Math.max(L.h,it.h)}else lines.push({y:it.y,h:it.h,parts:[it]})}
  return lines.map(L=>{L.parts.sort((a,b)=>a.x-b.x);return{text:L.parts.map(p=>p.s).join(' ').replace(/\s+/g,' ').trim(),top:Math.max(0,(L.y-L.h*1.05)/vp.height),bottom:Math.min(1,(L.y+L.h*.35)/vp.height)}}).filter(l=>l.text)}

function satProg(title,detail,pct){$('satImport').innerHTML='<div class="sat-imp"><h2></h2><p></p><div class="pr-bar"><span></span></div></div>';
  $('satImport').querySelector('h2').textContent=title;$('satImport').querySelector('p').textContent=detail||'';$('satImport').querySelector('.pr-bar span').style.width=(pct||0)+'%'}

// Official question-bank exports: "Question ID …", "ID: …", question, then "ID: … Answer / Correct Answer: …".
function parseQuestionBank(pages){const qs=[];let cur=null;
  const finish=()=>{if(!cur)return;const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=cur.lastBottom||1;
    const m=cur.answerText.match(/Correct Answer:?\s*(.+?)(?:\s+Rationale\b|\s+Question Difficulty|$)/i);
    let ans=m?m[1].trim().replace(/\.$/,''):null;
    if(cur.segs.length)qs.push({segs:cur.segs.filter(g=>g.y1>g.y0+.005),answer:ans,domain:DOMAINS.find(d=>cur.meta.toLowerCase().includes(d.toLowerCase()))||null,label:cur.label});cur=null};
  for(const p of pages){let first=true;
    for(const ln of p.lines){const t=ln.text;
      if(/^Question ID\b/i.test(t)){finish();cur={segs:[],answerText:'',header:true,meta:'',hdr:0,label:(t.match(/Question ID\s*([0-9a-z]+)/i)||[])[1]||'',inAnswer:false,lastPage:p.n};first=false;continue}
      if(!cur){first=false;continue}
      if(cur.header){cur.meta+=' '+t;cur.hdr++;
        if(/^ID:\s*[0-9a-z]+\s*$/i.test(t)||cur.hdr>14){cur.header=false;cur.segs.push({page:p.n,y0:cur.hdr>14?ln.top:ln.bottom,y1:null})}
        first=false;continue}
      if(cur.inAnswer){cur.answerText+=' '+t;first=false;continue}
      if(/^ID:\s*[0-9a-z]+\s+Answer\b/i.test(t)||/^Correct Answer\b/i.test(t)||/^Answer\s*$/i.test(t)){const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=s.page===p.n?ln.top:(cur.lastBottom||1);cur.inAnswer=true;cur.answerText+=' '+t;first=false;continue}
      if(cur.lastPage!==p.n){const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=cur.lastBottom||1;cur.segs.push({page:p.n,y0:ln.top,y1:null});cur.lastPage=p.n}
      cur.lastBottom=ln.bottom;first=false}
    if(cur&&!cur.inAnswer&&!cur.header){const s=cur.segs[cur.segs.length-1];if(s&&s.page===p.n&&s.y1==null)s.y1=cur.lastBottom||1}
  }
  finish();return qs}

async function satImport(file){satView('satImport');satProg('Reading '+file.name,'Opening the PDF…',2);
  let doc;const buf=await file.arrayBuffer();
  try{doc=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise}catch(e){satProg('Could not open that PDF','Use a PDF that is not password-protected.',0);return}
  const pages=[];
  for(let n=1;n<=doc.numPages;n++){const pg=await doc.getPage(n);pages.push({n,lines:await pageLines(pg)});if(n%3===0||n===doc.numPages)satProg('Reading '+file.name,'Page '+n+' of '+doc.numPages+' (on your computer, no AI)',5+60*n/doc.numPages)}
  const textChars=pages.reduce((a,p)=>a+p.lines.reduce((b,l)=>b+l.text.length,0),0);
  const name=file.name.replace(/\.pdf$/i,'');
  if(textChars<200*Math.max(1,doc.numPages/10)){satChoice(name,doc,buf,pages,[],'This PDF is scanned images with no readable text, so questions cannot be found automatically.',false);return}
  const qs=parseQuestionBank(pages);const keyed=qs.filter(q=>q.answer).length;
  if(qs.length&&keyed>=qs.length*.8)return satFinish(name,doc,buf,pages,qs,'Found '+qs.length+' questions and their answers on your computer. No AI was used.');
  satChoice(name,doc,buf,pages,qs,qs.length?'Found '+qs.length+' questions on your computer, but only '+keyed+' answers.':'This PDF\'s layout could not be read on your computer.',true)}

function satChoice(name,doc,buf,pages,qs,msg,canAI){
  $('satImport').innerHTML='<div class="sat-imp"><h2>'+esc(name)+'</h2><p class="sat-msg"></p><div class="sat-choice"></div><p class="fine"></p></div>';
  $('satImport').querySelector('.sat-msg').textContent=msg;const box=$('satImport').querySelector('.sat-choice');
  if(canAI){const b=document.createElement('button');b.className='btn solid';b.textContent='Read it with AI (one time)';box.append(b);
    $('satImport').querySelector('.fine').textContent='Sends only the PDF\'s text (no images) to the cheapest model, once. Usually a few cents for a full test. After that, practicing is free except Desmos help on wrong answers.';
    b.onclick=()=>{if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings first.');openSettings();return}satAIExtract(name,doc,buf,pages)}}
  if(qs.length){const b=document.createElement('button');b.className='btn';b.textContent='Use the '+qs.length+' found, fill in answers myself';box.append(b);b.onclick=()=>satFinish(name,doc,buf,pages,qs,'')}
  const c=document.createElement('button');c.className='btn';c.textContent='Cancel';c.onclick=satClose;box.append(c)}

function aiJSON(text){const t=text.trim();const a=Math.min(...['[','{'].map(ch=>{const i=t.indexOf(ch);return i<0?1e9:i}));
  const close=t[a]==='['?']':'}';const b=t.lastIndexOf(close);if(a===1e9||b<a)throw new Error('No JSON in reply');return JSON.parse(t.slice(a,b+1))}
async function aiCall(prompt,max_tokens,images){const content=[...(images||[]),{type:'text',text:prompt}];
  const {promise}=window.desk.claudeStart({system:'You extract structured data from SAT practice materials and coach SAT math. Reply with only the JSON asked for.',messages:[{role:'user',content}],model:SET.satModel||'claude-haiku-5-5',max_tokens});
  const res=await promise;if(res.error)throw Object.assign(new Error(res.error.message),{code:res.error.code});
  return(res.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('')}

async function satAIExtract(name,doc,buf,pages){
  const chunks=[];let cur=[],chars=0;
  for(const p of pages){const t=p.lines.map((l,i)=>'[p'+p.n+' L'+i+'] '+l.text).join('\n');if(chars+t.length>20000&&cur.length){chunks.push(cur);cur=[];chars=0}cur.push({n:p.n,t});chars+=t.length}
  if(cur.length)chunks.push(cur);
  const found=[];
  try{for(let i=0;i<chunks.length;i++){satProg('Reading questions with AI','Part '+(i+1)+' of '+chunks.length+' (text only)',10+70*i/chunks.length);
      const prompt='Below are text lines from pages of an SAT practice PDF. Each line is tagged [p<page> L<line>].\n'+
      'List every MATH question that starts in these lines. Skip reading and writing questions, directions, score tables and answer explanation pages.\n'+
      'Reply with only a JSON array. One object per question:\n{"n": question number as printed, "section": module or section label shown nearby such as "Module 1", or null, "start": tag of the question\'s first line, "end": tag of the question\'s last line including its answer choices (never include an answer, rationale or the next question), "answer": the correct answer only if these lines state it (like "B" or "3/4"), else null, "type": "mc" if it has choices A to D, otherwise "spr", "domain": one of "Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry", or null}\n'+
      'If no math question starts here, reply [].\n\n'+chunks[i].map(c=>c.t).join('\n');
      const arr=aiJSON(await aiCall(prompt,6000));if(Array.isArray(arr))found.push(...arr)}
    // answers that live in an answer key at the back
    const missing=found.filter(q=>!q.answer);
    if(missing.length){const lastQ=Math.max(0,...found.map(q=>+(String(q.start||'').match(/p(\d+)/)||[])[1]||0));
      const keyPages=pages.filter(p=>p.n>lastQ||/answer key|answer explanation|correct answer|scoring/i.test(p.lines.slice(0,6).map(l=>l.text).join(' ')));
      if(keyPages.length){satProg('Reading the answer key with AI','One more short request',85);
        const txt=keyPages.map(p=>'[page '+p.n+'] '+p.lines.map(l=>l.text).join(' ').slice(0,1800)).join('\n').slice(0,40000);
        const want=missing.map(q=>(q.section?q.section+' ':'')+'#'+q.n).join(', ');
        const prompt='These are the answer key or answer explanation pages of an SAT practice PDF. Give the correct answer for each of these math questions: '+want+'.\nReply with only a JSON object whose keys are exactly as listed (for example "Module 1 #5" or "#5") and whose values are the answers (like "B" or "3/4"). Leave out any you cannot find.\n\n'+txt;
        const key=aiJSON(await aiCall(prompt,2500));
        for(const q of missing){const k=(q.section?q.section+' ':'')+'#'+q.n;if(key[k])q.answer=String(key[k]);else if(key['#'+q.n])q.answer=String(key['#'+q.n])}}}
  }catch(e){satChoice(name,doc,buf,pages,[],e.code?(ERRS[e.code]||e.message):'The AI reply could not be read. Try again.',true);return}
  const loc=tag=>{const m=String(tag||'').match(/p(\d+)\s*L(\d+)/i);if(!m)return null;const p=pages.find(x=>x.n===+m[1]);if(!p)return null;const l=p.lines[Math.min(+m[2],p.lines.length-1)];return l?{page:p.n,line:l}:null};
  const qs=[];for(const f of found){const a=loc(f.start),b=loc(f.end)||a;if(!a)continue;const segs=[];
    if(a.page===b.page)segs.push({page:a.page,y0:a.line.top,y1:Math.max(b.line.bottom,a.line.top+.03)});
    else{segs.push({page:a.page,y0:a.line.top,y1:.97});for(let n=a.page+1;n<b.page;n++)segs.push({page:n,y0:.03,y1:.97});segs.push({page:b.page,y0:.03,y1:b.line.bottom})}
    qs.push({segs,answer:f.answer?String(f.answer):null,type:f.type==='mc'||f.type==='spr'?f.type:null,domain:DOMAINS.includes(f.domain)?f.domain:null,label:(f.section?f.section+' ':'')+(f.n!=null?'#'+f.n:'')})}
  if(!qs.length){satChoice(name,doc,buf,pages,[],'No math questions were found in this PDF.',false);return}
  satFinish(name,doc,buf,pages,qs,'Found '+qs.length+' questions with '+qs.filter(q=>q.answer).length+' answers.')}

async function satFinish(name,doc,buf,pages,qs,msg){
  const out=[];const cache=new Map();const SC=2;
  const pageCanvas=async n=>{if(cache.has(n))return cache.get(n);if(cache.size>3){const k=cache.keys().next().value;cache.get(k).width=0;cache.delete(k)}
    const pg=await doc.getPage(n);const vp=pg.getViewport({scale:SC});const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;cache.set(n,c);return c};
  qs.sort((a,b)=>a.segs[0].page-b.segs[0].page||a.segs[0].y0-b.segs[0].y0);
  for(let i=0;i<qs.length;i++){const q=qs[i];satProg('Preparing questions','Question '+(i+1)+' of '+qs.length,70+29*i/qs.length);
    const parts=[];for(const s of q.segs){const c=await pageCanvas(s.page);const y0=Math.max(0,Math.floor((s.y0-.006)*c.height)),y1=Math.min(c.height,Math.ceil((s.y1+.008)*c.height));
      const x0=Math.floor(c.width*.04),x1=Math.ceil(c.width*.96);if(y1-y0>8)parts.push({c,x0,y0,w:x1-x0,h:y1-y0})}
    if(!parts.length)continue;const W=Math.max(...parts.map(p=>p.w)),H=parts.reduce((a,p)=>a+p.h,0);
    const o=document.createElement('canvas');o.width=W;o.height=H;const ox=o.getContext('2d');ox.fillStyle='#fff';ox.fillRect(0,0,W,H);let y=0;
    for(const p of parts){ox.drawImage(p.c,p.x0,p.y0,p.w,p.h,0,y,p.w,p.h);y+=p.h}
    const ans=q.answer?String(q.answer).trim():null;
    const type=q.type||(ans?(/^\(?[A-D]\)?$/i.test(ans.replace(/^choice\s*/i,''))?'mc':'spr'):'mc');
    out.push({id:'sq'+i+'_'+Math.random().toString(36).slice(2,6),n:out.length+1,label:q.label||'',page:q.segs[0].page,img:o.toDataURL('image/jpeg',.86),w:W/SC,
      answer:ans?(type==='mc'?(ans.match(/[A-D]/i)||[''])[0].toUpperCase():ans):null,type,domain:q.domain||null,attempts:[],tip:null})}
  cache.forEach(c=>c.width=0);
  const id='sat_'+Date.now().toString(36);const data={questions:out,history:[]};
  await idb.set('sat:'+id,data);
  SAT.list.unshift({id,name,count:out.length,tried:0,right:0,tests:0,created:Date.now(),opened:Date.now()});await satSaveList();
  try{doc.destroy()}catch(e){}
  await satOpenSet(id);if(msg)toast(msg,5000)}

/* ---- set screen ---- */
async function satOpenSet(id){SAT.id=id;SAT.data=(await idb.get('sat:'+id))||{questions:[],history:[]};SAT.test=null;SAT.reviewMode=false;
  const m=satMeta();if(m){m.opened=Date.now();satSaveList()}
  $('satTitle').textContent=m?m.name:'SAT practice';renderSatSet();satView('satSet')}
function renderSatSet(){const d=SAT.data,qs=d.questions,st=satStats(),m=satMeta();
  const missed=qs.filter(q=>q.attempts.length&&!q.attempts[q.attempts.length-1].ok).length,fresh=qs.filter(q=>!q.attempts.length).length;
  const doms=DOMAINS.map(dm=>{const list=qs.filter(q=>q.domain===dm);if(!list.length)return'';const t=list.filter(q=>q.attempts.length),r=t.filter(q=>q.attempts[q.attempts.length-1].ok);
    return'<div class="dom"><span>'+dm+'</span><b>'+(t.length?Math.round(100*r.length/t.length)+'%':'–')+'</b><small>'+t.length+'/'+list.length+' tried</small></div>'}).join('');
  const el=$('satSet');
  el.innerHTML='<div class="sat-set"><section class="sat-sum"><div><h2></h2><p class="muted"></p></div>'+
    '<div class="sat-kpis"><div><b>'+qs.length+'</b><span>questions</span></div><div><b>'+st.tried+'</b><span>tried</span></div><div><b>'+(st.tried?Math.round(100*st.right/st.tried)+'%':'–')+'</b><span>right</span></div><div><b>'+missed+'</b><span>to review</span></div></div>'+
    (doms?'<div class="sat-doms">'+doms+'</div>':'')+'</section>'+
    '<section class="sat-build"><h3>New practice test</h3>'+
    '<div class="b-row"><label>Mode</label><div class="intents" id="bMode"><button data-v="practice" aria-pressed="true">Practice: check each</button><button data-v="test" aria-pressed="false">Timed test: check at end</button></div></div>'+
    '<div class="b-row"><label>Questions</label><div class="intents" id="bCount"><button data-v="10" aria-pressed="false">10</button><button data-v="22" aria-pressed="true">22 (one module)</button><button data-v="44" aria-pressed="false">44 (full math)</button><button data-v="all" aria-pressed="false">All '+qs.length+'</button></div></div>'+
    '<div class="b-row"><label>From</label><div class="intents" id="bPool"><button data-v="all" aria-pressed="true">All</button><button data-v="fresh" aria-pressed="false">Not tried ('+fresh+')</button><button data-v="missed" aria-pressed="false">Missed ('+missed+')</button></div></div>'+
    '<div class="b-row"><label>Order</label><div class="intents" id="bOrder"><button data-v="shuffle" aria-pressed="true">Shuffle</button><button data-v="seq" aria-pressed="false">In order</button></div></div>'+
    '<div class="b-foot"><span class="muted" id="bInfo"></span><button class="btn solid" id="bStart">Start</button></div></section>'+
    (st.keyed<qs.length?'<div class="sat-warn">'+(qs.length-st.keyed)+' questions have no answer yet, so they cannot be checked. Add them in the answer key below.</div>':'')+
    (d.history.length?'<section class="sat-hist"><h3>Past tests</h3>'+d.history.slice(-8).reverse().map(h=>'<div class="h-row"><span>'+new Date(h.date).toLocaleDateString()+'</span><span>'+(h.mode==='test'?'Timed test':'Practice')+'</span><b>'+h.right+' / '+h.n+'</b><span>'+Math.round(h.secs/60)+' min</span></div>').join('')+'</section>':'')+
    '<details class="sat-key"><summary>Answer key ('+st.keyed+' of '+qs.length+' filled in)</summary><div class="key-grid" id="keyGrid"></div></details>'+
    '<div class="sat-danger"><button class="btn" id="satDel">Delete this set</button></div></div>';
  el.querySelector('h2').textContent=m?m.name:'';el.querySelector('.muted').textContent='Answers are checked on your computer. Desmos help appears only when you miss one.';
  const pick=(id)=>{const g=$(id);g.querySelectorAll('button').forEach(b=>b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));info()})};
  const val=id=>$(id).querySelector('[aria-pressed="true"]').dataset.v;
  const pool=()=>{const p=val('bPool');return qs.filter(q=>p==='all'||(p==='fresh'?!q.attempts.length:(q.attempts.length&&!q.attempts[q.attempts.length-1].ok)))};
  const info=()=>{const n=Math.min(pool().length,val('bCount')==='all'?1e9:+val('bCount'));$('bInfo').textContent=n?(n+' questions'+(val('bMode')==='test'?' · '+Math.round(n*SEC_PER_Q/60)+' min timer':'')):'No questions match';$('bStart').disabled=!n};
  ['bMode','bCount','bPool','bOrder'].forEach(pick);info();
  $('bStart').onclick=()=>{let list=pool();if(val('bOrder')==='shuffle')list=list.map(q=>[Math.random(),q]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    const c=val('bCount');if(c!=='all')list=list.slice(0,+c);satStart(list.map(q=>q.id),val('bMode'))};
  $('satDel').onclick=()=>{const b=$('satDel');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Click again to delete';b.classList.add('danger');setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Delete this set';b.classList.remove('danger')}},3000);return}
    SAT.list=SAT.list.filter(s=>s.id!==SAT.id);satSaveList();idb.del('sat:'+SAT.id);satClose();toast('Set deleted')};
  el.querySelector('.sat-key').addEventListener('toggle',e=>{if(e.target.open)renderKey()},{once:true})}
function renderKey(){const g=$('keyGrid');g.innerHTML='';
  SAT.data.questions.forEach(q=>{const r=document.createElement('div');r.className='key-row';
    r.innerHTML='<img alt=""><div class="key-f"><b></b><select aria-label="Answer type"><option value="mc">Multiple choice</option><option value="spr">Student response</option></select><input aria-label="Correct answer" placeholder="Answer"></div>';
    r.querySelector('img').src=q.img;r.querySelector('b').textContent='Q'+q.n+(q.label?' · '+q.label:'')+' · p.'+q.page;
    const sel=r.querySelector('select'),inp=r.querySelector('input');sel.id='kt-'+q.id;inp.id='ka-'+q.id;sel.value=q.type;inp.value=q.answer||'';
    inp.placeholder=q.type==='mc'?'A, B, C or D':'e.g. 3/4, .75';
    sel.onchange=()=>{q.type=sel.value;inp.placeholder=q.type==='mc'?'A, B, C or D':'e.g. 3/4, .75';satSave()};
    inp.onchange=()=>{let v=inp.value.trim();if(q.type==='mc')v=(v.match(/[A-D]/i)||[''])[0].toUpperCase();q.answer=v||null;inp.value=v;satSave()};
    g.append(r)})}

/* ---- checking answers (on device) ---- */
function normA(s){return String(s==null?'':s).trim().replace(/\s+/g,'').replace(/[−–]/g,'-').toUpperCase()}
function numA(s){s=s.replace(/,/g,'');const m=s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);if(m){const d=parseFloat(m[2]);return d?parseFloat(m[1])/d:NaN}return/^-?\d*\.?\d+$/.test(s)?parseFloat(s):NaN}
function satVerify(q,val){if(!q.answer)return null;const v=normA(val);if(!v)return false;
  if(q.type==='mc')return v.replace(/[^A-D]/g,'')===normA(q.answer).replace(/[^A-D]/g,'');
  const acc=String(q.answer).split(/,|;|\bor\b/i).map(normA).filter(Boolean);if(acc.includes(v))return true;
  const u=numA(v);if(isNaN(u))return false;return acc.some(a=>{const x=numA(a);return!isNaN(x)&&Math.abs(x-u)<=Math.max(.0011,Math.abs(x)*1e-4)})}

/* ---- taking a test ---- */
function satStart(qids,mode){SAT.test={qids,mode,i:0,ans:{},start:Date.now(),limit:mode==='test'?Math.round(qids.length*SEC_PER_Q):0,done:false};SAT.states={};SAT.reviewMode=false;
  satView('satTest');satEnsureCalc();satShowQ(0);satStartTimer()}
function satQ(i){const id=SAT.test.qids[i];return SAT.data.questions.find(q=>q.id===id)}
function satEnsureCalc(){if(SAT.calc||!window.Desmos){if(!window.Desmos)$('satCalc').innerHTML='<div class="gmsg">'+(SET.desmosKey?'Desmos is still loading or could not connect.':'Add your Desmos API key in Settings to get the calculator here.')+'</div>';return}
  try{SAT.calc=Desmos.GraphingCalculator($('satCalc'),{keypad:true,expressions:true,settingsMenu:false,zoomButtons:true,border:false,links:false,invertedColors:isDark()})}catch(e){}}
function satSaveCalc(){const t=SAT.test;if(!t||!SAT.calc)return;const q=satQ(t.i);if(q)try{SAT.states[q.id]=SAT.calc.getState()}catch(e){}}
function satShowQ(i){const t=SAT.test;satSaveCalc();t.i=Math.max(0,Math.min(t.qids.length-1,i));const q=satQ(t.i),a=t.ans[q.id]||(t.ans[q.id]={val:'',checked:false,ok:null,marked:false,tries:0});
  $('satQn').textContent=(t.i+1)+' of '+t.qids.length;$('satImg').src=q.img;$('satImg').style.width=Math.round(q.w*1.15)+'px';
  $('satQLabel').textContent='Question '+(t.i+1)+(q.domain?' · '+q.domain:'')+(q.label?' · '+q.label:'');
  $('satMark').classList.toggle('on',a.marked);
  if(SAT.calc){try{const st=SAT.states[q.id];if(st)SAT.calc.setState(st);else SAT.calc.setBlank()}catch(e){}}
  const box=$('satAns');box.innerHTML='';const locked=SAT.reviewMode||(t.mode==='practice'&&a.ok===true)||t.done;
  if(q.type==='mc'){const g=document.createElement('div');g.className='mc';
    for(const L of ['A','B','C','D']){const b=document.createElement('button');b.className='mc-b'+(a.val===L?' sel':'');b.textContent=L;b.disabled=locked;
      if((t.done||SAT.reviewMode||a.checked)&&q.answer===L&&(a.ok===true||t.done||SAT.reviewMode||a.revealed))b.classList.add('right');
      if((a.checked||t.done||SAT.reviewMode)&&a.val===L&&a.ok===false)b.classList.add('wrong');
      b.onclick=()=>{a.val=L;if(a.checked&&a.ok===false){a.checked=false}satShowQ(t.i)};g.append(b)}box.append(g)}
  else{const w=document.createElement('div');w.className='spr';w.innerHTML='<input id="satIn" inputmode="decimal" autocomplete="off" placeholder="Your answer"><span>Fractions like 3/4 and decimals like .75 are both fine.</span>';
    const inp=w.querySelector('input');inp.value=a.val;inp.disabled=locked;inp.oninput=()=>{a.val=inp.value;if(a.checked&&a.ok===false)a.checked=false;satNav()};
    inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();satPrimary()}};box.append(w);if(!locked)setTimeout(()=>inp.focus(),20)}
  satFeedback();satNav();satGrid()}
function satNav(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];
  $('satPrev').disabled=t.i===0;
  const last=t.i===t.qids.length-1;$('satNext').textContent=last?(t.done||SAT.reviewMode?'Results':(t.mode==='test'?'Finish':'Finish')):'Next';
  $('satCheck').hidden=t.mode!=='practice'||t.done||SAT.reviewMode||a.ok===true;
  $('satCheck').disabled=!String(a.val||'').trim()}
function satPrimary(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];if(t.mode==='practice'&&!t.done&&!SAT.reviewMode&&a.ok!==true&&String(a.val).trim())satCheck();else satNextQ()}
function satRecord(q,val,ok){q.attempts.push({t:Date.now(),val,ok});if(q.attempts.length>20)q.attempts.shift()}
function satCheck(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];const ok=satVerify(q,a.val);
  if(ok===null){a.checked=true;a.ok=null;satFeedback();return}
  a.checked=true;a.ok=ok;a.tries++;if(a.tries===1){satRecord(q,a.val,ok);a.firstOk=ok}satSave();satShowQ(t.i)}
function satFeedback(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id],fb=$('satFb');fb.innerHTML='';fb.className='sat-fb';
  const show=a.checked||t.done||SAT.reviewMode;if(!show)return;
  if(a.ok===null&&!q.answer){fb.innerHTML='<div class="v none">No answer key for this one. Add it under Answer key on the set screen.</div>';return}
  const ok=a.ok===true||(t.done||SAT.reviewMode)&&satVerify(q,a.val)===true;
  if(ok){fb.classList.add('ok');fb.innerHTML='<div class="v ok">Correct</div>';return}
  fb.classList.add('bad');
  const blank=!String(a.val||'').trim();
  fb.innerHTML='<div class="v bad">'+(blank?'Not answered':'Not quite')+'</div>'+
    ((a.revealed||t.done||SAT.reviewMode)?'<div class="reveal">Correct answer: <b></b></div>':'')+
    '<div class="fb-acts">'+(!(t.done||SAT.reviewMode)?'<button class="btn" id="fbRetry">Try again</button>':'')+'<button class="btn solid" id="fbTip">'+(q.tip?'Show the Desmos shortcut':'Show me the Desmos shortcut')+'</button>'+(!(a.revealed||t.done||SAT.reviewMode)?'<button class="btn" id="fbReveal">Reveal answer</button>':'')+'</div><div class="tip" id="tipBox"></div>';
  const rb=fb.querySelector('.reveal b');if(rb)rb.textContent=q.answer;
  const r=$('fbRetry');if(r)r.onclick=()=>{a.checked=false;a.ok=null;a.val='';satShowQ(t.i)};
  const rv=$('fbReveal');if(rv)rv.onclick=()=>{a.revealed=true;satShowQ(t.i)};
  $('fbTip').onclick=()=>satTip(q,a.val);
  if(q.tip&&a.tipShown)satShowTip(q)}

/* ---- Desmos shortcut: one small request, only after a miss, saved for next time ---- */
async function satTip(q,val){const a=SAT.test.ans[q.id];a.tipShown=true;
  if(q.tip){satShowTip(q,true);return}
  if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings to get Desmos help.');openSettings();return}
  const box=$('tipBox');box.innerHTML='<div class="thinking">Finding the fastest Desmos route</div>';$('fbTip').disabled=true;
  try{const small=await shrink(b64Blob(q.img),1000);const data=await blobB64(small);
    const prompt='The image is an SAT math question. The correct answer is '+q.answer+'. The student answered '+(String(val||'').trim()||'nothing')+'.\n'+
      'Show the fastest way to get the answer with the Desmos graphing calculator built into the digital SAT. Reply with only this JSON:\n'+
      '{"method":"name of the shortcut in under 12 words","steps":["2 to 4 short steps; put exactly what to type in backticks"],"expressions":[{"latex":"Desmos LaTeX, e.g. y=2x+3","label":"what it shows"}],"viewport":{"xmin":-10,"xmax":10,"ymin":-10,"ymax":10},"look_for":"what to read off the graph or table to get '+q.answer+'","mistake":"the student\'s likely mistake in one short sentence, or empty"}\n'+
      'Use at most 4 expressions and make sure they produce the correct answer. Choose a viewport where the answer is visible. If Desmos does not help on this question, give the quickest by-hand method in steps and leave expressions empty.';
    const txt=await aiCall(prompt,700,[{type:'image',source:{type:'base64',media_type:'image/jpeg',data}}]);
    const tip=aiJSON(txt);if(!tip||typeof tip!=='object')throw new Error('bad');
    tip.steps=Array.isArray(tip.steps)?tip.steps.slice(0,5).map(String):[];tip.expressions=Array.isArray(tip.expressions)?tip.expressions.slice(0,4).filter(e=>e&&typeof e.latex==='string'):[];
    q.tip=tip;satSave();if(SAT.test&&satQ(SAT.test.i)===q)satShowTip(q,true)}
  catch(e){box.innerHTML='';toast(e.code?(ERRS[e.code]||e.message):'Could not get Desmos help this time. Try again.',4500)}
  finally{const b=$('fbTip');if(b)b.disabled=false}}
const TIP_COLORS=['#c74440','#2d70b3','#388c46','#6042a6'];
function satShowTip(q,plot){const tip=q.tip,box=$('tipBox');if(!box||!tip)return;
  box.innerHTML='<div class="tip-h"></div>'+(tip.steps.length?'<ol>'+tip.steps.map(s=>'<li>'+mdLite(s).replace(/^<p>|<\/p>$/g,'')+'</li>').join('')+'</ol>':'')+
    (tip.look_for?'<div class="tip-look"><b>Look for:</b> <span></span></div>':'')+(tip.mistake?'<div class="tip-mis"><b>Likely slip:</b> <span></span></div>':'')+
    (tip.expressions.length&&SAT.calc?'<div class="tip-plot">Plotted in Desmos on the right'+(plot?'':' · <button class="linkbtn" id="tipReplot">plot again</button>')+'</div>':'');
  box.querySelector('.tip-h').textContent=tip.method||'Desmos shortcut';
  const lf=box.querySelector('.tip-look span');if(lf)lf.innerHTML=mdLite(tip.look_for).replace(/^<p>|<\/p>$/g,'');
  const ms=box.querySelector('.tip-mis span');if(ms)ms.textContent=tip.mistake;
  const rp=$('tipReplot');if(rp)rp.onclick=()=>satPlotTip(q);
  typeset(box);if(plot)satPlotTip(q)}
function satPlotTip(q){const c=SAT.calc,tip=q.tip;if(!c||!tip||!tip.expressions.length)return;
  try{tip.expressions.forEach((e,i)=>c.setExpression({id:'tip'+i,latex:e.latex,color:TIP_COLORS[i%4]}));
    const v=tip.viewport;if(v&&v.xmax>v.xmin&&v.ymax>v.ymin)c.setMathBounds({left:+v.xmin,right:+v.xmax,bottom:+v.ymin,top:+v.ymax})}catch(e){}}

/* ---- navigation, grid, timer, results ---- */
function satNextQ(){const t=SAT.test;if(t.i<t.qids.length-1)return satShowQ(t.i+1);if(t.done||SAT.reviewMode)return satResults();satFinishTest()}
$('satNext').onclick=satNextQ;$('satPrev').onclick=()=>satShowQ(SAT.test.i-1);$('satCheck').onclick=satCheck;
$('satMark').onclick=()=>{const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];a.marked=!a.marked;$('satMark').classList.toggle('on',a.marked);satGrid()};
$('satGridBtn').onclick=()=>{$('satQGrid').hidden=!$('satQGrid').hidden};
$('satEnd').onclick=()=>{if(SAT.reviewMode||SAT.test.done)return satResults();const b=$('satEnd');
  const left=SAT.test.qids.filter(id=>!String((SAT.test.ans[id]||{}).val||'').trim()).length;
  if(!b.dataset.armed&&left){b.dataset.armed='1';b.textContent=left+' unanswered. Finish?';setTimeout(()=>{delete b.dataset.armed;b.textContent='Finish'},3000);return}
  delete b.dataset.armed;b.textContent='Finish';satFinishTest()};
function satGrid(){const t=SAT.test,g=$('satQGrid');g.innerHTML='';
  t.qids.forEach((id,i)=>{const a=t.ans[id]||{},b=document.createElement('button');b.textContent=i+1;b.className='qg'+(i===t.i?' cur':'')+(String(a.val||'').trim()?' done':'')+(a.marked?' mark':'')+
    ((t.done||SAT.reviewMode||a.checked)&&a.ok!=null?(a.ok?' ok':' bad'):'');b.onclick=()=>{satShowQ(i);g.hidden=true};g.append(b)})}
function satStartTimer(){satStopTimer();const t=SAT.test;const tick=()=>{if(!SAT.test)return satStopTimer();const el=(Date.now()-t.start)/1000;
  const s=t.limit?Math.max(0,t.limit-el):el;$('satTimer').textContent=Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  $('satTimer').classList.toggle('low',!!t.limit&&s<300);if(t.limit&&s<=0&&!t.done){satStopTimer();toast('Time is up.');satFinishTest()}};tick();SAT.timerIv=setInterval(tick,1000)}
function satStopTimer(){clearInterval(SAT.timerIv);SAT.timerIv=null}
function satFinishTest(){const t=SAT.test;satSaveCalc();satStopTimer();t.done=true;t.secs=Math.round((Date.now()-t.start)/1000);
  for(const id of t.qids){const q=SAT.data.questions.find(x=>x.id===id),a=t.ans[id]||(t.ans[id]={val:'',tries:0});
    if(t.mode==='test'){a.ok=satVerify(q,a.val);if(a.ok!==null)satRecord(q,a.val,a.ok)}
    else if(!a.tries){const ok=satVerify(q,a.val);a.ok=ok;if(String(a.val||'').trim()&&ok!==null){satRecord(q,a.val,ok);a.firstOk=ok}else a.firstOk=false}}
  t.right=t.qids.filter(id=>{const a=t.ans[id];return t.mode==='test'?a.ok===true:a.firstOk===true}).length;
  SAT.data.history.push({date:Date.now(),mode:t.mode,n:t.qids.length,right:t.right,secs:t.secs});satSave();satResults()}
function satResults(){const t=SAT.test;SAT.reviewMode=false;satView('satResults');satStopTimer();
  const rows=t.qids.map((id,i)=>{const q=SAT.data.questions.find(x=>x.id===id),a=t.ans[id]||{};const ok=satVerify(q,a.val);
    return{i,q,a,ok}});
  const right=t.right!=null?t.right:rows.filter(r=>r.ok).length;
  $('satResults').innerHTML='<div class="sat-res"><div class="res-score"><b>'+right+' / '+t.qids.length+'</b><span>'+(t.mode==='practice'?'right on the first try':'correct')+' · '+Math.round((t.secs||0)/60)+' min</span></div>'+
    '<div class="res-acts"><button class="btn solid" id="resWrong">Review the ones I missed</button><button class="btn" id="resRetry">Retry missed as a new test</button><button class="btn" id="resBack">Back to set</button></div>'+
    '<div class="res-list">'+rows.map(r=>'<button class="res-row '+(r.ok?'ok':'bad')+'" data-i="'+r.i+'"><span class="n">'+(r.i+1)+'</span><span class="st">'+(r.ok?'✓':r.ok===null?'?':'✗')+'</span><span class="yours"></span><span class="key"></span><span class="go">Review →</span></button>').join('')+'</div></div>';
  $('satResults').querySelectorAll('.res-row').forEach((b,k)=>{const r=rows[k];b.querySelector('.yours').textContent='You: '+(String(r.a.val||'').trim()||'blank');b.querySelector('.key').textContent='Answer: '+(r.q.answer||'not set');
    b.onclick=()=>satReview(r.i)});
  const missed=rows.filter(r=>!r.ok).map(r=>r.q.id);
  $('resWrong').disabled=!missed.length;$('resWrong').onclick=()=>satReview(rows.find(r=>!r.ok).i);
  $('resRetry').disabled=!missed.length;$('resRetry').onclick=()=>satStart(missed,'practice');
  $('resBack').onclick=()=>satOpenSet(SAT.id)}
function satReview(i){SAT.reviewMode=true;satView('satTest');satEnsureCalc();const t=SAT.test;for(const id of t.qids){const a=t.ans[id]||(t.ans[id]={val:''});a.checked=true;
  const q=SAT.data.questions.find(x=>x.id===id);a.ok=satVerify(q,a.val)}
  $('satTimer').textContent='Review';satShowQ(i)}

function satKeys(e){if($('sat').hidden)return false;const tag=(e.target.tagName||'').toLowerCase();if($('sat').dataset.view!=='satTest')return true;
  if(tag==='input'||tag==='textarea'||tag==='select'||e.target.closest&&e.target.closest('#satCalc'))return true;
  const t=SAT.test;if(!t)return true;const q=satQ(t.i);const k=e.key.toUpperCase();
  if(q.type==='mc'&&['A','B','C','D'].includes(k)&&!e.ctrlKey&&!e.metaKey){const b=[...$('satAns').querySelectorAll('.mc-b')].find(x=>x.textContent===k);if(b&&!b.disabled)b.click();e.preventDefault()}
  else if(e.key==='Enter'){e.preventDefault();satPrimary()}
  else if(e.key==='ArrowRight'){satNextQ()}else if(e.key==='ArrowLeft'){satShowQ(t.i-1)}
  return true}


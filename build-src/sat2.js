/* ================= SAT (Math + Reading and Writing) ================= */
const SUBJ={
  math:{key:'math',name:'SAT Math',short:'Math',color:'var(--c-math)',domains:['Algebra','Advanced Math','Problem-Solving and Data Analysis','Geometry and Trigonometry'],secPerQ:35*60/22,module:22},
  rw:{key:'rw',name:'SAT Reading and Writing',short:'Reading & Writing',color:'var(--c-rw)',domains:['Information and Ideas','Craft and Structure','Expression of Ideas','Standard English Conventions'],secPerQ:32*60/27,module:27}};
const ALL_DOMAINS=[...SUBJ.math.domains,...SUBJ.rw.domains];
const DIFF={easy:1,medium:2,hard:3};
const SAT={banks:[],data:{},qmap:new Map(),history:[],test:null,calc:null,states:{},reviewMode:false,timerIv:null,imgs:new Map()};
const subjOfDomain=d=>SUBJ.rw.domains.includes(d)?'rw':SUBJ.math.domains.includes(d)?'math':null;
const lastOk=q=>q.attempts&&q.attempts.length?q.attempts[q.attempts.length-1].ok:null;
const allQs=()=>[...SAT.qmap.values()];
function stripBank(d){return{questions:d.questions.map(q=>{const o={...q};delete o.setId;return o})}}

async function satLoadAll(){SAT.banks=(await idb.get('sat:list'))||[];SAT.history=(await idb.get('sat:history'))||[];SAT.qmap.clear();SAT.data={};
  let histChanged=false;
  for(const b of SAT.banks){const d=await idb.get('sat:'+b.id);if(!d)continue;let changed=false;
    for(const q of d.questions){
      if(q.img){await idb.set('satimg:'+q.id,q.img);delete q.img;changed=true}      // earlier versions kept images inline
      if(!q.subject){q.subject=subjOfDomain(q.domain)||'math';changed=true}
      if(!q.attempts)q.attempts=[];
      q.setId=b.id;SAT.qmap.set(q.id,q)}
    if(d.history&&d.history.length){SAT.history.push(...d.history);delete d.history;changed=true;histChanged=true}
    SAT.data[b.id]=d;if(changed)await idb.set('sat:'+b.id,stripBank(d));bankMeta(b.id,true)}
  if(histChanged)await idb.set('sat:history',SAT.history);await idb.set('sat:list',SAT.banks)}
const bankSaveT={};
function satSaveQ(q){const id=q.setId;clearTimeout(bankSaveT[id]);bankSaveT[id]=setTimeout(()=>{const d=SAT.data[id];if(d)idb.set('sat:'+id,stripBank(d));bankMeta(id)},300)}
function bankMeta(id,quiet){const b=SAT.banks.find(x=>x.id===id),d=SAT.data[id];if(!b||!d)return;
  b.count=d.questions.length;b.math=d.questions.filter(q=>q.subject==='math').length;b.rw=b.count-b.math;b.keyed=d.questions.filter(q=>q.answer).length;
  if(!quiet)idb.set('sat:list',SAT.banks)}
async function satImgOf(q){if(SAT.imgs.has(q.id))return SAT.imgs.get(q.id);const v=await idb.get('satimg:'+q.id);
  if(v){SAT.imgs.set(q.id,v);if(SAT.imgs.size>60)SAT.imgs.delete(SAT.imgs.keys().next().value)}return v||''}
function satRecord(q,val,ok){q.attempts.push({t:Date.now(),val,ok});if(q.attempts.length>20)q.attempts.shift();logActivity('q');satSaveQ(q)}

/* ---- overlay views ---- */
function satView(v){$('sat').hidden=false;for(const k of ['satImport','satTest','satResults'])$(k).hidden=k!==v;$('satBarTest').hidden=v!=='satTest';$('sat').dataset.view=v}
function satClose(){satStopTimer();satSaveCalc();$('sat').hidden=true;const back=SAT.test&&SAT.test.origin||'home';SAT.test=null;shellGo(back)}
$('satHome').onclick=()=>{const t=SAT.test;
  if(t&&!t.done&&!SAT.reviewMode&&t.mode==='test'&&$('sat').dataset.view==='satTest'){const b=$('satHome');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='Leave? This test will not be saved';setTimeout(()=>{delete b.dataset.armed;b.textContent='← Back'},2500);return}}
  delete $('satHome').dataset.armed;$('satHome').textContent='← Back';satClose()};

/* ---- reading a PDF on this computer ---- */
async function pageLines(page){const vp=page.getViewport({scale:1});const tc=await page.getTextContent();
  const items=tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:i.transform[4],y:vp.height-i.transform[5],h:Math.abs(i.transform[3])||Math.abs(i.height)||10}));
  items.sort((a,b)=>a.y-b.y||a.x-b.x);const lines=[];
  for(const it of items){const L=lines[lines.length-1];if(L&&Math.abs(L.y-it.y)<Math.max(2.5,it.h*.45)){L.parts.push(it);L.h=Math.max(L.h,it.h)}else lines.push({y:it.y,h:it.h,parts:[it]})}
  return lines.map(L=>{L.parts.sort((a,b)=>a.x-b.x);return{text:L.parts.map(p=>p.s).join(' ').replace(/\s+/g,' ').trim(),top:Math.max(0,(L.y-L.h*1.05)/vp.height),bottom:Math.min(1,(L.y+L.h*.35)/vp.height)}}).filter(l=>l.text)}
function satProg(title,detail,pct){$('satImport').innerHTML='<div class="sat-imp"><img class="imp-logo" src="assets/logo.png" alt=""><h2></h2><p></p><div class="pr-bar"><span></span></div></div>';
  $('satImport').querySelector('h2').textContent=title;$('satImport').querySelector('p').textContent=detail||'';$('satImport').querySelector('.pr-bar span').style.width=(pct||0)+'%'}
function metaInfo(lines){const txt=lines.join(' ');const dom=ALL_DOMAINS.find(d=>txt.toLowerCase().includes(d.toLowerCase()))||null;
  let skill=null;if(dom){const ln=lines.find(l=>l.toLowerCase().includes(dom.toLowerCase())&&!/\bDomain\b.*\bSkill\b/i.test(l));
    if(ln){skill=ln.slice(ln.toLowerCase().indexOf(dom.toLowerCase())+dom.length).replace(/\b(Easy|Medium|Hard)\b.*$/i,'').trim()||null}}
  const subject=/Reading and Writing/i.test(txt)?'rw':subjOfDomain(dom)||(/\bMath\b/.test(txt)?'math':null);
  const dm=txt.match(/\bDifficulty\b[^A-Za-z]*(Easy|Medium|Hard)\b/i);
  return{domain:dom,skill:skill&&skill.length<70?skill:null,subject,difficulty:dm?dm[1].toLowerCase():null}}
// Official SAT Suite Question Bank exports: "Question ID", header table, "ID: …", question, "ID: … Answer", "Correct Answer: …", rationale, "Question Difficulty: …"
function parseQuestionBank(pages){const qs=[];let cur=null;
  const finish=()=>{if(!cur)return;const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=cur.lastBottom||1;
    const m=cur.answerText.match(/Correct Answer:?\s*(.+?)(?:\s+Rationale\b|\s+Question Difficulty|$)/i);
    const dif=cur.answerText.match(/Question Difficulty:?\s*(Easy|Medium|Hard)/i);
    const mi=metaInfo(cur.meta);
    if(cur.segs.length)qs.push({segs:cur.segs.filter(g=>g.y1>g.y0+.005),answer:m?m[1].trim().replace(/\.$/,''):null,label:cur.label,
      domain:mi.domain,skill:mi.skill,subject:mi.subject,difficulty:dif?dif[1].toLowerCase():mi.difficulty});cur=null};
  for(const p of pages){
    for(const ln of p.lines){const t=ln.text;
      if(/^Question ID\b/i.test(t)){finish();cur={segs:[],answerText:'',header:true,meta:[],hdr:0,label:(t.match(/Question ID\s*([0-9a-z]+)/i)||[])[1]||'',inAnswer:false,lastPage:p.n};continue}
      if(!cur)continue;
      if(cur.header){cur.meta.push(t);cur.hdr++;
        if(/^ID:\s*[0-9a-z]+\s*$/i.test(t)||cur.hdr>14){cur.header=false;cur.segs.push({page:p.n,y0:cur.hdr>14?ln.top:ln.bottom+.006,y1:null});cur.lastPage=p.n}continue}
      if(cur.inAnswer){cur.answerText+=' '+t;continue}
      if(/^ID:\s*[0-9a-z]+\s+Answer\b/i.test(t)||/^Correct Answer\b/i.test(t)||/^Answer\s*$/i.test(t)){const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=s.page===p.n?ln.top-.008:(cur.lastBottom||1);cur.inAnswer=true;cur.answerText+=' '+t;continue}
      if(cur.lastPage!==p.n){const s=cur.segs[cur.segs.length-1];if(s&&s.y1==null)s.y1=cur.lastBottom||1;cur.segs.push({page:p.n,y0:ln.top,y1:null});cur.lastPage=p.n}
      cur.lastBottom=ln.bottom}
    if(cur&&!cur.inAnswer&&!cur.header){const s=cur.segs[cur.segs.length-1];if(s&&s.page===p.n&&s.y1==null)s.y1=cur.lastBottom||1}}
  finish();return qs}

async function satImport(file){satView('satImport');SAT.test={origin:'profile'};satProg('Reading '+file.name,'Opening the PDF…',2);
  let doc;const buf=await file.arrayBuffer();
  try{doc=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0))}).promise}catch(e){satProg('Could not open that PDF','Use a PDF that is not password-protected.',0);return}
  const pages=[];
  for(let n=1;n<=doc.numPages;n++){const pg=await doc.getPage(n);pages.push({n,lines:await pageLines(pg)});if(n%3===0||n===doc.numPages)satProg('Reading '+file.name,'Page '+n+' of '+doc.numPages+' · on your computer, no AI',5+60*n/doc.numPages)}
  const chars=pages.reduce((a,p)=>a+p.lines.reduce((b,l)=>b+l.text.length,0),0);const name=file.name.replace(/\.pdf$/i,'');
  if(chars<200*Math.max(1,doc.numPages/10))return satChoice(name,doc,pages,[],'This PDF is scanned images with no readable text, so questions cannot be found automatically.',false);
  const qs=parseQuestionBank(pages);const keyed=qs.filter(q=>q.answer).length;
  if(qs.length&&keyed>=qs.length*.8)return satFinish(name,doc,pages,qs,'Found '+qs.length+' questions with answers, sorted into lessons. No AI was used.');
  satChoice(name,doc,pages,qs,qs.length?'Found '+qs.length+' questions on your computer, but only '+keyed+' answers.':'This PDF\'s layout could not be read on your computer.',true)}
function satChoice(name,doc,pages,qs,msg,canAI){
  $('satImport').innerHTML='<div class="sat-imp"><img class="imp-logo" src="assets/logo.png" alt=""><h2></h2><p class="sat-msg"></p><div class="sat-choice"></div><p class="fine"></p></div>';
  $('satImport').querySelector('h2').textContent=name;$('satImport').querySelector('.sat-msg').textContent=msg;const box=$('satImport').querySelector('.sat-choice');
  if(canAI){const b=document.createElement('button');b.className='btn solid';b.textContent='Read it with AI (one time)';box.append(b);
    $('satImport').querySelector('.fine').textContent='Sends only the PDF\'s text, no images, to the cheapest model, once. Usually a few cents for a full test. After that, practicing is free except optional help on wrong answers.';
    b.onclick=()=>{if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings first.');openSettings();return}satAIExtract(name,doc,pages)}}
  if(qs.length){const b=document.createElement('button');b.className='btn';b.textContent='Use the '+qs.length+' found, fill in answers myself';box.append(b);b.onclick=()=>satFinish(name,doc,pages,qs,'')}
  const c=document.createElement('button');c.className='btn';c.textContent='Cancel';c.onclick=satClose;box.append(c)}
function aiJSON(text){const t=text.trim();const a=Math.min(...['[','{'].map(ch=>{const i=t.indexOf(ch);return i<0?1e9:i}));
  const close=t[a]==='['?']':'}';const b=t.lastIndexOf(close);if(a===1e9||b<a)throw new Error('No JSON in reply');return JSON.parse(t.slice(a,b+1))}
async function aiCall(prompt,max_tokens,images){const content=[...(images||[]),{type:'text',text:prompt}];
  const {promise}=window.desk.claudeStart({system:'You extract structured data from SAT practice materials and coach SAT students. Reply with only the JSON asked for.',messages:[{role:'user',content}],model:SET.satModel||'claude-haiku-5-5',max_tokens});
  const res=await promise;if(res.error)throw Object.assign(new Error(res.error.message),{code:res.error.code});
  return(res.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('')}
async function satAIExtract(name,doc,pages){
  const chunks=[];let cur=[],chars=0;
  for(const p of pages){const t=p.lines.map((l,i)=>'[p'+p.n+' L'+i+'] '+l.text).join('\n');if(chars+t.length>20000&&cur.length){chunks.push(cur);cur=[];chars=0}cur.push({n:p.n,t});chars+=t.length}
  if(cur.length)chunks.push(cur);const found=[];
  try{for(let i=0;i<chunks.length;i++){satProg('Reading questions with AI','Part '+(i+1)+' of '+chunks.length+' · text only',10+70*i/chunks.length);
      const prompt='Below are text lines from pages of an SAT practice PDF. Each line is tagged [p<page> L<line>].\n'+
      'List every SAT question (Math or Reading and Writing) that starts in these lines. Skip directions, score tables and answer explanation pages.\n'+
      'Reply with only a JSON array. One object per question:\n{"n": number as printed, "section": module or section label shown nearby such as "Module 1", or null, "start": tag of the first line (for Reading and Writing this is where the passage starts), "end": tag of the last line including the answer choices (never an answer, rationale or the next question), "answer": correct answer only if these lines state it (like "B" or "3/4"), else null, "type": "mc" if it has choices A to D, otherwise "spr", "subject": "math" or "rw", "domain": one of '+ALL_DOMAINS.map(d=>'"'+d+'"').join(', ')+' or null, "skill": the specific skill in a few words (like "Linear equations in one variable", "Words in context", "Boundaries"), "difficulty": your estimate "easy", "medium" or "hard"}\n'+
      'If no question starts here, reply [].\n\n'+chunks[i].map(c=>c.t).join('\n');
      const arr=aiJSON(await aiCall(prompt,7000));if(Array.isArray(arr))found.push(...arr)}
    const missing=found.filter(q=>!q.answer);
    if(missing.length){const lastQ=Math.max(0,...found.map(q=>+(String(q.start||'').match(/p(\d+)/)||[])[1]||0));
      const keyPages=pages.filter(p=>p.n>lastQ||/answer key|answer explanation|correct answer|scoring/i.test(p.lines.slice(0,6).map(l=>l.text).join(' ')));
      if(keyPages.length){satProg('Reading the answer key with AI','One more short request',85);
        const txt=keyPages.map(p=>'[page '+p.n+'] '+p.lines.map(l=>l.text).join(' ').slice(0,1800)).join('\n').slice(0,40000);
        const want=missing.map(q=>(q.section?q.section+' ':'')+'#'+q.n).join(', ');
        const key=aiJSON(await aiCall('These are the answer key or answer explanation pages of an SAT practice PDF. Give the correct answer for each of these questions: '+want+'.\nReply with only a JSON object whose keys are exactly as listed (for example "Module 1 #5" or "#5") and whose values are the answers (like "B" or "3/4"). Leave out any you cannot find.\n\n'+txt,2500));
        for(const q of missing){const k=(q.section?q.section+' ':'')+'#'+q.n;if(key[k])q.answer=String(key[k]);else if(key['#'+q.n])q.answer=String(key['#'+q.n])}}}
  }catch(e){return satChoice(name,doc,pages,[],e.code?(ERRS[e.code]||e.message):'The AI reply could not be read. Try again.',true)}
  const loc=tag=>{const m=String(tag||'').match(/p(\d+)\s*L(\d+)/i);if(!m)return null;const p=pages.find(x=>x.n===+m[1]);if(!p)return null;const l=p.lines[Math.min(+m[2],p.lines.length-1)];return l?{page:p.n,line:l}:null};
  const qs=[];for(const f of found){const a=loc(f.start),b=loc(f.end)||a;if(!a)continue;const segs=[];
    if(a.page===b.page)segs.push({page:a.page,y0:a.line.top,y1:Math.max(b.line.bottom,a.line.top+.03)});
    else{segs.push({page:a.page,y0:a.line.top,y1:.97});for(let n=a.page+1;n<b.page;n++)segs.push({page:n,y0:.03,y1:.97});segs.push({page:b.page,y0:.03,y1:b.line.bottom})}
    const dom=ALL_DOMAINS.includes(f.domain)?f.domain:null;
    qs.push({segs,answer:f.answer?String(f.answer):null,type:f.type==='mc'||f.type==='spr'?f.type:null,domain:dom,subject:f.subject==='rw'||f.subject==='math'?f.subject:subjOfDomain(dom),
      skill:typeof f.skill==='string'&&f.skill.length<70?f.skill:null,difficulty:DIFF[f.difficulty]?f.difficulty:null,label:(f.section?f.section+' ':'')+(f.n!=null?'#'+f.n:'')})}
  if(!qs.length)return satChoice(name,doc,pages,[],'No SAT questions were found in this PDF.',false);
  satFinish(name,doc,pages,qs,'Found '+qs.length+' questions with '+qs.filter(q=>q.answer).length+' answers, sorted into lessons.')}
function trimRows(c,y0,y1){try{const x=c.getContext('2d'),w=c.width,h=y1-y0;if(h<4)return[y0,y1];const d=x.getImageData(0,y0,w,h).data;
  const ink=r=>{for(let i=r*w*4,e=i+w*4;i<e;i+=16){if(d[i]<235||d[i+1]<235||d[i+2]<235)return true}return false};
  let a=0,b=h-1;while(a<b&&!ink(a))a++;while(b>a&&!ink(b))b--;return[Math.max(y0,y0+a-12),Math.min(y1,y0+b+12)]}catch(e){return[y0,y1]}}
async function satFinish(name,doc,pages,qs,msg){
  const id='sat_'+Date.now().toString(36);const out=[];const cache=new Map();const SC=2;
  const pageCanvas=async n=>{if(cache.has(n))return cache.get(n);if(cache.size>3){const k=cache.keys().next().value;cache.get(k).width=0;cache.delete(k)}
    const pg=await doc.getPage(n);const vp=pg.getViewport({scale:SC});const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise;cache.set(n,c);return c};
  qs.sort((a,b)=>a.segs[0].page-b.segs[0].page||a.segs[0].y0-b.segs[0].y0);
  for(let i=0;i<qs.length;i++){const q=qs[i];satProg('Preparing questions','Question '+(i+1)+' of '+qs.length,70+29*i/qs.length);
    const parts=[];for(const s of q.segs){const c=await pageCanvas(s.page);let y0=Math.max(0,Math.floor((s.y0-.003)*c.height)),y1=Math.min(c.height,Math.ceil((s.y1+.003)*c.height));
      [y0,y1]=trimRows(c,y0,y1);const x0=Math.floor(c.width*.04),x1=Math.ceil(c.width*.96);if(y1-y0>8)parts.push({c,x0,y0,w:x1-x0,h:y1-y0})}
    if(!parts.length)continue;const W=Math.max(...parts.map(p=>p.w)),H=parts.reduce((a,p)=>a+p.h,0);
    const o=document.createElement('canvas');o.width=W;o.height=H;const ox=o.getContext('2d');ox.fillStyle='#fff';ox.fillRect(0,0,W,H);let y=0;
    for(const p of parts){ox.drawImage(p.c,p.x0,p.y0,p.w,p.h,0,y,p.w,p.h);y+=p.h}
    const ans=q.answer?String(q.answer).trim():null;
    const type=q.type||(ans?(/^\(?[A-D]\)?$/i.test(ans.replace(/^choice\s*/i,''))?'mc':'spr'):'mc');
    const qid='sq_'+id.slice(4)+'_'+i;
    await idb.set('satimg:'+qid,o.toDataURL('image/jpeg',.86));
    const subject=q.subject||(type==='spr'?'math':null)||'math';
    out.push({id:qid,n:out.length+1,label:q.label||'',page:q.segs[0].page,w:W/SC,answer:ans?(type==='mc'?(ans.match(/[A-D]/i)||[''])[0].toUpperCase():ans):null,
      type,subject,domain:q.domain||null,skill:q.skill||null,difficulty:q.difficulty||null,attempts:[],tip:null})}
  cache.forEach(c=>c.width=0);try{doc.destroy()}catch(e){}
  const data={questions:out};await idb.set('sat:'+id,data);
  SAT.banks.unshift({id,name,created:Date.now()});SAT.data[id]=data;out.forEach(q=>{q.setId=id;SAT.qmap.set(q.id,q)});bankMeta(id);
  $('sat').hidden=true;SAT.test=null;shellGo('learn');if(msg)toast(msg,5500)}

/* ---- checking answers on this computer ---- */
function normA(s){return String(s==null?'':s).trim().replace(/\s+/g,'').replace(/[−–]/g,'-').toUpperCase()}
function numA(s){s=s.replace(/,/g,'');const m=s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);if(m){const d=parseFloat(m[2]);return d?parseFloat(m[1])/d:NaN}return/^-?\d*\.?\d+$/.test(s)?parseFloat(s):NaN}
function satVerify(q,val){if(!q.answer)return null;const v=normA(val);if(!v)return false;
  if(q.type==='mc')return v.replace(/[^A-D]/g,'')===normA(q.answer).replace(/[^A-D]/g,'');
  const acc=String(q.answer).split(/,|;|\bor\b/i).map(normA).filter(Boolean);if(acc.includes(v))return true;
  const u=numA(v);if(isNaN(u))return false;return acc.some(a=>{const x=numA(a);return!isNaN(x)&&Math.abs(x-u)<=Math.max(.0011,Math.abs(x)*1e-4)})}

/* ---- sessions (lessons and tests) ---- */
function satStart(qids,mode,opts={}){if(!qids.length)return toast('No questions to practice here yet.');
  const qs=qids.map(id=>SAT.qmap.get(id)).filter(Boolean);
  const limit=mode==='test'?Math.round(qs.reduce((a,q)=>a+SUBJ[q.subject||'math'].secPerQ,0)):0;
  SAT.test={qids:qs.map(q=>q.id),mode,i:0,ans:{},start:Date.now(),limit,done:false,title:opts.title||'Practice',origin:opts.origin||'learn',lesson:opts.lesson||null};
  SAT.states={};SAT.reviewMode=false;$('satTitle').textContent=SAT.test.title;
  if(opts.lesson)setLast({kind:'lesson',...opts.lesson});
  satView('satTest');satShowQ(0);satStartTimer()}
const satQ=i=>SAT.qmap.get(SAT.test.qids[i]);
function satEnsureCalc(){if(SAT.calc)return true;if(!window.Desmos){$('satCalc').innerHTML='<div class="gmsg">'+(SET.desmosKey?'Desmos is still loading or could not connect.':'Add your Desmos API key in Settings to get the calculator here.')+'</div>';return false}
  try{SAT.calc=Desmos.GraphingCalculator($('satCalc'),{keypad:true,expressions:true,settingsMenu:false,zoomButtons:true,border:false,links:false,invertedColors:isDark()});return true}catch(e){return false}}
function satSaveCalc(){const t=SAT.test;if(!t||!t.qids||!SAT.calc)return;const q=satQ(t.i);if(q&&q.subject!=='rw')try{SAT.states[q.id]=SAT.calc.getState()}catch(e){}}
async function satShowQ(i){const t=SAT.test;satSaveCalc();t.i=Math.max(0,Math.min(t.qids.length-1,i));const q=satQ(t.i),a=t.ans[q.id]||(t.ans[q.id]={val:'',checked:false,ok:null,marked:false,tries:0});
  const rw=q.subject==='rw';$('satTest').classList.toggle('no-calc',rw);
  if(!rw&&satEnsureCalc()){try{const st=SAT.states[q.id];if(st)SAT.calc.setState(st);else SAT.calc.setBlank()}catch(e){}setTimeout(()=>{try{SAT.calc.resize()}catch(e){}},30)}
  $('satQn').textContent=(t.i+1)+' of '+t.qids.length;
  const lab=[SUBJ[q.subject||'math'].short,q.domain,q.skill].filter(Boolean).join(' · ');
  $('satQLabel').innerHTML='<span></span>'+(q.difficulty?'<i class="dpill d-'+q.difficulty+'">'+q.difficulty+'</i>':'');$('satQLabel').querySelector('span').textContent=lab;
  $('satMark').classList.toggle('on',a.marked);
  const img=$('satImg');img.removeAttribute('src');img.style.width=Math.round(q.w*1.15)+'px';satImgOf(q).then(src=>{if(satQ(t.i)===q)img.src=src});
  const box=$('satAns');box.innerHTML='';const fin=SAT.reviewMode||t.done;const locked=fin||(t.mode==='practice'&&a.ok===true);
  if(q.type==='mc'){const g=document.createElement('div');g.className='mc';
    for(const L of ['A','B','C','D']){const b=document.createElement('button');b.className='mc-b'+(a.val===L?' pick':'');b.textContent=L;b.disabled=locked;
      if(q.answer===L&&(a.ok===true||fin||a.revealed))b.classList.add('right');
      if((a.checked||fin)&&a.val===L&&a.ok===false)b.classList.add('wrong');
      b.onclick=()=>{a.val=L;if(a.checked&&a.ok===false)a.checked=false;satShowQ(t.i)};g.append(b)}box.append(g)}
  else{const w=document.createElement('div');w.className='spr';w.innerHTML='<input id="satIn" inputmode="decimal" autocomplete="off" placeholder="Your answer"><span>Fractions like 3/4 and decimals like .75 both work.</span>';
    const inp=w.querySelector('input');inp.value=a.val;inp.disabled=locked;inp.oninput=()=>{a.val=inp.value;if(a.checked&&a.ok===false)a.checked=false;satNav()};
    inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();satPrimary()}};box.append(w);if(!locked)setTimeout(()=>inp.focus(),20)}
  satFeedback();satNav();satGrid()}
function satNav(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];$('satPrev').disabled=t.i===0;
  const last=t.i===t.qids.length-1;$('satNext').textContent=last?(t.done||SAT.reviewMode?'See results':'Finish'):'Next';
  $('satCheck').hidden=t.mode!=='practice'||t.done||SAT.reviewMode||a.ok===true;$('satCheck').disabled=!String(a.val||'').trim()}
function satPrimary(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];if(t.mode==='practice'&&!t.done&&!SAT.reviewMode&&a.ok!==true&&String(a.val).trim())satCheck();else satNextQ()}
function satCheck(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id];const ok=satVerify(q,a.val);a.checked=true;a.ok=ok;
  if(ok===null){satFeedback();return}a.tries++;if(a.tries===1){satRecord(q,a.val,ok);a.firstOk=ok}satShowQ(t.i)}
function satFeedback(){const t=SAT.test,q=satQ(t.i),a=t.ans[q.id],fb=$('satFb');fb.innerHTML='';fb.className='sat-fb';
  const fin=t.done||SAT.reviewMode;if(!a.checked&&!fin)return;
  if(!q.answer){fb.innerHTML='<div class="v none">No answer key for this one yet. Add it in Profile → My content → Answer key.</div>';return}
  if(a.ok===true||(fin&&satVerify(q,a.val)===true)){fb.classList.add('ok');fb.innerHTML='<div class="v ok">Correct!</div>';return}
  fb.classList.add('bad');const blank=!String(a.val||'').trim();const rw=q.subject==='rw';const cached=rw?q.explain:q.tip;
  fb.innerHTML='<div class="v bad">'+(blank?'Not answered':'Not quite')+'</div>'+((a.revealed||fin)?'<div class="reveal">Correct answer: <b></b></div>':'')+
    '<div class="fb-acts">'+(!fin?'<button class="btn" id="fbRetry">Try again</button>':'')+
    '<button class="btn solid" id="fbTip">'+(rw?(cached?'Show why':'Explain why'):(cached?'Show the Desmos shortcut':'Show me the Desmos shortcut'))+'</button>'+
    (!(a.revealed||fin)?'<button class="btn" id="fbReveal">Reveal answer</button>':'')+'</div><div class="tip" id="tipBox"></div>';
  const rb=fb.querySelector('.reveal b');if(rb)rb.textContent=q.answer;
  const r=$('fbRetry');if(r)r.onclick=()=>{a.checked=false;a.ok=null;a.val='';satShowQ(t.i)};
  const rv=$('fbReveal');if(rv)rv.onclick=()=>{a.revealed=true;satShowQ(t.i)};
  $('fbTip').onclick=()=>rw?satExplain(q,a.val):satTip(q,a.val);
  if(cached&&a.tipShown)rw?satShowExplain(q):satShowTip(q,false)}

/* Help on a miss: one small request to the cheapest model, saved so it never runs twice for the same question. */
async function helpImage(q){const src=await satImgOf(q);const small=await shrink(b64Blob(src),1000);return{type:'image',source:{type:'base64',media_type:'image/jpeg',data:await blobB64(small)}}}
async function satTip(q,val){const a=SAT.test.ans[q.id];a.tipShown=true;if(q.tip)return satShowTip(q,true);
  if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings to get Desmos help.');openSettings();return}
  $('tipBox').innerHTML='<div class="thinking">Finding the fastest Desmos route</div>';$('fbTip').disabled=true;
  try{const prompt='The image is an SAT math question. The correct answer is '+q.answer+'. The student answered '+(String(val||'').trim()||'nothing')+'.\n'+
      'Show the fastest way to get the answer with the Desmos graphing calculator built into the digital SAT. Reply with only this JSON:\n'+
      '{"method":"name of the shortcut in under 12 words","steps":["2 to 4 short steps; put exactly what to type in backticks"],"expressions":[{"latex":"Desmos LaTeX, e.g. y=2x+3","label":"what it shows"}],"viewport":{"xmin":-10,"xmax":10,"ymin":-10,"ymax":10},"look_for":"what to read off the graph or table to get '+q.answer+'","mistake":"the student\'s likely mistake in one short sentence, or empty"}\n'+
      'Use at most 4 expressions and make sure they produce the correct answer. Choose a viewport where the answer is visible. If Desmos does not help, give the quickest by-hand method and leave expressions empty.';
    const tip=aiJSON(await aiCall(prompt,700,[await helpImage(q)]));if(!tip||typeof tip!=='object')throw new Error('bad');
    tip.steps=Array.isArray(tip.steps)?tip.steps.slice(0,5).map(String):[];tip.expressions=Array.isArray(tip.expressions)?tip.expressions.slice(0,4).filter(e=>e&&typeof e.latex==='string'):[];
    q.tip=tip;satSaveQ(q);if(SAT.test&&satQ(SAT.test.i)===q)satShowTip(q,true)}
  catch(e){$('tipBox').innerHTML='';toast(e.code?(ERRS[e.code]||e.message):'Could not get Desmos help this time. Try again.',4500)}
  finally{const b=$('fbTip');if(b)b.disabled=false}}
const TIP_COLORS=['#c74440','#2d70b3','#388c46','#6042a6'];
const inlineMd=s=>mdLite(String(s||'')).replace(/^<p>|<\/p>$/g,'');
function satShowTip(q,plot){const tip=q.tip,box=$('tipBox');if(!box||!tip)return;
  box.innerHTML='<div class="tip-h"></div>'+(tip.steps.length?'<ol>'+tip.steps.map(s=>'<li>'+inlineMd(s)+'</li>').join('')+'</ol>':'')+
    (tip.look_for?'<div class="tip-look"><b>Look for:</b> '+inlineMd(tip.look_for)+'</div>':'')+(tip.mistake?'<div class="tip-mis"><b>Likely slip:</b> <span></span></div>':'')+
    (tip.expressions.length&&SAT.calc?'<div class="tip-plot">Drawn in Desmos on the right'+(plot?'':' · <button class="linkbtn" id="tipReplot">draw again</button>')+'</div>':'');
  box.querySelector('.tip-h').textContent=tip.method||'Desmos shortcut';const ms=box.querySelector('.tip-mis span');if(ms)ms.textContent=tip.mistake;
  const rp=$('tipReplot');if(rp)rp.onclick=()=>satPlotTip(q);typeset(box);if(plot)satPlotTip(q)}
function satPlotTip(q){const c=SAT.calc,tip=q.tip;if(!c||!tip||!tip.expressions.length)return;
  try{tip.expressions.forEach((e,i)=>c.setExpression({id:'tip'+i,latex:e.latex,color:TIP_COLORS[i%4]}));
    const v=tip.viewport;if(v&&v.xmax>v.xmin&&v.ymax>v.ymin)c.setMathBounds({left:+v.xmin,right:+v.xmax,bottom:+v.ymin,top:+v.ymax})}catch(e){}}
async function satExplain(q,val){const a=SAT.test.ans[q.id];a.tipShown=true;if(q.explain)return satShowExplain(q);
  if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings to get explanations.');openSettings();return}
  $('tipBox').innerHTML='<div class="thinking">Finding the evidence</div>';$('fbTip').disabled=true;
  try{const prompt='The image is an SAT Reading and Writing question. The correct answer is '+q.answer+'. The student chose '+(String(val||'').trim()||'nothing')+'.\n'+
      'Reply with only this JSON:\n{"rule":"the skill or rule being tested, in under 10 words","why":"why '+q.answer+' is right, in under 50 words, pointing to the passage","evidence":"the key words from the passage that prove it, under 15 words, quoted exactly","trap":"why the student\'s choice is tempting but wrong, in one sentence, or empty","tip":"one quick strategy for this question type, in one sentence"}';
    const ex=aiJSON(await aiCall(prompt,450,[await helpImage(q)]));if(!ex||typeof ex!=='object')throw new Error('bad');
    q.explain=ex;satSaveQ(q);if(SAT.test&&satQ(SAT.test.i)===q)satShowExplain(q)}
  catch(e){$('tipBox').innerHTML='';toast(e.code?(ERRS[e.code]||e.message):'Could not get an explanation this time. Try again.',4500)}
  finally{const b=$('fbTip');if(b)b.disabled=false}}
function satShowExplain(q){const ex=q.explain,box=$('tipBox');if(!box||!ex)return;
  box.innerHTML='<div class="tip-h"></div><p class="ex-why"></p>'+(ex.evidence?'<blockquote class="ex-ev"></blockquote>':'')+(ex.trap?'<div class="tip-mis"><b>The trap:</b> <span class="ex-trap"></span></div>':'')+(ex.tip?'<div class="tip-look"><b>Next time:</b> <span class="ex-tip"></span></div>':'');
  box.querySelector('.tip-h').textContent=ex.rule||'Why it is right';box.querySelector('.ex-why').textContent=ex.why||'';
  const ev=box.querySelector('.ex-ev');if(ev)ev.textContent='"'+String(ex.evidence).replace(/^"|"$/g,'')+'"';
  const tr=box.querySelector('.ex-trap');if(tr)tr.textContent=ex.trap;const tp=box.querySelector('.ex-tip');if(tp)tp.textContent=ex.tip}

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
  t.qids.forEach((id,i)=>{const a=t.ans[id]||{},b=document.createElement('button');b.textContent=i+1;
    b.className='qg'+(i===t.i?' cur':'')+(String(a.val||'').trim()?' done':'')+(a.marked?' mark':'')+((t.done||SAT.reviewMode||a.checked)&&a.ok!=null?(a.ok?' ok':' bad'):'');
    b.onclick=()=>{satShowQ(i);g.hidden=true};g.append(b)})}
function satStartTimer(){satStopTimer();const t=SAT.test;const tick=()=>{if(!SAT.test||!SAT.test.qids)return satStopTimer();const el=(Date.now()-t.start)/1000;
  const s=t.limit?Math.max(0,t.limit-el):el;$('satTimer').textContent=Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  $('satTimer').classList.toggle('low',!!t.limit&&s<300);if(t.limit&&s<=0&&!t.done){satStopTimer();toast('Time is up.');satFinishTest()}};tick();SAT.timerIv=setInterval(tick,1000)}
function satStopTimer(){clearInterval(SAT.timerIv);SAT.timerIv=null}
function satFinishTest(){const t=SAT.test;satSaveCalc();satStopTimer();t.done=true;t.secs=Math.round((Date.now()-t.start)/1000);
  for(const id of t.qids){const q=SAT.qmap.get(id),a=t.ans[id]||(t.ans[id]={val:'',tries:0});
    if(t.mode==='test'){a.ok=satVerify(q,a.val);if(a.ok!==null)satRecord(q,a.val,a.ok)}
    else if(!a.tries){const ok=satVerify(q,a.val);a.ok=ok;if(String(a.val||'').trim()&&ok!==null){satRecord(q,a.val,ok);a.firstOk=ok}else a.firstOk=false}}
  t.right=t.qids.filter(id=>{const a=t.ans[id];return t.mode==='test'?a.ok===true:a.firstOk===true}).length;
  SAT.history.push({date:Date.now(),mode:t.mode,n:t.qids.length,right:t.right,secs:t.secs,title:t.title});if(SAT.history.length>200)SAT.history.shift();
  idb.set('sat:history',SAT.history);satResults()}
function satResults(){const t=SAT.test;SAT.reviewMode=false;satView('satResults');satStopTimer();
  const rows=t.qids.map((id,i)=>{const q=SAT.qmap.get(id),a=t.ans[id]||{};return{i,q,a,ok:satVerify(q,a.val)}});
  const right=t.right!=null?t.right:rows.filter(r=>r.ok).length,pct=t.qids.length?right/t.qids.length:0;
  $('satResults').innerHTML='<div class="sat-res"><div class="res-hero"><div class="res-ring" style="--p:'+Math.round(pct*100)+'"><b>'+right+'<small>/'+t.qids.length+'</small></b></div><div><h2>'+(pct>=.9?'Outstanding!':pct>=.7?'Nice work!':pct>=.4?'Good effort':'Keep at it')+'</h2><p class="muted">'+(t.mode==='practice'?'Right on the first try':'Correct')+' · '+Math.max(1,Math.round((t.secs||0)/60))+' min</p></div></div>'+
    '<div class="res-acts"><button class="btn solid" id="resWrong">Review my misses</button><button class="btn" id="resRetry">Retry misses</button><button class="btn" id="resBack">Done</button></div>'+
    '<div class="res-list">'+rows.map(r=>'<button class="res-row '+(r.ok?'ok':'bad')+'" data-i="'+r.i+'"><span class="n">'+(r.i+1)+'</span><span class="st">'+(r.ok?'✓':r.ok===null?'?':'✗')+'</span><span class="sk"></span><span class="yours"></span><span class="key"></span></button>').join('')+'</div></div>';
  $('satResults').querySelectorAll('.res-row').forEach((b,k)=>{const r=rows[k];b.querySelector('.sk').textContent=r.q.skill||r.q.domain||SUBJ[r.q.subject||'math'].short;
    b.querySelector('.yours').textContent='You: '+(String(r.a.val||'').trim()||'blank');b.querySelector('.key').textContent='Answer: '+(r.q.answer||'not set');b.onclick=()=>satReview(r.i)});
  const missed=rows.filter(r=>!r.ok).map(r=>r.q.id);
  $('resWrong').disabled=!missed.length;$('resWrong').onclick=()=>satReview(rows.find(r=>!r.ok).i);
  $('resRetry').disabled=!missed.length;$('resRetry').onclick=()=>satStart(missed,'practice',{title:'Retry misses',origin:t.origin});
  $('resBack').onclick=satClose}
function satReview(i){SAT.reviewMode=true;satView('satTest');const t=SAT.test;
  for(const id of t.qids){const a=t.ans[id]||(t.ans[id]={val:''});a.checked=true;a.ok=satVerify(SAT.qmap.get(id),a.val)}
  $('satTimer').textContent='Review';satShowQ(i)}
function satKeys(e){if($('sat').hidden)return false;if($('sat').dataset.view!=='satTest')return true;const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(e.target.closest&&e.target.closest('#satCalc')))return true;
  const t=SAT.test;if(!t||!t.qids)return true;const q=satQ(t.i);const k=e.key.toUpperCase();
  if(q.type==='mc'&&['A','B','C','D'].includes(k)&&!e.ctrlKey&&!e.metaKey){const b=[...$('satAns').querySelectorAll('.mc-b')].find(x=>x.textContent===k);if(b&&!b.disabled)b.click();e.preventDefault()}
  else if(e.key==='Enter'){e.preventDefault();satPrimary()}else if(e.key==='ArrowRight')satNextQ();else if(e.key==='ArrowLeft')satShowQ(t.i-1);
  return true}


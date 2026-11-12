/* ================= SUBJECTS (named from the book's own content) ================= */
const SUBJECTS=[
 ['Differential Equations',['differential equation','ordinary differential','partial differential','laplace transform','boundary value','initial value problem']],
 ['Linear Algebra',['linear algebra','matrix','matrices','eigenvalue','eigenvector','vector space','determinant','linear transformation']],
 ['Multivariable Calculus',['multivariable','vector calculus','partial derivative','multiple integral','divergence theorem','stokes']],
 ['Calculus',['calculus','derivative','integral','integration','limit','differentiation','series']],
 ['Real Analysis',['real analysis','metric space','lebesgue','measure theory','uniform convergence']],
 ['Complex Analysis',['complex analysis','analytic function','residue','contour integral']],
 ['Abstract Algebra',['abstract algebra','group theory','ring theory','galois','homomorphism']],
 ['Probability',['probability','random variable','stochastic','markov chain','expectation']],
 ['Statistics',['statistics','statistical','regression','hypothesis test','confidence interval','anova']],
 ['Discrete Math',['discrete math','combinatorics','graph theory','recurrence','pigeonhole']],
 ['Number Theory',['number theory','congruence','prime number','diophantine']],
 ['Precalculus',['precalculus','pre-calculus']],['Trigonometry',['trigonometry','trigonometric']],['Geometry',['geometry','euclidean','triangle']],
 ['Embedded Systems',['embedded','microcontroller','firmware','arduino','real-time operating','rtos','cortex-m','peripheral','interrupt']],
 ['Digital Logic',['digital logic','logic design','flip-flop','verilog','vhdl','fpga','boolean algebra','combinational']],
 ['Computer Architecture',['computer architecture','computer organization','instruction set','pipelining','cache memory']],
 ['Signals and Systems',['signals and systems','signal processing','fourier transform','z-transform','convolution','sampling theorem']],
 ['Circuits',['circuit analysis','electric circuits','op amp','operational amplifier','transistor','kirchhoff']],
 ['Control Systems',['control systems','feedback control','pid controller','root locus','bode plot','transfer function']],
 ['Operating Systems',['operating system','process scheduling','virtual memory','file system','concurrency','deadlock']],
 ['Computer Networks',['computer network','tcp/ip','routing','network layer','ethernet']],
 ['Algorithms',['algorithm','big-o','dynamic programming','greedy','np-complete','sorting']],
 ['Data Structures',['data structure','linked list','binary tree','hash table','heap','stack and queue']],
 ['Machine Learning',['machine learning','neural network','deep learning','supervised learning','gradient descent']],
 ['Programming',['programming','python','java','c++','javascript','rust','golang']],
 ['Quantum Mechanics',['quantum mechanics','schrodinger','schrödinger','wave function','quantum']],
 ['Electromagnetism',['electromagnetism','electrodynamics','maxwell','electric field','magnetic field']],
 ['Thermodynamics',['thermodynamics','entropy','heat engine','statistical mechanics']],
 ['Physics',['physics','mechanics','kinematics','newton','momentum','energy']],
 ['Organic Chemistry',['organic chemistry','alkane','alkene','reaction mechanism','stereochemistry']],
 ['Chemistry',['chemistry','chemical','stoichiometry','molecule','periodic table']],
 ['Biology',['biology','cell biology','genetics','evolution','molecular biology']],
 ['Anatomy and Physiology',['anatomy','physiology']],
 ['Microeconomics',['microeconomics']],['Macroeconomics',['macroeconomics']],['Economics',['economics','supply and demand','market equilibrium']],
 ['Psychology',['psychology','cognitive']],['History',['history','historical']],['Philosophy',['philosophy','ethics','epistemology']],['Literature',['literature','novel','poetry']]];
function classifySubject(title,headings,text){const t=String(title||'').toLowerCase(),h=(headings||[]).join(' \n ').toLowerCase(),x=String(text||'').toLowerCase().slice(0,60000);
  let best=null,score=0;
  SUBJECTS.forEach(([name,kws],i)=>{let s=0;for(const k of kws){const re=new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
      if(re.test(t))s+=6;s+=Math.min(6,(h.match(re)||[]).length*1.2);s+=Math.min(3,(x.match(re)||[]).length*.04)}
    s-=i*.001;if(s>score){score=s;best=name}});
  return score>=1?best:'General'}
const subjectOf=w=>w.subject||classifySubject(w.name+' '+(w.pdfName||''),[],'');

/* ================= COURSES (exact page excerpts, no rewriting) ================= */
const SKIP_RE=/^(contents|table of contents|preface|foreword|acknowledg|copyright|dedication|index|bibliography|references|about the author|answers to|answers|solutions to|glossary|list of (figures|tables)|notation|cover|title page)/i;
const EX_RE=/^(problem set|exercises|problems|practice problems|review exercises|homework|chapter review|exercise set)\b/i;
const COURSE={building:{}};
async function getCourse(id){return(await idb.get('course:'+id))||null}
async function saveCourse(id,c){await idb.set('course:'+id,c)}
async function outlineUnits(doc){let ol=null;try{ol=await doc.getOutline()}catch(e){}if(!ol||!ol.length)return null;
  const pageOf=async it=>{try{let d=it.dest;if(typeof d==='string')d=await doc.getDestination(d);if(!d)return null;const r=d[0];return typeof r==='object'?(await doc.getPageIndex(r))+1:(+r)+1}catch(e){return null}};
  let top=ol;while(top.length===1&&top[0].items&&top[0].items.length>1)top=top[0].items;
  const units=[];let back=null;
  for(const it of top){const title=String(it.title||'').trim();const p=await pageOf(it);if(!p)continue;
    if(SKIP_RE.test(title)){if(units.length&&!back)back=p;continue}
    const lessons=[];for(const ch of it.items||[]){const ct=String(ch.title||'').trim();if(SKIP_RE.test(ct))continue;const cp=await pageOf(ch);if(cp)lessons.push({title:ct,start:cp})}
    units.push({title,start:p,lessons:lessons.length?lessons:[{title,start:p}]})}
  if(!units.length)return null;
  if(units.length>=6&&units.every(u=>u.lessons.length===1)){const grouped=[];for(let i=0;i<units.length;i+=4){const part=units.slice(i,i+4);grouped.push({title:'Part '+(grouped.length+1),start:part[0].start,lessons:part.map(u=>u.lessons[0])})}return{units:grouped,back}}
  return{units,back}}
function headingUnits(pages){const chap=/^(chapter|CHAPTER)\s+(\d+|[IVXLC]+)\b[.:\s-]*(.*)$/,sec=/^(\d{1,2})\.(\d{1,2})\s+([A-Z][^]{2,80})$/;
  const found=[];
  for(const p of pages){const top=p.lines.filter(l=>l.top<.4);const secs=top.filter(l=>sec.test(l.text)).length+p.lines.filter(l=>sec.test(l.text)).length;
    if(secs>=8)continue;   // a table of contents page
    for(const l of top){let m;if((m=l.text.match(chap)))found.push({kind:'c',num:m[2],title:(m[3]||'').trim(),page:p.n});
      else if((m=l.text.match(sec))&&!/\d\s*$/.test(m[3]))found.push({kind:'s',num:m[1],title:m[1]+'.'+m[2]+' '+m[3].trim(),page:p.n})}}
  const secs=found.filter(f=>f.kind==='s');if(secs.length<3&&found.filter(f=>f.kind==='c').length<3)return null;
  const units=[];const seen=new Set();
  for(const f of found){const key=f.kind+f.num+(f.kind==='s'?f.title:'');if(seen.has(key))continue;seen.add(key);
    if(f.kind==='c')units.push({title:'Chapter '+f.num+(f.title?': '+f.title:''),start:f.page,lessons:[],num:f.num});
    else{let u=units.find(x=>x.num===f.num);if(!u){u={title:'Chapter '+f.num,start:f.page,lessons:[],num:f.num};units.push(u)}u.lessons.push({title:f.title,start:f.page})}}
  units.forEach(u=>{if(!u.lessons.length)u.lessons=[{title:u.title,start:u.start}];delete u.num});
  units.sort((a,b)=>a.start-b.start);return{units,back:null}}
function pageUnits(n){const size=n>300?25:n>120?15:10,units=[];
  for(let s=1,k=1;s<=n;s+=size*4,k++){const lessons=[];for(let p=s;p<Math.min(n+1,s+size*4);p+=size)lessons.push({title:'Pages '+p+'–'+Math.min(n,p+size-1),start:p});units.push({title:'Part '+k,start:s,lessons})}
  return{units,back:null}}
function finishCourse(struct,numPages,pages,source){const units=struct.units;const end=struct.back?struct.back-1:numPages;
  const starts=units.flatMap(u=>u.lessons.map(l=>l.start)).sort((a,b)=>a-b);
  units.forEach((u,ui)=>{u.lessons.sort((a,b)=>a.start-b.start);u.lessons.forEach((l,li)=>{const nxt=starts.find(s=>s>l.start);l.end=Math.max(l.start,Math.min(end,(nxt||end+1)-1));
      l.id='u'+ui+'l'+li;
      if(pages){for(let p=l.start;p<=l.end;p++){const pg=pages[p-1];if(pg&&pg.lines.some(x=>x.text.length<40&&EX_RE.test(x.text))){l.ex=p;break}}}});
    u.end=u.lessons[u.lessons.length-1].end});
  const exams=[];if(units.length>=4){const mid=Math.ceil(units.length/2)-1;exams.push({id:'midterm',kind:'midterm',title:'Midterm',after:mid,covers:units.slice(0,mid+1).map((_,i)=>i)})}
  if(units.length>=1)exams.push({id:'final',kind:'final',title:'Final exam',after:units.length-1,covers:units.map((_,i)=>i)});
  return{units,exams,source,pages:numPages,built:Date.now(),done:{},results:{}}}

async function buildCourse(w,buf,onProg){if(COURSE.building[w.id])return COURSE.building[w.id];
  const job=(async()=>{const data=buf||await readWsPdf(w.id);if(!data)throw new Error('The PDF for this book could not be found.');
    const doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;const n=doc.numPages;
    const pages=[];
    for(let i=1;i<=n;i++){const pg=await doc.getPage(i);let lines=[];try{lines=await pageLines(pg)}catch(e){}pages.push({n:i,lines});pg.cleanup();
      if(onProg&&(i%5===0||i===n))onProg(i,n)}
    let struct=await outlineUnits(doc),source='outline';
    if(!struct||struct.units.reduce((a,u)=>a+u.lessons.length,0)<2){struct=headingUnits(pages);source='headings'}
    if(!struct){struct=pageUnits(n);source='pages'}
    const course=finishCourse(struct,n,pages,source);
    const old=await getCourse(w.id);if(old){course.done=old.done||{};course.results=old.results||{}}
    const headings=course.units.flatMap(u=>[u.title,...u.lessons.map(l=>l.title)]);
    const sample=pages.slice(0,Math.min(n,40)).map(p=>p.lines.map(l=>l.text).join(' ')).join(' ');
    if(!w.subjectManual)w.subject=classifySubject(w.name+' '+(w.pdfName||''),headings,sample);
    w.lessons=course.units.reduce((a,u)=>a+u.lessons.length,0);saveWsList();
    await saveCourse(w.id,course);doc.destroy();return course})();
  COURSE.building[w.id]=job;try{return await job}finally{delete COURSE.building[w.id]}}

async function aiFindSections(w){if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings first.');openSettings();return}
  const data=await readWsPdf(w.id);const doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;const n=doc.numPages;
  const pages=[];for(let i=1;i<=n;i++){const pg=await doc.getPage(i);pages.push({n:i,lines:await pageLines(pg)});pg.cleanup()}
  const front=pages.slice(0,Math.min(25,n)).map(p=>'[pdf page '+p.n+'] '+p.lines.map(l=>l.text).join(' | ')).join('\n').slice(0,45000);
  const txt=await aiCall('These are the first pages of a textbook, including its table of contents. List its chapters and their sections in order.\nReply with only JSON: {"units":[{"title":"chapter title as printed","page":printed page number,"lessons":[{"title":"section title as printed","page":printed page number}]}]}\nSkip the preface, index, bibliography and answer pages.\n\n'+front,4000);
  const res=aiJSON(txt);if(!res||!Array.isArray(res.units)||!res.units.length)throw new Error('No sections found');
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let offset=0;const first=res.units.find(u=>u.title&&u.page);
  if(first){const nt=norm(first.title).slice(0,40);const hit=pages.find(p=>p.n>Math.min(25,n/4)&&p.lines.slice(0,8).some(l=>norm(l.text).includes(nt)));if(hit)offset=hit.n-(+first.page)}
  const fix=p=>Math.max(1,Math.min(n,(+p||1)+offset));
  const struct={units:res.units.map(u=>({title:String(u.title),start:fix(u.page),lessons:(u.lessons&&u.lessons.length?u.lessons:[{title:u.title,page:u.page}]).map(l=>({title:String(l.title),start:fix(l.page)}))})),back:null};
  const course=finishCourse(struct,n,pages,'ai');const old=await getCourse(w.id);if(old){course.done=old.done||{};course.results=old.results||{}}
  w.lessons=course.units.reduce((a,u)=>a+u.lessons.length,0);saveWsList();await saveCourse(w.id,course);doc.destroy();return course}

function courseProgress(c){if(!c)return{done:0,total:0,p:0};const total=c.units.reduce((a,u)=>a+u.lessons.length,0),done=c.units.reduce((a,u)=>a+u.lessons.filter(l=>c.done[l.id]).length,0);return{done,total,p:total?done/total:0}}
function nextLesson(c){for(let ui=0;ui<c.units.length;ui++)for(let li=0;li<c.units[ui].lessons.length;li++)if(!c.done[c.units[ui].lessons[li].id])return{ui,li};return null}

/* ---- course page ---- */
async function renderCourse(id){const w=WS.find(x=>x.id===id),el=$('pg-course');if(!w){shellGo('learn');return}
  let c=await getCourse(id);
  const head='<header class="pg-head"><div><button class="btn small" id="crBack">← Learn</button></div></header>'+
    '<section class="course-hero card"><span class="cover lg" style="background:'+(w.color||'#2f7ff0')+'"><b>'+esc2((w.name.trim()[0]||'?').toUpperCase())+'</b></span><div class="ch-main"><span class="subj-chip">'+esc2(subjectOf(w))+'</span><h1 id="crTitle"></h1><p class="muted" id="crSub"></p></div><div class="ch-side" id="crSide"></div></section>';
  if(!c){el.innerHTML=head+'<section class="card build-card"><h2>Building your course</h2><p class="muted" id="crProg">Reading the book on your computer…</p><div class="pr-bar"><span id="crBar"></span></div></section>';
    fillCourseHead(w,null);$('crBack').onclick=()=>shellGo('learn');
    if(!w.pdfName){$('crProg').textContent='Add a PDF to this book first (Profile → My content).';return}
    try{c=await buildCourse(w,null,(i,n)=>{const p=$('crProg');if(p&&SHELL_PAGE==='course'){p.textContent='Reading page '+i+' of '+n+' on your computer. No AI.';$('crBar').style.width=(100*i/n)+'%'}})}
    catch(e){const p=$('crProg');if(p)p.textContent='Could not build the course: '+(e.message||e);return}
    if(SHELL_PAGE==='course')renderCourse(id);return}
  const pr=courseProgress(c);
  let html=head+'<div class="tree">';const offs=[0,56,84,56,0,-56,-84,-56];let k=0;const nl=nextLesson(c);
  c.units.forEach((u,ui)=>{const ud=u.lessons.filter(l=>c.done[l.id]).length;
    html+='<div class="unit-card card'+(ud===u.lessons.length?' done':'')+'"><span class="unit-n">Unit '+(ui+1)+'</span><b>'+esc2(u.title)+'</b><span class="muted">pp. '+u.start+'–'+u.end+' · '+ud+'/'+u.lessons.length+' lessons</span></div><div class="nodes">';
    u.lessons.forEach((l,li)=>{const done=!!c.done[l.id],cur=nl&&nl.ui===ui&&nl.li===li;
      html+='<button class="node'+(done?' done':'')+(cur?' cur':'')+'" data-ui="'+ui+'" data-li="'+li+'" style="--off:'+offs[k++%offs.length]+'px"><span class="dot">'+(done?'✓':li+1)+'</span><span class="node-t"><b></b><small>pp. '+l.start+'–'+l.end+(l.ex?' · exercises p. '+l.ex:'')+'</small></span>'+(cur?'<span class="start-tag">Start here</span>':'')+'</button>'});
    html+='</div>';
    c.exams.filter(x=>x.after===ui).forEach(x=>{const r=c.results[x.id];
      html+='<button class="exam-node card" data-exam="'+x.id+'"><span class="trophy">'+ICON.target+'</span><span><b>'+x.title+'</b><small class="muted">Covers units '+(x.covers[0]+1)+'–'+(x.covers[x.covers.length-1]+1)+(r?' · best '+Math.round(100*r.best)+'%':'')+'</small></span><span class="btn solid small">'+(r?'Retake':'Take')+'</span></button>'})});
  html+='</div><div class="course-foot"><span class="muted">'+({outline:'Sections come from the PDF\'s own table of contents.',headings:'Sections were found from the headings in the book.',pages:'This PDF has no table of contents, so it is split by pages.',ai:'Sections were read from the table of contents with AI.'}[c.source]||'')+'</span>'+
    '<button class="btn small" id="crRebuild">Rebuild</button>'+(c.source!=='outline'?'<button class="btn small" id="crAI">Find sections with AI (one time)</button>':'')+'</div>';
  el.innerHTML=html;fillCourseHead(w,c);
  c.units.forEach((u,ui)=>u.lessons.forEach((l,li)=>{const b=el.querySelector('.node[data-ui="'+ui+'"][data-li="'+li+'"] b');if(b)b.textContent=l.title}));
  el.querySelectorAll('.node').forEach(b=>b.onclick=()=>openLesson(id,+b.dataset.ui,+b.dataset.li));
  el.querySelectorAll('.exam-node').forEach(b=>b.onclick=()=>openExam(id,b.dataset.exam));
  $('crBack').onclick=()=>shellGo('learn');
  $('crRebuild').onclick=async()=>{await idb.del('course:'+id);renderCourse(id)};
  const ai=$('crAI');if(ai)ai.onclick=async()=>{ai.disabled=true;ai.textContent='Reading the table of contents…';try{await aiFindSections(w);renderCourse(id);toast('Sections updated.')}catch(e){toast(e.code?(ERRS[e.code]||e.message):'Could not find sections: '+(e.message||e),5000);ai.disabled=false;ai.textContent='Find sections with AI (one time)'}}}
function fillCourseHead(w,c){$('crTitle').textContent=w.name;const pr=courseProgress(c);
  $('crSub').textContent=c?c.units.length+' units · '+pr.total+' lessons · '+(w.pages||c.pages)+' pages, nothing cut':'';
  if(c){const nl=nextLesson(c);$('crSide').innerHTML=ring(pr.p,76,'var(--c-book)',Math.round(pr.p*100)+'%')+'<button class="btn solid big" id="crGo">'+(nl?(pr.done?'Continue':'Start course'):'Review')+'</button>';
    $('crGo').onclick=()=>{const n=nextLesson(c)||{ui:0,li:0};openLesson(w.id,n.ui,n.li)}}}

/* ---- lessons open the real book pages with a lesson bar ---- */
async function openLesson(id,ui,li){const c=await getCourse(id);if(!c)return;const l=c.units[ui]&&c.units[ui].lessons[li];if(!l)return;
  setLast({kind:'course',id,ui,li});
  if(S.key===id&&S.pdf){hideHome();S.lesson={id,ui,li,c};scrollToPage(l.start);updateLessonBar();return}
  S.pendingPage=l.start;await openWorkspace(id);S.lesson={id,ui,li,c};updateLessonBar()}
function updateLessonBar(){const bar=$('lessonBar');const L=S.lesson;if(!L||L.id!==S.key){bar.hidden=true;return}
  const c=L.c,u=c.units[L.ui],l=u.lessons[L.li];const span=l.end-l.start+1,at=Math.min(span,Math.max(1,S.cur-l.start+1));const reached=S.cur>=l.end;
  bar.hidden=false;
  bar.innerHTML='<button class="btn small" id="lbCourse">← Course</button><div class="lb-main"><span class="lb-k">Unit '+(L.ui+1)+' · Lesson '+(L.li+1)+'</span><b></b></div>'+
    '<div class="lb-prog"><div class="pbar"><i style="width:'+Math.round(100*at/span)+'%"></i></div><span>Page '+at+' of '+span+'</span></div>'+
    (l.ex?'<button class="btn small" id="lbEx">Exercises</button>':'')+
    '<button class="btn '+(reached||c.done[l.id]?'solid':'')+'" id="lbDone">'+(c.done[l.id]?'Next lesson →':'Complete lesson')+'</button>';
  bar.querySelector('b').textContent=l.title;
  $('lbCourse').onclick=()=>{flushAll();shellGo('course',L.id)};
  const ex=$('lbEx');if(ex)ex.onclick=()=>scrollToPage(l.ex);
  $('lbDone').onclick=async()=>{if(!c.done[l.id]){c.done[l.id]=Date.now();await saveCourse(L.id,c);logActivity('read');toast('Lesson complete')}
    let ui=L.ui,li=L.li+1;if(li>=u.lessons.length){const ex=c.exams.find(x=>x.after===L.ui);if(ex&&!c.results[ex.id]){toast(ex.title+' is next. Open it from the course page when you are ready.',4500)}ui++;li=0}
    if(ui>=c.units.length){toast('You finished every lesson. Take the final exam from the course page.',5000);shellGo('course',L.id);return}
    openLesson(L.id,ui,li)}}

/* ================= MIDTERMS AND FINALS ================= */
const EX={cur:null};
async function examExcerpts(w,c,exam){const data=await readWsPdf(w.id);const doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;
  const lessons=exam.covers.flatMap(ui=>c.units[ui].lessons.map(l=>({u:c.units[ui],l})));
  const per=Math.max(900,Math.floor(70000/Math.max(1,lessons.length)));let out='';
  for(const {u,l} of lessons){const want=[l.start,l.start+1,l.ex].filter((p,i,a)=>p&&p<=l.end&&a.indexOf(p)===i);let t='';
    for(const p of want){const pg=await doc.getPage(p);t+=' '+(await pageLines(pg)).map(x=>x.text).join(' ');pg.cleanup()}
    out+='\n\n### '+u.title+' / '+l.title+' (pp. '+l.start+'-'+l.end+')\n'+t.trim().slice(0,per)}
  doc.destroy();return out.slice(0,80000)}
async function openExam(id,examId){const w=WS.find(x=>x.id===id),c=await getCourse(id);const exam=c&&c.exams.find(x=>x.id===examId);if(!exam)return;
  satView('examView');SAT.test={origin:'course'};$('satTitle').textContent=w.name+' · '+exam.title;$('sat').dataset.course=id;
  const saved=c.results[examId]&&c.results[examId].last;
  const box=$('examView');
  box.innerHTML='<div class="exam-intro"><span class="trophy big">'+ICON.target+'</span><h2>'+exam.title+'</h2><p class="muted">Covers '+exam.covers.map(i=>'Unit '+(i+1)).join(', ')+'. Questions are written from this book\'s own sections and exercises, at the book\'s level.</p>'+
    '<div class="row"><button class="btn solid big" id="exNew">'+(SET.hasAnthropicKey?'Write my exam':'Add API key to write exams')+'</button>'+(saved?'<button class="btn big" id="exLast">Review last attempt</button>':'')+'</div>'+
    '<p class="fine muted">Writing an exam uses one AI request with your tutor model, and grading written answers uses one more. Multiple choice and number answers are graded on your computer.</p></div>';
  $('exNew').onclick=()=>{if(!SET.hasAnthropicKey){openSettings();return}generateExam(w,c,exam)};
  const ls_=$('exLast');if(ls_)ls_.onclick=()=>renderExam(w,c,exam,saved,true)}
async function generateExam(w,c,exam){const box=$('examView');box.innerHTML='<div class="exam-intro"><img class="imp-logo" src="assets/logo.png" alt=""><h2>Writing your '+exam.title.toLowerCase()+'</h2><p class="muted" id="exProg">Collecting the sections it covers…</p></div>';
  try{const text=await examExcerpts(w,c,exam);$('exProg').textContent='Writing questions at the book\'s level. This can take a minute.';
    const n=exam.kind==='final'?16:12;const topics=exam.covers.map(i=>c.units[i].title+': '+c.units[i].lessons.map(l=>l.title).join('; ')).join('\n');
    const prompt='You are writing the '+exam.title+' for a course built from the textbook "'+w.name+'" ('+subjectOf(w)+'). It covers:\n'+topics+'\n\nBelow are excerpts from those sections, including their exercises.\n'+
      'Write an exam with the SAME rigor, notation and difficulty as this book. Do not simplify. Model the problems on the book\'s own examples and exercises.'+(exam.kind==='final'?' Weight later units a little more.':'')+'\n'+
      n+' questions: about half "mc" (four choices, exactly one correct, with plausible wrong choices), about a third "num" (one numeric answer, given as a plain decimal number), and 2 or 3 "free" (a derivation, proof or explanation the book would ask for), each "free" with a grading rubric.\n'+
      'Reply with only JSON: {"questions":[{"type":"mc|num|free","section":"the section it tests","prompt":"the question, math in LaTeX with $...$","choices":["...","...","...","..."],"answer":"mc: index 0-3; num: the number","tolerance":0.01,"rubric":"free: what full credit needs","points":number}]}\n\nEXCERPTS:'+text;
    const {promise}=window.desk.claudeStart({system:'You are a rigorous professor writing exams that match the textbook exactly in level and notation. Reply with only the JSON asked for.',messages:[{role:'user',content:prompt}],max_tokens:7000});
    const res=await promise;if(res.error)throw Object.assign(new Error(res.error.message),{code:res.error.code});
    const j=aiJSON((res.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(''));
    const qs=(j.questions||[]).filter(q=>q&&q.prompt&&['mc','num','free'].includes(q.type)).map((q,i)=>({i,type:q.type,section:String(q.section||''),prompt:String(q.prompt),choices:Array.isArray(q.choices)?q.choices.slice(0,6).map(String):[],
      answer:q.answer,tolerance:+q.tolerance||0,rubric:String(q.rubric||''),points:Math.max(1,+q.points||(q.type==='free'?10:5)),resp:''}));
    if(!qs.length)throw new Error('The exam came back empty. Try again.');
    renderExam(w,c,exam,{questions:qs,start:Date.now(),graded:false},false)}
  catch(e){box.innerHTML='<div class="exam-intro"><h2>Could not write the exam</h2><p class="muted"></p><button class="btn solid big" id="exRetry">Try again</button></div>';box.querySelector('p').textContent=e.code?(ERRS[e.code]||e.message):(e.message||String(e));$('exRetry').onclick=()=>generateExam(w,c,exam)}}
function renderExam(w,c,exam,att,review){EX.cur={w,c,exam,att};const box=$('examView');const g=att.graded;
  const score=g?att.questions.reduce((a,q)=>a+(q.got||0),0):0,max=att.questions.reduce((a,q)=>a+q.points,0);
  box.innerHTML='<div class="exam-wrap">'+(g?'<div class="res-hero"><div class="res-ring" style="--p:'+Math.round(100*score/max)+'"><b>'+Math.round(100*score/max)+'<small>%</small></b></div><div><h2>'+exam.title+' results</h2><p class="muted">'+score.toFixed(1).replace(/\.0$/,'')+' of '+max+' points</p></div></div>':'<div class="exam-top"><h2>'+exam.title+'</h2><span class="muted">'+att.questions.length+' questions · '+max+' points</span></div>')+
    att.questions.map((q,k)=>'<article class="eq card'+(g?(q.got>=q.points?' ok':q.got>0?' part':' bad'):'')+'" data-k="'+k+'"><div class="eq-h"><span class="eq-n">'+(k+1)+'</span><span class="eq-s"></span><span class="eq-p">'+(g?(q.got||0).toFixed(1).replace(/\.0$/,'')+'/':'')+q.points+' pts</span></div><div class="eq-q"></div><div class="eq-a"></div><div class="eq-f"></div></article>').join('')+
    '<div class="exam-foot">'+(g?'<button class="btn big" id="exBack">Back to course</button><button class="btn solid big" id="exAgain">New exam</button>':'<button class="btn solid big" id="exSubmit">Submit exam</button>')+'</div></div>';
  att.questions.forEach((q,k)=>{const card=box.querySelector('.eq[data-k="'+k+'"]');card.querySelector('.eq-s').textContent=q.section;card.querySelector('.eq-q').innerHTML=mdLite(q.prompt);
    const a=card.querySelector('.eq-a');
    if(q.type==='mc'){a.innerHTML=q.choices.map((ch,ci)=>'<label class="eq-c'+(g&&+q.answer===ci?' right':'')+(g&&String(q.resp)===String(ci)&&+q.answer!==ci?' wrong':'')+'"><input type="radio" name="q'+k+'" value="'+ci+'"'+(String(q.resp)===String(ci)?' checked':'')+(g?' disabled':'')+'><span class="eq-l">'+'ABCDEF'[ci]+'</span><span class="eq-ct"></span></label>').join('');
      a.querySelectorAll('.eq-ct').forEach((s,ci)=>s.innerHTML=inlineMd(q.choices[ci]));a.querySelectorAll('input').forEach(r=>r.onchange=()=>{q.resp=r.value})}
    else if(q.type==='num'){a.innerHTML='<input class="eq-in" inputmode="decimal" placeholder="Your answer as a number"'+(g?' disabled':'')+'>';const i=a.querySelector('input');i.id='eqn'+k;i.value=q.resp;i.oninput=()=>{q.resp=i.value}}
    else{a.innerHTML='<textarea class="eq-ta" rows="5" placeholder="Show your work. Plain text is fine, LaTeX like $x^2$ works too."'+(g?' disabled':'')+'></textarea>';const t=a.querySelector('textarea');t.id='eqt'+k;t.value=q.resp;t.oninput=()=>{q.resp=t.value}}
    if(g){const f=card.querySelector('.eq-f');f.innerHTML=(q.type==='num'?'<div><b>Answer:</b> '+esc2(q.answer)+'</div>':'')+(q.feedback?'<div>'+inlineMd(q.feedback)+'</div>':'')}});
  typeset(box);
  if(g){$('exBack').onclick=()=>{$('sat').hidden=true;shellGo('course',w.id)};$('exAgain').onclick=()=>generateExam(w,c,exam)}
  else $('exSubmit').onclick=()=>submitExam()}
async function submitExam(){const {w,c,exam,att}=EX.cur;const b=$('exSubmit');const blank=att.questions.filter(q=>!String(q.resp).trim()).length;
  if(blank&&!b.dataset.armed){b.dataset.armed='1';b.textContent=blank+' unanswered. Submit anyway?';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Submit exam'}},3000);return}
  b.disabled=true;b.textContent='Grading…';
  for(const q of att.questions){if(q.type==='mc')q.got=String(q.resp)!==''&&+q.resp===+q.answer?q.points:0;
    else if(q.type==='num'){const u=numA(normA(q.resp)),x=parseFloat(q.answer);q.got=!isNaN(u)&&!isNaN(x)&&Math.abs(u-x)<=Math.max(q.tolerance||0,Math.abs(x)*.005,1e-6)?q.points:0}}
  const free=att.questions.filter(q=>q.type==='free');
  if(free.length){const todo=free.filter(q=>String(q.resp).trim());free.filter(q=>!String(q.resp).trim()).forEach(q=>{q.got=0;q.feedback='No answer given.'});
    if(todo.length){try{const prompt='Grade these written answers from a '+exam.title.toLowerCase()+' on "'+w.name+'". Be fair but hold the book\'s standard of rigor.\n'+
        todo.map(q=>'QUESTION '+q.i+' ('+q.points+' points)\n'+q.prompt+'\nRUBRIC: '+q.rubric+'\nSTUDENT ANSWER:\n'+q.resp).join('\n\n')+
        '\n\nReply with only JSON: [{"i":question number,"score":points earned,"feedback":"one or two sentences: what was right and what was missing"}]';
      const {promise}=window.desk.claudeStart({system:'You are a fair, rigorous grader. Reply with only the JSON asked for.',messages:[{role:'user',content:prompt}],max_tokens:2500});
      const res=await promise;if(res.error)throw Object.assign(new Error(res.error.message),{code:res.error.code});
      const arr=aiJSON((res.content||[]).filter(x=>x.type==='text').map(x=>x.text).join(''));
      for(const r of Array.isArray(arr)?arr:[]){const q=todo.find(x=>x.i===+r.i);if(q){q.got=Math.max(0,Math.min(q.points,+r.score||0));q.feedback=String(r.feedback||'')}}}
    catch(e){todo.forEach(q=>{if(q.got==null){q.got=0;q.feedback='Could not be graded automatically. Compare your work with the book.'}});toast(e.code?(ERRS[e.code]||e.message):'Written answers could not be graded this time.',5000)}}}
  att.graded=true;att.secs=Math.round((Date.now()-att.start)/1000);
  const score=att.questions.reduce((a,q)=>a+(q.got||0),0),max=att.questions.reduce((a,q)=>a+q.points,0);
  const r=c.results[exam.id]||{best:0,attempts:0};r.attempts++;r.best=Math.max(r.best,score/max);r.last=att;c.results[exam.id]=r;await saveCourse(w.id,c);logActivity('q',att.questions.length);
  renderExam(w,c,exam,att,true);$('examView').scrollTop=0}


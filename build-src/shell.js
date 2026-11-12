/* ================= APP SHELL (Home · Learn · Practice · Profile) ================= */
const CATS=['Math','Science','Computer Science','Humanities','Languages','Test Prep','Other'];
function guessCat(t){t=String(t||'').toLowerCase();
  if(/calc|algebra|geometr|trig|statist|math|linear|differential|probab|strang|number theory|topolog/.test(t))return'Math';
  if(/physic|chem|bio|science|anatom|astro|geolog|ecolog|neuro/.test(t))return'Science';
  if(/program|comput|python|java|algorithm|data struct|software|machine learning/.test(t))return'Computer Science';
  if(/histor|philosoph|econ|psych|sociol|govern|politic|literat|english|writing|art|music/.test(t))return'Humanities';
  if(/spanish|french|german|chinese|japanese|latin|korean|italian|language/.test(t))return'Languages';
  if(/\bsat\b|\bact\b|\bap\b|gre|gmat|lsat|mcat/.test(t))return'Test Prep';return'Other'}
const now2=()=>Date.now();
function ago(t){if(!t)return'never';const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.round(s/60)+' min ago';if(s<86400)return Math.round(s/3600)+' h ago';
  const d=Math.round(s/86400);return d===1?'yesterday':d<30?d+' days ago':new Date(t).toLocaleDateString()}
const dayKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function logActivity(kind,n=1){const a=ls.get('activity',{});const k=dayKey();a[k]=a[k]||{};a[k][kind]=(a[k][kind]||0)+n;ls.set('activity',a)}
function todayCount(){const a=ls.get('activity',{})[dayKey()]||{};return a.q||0}
function streakDays(){const a=ls.get('activity',{});const d=new Date();let s=0;const has=k=>a[k]&&(a[k].q||a[k].read);
  if(!has(dayKey(d)))d.setDate(d.getDate()-1);while(has(dayKey(d))){s++;d.setDate(d.getDate()-1)}return s}
function profile(){return Object.assign({name:'',goal:10},ls.get('profile',{}))}
function setLast(v){ls.set('last',Object.assign({t:Date.now()},v))}
const esc2=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ICON={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  learn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/></svg>',
  practice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  flame:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.3-5 .2 1.6.9 2.7 2 3.2C11 8.6 11.2 5 12 2z"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  target:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/></svg>',
  spark:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>',
  timer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4M9 2h6"/></svg>'};
document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',ICON[el.dataset.icon]||''));

let SHELL_PAGE='home';
function shellGo(page,arg){SHELL_PAGE=page;$('shell').hidden=false;document.title='PolyStudy';
  document.querySelectorAll('.nav-i').forEach(b=>b.classList.toggle('on',b.dataset.page===(page==='bank'?'profile':page)));
  for(const p of ['home','learn','practice','profile','bank'])$('pg-'+p).hidden=p!==page;
  ({home:renderShellHome,learn:renderLearn,practice:renderPracticePage,profile:renderProfile,bank:renderBank})[page](arg);
  $('streakN').textContent=streakDays();$('main').scrollTop=0}
function showHome(){flushAll();setClip(false);shellGo('home')}
function hideHome(){$('shell').hidden=true}
document.querySelectorAll('.nav-i').forEach(b=>b.onclick=()=>shellGo(b.dataset.page));
$('sideBrand').onclick=()=>shellGo('home');

/* ---- skill catalog: subject > domain > skill, sorted easy → hard ---- */
function catalog(subject){const qs=allQs().filter(q=>(q.subject||'math')===subject);const doms=new Map();
  for(const q of qs){const d=q.domain||'Mixed practice';const sk=q.skill||(q.domain?q.domain+' practice':'Mixed practice');
    if(!doms.has(d))doms.set(d,new Map());const m=doms.get(d);if(!m.has(sk))m.set(sk,[]);m.get(sk).push(q)}
  const order=[...SUBJ[subject].domains,'Mixed practice'];
  return[...doms.entries()].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0])).map(([domain,skills])=>({domain,
    skills:[...skills.entries()].map(([name,list])=>skillInfo(subject,domain,name,list)).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name))}))}
function skillInfo(subject,domain,name,list){const lv=list.map(q=>DIFF[q.difficulty]||2);const level=lv.reduce((a,b)=>a+b,0)/lv.length;
  const tried=list.filter(q=>q.attempts.length).length,right=list.filter(q=>lastOk(q)===true).length,missed=list.filter(q=>lastOk(q)===false).length;
  const counts={easy:list.filter(q=>q.difficulty==='easy').length,medium:list.filter(q=>q.difficulty==='medium').length,hard:list.filter(q=>q.difficulty==='hard').length};
  const mastery=list.length?right/list.length:0;const acc=tried?list.filter(q=>q.attempts.length&&lastOk(q)).length/tried:null;
  return{subject,domain,name,list,level,tried,right,missed,counts,mastery,acc,state:mastery>=.8?'mastered':tried?'progress':'new'}}
function lessonQids(info,diff){let list=info.list.filter(q=>q.answer&&(!diff||q.difficulty===diff));
  const rank=q=>(lastOk(q)===true?2:lastOk(q)===false?0:1);
  list.sort((a,b)=>rank(a)-rank(b)||(DIFF[a.difficulty]||2)-(DIFF[b.difficulty]||2));
  const notDone=list.filter(q=>lastOk(q)!==true);const pick=(notDone.length?notDone:list).slice(0,8);
  return pick.sort((a,b)=>(DIFF[a.difficulty]||2)-(DIFF[b.difficulty]||2)).map(q=>q.id)}
function startLesson(info,diff){satStart(lessonQids(info,diff),'practice',{title:info.name+(diff?' · '+diff:''),origin:'learn',lesson:{subject:info.subject,domain:info.domain,skill:info.name}})}
function findSkill(l){if(!l)return null;for(const d of catalog(l.subject))if(d.domain===l.domain){const s=d.skills.find(x=>x.name===l.skill);if(s)return s}return null}
function subjectStats(subject){const qs=allQs().filter(q=>(q.subject||'math')===subject);return{total:qs.length,right:qs.filter(q=>lastOk(q)===true).length,tried:qs.filter(q=>q.attempts.length).length,missed:qs.filter(q=>lastOk(q)===false).length}}
function ring(p,size,color,inner){const r=(size-8)/2,c=2*Math.PI*r;return'<svg class="ring" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'"><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--track)" stroke-width="6"/><circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="6" stroke-linecap="round" stroke-dasharray="'+(c*Math.min(1,p)).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 '+size/2+' '+size/2+')"/>'+(inner?'<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" class="ring-t">'+inner+'</text>':'')+'</svg>'}

/* ---- suggestions, computed on this computer ---- */
function suggestions(){const out=[];const last=ls.get('last',null);
  if(last&&last.kind==='ws'){const w=WS.find(x=>x.id===last.id);if(w)out.push({kind:'Continue reading',title:w.name,sub:w.pages?'Page '+(w.lastPage||1)+' of '+w.pages:'Open your textbook',color:'var(--c-book)',icon:'book',go:()=>openWorkspace(w.id)})}
  if(last&&last.kind==='lesson'){const s=findSkill(last);if(s&&s.state!=='mastered')out.push({kind:'Continue lesson',title:s.name,sub:Math.round(s.mastery*100)+'% mastered · '+SUBJ[s.subject].short,color:SUBJ[s.subject].color,icon:'learn',go:()=>startLesson(s)})}
  const skills=['math','rw'].flatMap(sub=>catalog(sub).flatMap(d=>d.skills));
  const missed=allQs().filter(q=>lastOk(q)===false&&q.answer);
  if(missed.length){const by={};missed.forEach(q=>{const k=q.skill||q.domain||'Mixed';by[k]=(by[k]||0)+1});const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
    out.push({kind:'Fix your mistakes',title:missed.length+' question'+(missed.length>1?'s':'')+' to redo',sub:'Most in '+top[0],color:'var(--c-bad)',icon:'redo',go:()=>satStart(missed.slice(0,10).map(q=>q.id),'practice',{title:'Fix your mistakes',origin:'home'})})}
  const weak=skills.filter(s=>s.tried>=3&&s.acc!=null&&s.acc<.7).sort((a,b)=>a.acc-b.acc)[0];
  if(weak)out.push({kind:'Strengthen',title:weak.name,sub:Math.round(weak.acc*100)+'% right so far · '+SUBJ[weak.subject].short,color:SUBJ[weak.subject].color,icon:'target',go:()=>startLesson(weak)});
  const fresh=skills.filter(s=>s.state==='new'&&s.list.some(q=>q.answer)).sort((a,b)=>a.level-b.level)[0];
  if(fresh)out.push({kind:'Start something new',title:fresh.name,sub:(fresh.level<1.6?'Easy start':fresh.level<2.4?'Medium':'Challenge')+' · '+fresh.list.length+' questions',color:SUBJ[fresh.subject].color,icon:'spark',go:()=>startLesson(fresh)});
  for(const sub of ['math','rw']){const st=subjectStats(sub);if(st.tried>=20&&st.total>=SUBJ[sub].module){out.push({kind:'Ready for a test',title:'Timed '+SUBJ[sub].short+' module',sub:SUBJ[sub].module+' questions · '+Math.round(SUBJ[sub].module*SUBJ[sub].secPerQ/60)+' min',color:SUBJ[sub].color,icon:'timer',go:()=>quickTest(sub)});break}}
  const books=WS.filter(w=>w.pdfName&&!(last&&last.kind==='ws'&&last.id===w.id)).sort((a,b)=>(b.opened||0)-(a.opened||0));
  if(books[0]&&out.length<4)out.push({kind:'Pick up your book',title:books[0].name,sub:books[0].pages?'Page '+(books[0].lastPage||1)+' of '+books[0].pages:'',color:'var(--c-book)',icon:'book',go:()=>openWorkspace(books[0].id)});
  return out.slice(0,4)}
function quickTest(sub){const qs=allQs().filter(q=>q.subject===sub&&q.answer).map(q=>[Math.random(),q]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]).slice(0,SUBJ[sub].module);
  satStart(qs.map(q=>q.id),'test',{title:'Timed '+SUBJ[sub].short+' module',origin:'practice'})}

/* ---- Home ---- */
function renderShellHome(){const p=profile(),h=new Date().getHours(),greet=h<12?'Good morning':h<18?'Good afternoon':'Good evening';
  const tc=todayCount(),goal=p.goal||10,st=streakDays();const hasSat=SAT.qmap.size>0,hasBooks=WS.some(w=>w.pdfName);
  const el=$('pg-home');
  let html='<header class="pg-head"><div><h1>'+greet+(p.name?', '+esc2(p.name):'')+'</h1><p class="muted">'+new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})+'</p></div>'+
    '<div class="head-stats"><div class="stat-pill flame">'+ICON.flame+'<b>'+st+'</b><span>day streak</span></div><div class="stat-pill goal">'+ring(tc/goal,44,'var(--accent)')+'<div><b>'+Math.min(tc,goal)+'/'+goal+'</b><span>today\'s goal</span></div></div></div></header>';
  if(!hasSat&&!hasBooks){html+='<section class="onboard card"><img src="assets/logo.png" alt=""><div><h2>Welcome to PolyStudy</h2><p>Add a textbook or an SAT question bank and PolyStudy sorts it into lessons from easy to hard, then suggests what to study each day.</p><div class="row"><button class="btn big solid" id="obBook">'+ICON.book+'Add a textbook</button><button class="btn big" id="obBank">'+ICON.plus+'Add SAT questions</button></div></div></section>'}
  else{const sug=suggestions();
    html+='<h2 class="sec-h">Suggested for you</h2><div class="sug-grid">'+sug.map((s,i)=>'<button class="sug card" data-i="'+i+'" style="--tone:'+s.color+'"><span class="sug-ic">'+ICON[s.icon]+'</span><span class="sug-k">'+esc2(s.kind)+'</span><span class="sug-t">'+esc2(s.title)+'</span><span class="sug-s">'+esc2(s.sub)+'</span><span class="sug-go">'+ICON.arrow+'</span></button>').join('')+'</div>';
    html+='<h2 class="sec-h">Your subjects</h2><div class="subj-grid">'+
      ['math','rw'].filter(s=>subjectStats(s).total).map(s=>{const x=subjectStats(s);return'<button class="subj card" data-sub="'+s+'" style="--tone:'+SUBJ[s].color+'">'+ring(x.total?x.right/x.total:0,64,SUBJ[s].color,Math.round(100*(x.total?x.right/x.total:0))+'%')+'<div><b>'+SUBJ[s].name+'</b><span>'+x.right+' of '+x.total+' mastered'+(x.missed?' · '+x.missed+' to redo':'')+'</span></div></button>'}).join('')+
      (hasBooks?'<button class="subj card" data-sub="books" style="--tone:var(--c-book)"><span class="subj-ic">'+ICON.book+'</span><div><b>Textbooks</b><span>'+WS.filter(w=>w.pdfName).length+' in your library</span></div></button>':'')+'</div>';
    el.innerHTML=html;el.querySelectorAll('.sug').forEach(b=>b.onclick=()=>sug[+b.dataset.i].go());
    el.querySelectorAll('.subj').forEach(b=>b.onclick=()=>{LEARN_TAB=b.dataset.sub;shellGo('learn')});return}
  el.innerHTML=html;$('obBook').onclick=()=>$('addBookIn').click();$('obBank').onclick=()=>$('satFile').click()}

/* ---- Learn ---- */
let LEARN_TAB=null;
function renderLearn(){const el=$('pg-learn');const tabs=[];
  if(subjectStats('math').total)tabs.push(['math','SAT Math']);if(subjectStats('rw').total)tabs.push(['rw','SAT Reading & Writing']);if(WS.length)tabs.push(['books','Textbooks']);
  if(!tabs.length){el.innerHTML='<header class="pg-head"><div><h1>Learn</h1><p class="muted">Lessons appear here once you add content.</p></div></header><div class="empty-card card"><p>Add a textbook or an SAT question bank in your profile. PolyStudy sorts it into subjects and lessons, easiest first.</p><button class="btn solid big" id="lnAdd">Go to My content</button></div>';$('lnAdd').onclick=()=>shellGo('profile');return}
  if(!tabs.some(t=>t[0]===LEARN_TAB))LEARN_TAB=tabs[0][0];
  let html='<header class="pg-head"><div><h1>Learn</h1><p class="muted">Sorted by subject and topic, easiest lessons first.</p></div></header><div class="seg">'+tabs.map(t=>'<button data-t="'+t[0]+'" class="'+(t[0]===LEARN_TAB?'on':'')+'">'+t[1]+'</button>').join('')+'</div>';
  if(LEARN_TAB==='books'){const by={};WS.forEach(w=>{const c=w.category||guessCat(w.name);(by[c]=by[c]||[]).push(w)});
    html+=CATS.filter(c=>by[c]).map(c=>'<section class="dom-sec"><div class="dom-h"><h2>'+c+'</h2><span class="muted">'+by[c].length+' book'+(by[c].length>1?'s':'')+'</span></div><div class="book-grid">'+
      by[c].sort((a,b)=>(b.opened||0)-(a.opened||0)).map(w=>{const pct=w.pages?(w.lastPage||1)/w.pages:0;return'<button class="book card" data-id="'+w.id+'"><span class="cover" style="background:'+(w.color||'#2f80ed')+'"><b>'+esc2((w.name.trim()[0]||'?').toUpperCase())+'</b></span><span class="book-t">'+esc2(w.name)+'</span><span class="book-s">'+(w.pdfName?(w.pages?'p. '+(w.lastPage||1)+' of '+w.pages:''):'No PDF yet')+'</span><span class="bar"><i style="width:'+Math.round(pct*100)+'%"></i></span><span class="book-m">'+(w.clips||0)+' clips · '+(w.prRight||0)+'/'+(w.prTotal||0)+' practice</span></button>'}).join('')+'</div></section>').join('');
    el.innerHTML=html;el.querySelectorAll('.book').forEach(b=>b.onclick=()=>openWorkspace(b.dataset.id))}
  else{const sub=LEARN_TAB,cat=catalog(sub),x=subjectStats(sub);
    html+='<div class="subj-banner card" style="--tone:'+SUBJ[sub].color+'">'+ring(x.total?x.right/x.total:0,72,SUBJ[sub].color,Math.round(100*(x.total?x.right/x.total:0))+'%')+'<div><h2>'+SUBJ[sub].name+'</h2><p>'+x.right+' of '+x.total+' questions mastered · '+cat.reduce((a,d)=>a+d.skills.length,0)+' lessons</p></div><button class="btn solid" id="lnTest">'+ICON.timer+'Timed module</button></div>';
    let n=0;
    html+=cat.map(d=>{const dr=d.skills.reduce((a,s)=>a+s.right,0),dt=d.skills.reduce((a,s)=>a+s.list.length,0);
      return'<section class="dom-sec"><div class="dom-h"><h2>'+esc2(d.domain)+'</h2><span class="muted">'+dr+'/'+dt+' mastered</span><button class="btn small" data-dom="'+esc2(d.domain)+'">Practice all</button></div><div class="path">'+
        d.skills.map(s=>{const idx=n++;const lvl=s.level<1.6?'easy':s.level<2.4?'medium':'hard';
          return'<div class="lesson card '+s.state+'" data-k="'+idx+'" tabindex="0" style="--tone:'+SUBJ[sub].color+'"><div class="les-top">'+ring(s.mastery,52,SUBJ[sub].color,s.state==='mastered'?'✓':Math.round(s.mastery*100)+'%')+'<span class="dpill d-'+lvl+'">'+lvl+'</span></div><b class="les-t">'+esc2(s.name)+'</b><span class="les-s">'+s.list.length+' questions'+(s.missed?' · '+s.missed+' to redo':'')+'</span>'+
            '<div class="les-diff">'+['easy','medium','hard'].map(k=>s.counts[k]?'<button class="dchip d-'+k+'" data-diff="'+k+'" title="Only '+k+' questions">'+k[0].toUpperCase()+k.slice(1)+' '+s.counts[k]+'</button>':'').join('')+'</div>'+
            '<button class="btn solid les-go">'+(s.state==='new'?'Start':s.state==='mastered'?'Review':'Continue')+'</button></div>'}).join('')+'</div></section>'}).join('');
    el.innerHTML=html;const flat=cat.flatMap(d=>d.skills);
    el.querySelectorAll('.lesson').forEach(c=>{const s=flat[+c.dataset.k];
      c.onclick=e=>{const dc=e.target.closest('.dchip');startLesson(s,dc?dc.dataset.diff:null)};c.onkeydown=e=>{if(e.key==='Enter')startLesson(s)}});
    el.querySelectorAll('[data-dom]').forEach(b=>b.onclick=()=>{const d=cat.find(x=>x.domain===b.dataset.dom);const qs=d.skills.flatMap(s=>s.list).filter(q=>q.answer).sort((a,b)=>(DIFF[a.difficulty]||2)-(DIFF[b.difficulty]||2));
      satStart(qs.filter(q=>lastOk(q)!==true).concat(qs.filter(q=>lastOk(q)===true)).slice(0,15).map(q=>q.id),'practice',{title:d.domain,origin:'learn'})});
    $('lnTest').onclick=()=>quickTest(sub)}
  el.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{LEARN_TAB=b.dataset.t;renderLearn()})}

/* ---- Practice (tests) ---- */
function renderPracticePage(){const el=$('pg-practice');const hasM=subjectStats('math').total,hasR=subjectStats('rw').total;
  if(!hasM&&!hasR){el.innerHTML='<header class="pg-head"><div><h1>Practice tests</h1><p class="muted">Build timed SAT modules from your question banks.</p></div></header><div class="empty-card card"><p>Add an SAT question bank first.</p><button class="btn solid big" id="prAdd">Add SAT questions</button></div>';$('prAdd').onclick=()=>$('satFile').click();return}
  const subs=[hasM&&['math','Math'],hasR&&['rw','Reading & Writing'],hasM&&hasR&&['both','Both']].filter(Boolean);
  el.innerHTML='<header class="pg-head"><div><h1>Practice tests</h1><p class="muted">Answers are checked on your computer. Help only appears when you miss one.</p></div></header>'+
    '<section class="card build"><div class="b-row"><label>Subject</label><div class="seg sm" id="pbSub">'+subs.map((s,i)=>'<button data-v="'+s[0]+'" class="'+(i===0?'on':'')+'">'+s[1]+'</button>').join('')+'</div></div>'+
    '<div class="b-row"><label>Mode</label><div class="seg sm" id="pbMode"><button data-v="test" class="on">Timed test</button><button data-v="practice">Practice: check each</button></div></div>'+
    '<div class="b-row"><label>Length</label><div class="seg sm" id="pbLen"><button data-v="module" class="on">One module</button><button data-v="full">Full section</button><button data-v="10">Quick 10</button></div></div>'+
    '<div class="b-row"><label>From</label><div class="seg sm" id="pbPool"><button data-v="all" class="on">All</button><button data-v="fresh">Not tried</button><button data-v="missed">Missed</button></div></div>'+
    '<div class="b-foot"><span class="muted" id="pbInfo"></span><button class="btn solid big" id="pbStart">Start</button></div></section>'+
    (SAT.history.length?'<h2 class="sec-h">Recent results</h2><div class="hist">'+SAT.history.slice(-10).reverse().map(h=>{const p=h.n?h.right/h.n:0;return'<div class="h-row card"><span class="h-score" style="--p:'+Math.round(p*100)+'">'+h.right+'/'+h.n+'</span><span class="h-t">'+esc2(h.title||'Practice')+'</span><span class="muted">'+(h.mode==='test'?'Timed':'Practice')+' · '+Math.max(1,Math.round(h.secs/60))+' min</span><span class="muted">'+ago(h.date)+'</span></div>'}).join('')+'</div>':'');
  const val=id=>$(id).querySelector('.on').dataset.v;
  const pool=()=>{const sub=val('pbSub'),p=val('pbPool');return allQs().filter(q=>q.answer&&(sub==='both'||q.subject===sub)&&(p==='all'||(p==='fresh'?!q.attempts.length:lastOk(q)===false)))};
  const size=()=>{const sub=val('pbSub'),len=val('pbLen');if(len==='10')return 10;const m=sub==='both'?SUBJ.math.module+SUBJ.rw.module:SUBJ[sub].module;return len==='full'?m*2:m};
  const info=()=>{const n=Math.min(pool().length,size());const secs=pool().slice(0,n).reduce((a,q)=>a+SUBJ[q.subject].secPerQ,0);
    $('pbInfo').textContent=n?n+' questions'+(val('pbMode')==='test'?' · '+Math.round(secs/60)+' min':''):'No questions match';$('pbStart').disabled=!n};
  el.querySelectorAll('.build .seg').forEach(g=>g.querySelectorAll('button').forEach(b=>b.onclick=()=>{g.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));info()}));info();
  $('pbStart').onclick=()=>{let list=pool().map(q=>[Math.random(),q]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]).slice(0,size());
    list.sort((a,b)=>(a.subject===b.subject?0:a.subject==='rw'?-1:1));   // like the real SAT: Reading and Writing first
    satStart(list.map(q=>q.id),val('pbMode'),{title:$('pbSub').querySelector('.on').textContent+' '+$('pbLen').querySelector('.on').textContent.toLowerCase(),origin:'practice'})}}

/* ---- Profile and content library ---- */
function renderProfile(){const p=profile(),el=$('pg-profile');const all=allQs(),tried=all.filter(q=>q.attempts.length);
  const acc=tried.length?Math.round(100*tried.filter(q=>lastOk(q)).length/tried.length):null;const totalAns=all.reduce((a,q)=>a+q.attempts.length,0);
  el.innerHTML='<header class="pg-head"><div><h1>Profile</h1><p class="muted">Your details, your content, and your connections.</p></div></header>'+
    '<section class="card prof"><img src="assets/logo.png" alt="" class="avatar"><div class="prof-f"><label for="pfName">Name</label><input id="pfName" maxlength="40" placeholder="What should we call you?"><label>Daily goal</label><div class="seg sm" id="pfGoal">'+[5,10,20,30].map(g=>'<button data-v="'+g+'" class="'+(g===p.goal?'on':'')+'">'+g+' questions</button>').join('')+'</div></div>'+
    '<div class="prof-stats"><div><b>'+streakDays()+'</b><span>day streak</span></div><div><b>'+totalAns+'</b><span>answers</span></div><div><b>'+(acc==null?'–':acc+'%')+'</b><span>accuracy</span></div></div></section>'+
    '<h2 class="sec-h">My content</h2><p class="muted sec-p">Add textbooks and question banks here. PolyStudy sorts them into subjects and lessons by itself.</p>'+
    '<div class="content-actions"><button class="btn big solid" id="pfAddBook">'+ICON.book+'Add textbook PDF</button><button class="btn big" id="pfAddBank">'+ICON.plus+'Add SAT question bank</button></div>'+
    '<div class="card list"><div class="list-h">Textbooks</div>'+(WS.length?WS.map(w=>'<div class="li" data-id="'+w.id+'"><span class="cover sm" style="background:'+(w.color||'#2f80ed')+'"><b>'+esc2((w.name.trim()[0]||'?').toUpperCase())+'</b></span><div class="li-main"><b class="li-t">'+esc2(w.name)+'</b><span class="muted">'+(w.pdfName?(w.pages||'?')+' pages':'No PDF yet')+' · opened '+ago(w.opened)+'</span></div><select class="li-cat" aria-label="Category">'+CATS.map(c=>'<option'+((w.category||guessCat(w.name))===c?' selected':'')+'>'+c+'</option>').join('')+'</select><button class="btn small li-open">Open</button><button class="btn small li-ren">Rename</button><button class="btn small danger li-del">Delete</button></div>').join(''):'<div class="li empty">No textbooks yet.</div>')+'</div>'+
    '<div class="card list"><div class="list-h">SAT question banks</div>'+(SAT.banks.length?SAT.banks.map(b=>'<div class="li" data-bank="'+b.id+'"><span class="cover sm sat-cover"><b>SAT</b></span><div class="li-main"><b class="li-t">'+esc2(b.name)+'</b><span class="muted">'+(b.math||0)+' math · '+(b.rw||0)+' reading & writing · '+(b.keyed||0)+'/'+(b.count||0)+' answers</span></div><button class="btn small li-key">Answer key</button><button class="btn small danger li-bdel">Delete</button></div>').join(''):'<div class="li empty">No question banks yet. Official SAT Suite Question Bank PDFs work best: they are read on your computer with no AI.</div>')+'</div>'+
    '<h2 class="sec-h">Connections</h2><div class="card list"><div class="li"><div class="li-main"><b>AI tutor and Desmos</b><span class="muted">'+(SET.hasAnthropicKey?'Anthropic key saved':'No Anthropic key yet')+' · '+(SET.desmosKey?'Desmos key saved':'No Desmos key yet')+'</span></div><button class="btn small" id="pfKeys">API keys and models</button></div></div>';
  const nm=$('pfName');nm.value=p.name||'';nm.oninput=()=>{const q=profile();q.name=nm.value.trim();ls.set('profile',q)};
  $('pfGoal').querySelectorAll('button').forEach(b=>b.onclick=()=>{const q=profile();q.goal=+b.dataset.v;ls.set('profile',q);$('pfGoal').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))});
  $('pfAddBook').onclick=()=>$('addBookIn').click();$('pfAddBank').onclick=()=>$('satFile').click();$('pfKeys').onclick=openSettings;
  el.querySelectorAll('[data-id]').forEach(row=>{const w=WS.find(x=>x.id===row.dataset.id);if(!w)return;
    row.querySelector('.li-cat').onchange=e=>{w.category=e.target.value;saveWsList()};
    row.querySelector('.li-open').onclick=()=>openWorkspace(w.id);
    row.querySelector('.li-ren').onclick=()=>{const t=row.querySelector('.li-t');const inp=document.createElement('input');inp.className='li-rename';inp.value=w.name;inp.maxLength=60;t.replaceWith(inp);inp.focus();inp.select();
      const done=s=>{if(s&&inp.value.trim()){w.name=inp.value.trim();saveWsList()}renderProfile()};inp.onkeydown=e=>{if(e.key==='Enter')done(true);if(e.key==='Escape')done(false)};inp.onblur=()=>done(true)};
    row.querySelector('.li-del').onclick=e=>armDelete(e.currentTarget,async()=>{WS=WS.filter(x=>x.id!==w.id);await saveWsList();window.desk.libDel(w.id);
      for(const k of ['pdf','clips','notes','chat','page','practice','desmos'])await idb.del(k+':'+w.id);if(S.key===w.id){S.key=null;resetReader()}renderProfile();toast('Textbook deleted')})});
  el.querySelectorAll('[data-bank]').forEach(row=>{const id=row.dataset.bank;
    row.querySelector('.li-key').onclick=()=>shellGo('bank',id);
    row.querySelector('.li-bdel').onclick=e=>armDelete(e.currentTarget,async()=>{const d=SAT.data[id];if(d)for(const q of d.questions){SAT.qmap.delete(q.id);idb.del('satimg:'+q.id)}
      delete SAT.data[id];SAT.banks=SAT.banks.filter(b=>b.id!==id);await idb.set('sat:list',SAT.banks);await idb.del('sat:'+id);renderProfile();toast('Question bank deleted')})})}
function armDelete(btn,fn){if(btn.dataset.armed){fn();return}btn.dataset.armed='1';const t=btn.textContent;btn.textContent='Click again to delete';setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.textContent=t}},3000)}
$('addBookIn').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const w=await addTextbook(f);if(w)shellGo(SHELL_PAGE==='home'?'home':'profile')};

function renderBank(id){const b=SAT.banks.find(x=>x.id===id),d=SAT.data[id],el=$('pg-bank');if(!b||!d){shellGo('profile');return}
  el.innerHTML='<header class="pg-head"><div><button class="btn small" id="bkBack">← Profile</button><h1 id="bkName"></h1><p class="muted">'+d.questions.length+' questions · '+d.questions.filter(q=>q.answer).length+' with answers. Fix anything the reader got wrong here.</p></div></header><div class="key-grid" id="keyGrid"></div>';
  $('bkName').textContent=b.name;$('bkName').contentEditable='true';$('bkName').spellcheck=false;
  $('bkName').onblur=()=>{const v=$('bkName').textContent.trim();if(v){b.name=v;idb.set('sat:list',SAT.banks)}};
  $('bkBack').onclick=()=>shellGo('profile');
  const g=$('keyGrid');
  d.questions.forEach(q=>{const r=document.createElement('div');r.className='key-row card';
    r.innerHTML='<img alt=""><div class="key-f"><b></b><select aria-label="Subject" class="k-sub"><option value="math">Math</option><option value="rw">Reading & Writing</option></select><select aria-label="Difficulty" class="k-dif"><option value="">Difficulty?</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><select aria-label="Answer type" class="k-type"><option value="mc">Multiple choice</option><option value="spr">Student response</option></select><input aria-label="Correct answer" class="k-ans" placeholder="Answer"></div>';
    satImgOf(q).then(src=>r.querySelector('img').src=src);r.querySelector('b').textContent='Q'+q.n+' · '+(q.skill||q.domain||'No topic found')+' · p.'+q.page;
    const sub=r.querySelector('.k-sub'),dif=r.querySelector('.k-dif'),ty=r.querySelector('.k-type'),an=r.querySelector('.k-ans');
    sub.value=q.subject||'math';dif.value=q.difficulty||'';ty.value=q.type;an.value=q.answer||'';an.placeholder=q.type==='mc'?'A, B, C or D':'e.g. 3/4, .75';
    sub.onchange=()=>{q.subject=sub.value;satSaveQ(q)};dif.onchange=()=>{q.difficulty=dif.value||null;satSaveQ(q)};
    ty.onchange=()=>{q.type=ty.value;an.placeholder=q.type==='mc'?'A, B, C or D':'e.g. 3/4, .75';satSaveQ(q)};
    an.onchange=()=>{let v=an.value.trim();if(q.type==='mc')v=(v.match(/[A-D]/i)||[''])[0].toUpperCase();q.answer=v||null;an.value=v;satSaveQ(q)};g.append(r)})}


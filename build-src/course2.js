/* ================= SUBJECTS (named from the book's own content) ================= */
const SUBJECTS=[
 ['Differential Equations',['differential equation','ordinary differential','partial differential','laplace transform','boundary value']],
 ['Linear Algebra',['linear algebra','eigenvalue','eigenvector','vector space','matrices','determinant']],
 ['Multivariable Calculus',['multivariable','vector calculus','multiple integral','divergence theorem']],
 ['Complex Analysis',['complex analysis','visual complex','analytic function','contour integral']],
 ['Real Analysis',['real analysis','metric space','lebesgue']],
 ['Calculus',['calculus','derivative','integral','integration']],
 ['Probability',['probability','random variable','stochastic','markov chain']],
 ['Information Theory',['information theory','entropy coding','learning algorithms']],
 ['Statistics',['statistics','regression','hypothesis test']],
 ['Optimization',['convex optimization','optimization','linear programming','lagrange multiplier']],
 ['Scientific Computing',['scientific computing','numerical methods','numerical analysis','quadrature']],
 ['Discrete Math',['discrete math','combinatorics','graph theory']],
 ['Abstract Algebra',['abstract algebra','group theory','galois']],
 ['Number Theory',['number theory','congruence']],
 ['Geometry',['geometry','euclidean','projective']],
 ['Robotics',['robotics','robot','ros2','manipulator','slam','motion planning','planning algorithms','state estimation']],
 ['Control Systems',['control systems','feedback control','feedback systems','pid control','model predictive','nonlinear systems','lyapunov','root locus','cybernetics']],
 ['Power Electronics',['power electronics','dc-dc converter','inverter','buck converter']],
 ['Solar Energy',['solar','photovoltaic','irradiance','pv module','thermal processes']],
 ['Battery Systems',['battery management','battery','state of charge']],
 ['Electromagnetic Compatibility',['electromagnetic compatibility','shielding','grounding']],
 ['Electronics',['art of electronics','microelectronic','amplifier','transistor','circuit']],
 ['Signals and Systems',['signals and systems','signal processing','fourier transform','z-transform']],
 ['Embedded Systems',['embedded','microcontroller','firmware','cortex-m','interrupt','peripheral']],
 ['Real-Time Systems',['real-time systems','priority inversion','wcet']],
 ['Digital Logic',['digital logic','flip-flop','verilog','vhdl','fpga']],
 ['Computer Systems',['computer systems','elements of computing','programmer\'s perspective','memory hierarchy']],
 ['Operating Systems',['operating system','three easy pieces','virtual memory','concurrency']],
 ['Compilers and Interpreters',['interpreter','compiler','parsing','bytecode']],
 ['Algorithms',['algorithm design','algorithms','dynamic programming','np-complete']],
 ['Software Engineering',['software design','pragmatic programmer','site reliability','data-intensive','software engineering']],
 ['Programming Languages',['structure and interpretation','c programming language','modern c','rust programming','fluent python','programming']],
 ['Computer Vision',['computer vision','multiple view geometry','camera calibration','remote sensing','image processing']],
 ['Reinforcement Learning',['reinforcement learning','markov decision','policy gradient']],
 ['Deep Learning',['deep learning','neural network','backpropagation','transformer']],
 ['Machine Learning',['machine learning','probabilistic machine','supervised learning']],
 ['Probabilistic Models',['graphical models','bayesian network','causality','causal inference','book of why']],
 ['Artificial Intelligence',['artificial intelligence','modern approach']],
 ['Mechanics of Materials',['mechanics of materials','stress and strain','beam deflection','elasticity']],
 ['Engineering Mechanics',['engineering mechanics','statics','dynamics of particles','rigid body']],
 ['Machine Design',['design of machinery','machine design','linkage','mechanism synthesis','fundamentals of design']],
 ['Materials Science',['strong materials','materials science','dislocation','fracture']],
 ['Structures',['structures','why things don','buildings','bridges']],
 ['Tribology',['tribology','wear','lubrication','corrosion']],
 ['Biomechanics',['biomechanics','life\'s devices','growth and form']],
 ['Engineering and Design',['engineer is human','mind\'s eye','engineering design']],
 ['Energy and Society',['energy and civilization','energy budget']],
 ['Soil Science',['soils','soil','erosion','dirt']],
 ['Environmental Physics',['environmental biophysics','environmental physics','soil physics','evapotranspiration']],
 ['Plant Science',['plant physiology','plant pathology','photosynthesis','mineral nutrition','plants']],
 ['Agriculture',['agroecology','organic grower','irrigation','greenhouse','hydroponic','crop','pest management','field robotics']],
 ['Biochemistry',['biochemistry','bioenergetics','metabolism','chemiosmosis','vital question']],
 ['Cell Biology',['molecular biology of the cell','cell biology','molecular biology']],
 ['Physical Chemistry',['physical chemistry','chemical kinetics','quantum chemistry']],
 ['Organic Chemistry',['organic chemistry','reaction mechanism','stereochemistry','physical organic']],
 ['Inorganic Chemistry',['inorganic chemistry','coordination chemistry']],
 ['Medicinal Chemistry',['medicinal chemistry','drug design']],
 ['Chemistry',['chemistry','chemical principles','periodic table']],
 ['Medical Physiology',['medical physiology','physiology']],
 ['Pharmacology',['pharmacology','pharmacokinetic','pharmacodynamic','therapeutics']],
 ['Pathology',['pathologic basis','pathology']],
 ['Immunology',['immunobiology','immunology']],
 ['Toxicology',['toxicology','poisons']],
 ['Medicine',['internal medicine','modern medicine','bad pharma','medicine']],
 ['Reliability and Safety',['reliability engineering','safer world','normal accidents','systems engineering','fmea']],
 ['Quantum Mechanics',['quantum mechanics','schrodinger','schrödinger']],
 ['Electromagnetism',['electromagnetism','electrodynamics','maxwell']],
 ['Thermodynamics',['thermodynamics','heat transfer','statistical mechanics']],
 ['Physics',['physics','mechanics','kinematics']],
 ['Biology',['biology','genetics','evolution']],
 ['Economics',['economics','microeconomics','macroeconomics']],
 ['Psychology',['psychology']],['History of Science',['history','eighth day']],['Philosophy',['philosophy']],['Literature',['literature','novel','poetry']]];
const normTitle=s=>String(s||'').toLowerCase().replace(/[_\-.]+/g,' ').replace(/\s+/g,' ');
function classifySubject(title,headings,text){const t=normTitle(title),h=normTitle((headings||[]).join(' \n ')),x=normTitle(text).slice(0,60000);
  let best=null,score=0;
  SUBJECTS.forEach(([name,kws],i)=>{let s=0;for(const k of kws){const re=new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
      if(re.test(t))s+=8;s+=Math.min(5,(h.match(re)||[]).length*.8);s+=Math.min(2.5,(x.match(re)||[]).length*.03)}
    s-=i*.001;if(s>score){score=s;best=name}});
  return score>=1.2?best:'General'}
const subjectOf=w=>w.subject||classifySubject(w.name+' '+(w.pdfName||''),[],'');
function cleanBookName(file,meta){let n=String(file||'').replace(/\.pdf$/i,'');
  n=n.replace(/^(dokumen\.pub|ebin\.pub|epdf\.pub|pdfcoffee\.com|libgen\.[a-z]+|z-?lib(rary)?\.[a-z]+|pdfdrive\.com)[_\s-]*/i,'').replace(/[_]+/g,' ').replace(/-(?=[a-z])/g,' ').replace(/\s+/g,' ').trim();
  n=n.replace(/\s(\d{10}|\d{13}|97[89][\d-]{10,})\b.*$/,'').replace(/\b(\d+(st|nd|rd|th)?\s*ed(ition)?)\b.*$/i,m=>m).trim();
  const t=meta&&String(meta).trim();
  if(t&&t.length>3&&t.length<120&&!/\.(pdf|docx?|tex|indd)$/i.test(t)&&!/^(untitled|microsoft word|document|title|book)$/i.test(t)&&/[a-z]{3}/i.test(t))return t;
  return n?n.charAt(0).toUpperCase()+n.slice(1):'Untitled book'}

/* ================= SECTION DETECTION (works on any layout) ================= */
const SKIP_RE=/^(\d+\s+)?(contents|table of contents|brief contents|detailed contents|preface|foreword|prologue to the|acknowledg|copyright|dedication|index|subject index|author index|bibliography|references|further reading|about the authors?|answers to|answers|solutions to|selected answers|hints and answers|glossary|list of (figures|tables|symbols)|notation|nomenclature|cover|title page|half title|frontmatter|front matter|backmatter|back matter|colophon|also by|praise for|endnotes|notes on the|photo credits|credits)\b/i;
const EX_RE=/^(\d+(\.\d+)*\s*)?(problem sets?|problems|exercises|exercise set|practice problems|review (questions|exercises|problems)|homework( problems)?|questions and problems|end[- ]of[- ]chapter|chapter review|self[- ]test|worked problems|challenge problems|test yourself|check your understanding)\b/i;
const BAD_TITLE=/(\.pdf|\.docx?|\.tex|\.ps)$|^(untitled|bookmark|page \d+|\d+|[ivxlc]+|section|chapter)$|^\s*$/i;
const COURSE_V=3;
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]};

async function outlineTree(doc){let ol=null;try{ol=await doc.getOutline()}catch(e){}if(!ol||!ol.length)return null;
  const pageOf=async it=>{try{let d=it.dest;if(typeof d==='string')d=await doc.getDestination(d);if(!d)return null;const r=d[0];return typeof r==='object'?(await doc.getPageIndex(r))+1:(+r)+1}catch(e){return null}};
  const walk=async(items,depth)=>{const out=[];for(const it of items||[]){if(depth>3)break;out.push({title:String(it.title||'').replace(/\s+/g,' ').trim(),page:await pageOf(it),depth,kids:await walk(it.items,depth+1)})}return out};
  return walk(ol,0)}
function nodesAt(tree,d){const out=[];const rec=(ns)=>{for(const n of ns){if(n.depth===d)out.push(n);else if(n.depth<d)rec(n.kids)}};rec(tree);return out}
function structFromOutline(tree,uDepth){const units=[];
  for(const u of nodesAt(tree,uDepth)){if(!u.page||SKIP_RE.test(u.title))continue;
    const lessons=(u.kids||[]).filter(k=>k.page&&!SKIP_RE.test(k.title)).map(k=>({title:k.title,start:k.page}));
    units.push({title:u.title,start:u.page,lessons:lessons.length?lessons:[{title:u.title,start:u.page}]})}
  return units.length?{units}:null}
function structFlat(entries){if(entries.length<2)return null;   // one level only: group into parts of ~5
  if(entries.length<=8)return{units:[{title:'Chapters',start:entries[0].start,lessons:entries}]};
  const units=[];for(let i=0;i<entries.length;i+=5){const part=entries.slice(i,i+5);units.push({title:'Part '+(units.length+1)+' · '+part[0].title,start:part[0].start,lessons:part})}return{units}}

function findTocPages(pages){const limit=Math.min(pages.length,Math.max(12,Math.round(pages.length*.12)),45);const out=[];
  const re=/^(.{3,140}?\S)\s*(?:\.{2,}|…+|(?:\s\.){2,}|\s{2,}|\s)\s*([0-9]{1,4}|[ivxlc]{1,6})$/i;
  for(let i=0;i<limit;i++){const p=pages[i];const hits=p.lines.filter(l=>re.test(l.text)&&/[a-z]{3}/i.test(l.text)).length;if(hits>=5&&hits>=p.lines.length*.35)out.push(p)}
  return{pages:out,re}}
function structFromPrintedToc(pages){const {pages:toc,re}=findTocPages(pages);if(!toc.length)return null;const entries=[];
  for(const p of toc)for(const l of p.lines){const m=l.text.match(re);if(!m||!/^\d+$/.test(m[2]))continue;const title=m[1].replace(/[.\s…]+$/,'').trim();if(title.length<3||SKIP_RE.test(title))continue;
    let level=1;if(/^(part|book|unit)\b|^[IVXLC]+[.:]?\s+[A-Z]/i.test(title))level=0;else if(/^\d+\.\d+\.\d+/.test(title))level=3;else if(/^(\d+|[A-Z])\.\d+\b|^§/.test(title))level=2;else if(/^(chapter|lecture|module|lesson)\s+\w+|^\d+\s+\S/i.test(title))level=1;else level=l.x>.16?2:1;
    entries.push({title,printed:+m[2],level})}
  if(entries.length<4)return null;
  const tocEnd=toc[toc.length-1].n;const norm=s=>normTitle(s).replace(/^((chapter|part|lecture|section)\s+)?[\divxlc.]+\s*/i,'').replace(/[^a-z0-9 ]/g,'').trim();
  const offs={};let tried=0;
  for(const e of entries){if(tried>40)break;const key=norm(e.title).slice(0,32);if(key.length<5)continue;tried++;
    for(let i=tocEnd;i<pages.length;i++){const p=pages[i];if(p.lines.slice(0,10).some(l=>norm(l.text).startsWith(key))){const o=p.n-e.printed;offs[o]=(offs[o]||0)+1;break}}}
  const best=Object.entries(offs).sort((a,b)=>b[1]-a[1])[0];const offset=best&&best[1]>=2?+best[0]:(best?+best[0]:0);
  const fix=p=>Math.max(1,Math.min(pages.length,p+offset));
  const lv=entries.some(e=>e.level===1)&&entries.some(e=>e.level===2)?[1,2]:entries.some(e=>e.level===0)&&entries.some(e=>e.level===1)?[0,1]:null;
  if(!lv)return structFlat(entries.map(e=>({title:e.title,start:fix(e.printed)})));
  const units=[];for(const e of entries){if(e.level===lv[0])units.push({title:e.title,start:fix(e.printed),lessons:[]});else if(e.level===lv[1]&&units.length)units[units.length-1].lessons.push({title:e.title,start:fix(e.printed)})}
  units.forEach(u=>{if(!u.lessons.length)u.lessons=[{title:u.title,start:u.start}]});
  return units.length?{units,offsetMatched:!!(best&&best[1]>=2)}:null}

function structFromHeadings(pages){const hs=[];pages.forEach(p=>p.lines.forEach(l=>{if(l.text.length>3)hs.push(l.h||0)}));const body=median(hs)||10;
  const rep={};pages.forEach(p=>p.lines.slice(0,3).concat(p.lines.slice(-2)).forEach(l=>{const k=normTitle(l.text).replace(/\d+/g,'#');rep[k]=(rep[k]||0)+1}));
  const running=k=>rep[normTitle(k).replace(/\d+/g,'#')]>Math.max(4,pages.length*.04);
  const tocSet=new Set(findTocPages(pages).pages.map(p=>p.n));
  const chapRe=/^(chapter|lecture|part|unit|module|lesson)\s+([0-9]+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b[.:\s-]*(.*)$/i;
  const secRe=/^(§\s*)?(\d{1,2}|[A-Z])\.(\d{1,2})\.?\s+([A-Z(][^]{2,90})$/;
  const found=[];
  for(const p of pages){if(tocSet.has(p.n))continue;const lines=p.lines;
    for(let i=0;i<lines.length;i++){const l=lines[i];if(l.top>.5||l.text.length>95||running(l.text))continue;const big=(l.h||0)/body;let m;
      if((m=l.text.match(chapRe))&&(big>=1.15||l.top<.3)){let title=(m[3]||'').trim();if(!title&&lines[i+1]&&(lines[i+1].h||0)/body>=1.15)title=lines[i+1].text;
        found.push({kind:'c',num:m[2],title:(m[1][0].toUpperCase()+m[1].slice(1).toLowerCase())+' '+m[2]+(title?': '+title:''),page:p.n,big});break}
      if((m=l.text.match(secRe))&&!/\d\s*$/.test(m[4])&&big>=1.05){found.push({kind:'s',num:m[2],title:m[2]+'.'+m[3]+' '+m[4].trim(),page:p.n,big});continue}
      if(big>=1.7&&l.top<.35&&/[a-z]{3}/i.test(l.text)&&!/[.,;:]$/.test(l.text)&&l.text.split(' ').length<=12&&!SKIP_RE.test(l.text)){found.push({kind:'b',title:l.text,page:p.n,big});break}}}
  const cs=found.filter(f=>f.kind==='c'),ss=found.filter(f=>f.kind==='s'),bs=found.filter(f=>f.kind==='b');
  const dedupe=a=>{const seen=new Set();return a.filter(f=>{const k=normTitle(f.title);if(seen.has(k))return false;seen.add(k);return true})};
  if(ss.length>=3){const units=[];
    for(const f of dedupe([...cs,...ss]).sort((a,b)=>a.page-b.page)){
      if(f.kind==='c')units.push({title:f.title,start:f.page,lessons:[],num:String(f.num)});
      else{let u=units.filter(x=>x.num===f.num).pop()||(cs.length?null:units.find(x=>x.num===f.num));
        if(!u){u={title:'Chapter '+f.num,start:f.page,lessons:[],num:f.num};units.push(u)}u.lessons.push({title:f.title,start:f.page})}}
    units.forEach(u=>{if(!u.lessons.length)u.lessons=[{title:u.title,start:u.start}];delete u.num});return{units:units.sort((a,b)=>a.start-b.start)}}
  if(cs.length>=2)return structFlat(dedupe(cs).map(f=>({title:f.title,start:f.page})));
  if(bs.length>=3&&bs.length<pages.length/2)return structFlat(dedupe(bs).map(f=>({title:f.title,start:f.page})));
  return null}
function structPages(n){const size=n>400?20:n>120?12:8;const entries=[];for(let p=1;p<=n;p+=size)entries.push({title:'Pages '+p+'–'+Math.min(n,p+size-1),start:p});return structFlat(entries)}

function backMatterStart(pages){const n=pages.length;for(let i=Math.floor(n*.75);i<n;i++){const top=pages[i].lines.slice(0,4).map(l=>l.text).join(' ');if(/^(index|subject index|bibliography|references|glossary)\b/i.test(top.trim()))return i+1}return null}
function normalizeStruct(st,n,pages){if(!st)return null;const back=backMatterStart(pages)||n+1;
  const units=st.units.map(u=>({title:u.title,start:u.start,lessons:u.lessons.filter(l=>l.start>=1&&l.start<back).sort((a,b)=>a.start-b.start)})).filter(u=>u.lessons.length&&u.start<back).sort((a,b)=>a.start-b.start);
  const starts=[...new Set(units.flatMap(u=>[u.start,...u.lessons.map(l=>l.start)]))].sort((a,b)=>a-b);const last=back-1;
  units.forEach(u=>u.lessons.forEach(l=>{const nx=starts.find(s=>s>l.start);l.end=Math.max(l.start,Math.min(last,(nx||last+1)-1))}));
  units.forEach(u=>{const seen=new Set();u.lessons=u.lessons.filter(l=>{const k=l.start+'|'+l.title;if(seen.has(k))return false;seen.add(k);return true})});
  return{units:units.filter(u=>u.lessons.length)}}
function scoreStruct(st,n){if(!st||!st.units.length)return-1e9;const ls=st.units.flatMap(u=>u.lessons);if(ls.length<2)return-1e9;
  const lens=ls.map(l=>l.end-l.start+1),med=median(lens),mx=Math.max(...lens),cover=(Math.max(...ls.map(l=>l.end))-Math.min(...ls.map(l=>l.start))+1)/n;
  const bad=ls.filter(l=>BAD_TITLE.test(l.title.trim())).length/ls.length+st.units.filter(u=>BAD_TITLE.test(u.title.trim())).length/st.units.length;
  let s=Math.min(ls.length,150)/6;
  s+=med>=2&&med<=35?8:med>60?-12:0;
  if(mx>Math.max(80,n*.35))s-=14;else if(mx>60)s-=4;
  s-=bad*25;s+=cover>.6?4:cover<.35?-10:0;
  if(st.units.length>1&&st.units.length<60)s+=3;
  return s}
function splitLong(units,pages,body){const MAX=36;
  for(const u of units){const out=[];for(const l of u.lessons){const len=l.end-l.start+1;if(len<=MAX){out.push(l);continue}
      const subs=[];for(let p=l.start+1;p<=l.end;p++){const pg=pages[p-1];if(!pg)continue;const h=pg.lines.find(x=>x.top<.3&&(x.h||0)>=body*1.3&&x.text.length<80&&/[a-z]{3}/i.test(x.text)&&!EX_RE.test(x.text));if(h)subs.push({title:h.text,start:p})}
      let cuts=subs.filter((s,i,a)=>i===0?s.start-l.start>=4:s.start-a[i-1].start>=4);
      if(cuts.length<1||cuts.length>len/3){cuts=[];const k=Math.ceil(len/16);for(let i=1;i<k;i++)cuts.push({title:'',start:l.start+Math.round(i*len/k)})}
      const pts=[{title:l.title,start:l.start},...cuts];
      pts.forEach((c,i)=>out.push({title:c.title&&i>0?c.title:l.title+' (part '+(i+1)+' of '+pts.length+')',start:c.start,end:(pts[i+1]?pts[i+1].start-1:l.end)}))}
    u.lessons=out}}
function attachExercises(units,pages){for(const u of units)for(const l of u.lessons){l.readEnd=l.end;l.ex=null;
    for(let p=l.start;p<=l.end;p++){const pg=pages[p-1];if(!pg)continue;const hit=pg.lines.find(x=>x.text.length<48&&EX_RE.test(x.text));
      if(hit){if(p===l.start&&hit.top<.2&&l.end>l.start&&l.start===u.lessons[0].start&&false)continue;l.ex={start:p,end:l.end,label:hit.text.replace(/\s+/g,' ')};l.readEnd=Math.max(l.start,hit.top<.25?p-1:p);break}}}
  // a unit whose last section holds the chapter's problems: show them as their own practice stop
  for(const u of units){const last=u.lessons[u.lessons.length-1];if(last.ex&&u.lessons.length>1&&!u.lessons.slice(0,-1).some(x=>x.ex)){u.practice=last.ex;last.ex=null;last.readEnd=Math.max(last.start,u.practice.start-(1))}}}
function headingsInRange(pages,a,b,body){const out=[];for(let p=a;p<=b;p++){const pg=pages[p-1];if(!pg)continue;
    for(const l of pg.lines){if((l.h||0)>=body*1.12&&l.text.length>3&&l.text.length<80&&/[a-z]{3}/i.test(l.text)&&!/[.,;]$/.test(l.text)&&!EX_RE.test(l.text))out.push(l.text)}}
  return[...new Set(out)].slice(0,8)}

async function buildCourse(w,buf,onProg){if(COURSE.building[w.id])return COURSE.building[w.id];
  const job=(async()=>{const data=buf||await readWsPdf(w.id);if(!data)throw new Error('The PDF for this book could not be found.');
    const doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;const n=doc.numPages;
    let metaTitle=null;try{const md=await doc.getMetadata();metaTitle=md&&md.info&&md.info.Title}catch(e){}
    const pages=[];
    for(let i=1;i<=n;i++){const pg=await doc.getPage(i);let lines=[];try{lines=await pageLines(pg)}catch(e){}pages.push({n:i,lines});pg.cleanup();if(onProg&&(i%5===0||i===n))onProg(i,n)}
    const textChars=pages.reduce((a,p)=>a+p.lines.reduce((b,l)=>b+l.text.length,0),0);
    const hs=[];pages.forEach(p=>p.lines.forEach(l=>{if(l.text.length>3)hs.push(l.h||0)}));const body=median(hs)||10;
    const cands=[];const tree=await outlineTree(doc);
    if(tree){for(let d=0;d<=2;d++){const st=structFromOutline(tree,d);if(st)cands.push(['outline',st])}
      for(let d=0;d<=3;d++){const flat=nodesAt(tree,d).filter(x=>x.page&&!SKIP_RE.test(x.title)).map(x=>({title:x.title,start:x.page}));const st=structFlat(flat);if(st)cands.push(['outline',st])}}
    if(textChars>n*80){const t=structFromPrintedToc(pages);if(t)cands.push(['toc',t]);const h=structFromHeadings(pages);if(h)cands.push(['headings',h])}
    cands.push(['pages',structPages(n)]);
    let best=null;for(const [src,st] of cands){const norm=normalizeStruct(st,n,pages);const sc=scoreStruct(norm,n)+(src==='outline'?2:src==='toc'?1:src==='pages'?-6:0);if(!best||sc>best.sc)best={src,st:norm,sc}}
    const units=best.st.units;splitLong(units,pages,body);attachExercises(units,pages);
    units.forEach((u,ui)=>{u.lessons.forEach((l,li)=>{l.id='u'+ui+'l'+li;l.keys=headingsInRange(pages,l.start,l.readEnd,body)});u.end=u.lessons[u.lessons.length-1].end});
    const exams=[];if(units.length>=4){const mid=Math.ceil(units.length/2)-1;exams.push({id:'midterm',kind:'midterm',title:'Midterm',after:mid,covers:units.slice(0,mid+1).map((_,i)=>i)})}
    exams.push({id:'final',kind:'final',title:'Final exam',after:units.length-1,covers:units.map((_,i)=>i)});
    const course={v:COURSE_V,units,exams,source:best.src,pages:n,built:Date.now(),m:{},results:{},scanned:textChars<n*80};
    const old=await getCourse(w.id);if(old&&old.v===COURSE_V){course.m=old.m||{};course.results=old.results||{}}else if(old)course.results=old.results||{};
    const headings=units.flatMap(u=>[u.title,...u.lessons.map(l=>l.title)]);
    if(!w.nameManual&&metaTitle){const nm=cleanBookName(w.pdfName,metaTitle);if(nm&&nm!==w.name)w.name=nm}
    if(!w.subjectManual)w.subject=classifySubject(w.name+' '+(w.pdfName||'')+' '+(metaTitle||''),headings,pages.slice(0,40).map(p=>p.lines.map(l=>l.text).join(' ')).join(' '));
    w.lessons=units.reduce((a,u)=>a+u.lessons.length,0);w.pages=n;saveWsList();
    await saveCourse(w.id,course);doc.destroy();return course})();
  COURSE.building[w.id]=job;try{return await job}finally{delete COURSE.building[w.id]}}
const COURSE={building:{},cache:{}};
async function getCourse(id){return(await idb.get('course:'+id))||null}
async function saveCourse(id,c){COURSE.cache[id]=c;await idb.set('course:'+id,c)}

async function aiFindSections(w){if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings first.');openSettings();return}
  const data=await readWsPdf(w.id);const doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;const n=doc.numPages;
  const pages=[];for(let i=1;i<=n;i++){const pg=await doc.getPage(i);pages.push({n:i,lines:await pageLines(pg)});pg.cleanup()}
  const front=pages.slice(0,Math.min(30,n)).map(p=>'[pdf page '+p.n+'] '+p.lines.map(l=>l.text).join(' | ')).join('\n').slice(0,50000);
  const res=aiJSON(await aiCall('These are the first pages of a book, including its table of contents. List its chapters and their sections in order.\nReply with only JSON: {"units":[{"title":"chapter title as printed","page":printed page number,"lessons":[{"title":"section title as printed","page":printed page number}]}]}\nSkip the preface, index, bibliography and answer pages. If the book has only chapters, give each chapter one lesson with the same title.\n\n'+front,4500));
  if(!res||!Array.isArray(res.units)||!res.units.length)throw new Error('No sections found');
  const norm=s=>normTitle(s).replace(/^((chapter|part)\s+)?[\divxlc.]+\s*/i,'').replace(/[^a-z0-9 ]/g,'').trim();const offs={};
  for(const u of res.units.slice(0,12)){const k=norm(u.title).slice(0,30);if(k.length<5||!u.page)continue;const hit=pages.find(p=>p.n>Math.min(20,n/5)&&p.lines.slice(0,10).some(l=>norm(l.text).startsWith(k)));if(hit){const o=hit.n-(+u.page);offs[o]=(offs[o]||0)+1}}
  const bo=Object.entries(offs).sort((a,b)=>b[1]-a[1])[0];const offset=bo?+bo[0]:0;const fix=p=>Math.max(1,Math.min(n,(+p||1)+offset));
  const st=normalizeStruct({units:res.units.map(u=>({title:String(u.title),start:fix(u.page),lessons:(u.lessons&&u.lessons.length?u.lessons:[{title:u.title,page:u.page}]).map(l=>({title:String(l.title),start:fix(l.page)}))}))},n,pages);
  const hs=[];pages.forEach(p=>p.lines.forEach(l=>{if(l.text.length>3)hs.push(l.h||0)}));const body=median(hs)||10;
  splitLong(st.units,pages,body);attachExercises(st.units,pages);st.units.forEach((u,ui)=>{u.lessons.forEach((l,li)=>{l.id='u'+ui+'l'+li;l.keys=headingsInRange(pages,l.start,l.readEnd,body)});u.end=u.lessons[u.lessons.length-1].end});
  const old=await getCourse(w.id);const exams=[];if(st.units.length>=4){const mid=Math.ceil(st.units.length/2)-1;exams.push({id:'midterm',kind:'midterm',title:'Midterm',after:mid,covers:st.units.slice(0,mid+1).map((_,i)=>i)})}
  exams.push({id:'final',kind:'final',title:'Final exam',after:st.units.length-1,covers:st.units.map((_,i)=>i)});
  const course={v:COURSE_V,units:st.units,exams,source:'ai',pages:n,built:Date.now(),m:{},results:(old&&old.results)||{}};
  w.lessons=st.units.reduce((a,u)=>a+u.lessons.length,0);saveWsList();await saveCourse(w.id,course);doc.destroy();return course}

/* ================= MASTERY (local logic, no AI) ================= */
const RATING={again:0,hard:.45,good:.8,easy:1},PRAC={none:0,some:.5,most:.8,all:1};
function lessonM(c,l){return c.m[l.id]||(c.m[l.id]={})}
function mastery(c,l){const m=c.m[l.id]||{};const hasEx=!!l.ex;let s=0;
  if(m.read)s+=.25;const r=m.recall?RATING[m.recall.rating]||0:0;const p=m.practice?PRAC[m.practice.rating]||0:0;
  s+=hasEx?r*.3+p*.45:r*.75;
  if(m.last){const days=(Date.now()-m.last)/864e5;const ret=Math.exp(-days/Math.max(1,m.stab||1));s*=.55+.45*ret}
  const due=!!(m.due&&Date.now()>=m.due&&(m.recall||m.practice));
  const state=!m.started&&!m.read?'new':due?'due':s>=.82?'mastered':s>=.5?'learned':'progress';
  return{score:Math.min(1,s),state,due}}
function schedule(m,rating){const q={again:0,hard:3,good:4,easy:5,none:1,some:3,most:4,all:5}[rating]??3;
  m.ease=Math.max(1.3,(m.ease||2.5)+.1-(5-q)*(.08+(5-q)*.02));
  if(q<3){m.reps=0;m.stab=1}else{m.reps=(m.reps||0)+1;m.stab=m.reps===1?1:m.reps===2?4:Math.round((m.stab||1)*m.ease)}
  m.last=Date.now();m.due=Date.now()+m.stab*864e5}
function unitScore(c,u){return u.lessons.reduce((a,l)=>a+mastery(c,l).score,0)/u.lessons.length}
function unitOpen(c,ui){return ui===0||unitScore(c,c.units[ui-1])>=.5||c.units[ui].lessons.some(l=>(c.m[l.id]||{}).started)}
function courseProgress(c){if(!c||!c.units)return{done:0,total:0,p:0};const ls=c.units.flatMap(u=>u.lessons);const sc=ls.reduce((a,l)=>a+mastery(c,l).score,0);
  return{done:ls.filter(l=>mastery(c,l).score>=.5).length,total:ls.length,p:ls.length?sc/ls.length:0,due:ls.filter(l=>mastery(c,l).due).length}}
function nextLesson(c){if(!c||!c.units)return null;let firstDue=null;
  for(let ui=0;ui<c.units.length;ui++)for(let li=0;li<c.units[ui].lessons.length;li++){const st=mastery(c,c.units[ui].lessons[li]);if(st.due&&!firstDue)firstDue={ui,li,review:true};if(st.score<.5&&st.state!=='due')return{ui,li}}
  return firstDue}
async function dueReviews(){const out=[];for(const w of WS){const c=COURSE.cache[w.id]||(COURSE.cache[w.id]=await getCourse(w.id));if(!c||!c.units)continue;
    c.units.forEach((u,ui)=>u.lessons.forEach((l,li)=>{if(mastery(c,l).due)out.push({w,ui,li,l})}))}return out}

/* ---- course page ---- */
async function renderCourse(id){const w=WS.find(x=>x.id===id),el=$('pg-course');if(!w){shellGo('learn');return}
  let c=await getCourse(id);if(c&&c.v!==COURSE_V)c=null;
  const head='<header class="pg-head"><div><button class="btn small" id="crBack">← Learn</button></div></header>'+
    '<section class="course-hero card"><span class="cover lg" style="background:'+(w.color||'#2f7ff0')+'"><b>'+esc2((w.name.trim()[0]||'?').toUpperCase())+'</b></span><div class="ch-main"><span class="subj-chip">'+esc2(subjectOf(w))+'</span><h1 id="crTitle"></h1><p class="muted" id="crSub"></p></div><div class="ch-side" id="crSide"></div></section>';
  if(!c){el.innerHTML=head+'<section class="card build-card"><h2>Building your course</h2><p class="muted" id="crProg">Reading the book on your computer…</p><div class="pr-bar"><span id="crBar"></span></div></section>';
    fillCourseHead(w,null);$('crBack').onclick=()=>shellGo('learn');
    if(!w.pdfName){$('crProg').textContent='Add a PDF to this book first (Profile → My content).';return}
    try{c=await buildCourse(w,null,(i,n)=>{const p=$('crProg');if(p&&SHELL_PAGE==='course'){p.textContent='Reading page '+i+' of '+n+' on your computer. No AI.';$('crBar').style.width=(100*i/n)+'%'}})}
    catch(e){const p=$('crProg');if(p)p.textContent='Could not build the course: '+(e.message||e);return}
    if(SHELL_PAGE==='course')renderCourse(id);return}
  COURSE.cache[id]=c;const nl=nextLesson(c);
  let html=head+'<div class="tree">';const offs=[0,56,84,56,0,-56,-84,-56];let k=0;
  c.units.forEach((u,ui)=>{const open=unitOpen(c,ui),us=unitScore(c,u);
    html+='<div class="unit-card card'+(us>=.82?' done':'')+(open?'':' locked')+'"><span class="unit-n">'+(open?'':'🔒 ')+'Unit '+(ui+1)+'</span><b></b><span class="muted">pp. '+u.lessons[0].start+'–'+u.end+' · '+Math.round(us*100)+'% mastered</span></div><div class="nodes">';
    u.lessons.forEach((l,li)=>{const ms=mastery(c,l),cur=nl&&nl.ui===ui&&nl.li===li;
      html+='<button class="node st-'+ms.state+(cur?' cur':'')+(open?'':' lockednode')+'" data-ui="'+ui+'" data-li="'+li+'" style="--off:'+offs[k++%offs.length]+'px"><span class="dot">'+(ms.state==='mastered'?'★':ms.state==='learned'?'✓':ms.state==='due'?'↻':li+1)+'</span><span class="node-t"><b></b><small>pp. '+l.start+'–'+l.readEnd+(l.ex?' · has exercises':'')+' · '+({new:'not started',progress:'in progress',learned:'learned',mastered:'mastered',due:'review due'}[ms.state])+'</small></span>'+(cur?'<span class="start-tag">'+(nl.review?'Review':'Next')+'</span>':'')+'</button>'});
    if(u.practice)html+='<button class="node prac" data-up="'+ui+'" style="--off:0px"><span class="dot">✎</span><span class="node-t"><b>'+esc2(u.practice.label||'Chapter problems')+'</b><small>pp. '+u.practice.start+'–'+u.practice.end+'</small></span></button>';
    html+='</div>';
    c.exams.filter(x=>x.after===ui).forEach(x=>{const r=c.results[x.id];
      html+='<button class="exam-node card" data-exam="'+x.id+'"><span class="trophy">'+ICON.target+'</span><span><b>'+x.title+'</b><small class="muted">Covers units '+(x.covers[0]+1)+'–'+(x.covers[x.covers.length-1]+1)+(r?' · best '+Math.round(100*r.best)+'%':'')+'</small></span><span class="btn solid small">'+(r?'Retake':'Take')+'</span></button>'})});
  html+='</div><div class="course-foot"><span class="muted">'+({outline:'Sections come from the PDF\'s bookmarks.',toc:'Sections were read from the printed table of contents.',headings:'Sections were found from the book\'s headings.',pages:'No usable structure was found, so the book is split into page ranges.',ai:'Sections were read from the table of contents with AI.'}[c.source]||'')+(c.scanned?' This PDF has little readable text (it may be scanned).':'')+'</span>'+
    '<button class="btn small" id="crRebuild">Rebuild</button>'+(c.source!=='outline'||c.units.length<2?'<button class="btn small" id="crAI">Find sections with AI (one time)</button>':'')+'</div>';
  el.innerHTML=html;fillCourseHead(w,c);
  c.units.forEach((u,ui)=>{el.querySelectorAll('.unit-card b')[ui].textContent=u.title;u.lessons.forEach((l,li)=>{const b=el.querySelector('.node[data-ui="'+ui+'"][data-li="'+li+'"] b');if(b)b.textContent=l.title})});
  el.querySelectorAll('.node[data-ui]').forEach(b=>b.onclick=()=>{const ui=+b.dataset.ui;if(!unitOpen(c,ui)&&!b.dataset.armed){b.dataset.armed='1';toast('Unit '+ui+' is not mastered yet. Click again to start this anyway.',3500);return}openStudy(id,ui,+b.dataset.li)});
  el.querySelectorAll('.node[data-up]').forEach(b=>b.onclick=()=>openStudy(id,+b.dataset.up,-1));
  el.querySelectorAll('.exam-node').forEach(b=>b.onclick=()=>openExam(id,b.dataset.exam));
  $('crBack').onclick=()=>shellGo('learn');
  $('crRebuild').onclick=async()=>{await idb.del('course:'+id);delete COURSE.cache[id];renderCourse(id)};
  const ai=$('crAI');if(ai)ai.onclick=async()=>{ai.disabled=true;ai.textContent='Reading the table of contents…';try{await aiFindSections(w);renderCourse(id);toast('Sections updated.')}catch(e){toast(e.code?(ERRS[e.code]||e.message):'Could not find sections: '+(e.message||e),5000);ai.disabled=false;ai.textContent='Find sections with AI (one time)'}}}
function fillCourseHead(w,c){$('crTitle').textContent=w.name;const pr=courseProgress(c);
  $('crSub').textContent=c?c.units.length+' units · '+pr.total+' lessons · '+(w.pages||c.pages)+' pages, nothing cut'+(pr.due?' · '+pr.due+' review'+(pr.due>1?'s':'')+' due':''):'';
  if(c){const nl=nextLesson(c);$('crSide').innerHTML=ring(pr.p,76,'var(--c-book)',Math.round(pr.p*100)+'%')+'<button class="btn solid big" id="crGo">'+(nl?(nl.review?'Review':pr.done?'Continue':'Start course'):'Review')+'</button><button class="btn small" id="crOpen">Open whole book</button>';
    $('crGo').onclick=()=>{const n=nextLesson(c)||{ui:0,li:0};openStudy(w.id,n.ui,n.li)};$('crOpen').onclick=()=>openWorkspace(w.id)}}
function openLesson(id,ui,li){return openStudy(id,ui,li)}

/* ================= STUDY SCREEN (one section at a time) ================= */
const STUDY={doc:null,docId:null,io:null};
async function studyDoc(id){if(STUDY.docId===id&&STUDY.doc)return STUDY.doc;if(STUDY.doc){try{STUDY.doc.destroy()}catch(e){}}
  const data=await readWsPdf(id);STUDY.doc=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;STUDY.docId=id;return STUDY.doc}
async function mountPages(box,doc,a,b,onPage){box.innerHTML='';if(STUDY.io)STUDY.io.disconnect();
  const p1=await doc.getPage(a);const v1=p1.getViewport({scale:1});const W=Math.min(980,box.clientWidth-40)||820;const sc=W/v1.width;const r=Math.min(window.devicePixelRatio||1,2.5);
  const io=new IntersectionObserver(async es=>{for(const e of es){if(!e.isIntersecting||e.target.dataset.done)continue;e.target.dataset.done=1;const pg=await doc.getPage(+e.target.dataset.p);const vp=pg.getViewport({scale:sc});
      const c=document.createElement('canvas');c.width=Math.floor(vp.width*r);c.height=Math.floor(vp.height*r);c.style.width=vp.width+'px';c.style.height=vp.height+'px';
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp,transform:r!==1?[r,0,0,r,0,0]:null}).promise;e.target.innerHTML='';e.target.append(c)}},{root:box,rootMargin:'900px 0px'});
  STUDY.io=io;
  for(let p=a;p<=b;p++){const d=document.createElement('div');d.className='spg';d.dataset.p=p;d.style.width=W+'px';d.style.height=Math.round(v1.height*sc)+'px';d.innerHTML='<span class="spg-n">p. '+p+'</span>';box.append(d);io.observe(d)}
  box.onscroll=()=>{if(!onPage)return;const kids=[...box.children];const mid=box.scrollTop+box.clientHeight*.4;let cur=a;for(const k of kids)if(k.offsetTop<=mid)cur=+k.dataset.p;onPage(cur)}}
async function openStudy(id,ui,li,startStep){const w=WS.find(x=>x.id===id);let c=COURSE.cache[id]||await getCourse(id);if(!w||!c)return;
  const u=c.units[ui];const l=li<0?{id:'u'+ui+'prac',title:u.practice.label||'Chapter problems',start:u.practice.start,readEnd:u.practice.start-1,end:u.practice.end,ex:u.practice,keys:[],unitPractice:true}:u.lessons[li];
  const m=lessonM(c,l);m.started=m.started||Date.now();await saveCourse(id,c);setLast({kind:'course',id,ui,li});logActivity('read');
  const st=mastery(c,l);
  const steps=l.unitPractice?['practice','done']:['read','questions','recall',...(l.ex?['practice']:[]),'done'];
  let step=startStep||(st.state==='due'?'recall':m.read?(m.recall?(l.ex&&!m.practice?'practice':'done'):'questions'):'read');
  STUDY.ctx={w,c,u,ui,li,l,m,steps,review:st.state==='due'};
  $('study').hidden=false;$('stTitle').textContent=l.title;$('stKicker').textContent=w.name+' · Unit '+(ui+1)+(STUDY.ctx.review?' · Review':'');
  $('stSteps').innerHTML=steps.map(s=>'<button data-s="'+s+'">'+({read:'Read',questions:'Questions',recall:'Recall',practice:'Practice',done:'Done'}[s])+'</button>').join('');
  $('stSteps').querySelectorAll('button').forEach(b=>b.onclick=()=>studyStep(b.dataset.s));
  await studyDoc(id);studyStep(step)}
function closeStudy(){$('study').hidden=true;if(STUDY.io)STUDY.io.disconnect();const id=STUDY.ctx&&STUDY.ctx.w.id;if(STUDY.doc){try{STUDY.doc.destroy()}catch(e){}STUDY.doc=null;STUDY.docId=null}shellGo('course',id)}
$('stBack').onclick=closeStudy;
async function studyStep(s){const X=STUDY.ctx;X.step=s;const {l,m,c,w}=X;
  $('stSteps').querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('on',b.dataset.s===s);const idx=X.steps.indexOf(s);b.classList.toggle('past',i<idx)});
  const main=$('stMain'),side=$('stSide'),foot=$('stFoot');side.hidden=false;main.className='st-main';
  if(s==='read'){const span=l.readEnd-l.start+1;
    foot.innerHTML='<span class="st-hint" id="stPage">Page 1 of '+span+'</span><div class="pbar st-pb"><i id="stPbar"></i></div><button class="btn solid big" id="stNext">I finished reading</button>';
    renderQuestionsSide(side,false);
    await mountPages(main,STUDY.doc,l.start,l.readEnd,p=>{const at=p-l.start+1;$('stPage').textContent='Page '+at+' of '+span;$('stPbar').style.width=(100*at/span)+'%';if(at>=span)$('stNext').classList.add('pulse')});
    $('stNext').onclick=async()=>{m.read=m.read||Date.now();await saveCourse(w.id,c);studyStep((m.questions||[]).some(q=>!q.done)?'questions':'recall')}}
  else if(s==='questions'){foot.innerHTML='<span class="st-hint">Answer what you can by looking back. Anything left over, ask the tutor or bring to class.</span><button class="btn solid big" id="stNext">Continue to recall</button>';
    renderQuestionsSide(side,true);await mountPages(main,STUDY.doc,l.start,l.readEnd);$('stNext').onclick=()=>studyStep('recall')}
  else if(s==='recall'){side.hidden=true;main.className='st-main st-recall';
    const prompts=(l.keys&&l.keys.length?l.keys:[l.title]).slice(0,6);
    main.innerHTML='<div class="recall"><h2>'+(X.review?'Review: ':'')+'What do you remember?</h2><p class="muted">Without looking, write the main ideas, definitions and results of this section. Retrieving it from memory is what makes it stick.</p>'+
      '<div class="rc-prompts">'+prompts.map(p=>'<span class="rc-p"></span>').join('')+'</div><textarea id="rcText" placeholder="Explain it in your own words. Include any formulas or steps you can reconstruct."></textarea>'+
      '<div class="rc-check" id="rcCheck" hidden><h3>Now compare with the book</h3><div class="rc-pages" id="rcPages"></div><p class="muted">How well did your recall match the text?</p><div class="rc-rate"><button data-r="again" class="btn big">Missed most</button><button data-r="hard" class="btn big">Got some</button><button data-r="good" class="btn big">Got most</button><button data-r="easy" class="btn big">Nailed it</button></div></div></div>';
    main.querySelectorAll('.rc-p').forEach((sp,i)=>sp.textContent=prompts[i]);
    const ta=$('rcText');ta.value=(m.recall&&m.recall.text&&!X.review)?m.recall.text:'';
    foot.innerHTML='<span class="st-hint">Write first, then check. Be honest with the rating; it sets when this comes back for review.</span><button class="btn solid big" id="stNext">Check against the book</button>';
    $('stNext').onclick=async()=>{if(ta.value.trim().length<20){toast('Write a few sentences from memory first.');ta.focus();return}$('rcCheck').hidden=false;$('stNext').hidden=true;
      await mountPages($('rcPages'),STUDY.doc,l.start,l.readEnd);$('rcCheck').scrollIntoView({behavior:'smooth'})};
    main.querySelectorAll('.rc-rate button').forEach(b=>b.onclick=async()=>{m.recall={rating:b.dataset.r,text:ta.value,t:Date.now()};schedule(m,b.dataset.r);await saveCourse(w.id,c);logActivity('q');
      studyStep(l.ex&&(!m.practice||X.review)?'practice':'done')})}
  else if(s==='practice'){const ex=l.ex;
    foot.innerHTML='<span class="st-hint">Work the problems on paper or below, then rate how it went.</span><div class="rc-rate inline"><span class="muted">How many could you do?</span><button data-r="none" class="btn">None</button><button data-r="some" class="btn">Some</button><button data-r="most" class="btn">Most</button><button data-r="all" class="btn">All</button></div>';
    renderPracticeSide(side);await mountPages(main,STUDY.doc,ex.start,ex.end);
    foot.querySelectorAll('.rc-rate button').forEach(b=>b.onclick=async()=>{m.practice={rating:b.dataset.r,t:Date.now(),items:m.practice&&m.practice.items||[]};
      if(l.unitPractice){u_markUnitPractice(X,b.dataset.r)}else schedule(m,m.recall&&RATING[m.recall.rating]<PRAC[b.dataset.r]?m.recall.rating:b.dataset.r);
      await saveCourse(w.id,c);logActivity('q');studyStep('done')})}
  else if(s==='done'){side.hidden=true;main.className='st-main st-done';const ms=mastery(c,l);const nl=nextLesson(c);
    const dueIn=m.due?Math.max(1,Math.round((m.due-Date.now())/864e5)):null;
    main.innerHTML='<div class="done-card"><div class="res-ring" style="--p:'+Math.round(ms.score*100)+'"><b>'+Math.round(ms.score*100)+'<small>%</small></b></div><h2>'+({mastered:'Mastered',learned:'Learned',progress:'Keep going',due:'Review due',new:'Started'}[ms.state])+'</h2>'+
      '<ul class="done-list"><li class="'+(m.read?'ok':'')+'">Read the section</li><li class="'+(m.recall?'ok':'')+'">Recalled it from memory'+(m.recall?' ('+({again:'missed most',hard:'got some',good:'got most',easy:'nailed it'}[m.recall.rating])+')':'')+'</li>'+(l.ex?'<li class="'+(m.practice?'ok':'')+'">Worked the exercises'+(m.practice?' ('+m.practice.rating+')':'')+'</li>':'')+'</ul>'+
      (dueIn?'<p class="muted">Next review in '+dueIn+' day'+(dueIn>1?'s':'')+'. PolyMath will bring it back on Home when it is due.</p>':'')+
      ((m.questions||[]).filter(q=>!q.done).length?'<p class="muted">You have '+(m.questions.filter(q=>!q.done).length)+' open question(s) saved for this section.</p>':'')+'</div>';
    foot.innerHTML='<button class="btn big" id="stCourse">Back to course</button>'+(nl&&!(nl.ui===X.ui&&nl.li===X.li)?'<button class="btn solid big" id="stNext">'+(nl.review?'Next review':'Next lesson')+' →</button>':'');
    $('stCourse').onclick=closeStudy;const nx=$('stNext');if(nx)nx.onclick=()=>openStudy(w.id,nl.ui,nl.li)}}
function u_markUnitPractice(X,r){const m=X.m;schedule(m,r);for(const l of X.u.lessons){const lm=lessonM(X.c,l);if(!lm.practice)lm.practice={rating:r,t:Date.now(),fromUnit:true}}}
function renderQuestionsSide(side,answering){const X=STUDY.ctx,m=X.m;m.questions=m.questions||[];
  side.innerHTML='<h3>Questions about this section</h3><p class="muted small">'+(answering?'Answer them by looking back at the text.':'Jot down anything unclear while you read. You will come back to these before recall.')+'</p>'+
    '<div class="qadd"><input id="qIn" placeholder="e.g. Why does the dot product give the angle?" maxlength="300"><button class="btn small" id="qAdd">Add</button></div><div id="qList" class="qlist"></div>';
  const draw=()=>{const box=$('qList');box.innerHTML='';if(!m.questions.length){box.innerHTML='<p class="muted small">No questions yet.</p>';return}
    m.questions.forEach((q,i)=>{const d=document.createElement('div');d.className='qi'+(q.done?' done':'');
      d.innerHTML='<label class="qrow"><input type="checkbox"'+(q.done?' checked':'')+'><span class="qt"></span></label>'+(answering?'<textarea class="qa" rows="2" placeholder="Your answer"></textarea><div class="qacts"><button class="linkbtn qask">Ask tutor</button><button class="linkbtn qdel">Remove</button></div><div class="qai"></div>':'<button class="linkbtn qdel">Remove</button>');
      d.querySelector('.qt').textContent=q.q;const cb=d.querySelector('input');cb.onchange=()=>{q.done=cb.checked;d.classList.toggle('done',q.done);saveCourse(X.w.id,X.c)};
      const ta=d.querySelector('.qa');if(ta){ta.value=q.a||'';ta.oninput=()=>{q.a=ta.value;clearTimeout(q._t);q._t=setTimeout(()=>saveCourse(X.w.id,X.c),400)}}
      const ai=d.querySelector('.qai');if(ai&&q.ai){ai.innerHTML=mdLite(q.ai);typeset(ai)}
      d.querySelector('.qdel').onclick=()=>{m.questions.splice(i,1);saveCourse(X.w.id,X.c);draw()};
      const ask=d.querySelector('.qask');if(ask)ask.onclick=()=>askSectionQuestion(q,ai,ask);box.append(d)})};
  const add=()=>{const v=$('qIn').value.trim();if(!v)return;m.questions.push({q:v,a:'',done:false,t:Date.now()});$('qIn').value='';saveCourse(X.w.id,X.c);draw()};
  $('qAdd').onclick=add;$('qIn').onkeydown=e=>{if(e.key==='Enter')add()};draw()}
async function askSectionQuestion(q,box,btn){if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings to ask the tutor.');openSettings();return}
  const X=STUDY.ctx;btn.disabled=true;box.innerHTML='<div class="thinking">Thinking</div>';
  try{let text='';for(let p=X.l.start;p<=Math.min(X.l.readEnd,X.l.start+5);p++){const pg=await STUDY.doc.getPage(p);text+=' '+(await pageLines(pg)).map(x=>x.text).join(' ')}
    const {promise}=window.desk.claudeStart({system:'You are a patient tutor. Answer using the section text given, at its level of rigor. Be concise (under 150 words). Math in LaTeX with $...$.',
      messages:[{role:'user',content:'Book: "'+X.w.name+'", section "'+X.l.title+'".\nSection text (excerpt):\n'+text.slice(0,12000)+'\n\nStudent question: '+q.q+(q.a?'\nStudent\'s own attempt: '+q.a:'')}],model:SET.satModel||'claude-haiku-5-5',max_tokens:600},()=>{});
    const res=await promise;if(res.error)throw Object.assign(new Error(res.error.message),{code:res.error.code});
    q.ai=(res.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');box.innerHTML=mdLite(q.ai);typeset(box);saveCourse(X.w.id,X.c)}
  catch(e){box.innerHTML='';toast(e.code?(ERRS[e.code]||e.message):'The tutor could not be reached.',4000)}finally{btn.disabled=false}}
function renderPracticeSide(side){const X=STUDY.ctx,m=X.m;m.practice=m.practice||null;const items=(m.prItems=m.prItems||[]);
  side.innerHTML='<h3>Your work</h3><p class="muted small">Log each problem you try. Mark the ones you got, the ones you got stuck on, and come back to the stuck ones later.</p><div class="qadd"><input id="pIn" placeholder="Problem number, e.g. 7" maxlength="40"><button class="btn small" id="pAdd">Add</button></div><div id="pList" class="qlist"></div>';
  const draw=()=>{const box=$('pList');box.innerHTML='';if(!items.length){box.innerHTML='<p class="muted small">Nothing logged yet.</p>';return}
    items.forEach((it,i)=>{const d=document.createElement('div');d.className='qi pi st-'+(it.s||'todo');
      d.innerHTML='<div class="pi-h"><b class="pn"></b><div class="pi-s"><button data-s="got" title="Got it">✓</button><button data-s="stuck" title="Stuck">?</button><button data-s="wrong" title="Wrong">✗</button></div></div><textarea class="qa" rows="2" placeholder="Answer or notes"></textarea><div class="qacts"><button class="linkbtn pdel">Remove</button></div>';
      d.querySelector('.pn').textContent='Problem '+it.n;const ta=d.querySelector('.qa');ta.value=it.a||'';ta.oninput=()=>{it.a=ta.value;clearTimeout(it._t);it._t=setTimeout(()=>saveCourse(X.w.id,X.c),400)};
      d.querySelectorAll('.pi-s button').forEach(b=>{b.classList.toggle('on',it.s===b.dataset.s);b.onclick=()=>{it.s=b.dataset.s;saveCourse(X.w.id,X.c);draw()}});
      d.querySelector('.pdel').onclick=()=>{items.splice(i,1);saveCourse(X.w.id,X.c);draw()};box.append(d)})};
  const add=()=>{const v=$('pIn').value.trim();if(!v)return;items.push({n:v,a:'',s:'todo'});$('pIn').value='';saveCourse(X.w.id,X.c);draw()};
  $('pAdd').onclick=add;$('pIn').onkeydown=e=>{if(e.key==='Enter')add()};draw()}

/* ================= MIDTERMS AND FINALS ================= */
const EX={cur:null};
async function examExcerpts(w,c,exam){const doc=await studyDoc(w.id);
  const lessons=exam.covers.flatMap(ui=>c.units[ui].lessons.map(l=>({u:c.units[ui],l})));
  const per=Math.max(900,Math.floor(70000/Math.max(1,lessons.length)));let out='';
  for(const {u,l} of lessons){const want=[l.start,l.start+1,l.ex&&l.ex.start].filter((p,i,a)=>p&&p<=l.end&&a.indexOf(p)===i);let t='';
    for(const p of want){const pg=await doc.getPage(p);t+=' '+(await pageLines(pg)).map(x=>x.text).join(' ')}
    out+='\n\n### '+u.title+' / '+l.title+' (pp. '+l.start+'-'+l.end+')\n'+t.trim().slice(0,per)}
  return out.slice(0,80000)}
function examExercisePages(c,exam){const pages=[];for(const ui of exam.covers){const u=c.units[ui];if(u.practice)for(let p=u.practice.start;p<=u.practice.end;p++)pages.push({p,label:u.title});
    for(const l of u.lessons)if(l.ex)for(let p=l.ex.start;p<=l.ex.end;p++)pages.push({p,label:l.title})}return pages}
async function openExam(id,examId){const w=WS.find(x=>x.id===id),c=await getCourse(id);const exam=c&&c.exams.find(x=>x.id===examId);if(!exam)return;
  satView('examView');SAT.test={origin:'course'};$('satTitle').textContent=w.name+' · '+exam.title;$('sat').dataset.course=id;
  const saved=c.results[examId]&&c.results[examId].last;const exPages=examExercisePages(c,exam);
  $('examView').innerHTML='<div class="exam-intro"><span class="trophy big">'+ICON.target+'</span><h2>'+exam.title+'</h2><p class="muted">Covers '+exam.covers.map(i=>'Unit '+(i+1)).join(', ')+'.</p>'+
    '<div class="exam-opts">'+(exPages.length?'<button class="card exam-opt" id="exSelf"><b>Self-test from the book</b><span>Random problems from the book\'s own exercise pages for these units. You grade yourself. No AI, free.</span></button>':'')+
    '<button class="card exam-opt" id="exNew"><b>Written exam</b><span>Fresh questions written from these sections at the book\'s level. One AI request to write it, one more to grade written answers.</span></button></div>'+
    (saved?'<button class="btn big" id="exLast">Review last attempt</button>':'')+'</div>';
  $('exNew').onclick=()=>{if(!SET.hasAnthropicKey){toast('Add your Anthropic API key in Settings for written exams.');openSettings();return}generateExam(w,c,exam)};
  const se=$('exSelf');if(se)se.onclick=()=>selfTest(w,c,exam,exPages);
  const ls_=$('exLast');if(ls_)ls_.onclick=()=>renderExam(w,c,exam,saved,true)}
async function selfTest(w,c,exam,pages){const pick=[];const byLabel={};pages.forEach(x=>{(byLabel[x.label]=byLabel[x.label]||[]).push(x)});
  const groups=Object.values(byLabel).map(g=>[Math.random(),g]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  for(const g of groups){if(pick.length>=(exam.kind==='final'?8:6))break;pick.push(g[Math.floor(Math.random()*g.length)])}
  const doc=await studyDoc(w.id);const box=$('examView');
  box.innerHTML='<div class="exam-wrap"><div class="exam-top"><h2>'+exam.title+' · self-test</h2><span class="muted">Pick at least one problem on each page, work it fully on paper, then grade yourself honestly.</span></div><div id="stPagesEx"></div><div class="exam-foot"><button class="btn solid big" id="stSubmit">Finish</button></div></div>';
  const host=$('stPagesEx');const grades={};
  for(const [i,x] of pick.entries()){const card=document.createElement('article');card.className='eq card';card.innerHTML='<div class="eq-h"><span class="eq-n">'+(i+1)+'</span><span class="eq-s"></span><span class="eq-p">p. '+x.p+'</span></div><div class="eq-pg"></div><div class="rc-rate inline"><span class="muted">How did it go?</span><button data-g="0" class="btn">Could not</button><button data-g="0.5" class="btn">Partly</button><button data-g="1" class="btn">Solid</button></div>';
    card.querySelector('.eq-s').textContent=x.label;host.append(card);
    const pg=await doc.getPage(x.p);const vp0=pg.getViewport({scale:1});const sc=Math.min(760,host.clientWidth-40)/vp0.width;const vp=pg.getViewport({scale:sc});const cv=document.createElement('canvas');const r=Math.min(window.devicePixelRatio||1,2);
    cv.width=vp.width*r;cv.height=vp.height*r;cv.style.width=vp.width+'px';await pg.render({canvasContext:cv.getContext('2d'),viewport:vp,transform:r!==1?[r,0,0,r,0,0]:null}).promise;card.querySelector('.eq-pg').append(cv);
    card.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{grades[i]=+b.dataset.g;card.querySelectorAll('[data-g]').forEach(y=>y.classList.toggle('solid',y===b))})}
  $('stSubmit').onclick=async()=>{const n=pick.length,got=Object.values(grades).reduce((a,b)=>a+b,0);if(Object.keys(grades).length<n&&!$('stSubmit').dataset.armed){$('stSubmit').dataset.armed=1;$('stSubmit').textContent='Some are ungraded. Finish anyway?';return}
    const r=c.results[exam.id]||{best:0,attempts:0};r.attempts++;r.best=Math.max(r.best,got/n);r.self={score:got/n,t:Date.now()};c.results[exam.id]=r;await saveCourse(w.id,c);logActivity('q',n);
    box.innerHTML='<div class="exam-intro"><div class="res-ring" style="--p:'+Math.round(100*got/n)+'"><b>'+Math.round(100*got/n)+'<small>%</small></b></div><h2>Self-test done</h2><p class="muted">'+(got/n>=.8?'Strong. You are ready to move on.':got/n>=.5?'Solid base. Revisit the sections behind the problems you marked partly or could not.':'Go back through the units this covers and redo their recall and practice steps.')+'</p><button class="btn solid big" id="exBack2">Back to course</button></div>';
    $('exBack2').onclick=()=>{$('sat').hidden=true;shellGo('course',w.id)}}}
async function generateExam(w,c,exam){const box=$('examView');box.innerHTML='<div class="exam-intro"><img class="imp-logo" src="assets/logo.png" alt=""><h2>Writing your '+exam.title.toLowerCase()+'</h2><p class="muted" id="exProg">Collecting the sections it covers…</p></div>';
  try{const text=await examExcerpts(w,c,exam);$('exProg').textContent='Writing questions at the book\'s level. This can take a minute.';
    const n=exam.kind==='final'?16:12;const topics=exam.covers.map(i=>c.units[i].title+': '+c.units[i].lessons.map(l=>l.title).join('; ')).join('\n');
    const prompt='You are writing the '+exam.title+' for a course built from the book "'+w.name+'" ('+subjectOf(w)+'). It covers:\n'+topics+'\n\nBelow are excerpts from those sections, including their exercises.\n'+
      'Write an exam with the SAME rigor, notation and difficulty as this book. Do not simplify. Model the problems on the book\'s own examples and exercises. If the book is not mathematical, ask conceptual and analytical questions at the book\'s depth.'+(exam.kind==='final'?' Weight later units a little more.':'')+'\n'+
      n+' questions: about half "mc" (four choices, exactly one correct, with plausible wrong choices), about a third "num" (one numeric answer, given as a plain decimal number; use "free" instead if the subject has no numeric answers), and 2 or 3 "free" (a derivation, proof, or explanation the book would ask for), each "free" with a grading rubric.\n'+
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


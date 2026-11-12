/* ================= SETTINGS ================= */
let SET={hasAnthropicKey:false,desmosKey:'',model:'claude-sonnet-5-5'};
async function loadSettings(){try{SET=await window.desk.getSettings()}catch(e){}}
function openSettings(){$('setAnthropic').value='';$('setAnthropic').placeholder=SET.hasAnthropicKey?'Saved. Paste a new key to replace it.':'sk-ant-…';
  $('setDesmos').value=SET.desmosKey||'';$('setModel').value=SET.model||'claude-sonnet-5-5';$('setMsg').textContent='';$('settings').hidden=false;
  setTimeout(()=>(SET.hasAnthropicKey?$('setDesmos'):$('setAnthropic')).focus(),30)}
function closeSettings(){$('settings').hidden=true}
async function saveSettingsForm(){const patch={model:$('setModel').value};const a=$('setAnthropic').value.trim(),d=$('setDesmos').value.trim();
  if(a){if(!/^sk-ant-/.test(a)){$('setMsg').textContent='Anthropic keys start with "sk-ant-". Check you copied the whole key.';return}patch.anthropicKey=a}
  const desmosChanged=d!==(SET.desmosKey||'');if(desmosChanged)patch.desmosKey=d;
  await window.desk.saveSettings(patch);await loadSettings();closeSettings();toast('Settings saved');
  renderTutorState();
  if(desmosChanged){if(window.Desmos)location.reload();else loadDesmos()}}
$('setBtn').onclick=openSettings;$('setClose').onclick=closeSettings;$('setSave').onclick=saveSettingsForm;
$('settings').onclick=e=>{if(e.target===$('settings'))closeSettings()};

/* ================= DESMOS ================= */
let calc=null,saveDT=0;
const DESMOS_URL='https://www.desmos.com/api/v1.13/calculator.js?apiKey=';
function gmsg(html){$('gwrap').innerHTML='<div class="gmsg">'+html+'</div>';const b=$('gwrap').querySelector('[data-open-settings]');if(b)b.onclick=openSettings}
function initGraph(){window.__graphResize=()=>{if(calc)calc.resize()};loadDesmos();
  $('gWide').onclick=()=>{const w=Math.round(Math.min(window.innerWidth*.6,Math.max(620,parseInt(getComputedStyle(document.documentElement).getPropertyValue('--board-w'))+200)));
    document.documentElement.style.setProperty('--board-w',w+'px');ls.set('boardW',w);setTimeout(()=>calc&&calc.resize(),30)};
  $('gClear').onclick=()=>{if(calc)calc.setBlank({allowUndo:true})}}
function loadDesmos(){if(!SET.desmosKey)return gmsg('<b>Desmos needs an API key.</b><br>Request a free key at <a href="https://www.desmos.com/my-api" target="_blank">desmos.com/my-api</a>, then paste it in Settings.<br><button class="btn solid" data-open-settings>Open Settings</button>');
  if(window.Desmos)return makeCalc();
  gmsg('Loading Desmos…');const sc=document.createElement('script');sc.src=DESMOS_URL+encodeURIComponent(SET.desmosKey);
  sc.onload=()=>{if(window.Desmos)makeCalc();else gmsg('Desmos rejected the API key. Check it in Settings.<br><button class="btn solid" data-open-settings>Open Settings</button>')};
  sc.onerror=()=>gmsg('Desmos did not load. Check your internet connection, then reopen the app.<br><button class="btn solid" data-open-settings>Check Settings</button>');
  document.head.append(sc)}
function isDark(){const t=document.documentElement.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
function makeCalc(){$('gwrap').innerHTML='<div id="calc"></div>';
  try{calc=Desmos.GraphingCalculator($('calc'),{keypad:true,expressions:true,settingsMenu:true,zoomButtons:true,border:false,links:false,invertedColors:isDark()})}
  catch(e){return gmsg('Desmos could not start: '+esc(String(e.message||e)))}
  const st=ls.get('desmos',null);
  if(st){try{calc.setState(st)}catch(e){}}else{calc.setExpression({id:'ex1',latex:'f(x)=x^3-3x'});calc.setExpression({id:'ex2',latex:"f'(x)"})}
  calc.observeEvent('change',()=>{clearTimeout(saveDT);saveDT=setTimeout(()=>{try{ls.set('desmos',calc.getState())}catch(e){}},600)});
  try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>calc.updateSettings({invertedColors:isDark()}))}catch(e){}
  renderAtts()}
function graphState(){if(!calc)return null;
  const ex=calc.getExpressions().filter(e=>e.type==='expression'&&e.latex&&e.latex.trim()).map(e=>({id:e.id,latex:e.latex,hidden:!!e.hidden}));
  let vp=null;try{const b=calc.graphpaperBounds.mathCoordinates;vp={xmin:+b.left.toPrecision(5),xmax:+b.right.toPrecision(5),ymin:+b.bottom.toPrecision(5),ymax:+b.top.toPrecision(5)}}catch(e){}
  return{expressions:ex,viewport:vp}}
function graphShot(){return new Promise(res=>{if(!calc)return res(null);let done=false;const t=setTimeout(()=>{if(!done){done=true;res(null)}},4000);
  try{calc.asyncScreenshot({width:640,height:460,targetPixelRatio:1,showLabels:true},uri=>{if(done)return;done=true;clearTimeout(t);res(typeof uri==='string'&&uri.startsWith('data:image/png')?uri:null)})}catch(e){done=true;clearTimeout(t);res(null)}})}
function evalLatex(latex){return new Promise(res=>{let h;try{h=calc.HelperExpression({latex})}catch(e){return res(null)}let done=false;
  const fin=()=>{if(done)return;done=true;try{h.unobserve('numericValue')}catch(e){}res(h.numericValue)};
  h.observe('numericValue',()=>{if(isFinite(h.numericValue))fin()});setTimeout(fin,1500)})}

/* ================= TUTOR ================= */
const INTENTS={
  hint:{label:'Hint',ask:'Give me a hint or a guiding question for the next step only. Do not reveal the final answer.'},
  check:{label:'Check me',ask:'Check my answer or work. Say plainly first whether it is correct. If it is wrong, point to the first step that goes wrong and give a hint to fix it, but do not give the corrected final answer.'},
  explain:{label:'Explain',ask:'Explain the idea behind this clearly and briefly with one small example, then ask me one quick question to check I understood.'},
  solve:{label:'Solution',ask:'I want the full worked solution, step by step, with a short reason for each step.'}};
const TU={intent:'hint',turns:[],atts:[],pageOn:false,graphOn:true,busy:null,reqId:null};
const MAX_IMGS=5;

const TOOLS=[
  {name:'desmos_set_expressions',description:"Add or update expressions on the student's Desmos graph. Each expression is Desmos LaTeX, e.g. \"y=2x+1\", \"f(x)=x^{2}\", \"(1,2)\", \"a=3\" (makes a slider). Reuse an existing id to change that expression. Returns the graph's expressions afterwards.",
   input_schema:{type:'object',properties:{expressions:{type:'array',items:{type:'object',properties:{latex:{type:'string'},id:{type:'string',description:'Optional. Reuse an id to edit an existing expression.'},color:{type:'string',description:'Optional hex color like #c74440'},hidden:{type:'boolean'}},required:['latex']}},replace:{type:'boolean',description:'true clears the graph first. Only do this if the student agrees, since it removes their work.'}},required:['expressions']}},
  {name:'desmos_remove_expressions',description:'Remove expressions from the graph by id. Only remove expressions you added, unless the student asks.',
   input_schema:{type:'object',properties:{ids:{type:'array',items:{type:'string'}}},required:['ids']}},
  {name:'desmos_set_viewport',description:'Move or zoom the graph to the given window.',
   input_schema:{type:'object',properties:{xmin:{type:'number'},xmax:{type:'number'},ymin:{type:'number'},ymax:{type:'number'}},required:['xmin','xmax','ymin','ymax']}},
  {name:'desmos_evaluate',description:"Evaluate a numeric Desmos LaTeX expression using the student's current definitions, e.g. \"f(2)\" or \"\\int_{0}^{1}x^{2}dx\". Returns the number, or null if it is not a single number.",
   input_schema:{type:'object',properties:{latex:{type:'string'}},required:['latex']}}];
let aiExprN=0;
async function runTool(name,input,log){
  if(!calc)throw new Error('Desmos is not loaded. Tell the student to add their Desmos API key in Settings.');
  if(name==='desmos_set_expressions'){const ex=Array.isArray(input.expressions)?input.expressions.slice(0,12):[];
    if(input.replace)calc.setBlank({allowUndo:true});
    const ids=[];for(const e of ex){if(!e||typeof e.latex!=='string')continue;const id=e.id?String(e.id):'ai'+(++aiExprN)+'_'+Date.now().toString(36);
      const o={id,latex:e.latex};if(e.color)o.color=String(e.color);if(typeof e.hidden==='boolean')o.hidden=e.hidden;calc.setExpression(o);ids.push(id);log.push(e.latex)}
    await new Promise(r=>setTimeout(r,250));
    const st=graphState();const errs=calc.getExpressions().filter(x=>ids.includes(x.id)).map(x=>{const a=calc.expressionAnalysis&&calc.expressionAnalysis[x.id];return a&&a.isError?{id:x.id,latex:x.latex,error:a.errorMessage}:null}).filter(Boolean);
    return{ok:!errs.length,added_ids:ids,errors:errs,graph:st}}
  if(name==='desmos_remove_expressions'){const ids=(input.ids||[]).map(String);calc.removeExpressions(ids.map(id=>({id})));return{ok:true,graph:graphState()}}
  if(name==='desmos_set_viewport'){const{xmin,xmax,ymin,ymax}=input;if(!(xmax>xmin&&ymax>ymin))throw new Error('Need xmax > xmin and ymax > ymin');
    calc.setMathBounds({left:+xmin,right:+xmax,bottom:+ymin,top:+ymax});return{ok:true}}
  if(name==='desmos_evaluate'){const v=await evalLatex(String(input.latex||''));return{value:(typeof v==='number'&&isFinite(v))?v:null}}
  throw new Error('Unknown tool '+name)}

function initTutor(){renderChat();renderAtts();renderTutorState();
  document.querySelectorAll('.intents button').forEach(b=>b.onclick=()=>{TU.intent=b.dataset.intent;
    document.querySelectorAll('.intents button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    $('ask').placeholder={hint:'What are you stuck on?',check:'Type your answer or steps…',explain:'What do you want explained?',solve:'Which problem?'}[TU.intent]});
  $('ask').addEventListener('input',autoGrow);
  $('ask').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
  $('sendBtn').onclick=()=>{if(TU.busy)stopTutor();else send()};
  $('pageChip').onclick=()=>{if(!S.pdf)return toast('Open a PDF first.');if(!TU.pageOn&&imgCount()>=MAX_IMGS)return toast('That is the most images for one message.');TU.pageOn=!TU.pageOn;renderAtts()};
  $('graphChip').onclick=()=>{TU.graphOn=!TU.graphOn;renderAtts()};
  $('photoChip').onclick=()=>$('photoIn').click();
  $('photoIn').onchange=async e=>{for(const f of [...e.target.files]){if(imgCount()>=MAX_IMGS){toast('That is the most images for one message.');break}
    const blob=await shrink(f,1568);if(!blob){toast('Could not read '+f.name);continue}
    TU.atts.push({blob,type:'image/jpeg',desc:"a photo of the student's handwritten work",label:'My work',thumb:await thumbOf(blob)})}e.target.value='';renderAtts()}}
function renderTutorState(){const need=!SET.hasAnthropicKey;$('tutorKey').hidden=!need;$('compose').hidden=need}
function imgCount(){return TU.atts.length+(TU.pageOn?1:0)}
function autoGrow(){const a=$('ask');a.style.height='auto';a.style.height=Math.min(a.scrollHeight,140)+'px'}
function renderAtts(){const box=$('atts');box.querySelectorAll('.att').forEach(n=>n.remove());
  $('pageChip').classList.toggle('on',TU.pageOn);$('pageChip').textContent=TU.pageOn?'✓ Page '+S.cur:'+ This page';
  $('graphChip').hidden=!calc;$('graphChip').classList.toggle('on',TU.graphOn);$('graphChip').textContent=TU.graphOn?'✓ My Desmos graph':'+ My Desmos graph';
  TU.atts.forEach((a,i)=>{const ch=document.createElement('span');ch.className='chip att';
    ch.innerHTML='<img alt=""><span></span><button class="rm" aria-label="Remove attachment">×</button>';
    ch.querySelector('img').src=a.thumb;ch.querySelector('span').textContent=a.label||'Image';
    ch.querySelector('.rm').onclick=()=>{TU.atts.splice(i,1);renderAtts()};box.append(ch)})}

function b64Blob(dataUrl){const [h,b]=dataUrl.split(',');const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  return new Blob([u],{type:(h.match(/data:([^;]+)/)||[])[1]||'image/png'})}
function blobB64(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob)})}
async function shrink(blob,max){try{const bm=await createImageBitmap(blob);const s=Math.min(1,max/Math.max(bm.width,bm.height));
  const c=document.createElement('canvas');c.width=Math.round(bm.width*s);c.height=Math.round(bm.height*s);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bm,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.85))}catch(e){return null}}
async function thumbOf(blob){try{const bm=await createImageBitmap(blob);const h=90,w=Math.max(1,Math.round(bm.width*h/bm.height));
  const c=document.createElement('canvas');c.width=Math.min(w,360);c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,h);x.drawImage(bm,0,0,w,h);
  return c.toDataURL('image/jpeg',.8)}catch(e){return''}}
async function pageBlob(n){try{const page=await S.pdf.getPage(n);const v1=page.getViewport({scale:1});const vp=page.getViewport({scale:1400/v1.width});
  const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:x,viewport:vp}).promise;return await new Promise(r=>c.toBlob(r,'image/jpeg',.85))}catch(e){return null}}

async function askAboutClip(c){if(mobile())app.classList.add('board-open');else app.classList.remove('board-hidden');showTab('tutor');
  if(!SET.hasAnthropicKey)return;
  if(imgCount()>=MAX_IMGS)return toast('That is the most images for one message.');
  let blob=b64Blob(c.img);if(blob.size>3.5e6)blob=await shrink(blob,1568)||blob;
  TU.atts.push({blob,type:blob.type||'image/png',desc:'a clip from textbook page '+c.page+(c.label?' labeled "'+c.label+'"':''),label:c.label||'p. '+c.page,thumb:await thumbOf(blob)});
  renderAtts();$('ask').focus()}

function rules(){return 'You are a math tutor built into a desktop textbook study app. The student is studying "'+(S.name||'a textbook')+'"'+(S.pdf?', currently reading page '+S.cur+' of '+S.n:'')+'. The app has a Desmos graphing calculator next to the book.\n\n'+
'How to tutor:\n'+
'- Your goal is that the student learns. Lead them to answers rather than handing answers over.\n'+
'- Every student message begins with an "Intent" line saying what kind of help they want. Follow it strictly. Give a complete solution only when the intent is Solution.\n'+
'- When checking work, be honest and specific: say right or wrong first, and praise only what is actually correct. Small slips (a sign, a dropped factor) count as wrong; name exactly where.\n'+
'- Keep replies short, usually under 120 words, one idea or question at a time.\n'+
'- Write math in LaTeX: $...$ inline and $$...$$ for display. Use plain paragraphs and simple "- " lists. No headings.\n'+
'- Attached images may be the textbook page, a clipped equation, the student\'s handwritten work, or a screenshot of their Desmos graph. Read them carefully; if part is unreadable, say which part.\n'+
'- Each message includes the student\'s Desmos expressions as JSON. Use them: if they graphed something wrong, notice it and point it out. You can change the graph with the desmos tools when a picture helps (a tangent line, a secant, a limit, an area). Prefer adding new expressions over editing the student\'s own, and tell them what you added and what to look for. Use desmos_evaluate to double-check numbers before telling the student an answer is right or wrong.'}

const ERRS={no_key:'Add your Anthropic API key in Settings to use the tutor.',bad_key:'Anthropic rejected your API key. Check it in Settings.',
  rate_limited:'Too many requests, or your API credit ran out. Wait a moment or check your Anthropic billing.',overloaded:'Anthropic is busy right now. Try again in a moment.',
  network:'Could not reach Anthropic. Check your internet connection.'};

function stopTutor(){TU.stopped=true;if(TU.reqId)window.desk.claudeAbort(TU.reqId)}
function historyMsgs(){const out=[];for(const t of TU.turns.slice(-16)){const last=out[out.length-1];
    if(last&&last.role===t.role)last.content[0].text+='\n\n'+t.content;else out.push({role:t.role,content:[{type:'text',text:t.content}]})}
  while(out.length&&out[0].role!=='user')out.shift();return out}

async function send(){if(TU.busy||!SET.hasAnthropicKey)return;const text=$('ask').value.trim();
  const gs=TU.graphOn?graphState():null;const hasGraph=gs&&gs.expressions.length;
  if(!text&&!imgCount())return;
  TU.busy=true;TU.stopped=false;$('sendBtn').textContent='Stop';
  const imgBlocks=[],desc=[],thumbs=[];
  try{
    if(TU.pageOn&&S.pdf){const b=await pageBlob(S.cur);if(b){imgBlocks.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:await blobB64(b)}});desc.push('textbook page '+S.cur);thumbs.push(await thumbOf(b))}}
    for(const a of TU.atts){imgBlocks.push({type:'image',source:{type:'base64',media_type:a.blob.type==='image/png'?'image/png':'image/jpeg',data:await blobB64(a.blob)}});desc.push(a.desc);thumbs.push(a.thumb)}
    if(hasGraph){const shot=await graphShot();if(shot){imgBlocks.push({type:'image',source:{type:'base64',media_type:'image/png',data:shot.split(',')[1]}});desc.push('a screenshot of their Desmos graph')}}
  }catch(e){}
  const it=INTENTS[TU.intent];
  const ctx='Intent: '+it.label+'. '+it.ask+'\n'+(desc.length?'Attached image'+(desc.length>1?'s':'')+': '+desc.join('; ')+'.\n':'')+
    (gs?'Desmos graph: '+JSON.stringify(gs)+'\n':'')+'\nStudent: '+(text||'(Please look at the attached image.)');
  const ctxStored='Intent: '+it.label+'. '+it.ask+'\n'+(desc.length?'(Had attached: '+desc.join('; ')+'.)\n':'')+'\nStudent: '+(text||'(see attached image)');
  TU.turns.push({role:'user',content:ctxStored,show:text,intent:TU.intent,thumbs:thumbs.filter(Boolean)});
  $('ask').value='';autoGrow();TU.atts=[];TU.pageOn=false;renderAtts();
  renderChat(true);const body=$('chat').querySelector('.msg.ai:last-child .body');
  const msgs=historyMsgs();msgs[msgs.length-1]={role:'user',content:[...imgBlocks,{type:'text',text:(msgs[msgs.length-1].content[0].text.replace(ctxStored,'')+ctx).trim()}]};
  let acc='';const log=[];let errMsg=null;
  const onText=d=>{acc+=d;body.classList.remove('thinking');body.innerHTML=mdLite(acc);scrollChat()};
  try{for(let round=0;round<6;round++){
      const {id,promise}=window.desk.claudeStart({system:rules(),messages:msgs,tools:TOOLS},onText);TU.reqId=id;
      const res=await promise;TU.reqId=null;
      if(res.error){if(res.error.code!=='cancelled')errMsg=ERRS[res.error.code]||res.error.message;break}
      const content=(res.content||[]).filter(b=>!(b.type==='text'&&!b.text));
      if(!content.length)break;
      msgs.push({role:'assistant',content});
      const uses=content.filter(b=>b.type==='tool_use');
      if(res.stop_reason!=='tool_use'||!uses.length||TU.stopped)break;
      const results=[];
      for(const u of uses){let out,isErr=false;try{out=await runTool(u.name,u.input||{},log)}catch(e){out='Error: '+(e.message||e);isErr=true}
        results.push({type:'tool_result',tool_use_id:u.id,content:typeof out==='string'?out:JSON.stringify(out),is_error:isErr||undefined})}
      msgs.push({role:'user',content:results});
      if(acc&&!acc.endsWith('\n\n'))acc+='\n\n';
      if(!acc){body.textContent='Working on your graph';}
    }}
  catch(e){errMsg='Something went wrong talking to the tutor. Try again.'}
  finally{TU.busy=false;TU.reqId=null;$('sendBtn').textContent='Send'}
  if(acc.trim()){const shown=acc.trim()+(TU.stopped?'\n\n_(stopped)_':'');
    TU.turns.push({role:'assistant',show:shown,content:acc.trim()+(log.length?'\n\n[I added to the Desmos graph: '+log.join('; ')+']':''),plotted:log})}
  else if(log.length)TU.turns.push({role:'assistant',show:'I updated your graph.',content:'[I added to the Desmos graph: '+log.join('; ')+']',plotted:log});
  if(errMsg)toast(errMsg,5000);
  renderChat();saveChat()}

function scrollChat(){const c=$('chat');c.scrollTop=c.scrollHeight}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function mdLite(src){const math=[];const re=/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g;
  let out=src.replace(re,m=>'\u0001'+(math.push(m)-1)+'\u0002');out=esc(out)
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^\w*])_(\(.+?\))_/g,'$1<span class="note">$2</span>').replace(/`([^`\n]+)`/g,'<code>$1</code>');
  const lines=out.split('\n');let html='',list=null,para=[];
  const flushP=()=>{if(para.length){html+='<p>'+para.join('<br>')+'</p>';para=[]}};const flushL=()=>{if(list){html+='</'+list+'>';list=null}};
  for(const ln of lines){let m;
    if((m=ln.match(/^\s*[-*•]\s+(.*)$/))){flushP();if(list!=='ul'){flushL();html+='<ul>';list='ul'}html+='<li>'+m[1]+'</li>'}
    else if((m=ln.match(/^\s*\d+[.)]\s+(.*)$/))){flushP();if(list!=='ol'){flushL();html+='<ol>';list='ol'}html+='<li>'+m[1]+'</li>'}
    else if(!ln.trim()){flushP();flushL()}
    else{flushL();para.push(ln.replace(/^#+\s*/,''))}}
  flushP();flushL();
  return html.replace(/\u0001(\d+)\u0002/g,(a,k)=>esc(math[+k]))}
let mjTries=0;
function typeset(el){const MJ=window.MathJax;if(MJ&&typeof MJ.typesetPromise==='function'){MJ.typesetPromise([el]).catch(()=>{});return}
  if(mjTries++<20)setTimeout(()=>typeset(el),500)}

function renderChat(pending){const box=$('chat');box.innerHTML='';
  if(!TU.turns.length&&!pending){box.innerHTML='<div class="tutor-intro"><h3>Your tutor</h3>Pick the kind of help, then ask.<ul><li><b>Hint</b> nudges you toward the next step.</li><li><b>Check me</b> says if your answer is right and where it went wrong.</li><li><b>Explain</b> teaches the idea with an example.</li><li><b>Solution</b> shows every step, only when you want it.</li></ul>The tutor sees your Desmos graph with every message, and it can draw on it to show you an idea. Attach <b>This page</b>, a clip (the Ask button on any clip) or a photo of your work so it sees exactly what you see.</div>';return}
  if(TU.turns.length){const clr=document.createElement('button');clr.className='pref';clr.textContent='Clear conversation';clr.style.alignSelf='center';
    clr.onclick=()=>{if(TU.busy)return;TU.turns=[];saveChat();renderChat()};box.append(clr)}
  TU.turns.forEach(t=>{const m=document.createElement('div');
    if(t.role==='user'){m.className='msg me';m.innerHTML='<div class="who">You <span class="intent"></span></div><div class="body"></div>';
      m.querySelector('.intent').textContent=(INTENTS[t.intent]||INTENTS.hint).label;m.querySelector('.body').textContent=t.show||'(image)';
      if(t.thumbs&&t.thumbs.length){const th=document.createElement('div');th.className='thumbs';t.thumbs.forEach(s=>{const i=document.createElement('img');i.src=s;i.alt='Attached image';th.append(i)});m.append(th)}}
    else{m.className='msg ai';m.innerHTML='<div class="who">Tutor</div><div class="body"></div>';m.querySelector('.body').innerHTML=mdLite(t.show||t.content);
      if(t.plotted&&t.plotted.length){const b=document.createElement('button');b.className='plotted';b.textContent='Added '+t.plotted.length+' to your Desmos graph · View';b.onclick=()=>showTab('graph');m.append(b)}}
    box.append(m)});
  if(pending){const m=document.createElement('div');m.className='msg ai';m.innerHTML='<div class="who">Tutor</div><div class="body thinking">Thinking</div>';box.append(m)}
  else typeset(box);
  scrollChat()}
async function saveChat(){if(S.key)idb.set('chat:'+S.key,TU.turns.slice(-40).map(t=>({role:t.role,content:t.content,show:t.show,intent:t.intent,thumbs:t.thumbs,plotted:t.plotted})))}
async function loadChat(){if(TU.busy)return;TU.turns=(await idb.get('chat:'+S.key))||[];renderChat()}


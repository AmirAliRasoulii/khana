/* Khana Interview Runner — no backend, no remote data, candidate-safe broadcasts. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fa = n => new Intl.NumberFormat('fa-IR').format(n);
  const esc = str => String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inline = src => {
    const escaped = esc(src);
    return escaped.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  };
  function highlightCode(source, lang) {
    if (!/^(python|py)$/i.test(lang || '')) return esc(source);
    // Tokenizer for display only: it never evaluates source and escapes every token.
    const pattern = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:async|await|def|return|if|else|elif|for|in|and|or|not|is|with|as|class|try|except|raise|finally|while|yield|from|import|pass|None|True|False|lambda|global|nonlocal)\b|\b(?:print|len|range|str|int|list|dict|set|super|self)\b|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()/g;
    let out='',prev=0,match;
    while((match=pattern.exec(source))!==null) {
      out+=esc(source.slice(prev,match.index));
      const token=match[0];
      let kind='fn';
      if(token.startsWith('#'))kind='comment';
      else if(token.startsWith('"')||token.startsWith("'"))kind='str';
      else if(/^\d/.test(token))kind='num';
      else if(/^(print|len|range|str|int|list|dict|set|super|self)$/.test(token))kind='builtin';
      else if(/^(async|await|def|return|if|else|elif|for|in|and|or|not|is|with|as|class|try|except|raise|finally|while|yield|from|import|pass|None|True|False|lambda|global|nonlocal)$/.test(token))kind='kw';
      out+='<span class="code-token '+kind+'">'+esc(token)+'</span>';
      prev=pattern.lastIndex;
    }
    return out+esc(source.slice(prev));
  }
  function renderMd(source) {
    const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraph = [], listType = null, fence = null, code = [];
    const flushParagraph = () => {if (paragraph.length) {html.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph=[];}};
    const closeList = () => {if(listType){html.push('</'+listType+'>');listType=null;}};
    const flushCode = () => {if(fence!==null){const lang=String(fence).trim().split(/\s+/)[0].toLowerCase();html.push('<pre class="highlighted" dir="ltr"><div class="code-head">'+esc(lang||'CODE').toUpperCase()+'</div><code>'+highlightCode(code.join('\n'),lang)+'</code></pre>');fence=null;code=[];}};
    for (let i=0;i<lines.length;i++) {
      const raw=lines[i], line=raw.trim();
      const boundary=line.match(/^```(.*)$/);
      if (boundary) {
        if (fence!==null) flushCode();
        else {flushParagraph();closeList();fence=boundary[1];code=[];}
        continue;
      }
      if (fence!==null) {code.push(raw);continue;}
      if (!line) {flushParagraph();closeList();continue;}
      if (/^---+$/.test(line)) {flushParagraph();closeList();html.push('<hr>');continue;}
      const h=line.match(/^(#{1,5})\s+(.+)$/);
      if(h){flushParagraph();closeList();html.push('<h'+Math.min(5,h[1].length)+'>'+inline(h[2])+'</h'+Math.min(5,h[1].length)+'>');continue;}
      const quote=line.match(/^>\s?(.*)$/);
      if(quote){flushParagraph();closeList();html.push('<blockquote>'+inline(quote[1])+'</blockquote>');continue;}
      const item=line.match(/^(?:[-*+]\s+|(\d+)\.\s+)(.+)$/);
      if(item){flushParagraph();const type=item[1]?'ol':'ul';if(listType!==type){closeList();html.push('<'+type+'>');listType=type;}html.push('<li>'+inline(item[2])+'</li>');continue;}
      // Tables are supported without any executable HTML in the input.
      if(line.startsWith('|') && line.endsWith('|') && i+1<lines.length && /^\|[\s|:-]+\|$/.test(lines[i+1].trim())) {
        flushParagraph();closeList();const cells=x=>x.trim().slice(1,-1).split('|').map(s=>s.trim());
        html.push('<div class="table-wrap"><table><thead><tr>'+cells(line).map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>');i++;
        while(i+1<lines.length && lines[i+1].trim().startsWith('|')) {i++;html.push('<tr>'+cells(lines[i]).map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>');}
        html.push('</tbody></table></div>');continue;
      }
      paragraph.push(line);
    }
    flushParagraph();closeList();flushCode();
    return html.join('\n');
  }
  const role=document.body.dataset.role;
  if(role==='candidate') {initCandidate();return;}
  if(role==='interviewer') initInterviewer();

  function initCandidate() {
    const room=new URLSearchParams(location.search).get('room');
    if(!room || !/^[a-z0-9-]{8,100}$/i.test(room)) {$('candidateEmpty').querySelector('p').textContent='این صفحه را با دکمه «بازکردن تب کاندیدا» در پنل مصاحبه‌گر باز کنید.';return;}
    const channel=new BroadcastChannel('khana-interview-'+room);
    let shownIndex=null;
    $('candidatePrev').addEventListener('click',()=>{if(shownIndex!==null)channel.postMessage({type:'navigate',from:shownIndex,delta:-1});});
    $('candidateNext').addEventListener('click',()=>{if(shownIndex!==null)channel.postMessage({type:'navigate',from:shownIndex,delta:1});});
    channel.onmessage=event=>{
      const msg=event.data;
      if(!msg || msg.type!=='slide' || typeof msg.slide!=='object')return;
      const s=msg.slide;
      if(!Number.isInteger(s.index) || !Number.isInteger(s.total) || s.total<1 || s.index<1 || s.index>s.total || typeof s.prompt!=='string' || typeof s.contextMd!=='string')return;
      $('candidateEmpty').hidden=true;$('candidateActive').hidden=false;
      $('candidatePrompt').textContent=s.prompt;
      $('candidateQuestion').innerHTML=renderMd(s.contextMd);
      $('candidateCounter').textContent=`سؤال ${fa(s.index)} از ${fa(s.total)}`;
      $('candidateRemaining').textContent=`${fa(s.total-s.index)} سؤال باقی‌مانده`;
      $('candidateProgressBar').style.width=(100*s.index/s.total)+'%';
      $('candidateFootPosition').textContent=`${fa(s.index)} / ${fa(s.total)}`;
      $('candidatePrev').disabled=s.index===1;
      $('candidateNext').disabled=s.index===s.total;
      shownIndex=s.index;
      const hints=Array.isArray(s.hints)?s.hints.filter(x=>typeof x==='string'):[];
      $('candidateHints').hidden=!hints.length;
      $('candidateHintsContent').innerHTML=hints.map((h,i)=>`<div class="hint-item"><strong>راهنمای ${fa(i+1)}</strong><p>${inline(h)}</p></div>`).join('');
      const followups=Array.isArray(s.followups)?s.followups.filter(x=>typeof x==='string'):[];
      $('candidateFollowups').hidden=!followups.length;
      $('candidateFollowupsContent').innerHTML=followups.map(x=>'<blockquote>'+inline(x)+'</blockquote>').join('');
      window.scrollTo({top:0,behavior:'smooth'});
    };
    channel.postMessage({type:'ready'});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)channel.postMessage({type:'ready'});});
  }

  function initInterviewer() {
    let bank=null;
    const cacheKey='khana-interview-session-v1';
    let saved={};try{saved=JSON.parse(sessionStorage.getItem(cacheKey)||'{}')||{};}catch(_){saved={};}
    let pos=Number.isInteger(saved.pos)?saved.pos:0;
    let grades=saved.grades||{},notes=saved.notes||{},hintLevels=saved.hintLevels||{},followLevels=saved.followLevels||{};
    let started=Date.now();
    let room=sessionStorage.getItem('khana-interview-room');
    if(!room){room=crypto.randomUUID();sessionStorage.setItem('khana-interview-room',room);}
    const channel=new BroadcastChannel('khana-interview-'+room);
    channel.onmessage=e=>{
      if(e.data?.type==='ready'&&bank)sendSlide();
      if(e.data?.type==='navigate'&&bank&&e.data.from===pos+1&&[-1,1].includes(e.data.delta))navigate(pos+e.data.delta);
    };
    function save(){sessionStorage.setItem(cacheKey,JSON.stringify({pos,grades,notes,hintLevels,followLevels}));}
    function notify(s){const t=$('toast');t.textContent=s;t.hidden=false;clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>t.hidden=true,3200);}
    function current(){return bank.questions[pos];}
    function key(){return current().id;}
    function getHintLevel(){return Math.min(Number(hintLevels[key()]||0),current().hints.length);}
    function getFollowLevel(){return Math.min(Number(followLevels[key()]||0),current().followups.length);}
    function sendSlide(){
      if(!bank)return;
      const q=current();
      // Whitelist-only payload. Never post answerMd, rubricMd, notes, grades or the entire bank.
      channel.postMessage({type:'slide',slide:{index:pos+1,total:bank.questions.length,
        prompt:q.prompt,contextMd:q.contextMd,hints:q.hints.slice(0,getHintLevel()),followups:q.followups.slice(0,getFollowLevel())}});
    }
    function renderRail(){
      const sections=[];
      bank.questions.forEach((q,i)=>{let section=sections.find(x=>x.label===q.section);if(!section){section={label:q.section,items:[]};sections.push(section);}section.items.push({q,i});});
      $('rail').innerHTML=sections.map(section=>'<section class="rail-section"><div class="rail-heading">'+esc(section.label)+'</div><div class="rail-items">'+section.items.map(({q,i})=>`<button class="rail-dot ${i===pos?'current':''} ${grades[q.id]?'scored':''}" data-go="${i}" title="${esc(q.title)}" aria-label="سؤال ${i+1}">${fa(i+1)}</button>`).join('')+'</div></section>').join('');
      $('rail').querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navigate(Number(btn.dataset.go))));
    }
    function renderHints(){
      const q=current(),n=getHintLevel();
      $('hintPanel').hidden=!q.hints.length;
      if(!q.hints.length)return;
      $('hintCounter').textContent=`نمایش ${fa(n)} از ${fa(q.hints.length)}`;
      $('hintContent').innerHTML=q.hints.slice(0,n).map((h,i)=>`<div class="hint-item"><strong>راهنمای ${fa(i+1)}</strong><p>${inline(h)}</p></div>`).join('');
      $('hintNext').hidden=n===q.hints.length;
      $('hintNext').textContent=`نمایش راهنمای ${fa(n+1)} برای کاندیدا`;
      $('hintReset').disabled=n===0;
    }
    function renderFollowups(){
      const q=current(),n=getFollowLevel();
      $('followupPanel').hidden=!q.followups.length;
      if(!q.followups.length)return;
      $('followupCounter').textContent=`نمایش ${fa(n)} از ${fa(q.followups.length)}`;
      $('followupContent').innerHTML=q.followups.slice(0,n).map(t=>'<blockquote>'+inline(t)+'</blockquote>').join('');
      $('followupNext').hidden=n===q.followups.length;
      $('followupReset').disabled=n===0;
    }
    function toggleAnswer(open){$('answerContent').hidden=!open;$('toggleAnswer').setAttribute('aria-expanded',String(open));$('toggleAnswer').textContent=open?'مخفی‌کردن پاسخ':'نمایش پاسخ و معیارها';}
    function renderScore(){
      const value=grades[key()];
      $('scoreButtons').innerHTML=[1,2,3,4].map(n=>`<button class="score-button ${value===n?'selected':''}" data-score="${n}" aria-label="امتیاز ${n}">${fa(n)}</button>`).join('')+
        `<button class="button subtle" data-score="0">بدون امتیاز</button>`;
      $('scoreButtons').querySelectorAll('[data-score]').forEach(btn=>btn.addEventListener('click',()=>{const n=Number(btn.dataset.score);if(n)grades[key()]=n;else delete grades[key()];save();renderScore();renderRail();}));
    }
    function render(){
      const q=current();$('empty').hidden=true;$('active').hidden=false;
      $('position').textContent=`سؤال ${fa(pos+1)} از ${fa(bank.questions.length)}`;
      $('category').textContent=q.category;
      $('budget').textContent=`${fa(q.minutes)} دقیقه`;
      $('questionTitle').textContent=q.title;
      $('questionPrompt').textContent=q.prompt;
      $('questionBody').innerHTML=renderMd(q.contextMd);
      $('progressBar').style.width=(100*(pos+1)/bank.questions.length)+'%';
      $('footPosition').textContent=`${fa(pos+1)} / ${fa(bank.questions.length)}`;
      $('answerBody').innerHTML=renderMd(q.answerMd);
      $('rubricBody').innerHTML=renderMd(q.rubricMd);
      $('prev').disabled=pos===0;$('next').disabled=pos===bank.questions.length-1;
      $('note').value=notes[q.id]||'';
      renderRail();renderHints();renderFollowups();renderScore();toggleAnswer(false);
      sendSlide();save();
    }
    function navigate(idx){
      if(!bank||idx<0||idx>=bank.questions.length)return;
      notes[key()]=$('note').value;pos=idx;render();window.scrollTo({top:0,behavior:'smooth'});
    }
    function validate(data){
      if(!data || data.schemaVersion!==2 || !Array.isArray(data.questions) || !data.questions.length || data.questions.length>120)throw Error('فرمت فایل سؤال‌ها پشتیبانی نمی‌شود.');
      const ids=new Set();
      for(const q of data.questions){
        if(typeof q.id!=='string'||!q.id||ids.has(q.id) || typeof q.title!=='string' ||typeof q.prompt!=='string'||!q.prompt.trim()||typeof q.contextMd!=='string'||typeof q.answerMd!=='string'||typeof q.rubricMd!=='string'||!Array.isArray(q.hints)||!Array.isArray(q.followups)||q.hints.some(x=>typeof x!=='string')||q.followups.some(x=>typeof x!=='string'))throw Error('ساختار یکی از سؤال‌ها معتبر نیست.');
        ids.add(q.id);
      }
      return data;
    }
    async function loadBank(file){
      if(!file)return;
      if(file.size>5_000_000){notify('حجم فایل بیش از حد مجاز است.');return;}
      try{
        const data=validate(JSON.parse(await file.text()));
        const prevNames=bank?.questions.map(q=>q.id).join(',');
        if(prevNames && prevNames!==data.questions.map(q=>q.id).join(',')){
          if(!confirm('بانک سؤال متفاوت است. ارزیابی قبلی برای این جلسه پاک شود؟'))return;
          grades={};notes={};hintLevels={};followLevels={};pos=0;
        }
        bank=data;pos=Math.max(0,Math.min(pos,bank.questions.length-1));started=Date.now();
        $('totalMinutes').textContent=`${fa(bank.durationMinutes||75)} دقیقه`;
        $('openCandidate').disabled=false;$('export').disabled=false;
        render();notify(`${fa(data.questions.length)} سؤال بارگذاری شد. پاسخ‌ها فقط در این تب هستند.`);
      }catch(e){notify('خطای بارگذاری: '+e.message);}
    }
    ['bankInput','bankInput2'].forEach(id=>$(id).addEventListener('change',e=>loadBank(e.target.files?.[0])));
    $('prev').addEventListener('click',()=>navigate(pos-1));$('next').addEventListener('click',()=>navigate(pos+1));
    $('hintNext').addEventListener('click',()=>{hintLevels[key()]=getHintLevel()+1;renderHints();sendSlide();save();});
    $('hintReset').addEventListener('click',()=>{hintLevels[key()]=0;renderHints();sendSlide();save();});
    $('followupNext').addEventListener('click',()=>{followLevels[key()]=getFollowLevel()+1;renderFollowups();sendSlide();save();});
    $('followupReset').addEventListener('click',()=>{followLevels[key()]=0;renderFollowups();sendSlide();save();});
    $('toggleAnswer').addEventListener('click',()=>toggleAnswer($('answerContent').hidden));
    $('note').addEventListener('input',()=>{notes[key()]=$('note').value;save();});
    $('openCandidate').addEventListener('click',()=>{window.open('./candidate.html?room='+encodeURIComponent(room),'_blank','noopener');notify('فقط تب کاندیدا را Share کن.');});
    $('export').addEventListener('click',()=>{
      notes[key()]=$('note').value;
      const payload={title:bank.title,exportedAt:new Date().toISOString(),evaluations:bank.questions.map((q,i)=>({number:i+1,id:q.id,title:q.title,score:grades[q.id]??null,hintsUsed:Number(hintLevels[q.id]||0),followupsUsed:Number(followLevels[q.id]||0),note:notes[q.id]||''}))};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='baharan-interview-evaluation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      notify('گزارش ارزیابی دریافت شد.');
    });
    document.addEventListener('keydown',e=>{if(!e.altKey || !bank || ['TEXTAREA','INPUT'].includes(document.activeElement.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();navigate(pos+1);}else if(e.key==='ArrowRight'){e.preventDefault();navigate(pos-1);}});
    setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);$('elapsed').textContent=`${fa(Math.floor(seconds/60)).padStart(2,'۰')}:${fa(seconds%60).padStart(2,'۰')}`;},1000);
  }
})();

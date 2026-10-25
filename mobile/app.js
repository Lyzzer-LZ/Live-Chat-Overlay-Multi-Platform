(() => {
  const $ = id => document.getElementById(id);
  const token = new URLSearchParams(location.search).get('token');
  const feed = $('feed'); let sources = []; let delay = 1000;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const platform = p => ({tiktok:'TikTok',youtube:'YouTube',twitch:'Twitch'}[p] || p || 'Live');
  function renderSources(list) {
    sources = Array.isArray(list) ? list : [];
    $('count').textContent = `${sources.length} sumber`;
    $('sources').innerHTML = sources.length ? sources.map(s => {
      const st=s.stats||{}; const n=v=>v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toLocaleString('id-ID');
      return `<article class="source"><b class="mark ${esc(s.platform)}">${esc(platform(s.platform).slice(0,1))}</b><div class="source-name"><strong>${esc(s.label||platform(s.platform))}</strong><small>${esc(platform(s.platform))}</small></div><div class="stats">${n(st.viewers)} <small>penonton</small><br>${n(st.likes)} <small>suka</small></div></article>`;
    }).join('') : '<p class="empty">Belum ada sumber live yang terhubung di aplikasi PC.</p>';
  }
  function addMessage(p, activity=false) {
    if (feed.querySelector('.empty')) feed.innerHTML='';
    const src=sources.find(s=>s.id===p.sourceId); const who=p.nickname||p.username||'Penonton';
    let badge=activity?'AKTIVITAS':'CHAT', text=p.comment||'';
    if(activity){ if(p.type==='gift'){badge='GIFT';text=`mengirim ${p.giftName||'Gift'}${Number(p.amount)>1?' × '+p.amount:''}`;} else if(p.type==='follow'){badge='FOLLOW';text='mulai mengikuti';} else if(p.type==='share'){badge='SHARE';text='membagikan live';} else if(p.type==='superchat'){badge='SUPER CHAT';text=[p.amountText,text].filter(Boolean).join(' ');} else if(p.type==='membership'){badge='MEMBER';text=text||'bergabung';} else badge=String(p.type||badge).toUpperCase(); }
    const avatar=p.avatar?`<img class="avatar" src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">`:`<span class="avatar">${esc(who.slice(0,1).toUpperCase())}</span>`;
    const card=document.createElement('article');card.className='message'+(activity?' activity':'');
    card.innerHTML=`<div class="meta"><span>${esc(p.sourceLabel||src?.label||platform(p.platform))}</span><b>${esc(badge)}</b></div><div class="person">${avatar}<div><strong>${esc(who)}</strong><p>${esc(text||'(tanpa teks)')}</p></div></div>`;
    feed.prepend(card); while(feed.children.length>150) feed.lastElementChild.remove(); $('updated').textContent='Diperbarui '+new Date().toLocaleTimeString('id-ID');
  }
  function handle(e){let m;try{m=JSON.parse(e.data)}catch{return} if(!m||!m.channel)return; const p=m.payload||{};
    if(m.channel==='sources:update') renderSources(p);
    else if(m.channel==='live:stats'){sources=sources.map(s=>s.id===p.sourceId?{...s,label:p.sourceLabel||s.label,stats:{...(s.stats||{}),...p}}:s);renderSources(sources)}
    else if(m.channel==='live:chat') addMessage(p,false);
    else if(m.channel==='live:activity') addMessage(p,true);
  }
  function connect(){ if(!token){$('status').textContent='Token tidak ada';$('sources').innerHTML='<p class="empty">Token tidak ditemukan. Buka tautan lengkap dari aplikasi PC.</p>';return;}
    const proto=location.protocol==='https:'?'wss:':'ws:'; const ws=new WebSocket(`${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`); $('status').textContent='Menghubungkan…';
    ws.onopen=()=>{delay=1000;$('status').textContent='Terhubung'}; ws.onmessage=handle; ws.onerror=()=>{$('status').textContent='Koneksi bermasalah'}; ws.onclose=()=>{$('status').textContent='Terputus · mencoba lagi';setTimeout(connect,delay);delay=Math.min(delay*2,15000)};
  }
  $('clear').addEventListener('click',()=>{feed.innerHTML='<p class="empty">Feed dibersihkan. Menunggu chat baru…</p>'}); connect();
})();

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    p1: { hp:100, maxHp:100, mp:50, maxMp:50, effects: {} },
    p2: { hp:110, maxHp:110, mp:55, maxMp:55, effects: {} },
    turn: 'p1',
    busy: false,
    actionTaken: false,
    winner: null,
    round: 1
  };

  const spells = {
    p1: [
      { id:'fire', name:'Bola de Fogo', cost:8, dmg:[14,22], visual:'fire' },
      { id:'ice',  name:'Gelo', cost:7, dmg:[10,16], visual:'ice', slow:1 },
      { id:'heal', name:'Cura', cost:7, heal:[16,18], visual:'heal' },
      { id:'shield', name:'Escudo', cost:5, shield:20, visual:'shield' },
      { id:'wind', name:'Corte de Ar', cost:6, dmg:[10,18], visual:'wind' }
    ],
    p2: [
      { id:'hit', name:'Soco', cost:0, dmg:[6,10], visual:'hit' },
      { id:'drain', name:'Dreno', cost:10, dmg:[8,14], healPercent:0.4, visual:'shadow' },
      { id:'barreira', name:'Barreira', cost:6, shield:14, visual:'shield' },
      { id:'light', name:'Raio de Luz', cost:7, dmg:[12,16], visual:'light' }
    ]
  };

  const $ = id => document.getElementById(id);
  const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const log = txt => { const d = document.createElement('div'); d.innerHTML = txt; $('log').prepend(d); };

  function updateHUD(){
    $('p1hp').style.width = Math.max(0,(state.p1.hp/state.p1.maxHp)*100) + '%';
    $('p2hp').style.width = Math.max(0,(state.p2.hp/state.p2.maxHp)*100) + '%';
    updateShieldBar('p1');
    updateShieldBar('p2');
    $('p1mp').style.width = Math.max(0,(state.p1.mp/state.p1.maxMp)*100) + '%';
    $('p2mp').style.width = Math.max(0,(state.p2.mp/state.p2.maxMp)*100) + '%';
    $('p1hpTxt').innerText = Math.round(state.p1.hp);
    $('p1mpTxt').innerText = Math.round(state.p1.mp);
    $('p2hpTxt').innerText = Math.round(state.p2.hp);
    $('p2mpTxt').innerText = Math.round(state.p2.mp);
    refreshButtons();
  }

  function updateShieldBar(pid) {
    const bar = document.getElementById(pid + 'hp').parentElement;
    let shieldBar = bar.querySelector('.hp-shield-bar');
    const player = state[pid];
    if (!player.effects.shield || player.effects.shield.value <= 0) {
      if (shieldBar) shieldBar.remove();
      return;
    }
    if (!shieldBar) {
      shieldBar = document.createElement('i');
      shieldBar.className = 'hp-shield-bar';
      bar.appendChild(shieldBar);
    }
    const percent = Math.max(0, Math.min(1, player.effects.shield.value / player.maxHp));
    shieldBar.style.width = (percent * 100) + '%';
  }

  function refreshButtons(){
    document.querySelectorAll('.spell-btn').forEach(btn => {
      const owner = btn.dataset.owner;
      const cost = Number(btn.dataset.cost || 0);
      const actor = owner === 'p1' ? state.p1 : state.p2;
      btn.disabled = Boolean(
        state.winner ||
        state.busy ||
        state.actionTaken ||
        state.turn !== owner ||
        actor.mp < cost
      );
    });

    $('endLeft').disabled  = !(state.turn === 'p1' && !state.busy && state.actionTaken && !state.winner);
    $('endRight').disabled = !(state.turn === 'p2' && !state.busy && state.actionTaken && !state.winner);
    $('medLeft').disabled  = !(state.turn === 'p1' && !state.busy && !state.actionTaken && !state.winner);
    $('medRight').disabled = !(state.turn === 'p2' && !state.busy && !state.actionTaken && !state.winner);
  }

  function renderSpells(){
    const s1 = $('spells1'), s2 = $('spells2');
    s1.innerHTML = ''; s2.innerHTML = '';
    spells.p1.forEach(s => {
      const b = document.createElement('button');
      b.className = 'spell-btn';
      b.innerText = `${s.name} (MP ${s.cost})`;
      b.dataset.owner = 'p1'; b.dataset.cost = s.cost;
      b.addEventListener('click', () => attemptCast('p1', s));
      s1.appendChild(b);
    });
    spells.p2.forEach(s => {
      const b = document.createElement('button');
      b.className = 'spell-btn';
      b.innerText = `${s.name} (MP ${s.cost})`;
      b.dataset.owner = 'p2'; b.dataset.cost = s.cost;
      b.addEventListener('click', () => attemptCast('p2', s));
      s2.appendChild(b);
    });
    refreshButtons();
  }

  function applyDamage(target, amount){
    if(target.effects && target.effects.shield && target.effects.shield.value > 0){
      const sh = target.effects.shield;
      const absorbed = Math.min(sh.value, amount);
      sh.value -= absorbed;
      amount -= absorbed;
      log(`<small style="color:#cfcfcf">${absorvido} absorvido pelo escudo.</small>`);
      if(sh.value <= 0){ delete target.effects.shield; log(`<small style="color:#cfcfcf">Escudo destruído.</small>`); }
    }
    if(amount > 0){
      target.hp = Math.max(0, target.hp - amount);
    }
    updateHUD();
  }

  (function(){
  const fxContainer = $('fx');
  let canvas = fxContainer.querySelector('canvas');
  if(!canvas){
    canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    fxContainer.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  let DPR = window.devicePixelRatio || 1;

  function resizeCanvas(){
    const rect = fxContainer.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  const projectiles = [], impacts = [], shields = [];
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

  let rafId = null;
  function ensureLoop(){ if(rafId == null) rafId = requestAnimationFrame(loop); }

  function loop(){
    ctx.clearRect(0,0, canvas.width / DPR, canvas.height / DPR);
    const now = performance.now();

    for(let i = projectiles.length-1; i >= 0; i--){
      const p = projectiles[i];
      const t = Math.min(1, (now - p.start) / p.duration);
      const et = easeOutCubic(t);
      const x = p.sx + (p.ex - p.sx) * et;
      const y = p.sy + (p.ey - p.sy) * et;

      if(p.visual === 'fire'){
        const rad = 18 * (1 + 0.12 * Math.sin((now - p.start)/80));
        const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
        g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(0.5, 'rgba(255,110,50,0.95)'); g.addColorStop(1, 'rgba(255,60,20,0.05)');
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
      } else if(p.visual === 'ice'){
        ctx.save();
        const angle = Math.atan2(p.ey - p.sy, p.ex - p.sx);
        ctx.translate(x,y); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(0,-20); ctx.lineTo(12,0); ctx.lineTo(0,20); ctx.closePath();
        ctx.fillStyle = 'rgba(210,245,255,0.98)'; ctx.fill();
        ctx.restore();
      } else if(p.visual === 'shadow'){
        ctx.beginPath(); ctx.fillStyle = 'rgba(140,110,200,0.95)'; ctx.arc(x,y,12,0,Math.PI*2); ctx.fill();
      } else if(p.visual === 'hit'){
        const base = 13 + 6 * Math.sin((now - p.start)/60);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, base, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255, 220, 80, 0.95)';
        ctx.shadowColor = 'rgba(255,220,80,0.7)';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(255,220,80,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x-base*0.7, y);
        ctx.lineTo(x+base*0.7, y);
        ctx.moveTo(x, y-base*0.7);
        ctx.lineTo(x, y+base*0.7);
        ctx.stroke();
        ctx.restore();
      } else if(p.visual === 'wind'){
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI/8 * Math.sin((now-p.start)/120));
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 7, 0, 0, Math.PI*2);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(180,240,255,0.85)';
        ctx.shadowColor = 'rgba(120,220,255,0.7)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if(p.visual === 'light'){
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 13 + 5*Math.sin((now-p.start)/80), 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,180,0.93)';
        ctx.shadowColor = 'rgba(255,255,180,0.7)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.fillStyle = 'rgba(200,230,255,0.95)'; ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
      }

      if(t >= 1){
        if(p.resolve) p.resolve();
        projectiles.splice(i,1);
      }
    }

    for(let i = impacts.length-1; i >= 0; i--){
      const im = impacts[i];
      const t = Math.min(1, (now - im.start) / im.duration);
      const alpha = 1 - t;
      const scale = easeOutCubic(t);

      if(im.visual === 'fire'){
        const r = 55 * scale;
        const g = ctx.createRadialGradient(im.x, im.y, 2, im.x, im.y, r);
        g.addColorStop(0, `rgba(255,210,160,${alpha})`);
        g.addColorStop(0.6, `rgba(255,110,40,${alpha*0.6})`);
        g.addColorStop(1, `rgba(255,80,30,0)`);
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(im.x,im.y,r,0,Math.PI*2); ctx.fill();
      } else if(im.visual === 'ice'){
        const r = 44 * scale;
        const g = ctx.createRadialGradient(im.x, im.y, 2, im.x, im.y, r);
        g.addColorStop(0, `rgba(230,250,255,${alpha})`);
        g.addColorStop(1, `rgba(120,200,255,0)`);
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(im.x,im.y,r,0,Math.PI*2); ctx.fill();
      } else if(im.visual === 'heal'){
        const r = 48 * scale;
        const g = ctx.createRadialGradient(im.x, im.y, 2, im.x, im.y, r);
        g.addColorStop(0, `rgba(200,255,220,${alpha})`);
        g.addColorStop(1, `rgba(80,200,120,0)`);
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(im.x,im.y,r,0,Math.PI*2); ctx.fill();
      } else if(im.visual === 'hit'){
        const r = 38 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(im.x, im.y, r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255, 220, 80, ${alpha*0.7})`;
        ctx.shadowColor = 'rgba(255,220,80,0.5)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = `rgba(255,220,80,${alpha*0.7})`;
        ctx.lineWidth = 2;
        for(let j=0;j<4;j++){
          const ang = Math.PI/2 * j;
          ctx.beginPath();
          ctx.moveTo(im.x + Math.cos(ang)*r*0.7, im.y + Math.sin(ang)*r*0.7);
          ctx.lineTo(im.x + Math.cos(ang)*r*1.1, im.y + Math.sin(ang)*r*1.1);
          ctx.stroke();
        }
        ctx.restore();
      } else if(im.visual === 'shadow'){
        const r = 36 * scale;
        ctx.beginPath(); ctx.fillStyle = `rgba(140,110,200,${alpha})`; ctx.arc(im.x,im.y,r,0,Math.PI*2); ctx.fill();
      } else if(im.visual === 'wind'){
        const r = 48 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(im.x, im.y, r, r*0.22, 0, 0, Math.PI*2);
        ctx.globalAlpha = alpha*0.8;
        ctx.fillStyle = 'rgba(180,240,255,0.85)';
        ctx.shadowColor = 'rgba(120,220,255,0.5)';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if(im.visual === 'light'){
        const r = 44 * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(im.x, im.y, r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,180,${alpha*0.7})`;
        ctx.shadowColor = 'rgba(255,255,180,0.5)';
        ctx.shadowBlur = 18;
        ctx.fill();
        ctx.restore();
      } else {
        const r = 36 * scale;
        ctx.beginPath(); ctx.fillStyle = `rgba(200,200,200,${alpha})`; ctx.arc(im.x,im.y,r,0,Math.PI*2); ctx.fill();
      }

      if(t >= 1) impacts.splice(i,1);
    }

    for(let i = shields.length-1; i >= 0; i--){
      const sh = shields[i];
      const t = Math.min(1, (now - sh.start) / sh.duration);
      const alpha = 1 - t;
      const r = sh.r * (0.7 + 0.4 * t);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180,220,255,${alpha})`;
      ctx.lineWidth = 4 * (1 - 0.4 * t);
      ctx.arc(sh.x, sh.y, r, 0, Math.PI*2); ctx.stroke();
      if(t >= 1) shields.splice(i,1);
    }

    if(projectiles.length || impacts.length || shields.length){
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  function battleRect(){ return $('battle').getBoundingClientRect(); }

  function elementCenterToCanvas(el){
    const bfRect = battleRect();
    const r = el.getBoundingClientRect();
    return {
      x: (r.left + r.right)/2 - bfRect.left,
      y: (r.top + r.bottom)/2 - bfRect.top
    };
  }

  window.launchProjectileAsync = function(owner, visual){
    return new Promise(resolve => {
      try {
        const fromEl = owner === 'p1' ? $('p1box') : $('p2box');
        const toEl   = owner === 'p1' ? $('p2box') : $('p1box');
        const f = elementCenterToCanvas(fromEl);
        const t = elementCenterToCanvas(toEl);
        const duration = 420 + Math.random() * 180;
        projectiles.push({ sx: f.x, sy: f.y, ex: t.x, ey: t.y, visual: visual || 'fire', start: performance.now(), duration, resolve });
        ensureLoop();
      } catch(e){ console.error(e); resolve(); }
    });
  };

  window.showImpact = function(owner, visual){
    try {
      const node = $(owner + 'box');
      const p = elementCenterToCanvas(node);
      impacts.push({ x: p.x, y: p.y, visual: visual, start: performance.now(), duration: 420 });
      ensureLoop();
    } catch(e){ console.error(e); }
  };

  window.showImpactAsync = function(owner, visual){
    return new Promise(resolve => {
      try {
        window.showImpact(owner, visual);
        setTimeout(resolve, 420);
      } catch(e){ console.error(e); resolve(); }
    });
  };

  window.showShield = function(owner){
    try {
      const node = $(owner + 'box');
      const p = elementCenterToCanvas(node);
      shields.push({ x: p.x, y: p.y, r: 80, start: performance.now(), duration: 900 });
      ensureLoop();
    } catch(e){ console.error(e); }
  };

})();
const soundMap = {
  fire:   'Sons/Fogo.mp3',
  ice:    'Sons/Gelo.mp3',
  heal:   'Sons/Cura.mp3',
  shield: 'Sons/Escudo.mp3',
  shadow: 'Sons/Sombra.mp3',
  med:    'Sons/Meditar.mp3',
  hit:    'Sons/Soco.mp3',
  wind:   'Sons/Vento.mp3',
  light:  'Sons/Luz.mp3'
};

function playSound(type) {
  const src = soundMap[type];
  if (!src) return;
  const audio = new Audio(src);
  audio.volume = 0.6;
  audio.play();
  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
  }, 3000);
}

let soundtrackAudio = null;

function playSoundtrack() {
  if (soundtrackAudio) {
    soundtrackAudio.currentTime = 0;
    soundtrackAudio.play();
    return;
  }
  soundtrackAudio = new Audio('Sons/Trilha.mp3');
  soundtrackAudio.loop = true;
  soundtrackAudio.volume = 0.5;
  soundtrackAudio.play();
}

function pauseSoundtrack() {
  if (soundtrackAudio) soundtrackAudio.pause();
}

window.toggleSoundtrack = function() {
  if (!soundtrackAudio) return;
  if (soundtrackAudio.paused) soundtrackAudio.play();
  else soundtrackAudio.pause();
};

async function attemptCast(owner, spell){
  if(state.busy || state.winner) return;
  if(state.turn !== owner){ log('Não é seu turno.'); return; }
  const actor = owner === 'p1' ? state.p1 : state.p2;
  const target = owner === 'p1' ? state.p2 : state.p1;
  if(actor.mp < (spell.cost || 0)){ log('MP insuficiente.'); return; }

  actor.mp = Math.max(0, actor.mp - (spell.cost || 0));
  state.busy = true;
  state.actionTaken = true;
  refreshButtons();
  log(`<b>${owner === 'p1' ? 'Jogador 1' : 'Jogador 2'}</b> usa <b>${spell.name}</b>...`);

  try {
    if(spell.dmg){
      if (spell.id === 'hit') playSound('hit');
      else playSound(spell.visual);
      await launchProjectileAsync(owner, spell.visual);
      let dmg = randInt(spell.dmg[0], spell.dmg[1]);
      const bonus = 2 * (state.round - 1);
      if(bonus > 0) dmg += bonus;
      applyDamage(target, dmg);
      log(`<span style="color:#ffd3a8">${dmg}</span> de dano. <small>(+${bonus} por rodada)</small>`);
      if(spell.healPercent){
        const heal = Math.floor(dmg * spell.healPercent);
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        log(`<span style="color:#bff0c7">${heal}</span> curados via Dreno.`);
      }
      showImpact(target === state.p1 ? 'p1' : 'p2', spell.visual);
    } else if(spell.heal){
      playSound('heal');
      await showImpactAsync(owner, 'heal');
      const v = randInt(spell.heal[0], spell.heal[1]);
      actor.hp = Math.min(actor.maxHp, actor.hp + v);
      log(`<span style="color:#bff0c7">${v}</span> curados.`);
    } else if(spell.mpRecover){
      playSound('med');
      await showImpactAsync(owner, 'heal');
      const amt = randInt(spell.mpRecover[0], spell.mpRecover[1]);
      actor.mp = Math.min(actor.maxMp, actor.mp + amt);
      log(`<span style="color:#bfe0ff">${amt}</span> MP recuperado.`);
    } else if(spell.shield){
      playSound('shield');
      actor.effects = actor.effects || {};
      actor.effects.shield = { value: spell.shield, turns: 1 };
      showShield(owner);
      log(`<small>Escudo de ${spell.shield} aplicado.</small>`);
    } else if(spell.slow){
      playSound('ice');
      target.effects = target.effects || {};
      target.effects.precDown = { turns: spell.slow };
      log(`<small>Precisão reduzida em ${spell.slow} turno(s).</small>`);
    }
  } catch(err){
    console.error('Erro cast:', err);
  } finally {
    state.busy = false;
    updateHUD();
    checkWinner();
  }
}


  function endTurnFor(pid){
    if(state.busy || state.winner) return;
    if(state.turn !== pid){ log('Somente o jogador do turno pode terminar.'); return; }
    if(!state.actionTaken){ log('Você deve executar uma ação antes de terminar o turno.'); return; }
    tickEffects(state.p1); tickEffects(state.p2);
    state.actionTaken = false;
    state.turn = (state.turn === 'p1') ? 'p2' : 'p1';

    if(state.turn === 'p1'){
      state.round += 1;
      log(`<small>Rodada ${state.round - 1} concluída. Agora Rodada ${state.round}.</small>`);
    }

    refreshButtons();
    log(`<i>Agora é a vez de ${state.turn === 'p1' ? 'Jogador 1' : 'Jogador 2'}</i>`);
  }

  function tickEffects(character){
    for(const k of Object.keys(character.effects)){
      const ef = character.effects[k];
      if(ef.turns != null){
        ef.turns--;
        if(ef.turns <= 0) delete character.effects[k];
      }
    }
  }

  function applyPreset(){
    const pr = $('preset').value;
    if(pr === 'default'){
      state.p1.hp = state.p1.maxHp = 100; state.p1.mp = state.p1.maxMp = 50;
      state.p2.hp = state.p2.maxHp = 110; state.p2.mp = state.p2.maxMp = 55;
    } else {
      state.p1.hp = state.p1.maxHp = 105; state.p1.mp = state.p1.maxMp = 55;
      state.p2.hp = state.p2.maxHp = 105; state.p2.mp = state.p2.maxMp = 55;
    }
  }
  function applyColors(){
    const c1 = $('color1').value, c2 = $('color2').value;
    const b1 = $('p1box'), b2 = $('p2box');
    if(!b1.querySelector('img')) b1.style.background = c1;
    if(!b2.querySelector('img')) b2.style.background = c2;
  }
  function loadFiles(){
    const f1 = $('img1').files[0], f2 = $('img2').files[0];
    if(f1) setPlayerImage('p1box', URL.createObjectURL(f1));
    if(f2) setPlayerImage('p2box', URL.createObjectURL(f2));
  }
  function setPlayerImage(boxId, url){
    const box = $(boxId);
    const prev = box.querySelector('img'); if(prev) prev.remove();
    box.style.background = 'transparent';
    const img = document.createElement('img'); img.src = url;
    img.onload = ()=>{ URL.revokeObjectURL(url); };
    box.appendChild(img);
    const lbl = box.querySelector('span'); if(lbl) lbl.style.display = 'none';
  }

  function hookupUI(){
    $('start').addEventListener('click', () => {
      try {
        applyPreset(); applyColors(); loadFiles();
        $('modal').style.display = 'none';
        updateHUD();
        log('Duelo iniciado — Jogador 1 começa. Rodada 1.');
        playSoundtrack();
      } catch(e){ console.error(e); alert('Erro ao iniciar (veja console)'); }
    });
    $('cancel').addEventListener('click', ()=>$('modal').style.display='none');
    $('endLeft').addEventListener('click', ()=>endTurnFor('p1'));
    $('endRight').addEventListener('click', ()=>endTurnFor('p2'));
    $('medLeft').addEventListener('click', ()=>attemptCast('p1', { id:'med', name:'Meditar', cost:0, mpRecover:[10,16], visual:'heal' }));
    $('medRight').addEventListener('click', ()=>attemptCast('p2', { id:'med', name:'Meditar', cost:0, mpRecover:[12,18], visual:'heal' }));
  }

  function checkWinner(){
    if(state.p1.hp <= 0 && state.p2.hp <= 0){ state.winner = 'draw'; log('<b>Empate!</b>'); }
    else if(state.p2.hp <= 0){ state.winner = 'p1'; log('<b>Jogador 1 venceu!</b>'); }
    else if(state.p1.hp <= 0){ state.winner = 'p2'; log('<b>Jogador 2 venceu!</b>'); }
    if(state.winner) refreshButtons();
  }

  window.setBattleBackground = url => {
    const b = $('battle');
    b.style.backgroundImage = `url(${url})`;
    b.style.backgroundSize = 'cover';
    b.style.backgroundPosition = 'center';
  };

  renderSpells();
  hookupUI();
  updateHUD();
  $('modal').style.display = 'flex';
  log('Bem-vindo! Ajuste cores/preset e clique em Iniciar.');
});

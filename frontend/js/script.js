

   const API_URL = 'http://127.0.0.1:8000';

   const PK = {
       instituicao: 'id_instituicao', curso: 'id_curso', estudante: 'id_estudante', categoria: 'id_categoria',
       compromisso: 'id_compromisso', recorrencia: 'id_recorrencia', bloco_descompressao: 'id_bloco',
       conversa: 'id_conversa', mensagem: 'id_mensagem', meta: 'id_meta', habito_checkin: 'id_checkin',
       jornada_trabalho: 'id_jornada', lembrete: 'id_lembrete'
   };
   const TABLES = Object.keys(PK).concat(['recorrencia_dia', 'jornada_dia']);
   

   const DB = {
       KEY: 'flow_agendas_db_v2', d: null,
       init() {
           let raw = null;
           try { raw = localStorage.getItem(this.KEY); } catch (e) {}
           try { this.d = raw ? JSON.parse(raw) : null; } catch (e) { this.d = null; }
           if (!this.d) this.d = { seq: {}, session: null };
           TABLES.forEach(t => { if (!this.d[t]) this.d[t] = []; });
           if (!this.d.categoria.length) {
               [['Estudo', '#4B3FE4', 4], ['Trabalho', '#0A8FB3', 5], ['Lazer', '#E0287D', 1],
                ['Saúde', '#0E9F6E', 2], ['Descompressão', '#8B5CF6', 1], ['Pessoal', '#D98A0B', 3]]
                   .forEach(([nome, cor, peso]) => this.insert('categoria', { nome, cor_hex: cor, peso_energia: peso, padrao_sistema: true }));
           }
           this.save();
       },
       save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) {} },
       insert(t, row) {
           const pk = PK[t];
           if (pk) { this.d.seq[t] = (this.d.seq[t] || 0) + 1; row[pk] = this.d.seq[t]; }
           this.d[t].push(row); this.save(); return row;
       },
       where(t, fn) { return this.d[t].filter(fn); },
       find(t, fn) { return this.d[t].find(fn); },
       get(t, id) { return this.d[t].find(r => r[PK[t]] === id); },
       update(t, id, patch) { const r = this.get(t, id); if (r) { Object.assign(r, patch); this.save(); } return r; },
       _drop(t, fn) { this.d[t] = this.d[t].filter(r => !fn(r)); },
       remove(t, id) {
           if (t === 'compromisso') {
               this.where('recorrencia', r => r.id_compromisso === id).forEach(r => this._drop('recorrencia_dia', x => x.id_recorrencia === r.id_recorrencia));
               this._drop('recorrencia', r => r.id_compromisso === id);
               this._drop('bloco_descompressao', b => b.id_compromisso === id);
               this._drop('habito_checkin', k => k.id_compromisso === id);
               this._drop('lembrete', l => l.id_compromisso === id);
           }
           if (t === 'meta') this.where('compromisso', c => c.id_meta === id).forEach(c => { c.id_meta = null; });
           if (t === 'jornada_trabalho') this._drop('jornada_dia', d => d.id_jornada === id);
           if (t === 'conversa') this._drop('mensagem', m => m.id_conversa === id);
           this._drop(t, r => r[PK[t]] === id);
           this.save();
       }
   };
   
   /* ================= UTILITÁRIOS ================= */
   const $ = id => document.getElementById(id);
   const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
   const pad = n => String(n).padStart(2, '0');
   const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
   const fmtTs = d => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
   const toInput = d => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
   const todayStr = () => fmtDate(new Date());
   const isoDow = d => (d.getDay() === 0 ? 7 : d.getDay());
   const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
   const dayDiff = d => Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
   const fmtBR = s => s.split('-').reverse().join('/');
   const fmtL = ml => `${(ml / 1000).toLocaleString('pt-BR')} L`;
   const fmtH = h => `${String(h).replace('.', ',')} h`;
   const plural = (n, um, varios) => (n === 1 ? um : varios);
   const hhmm = s => { const [h, m] = s.split(':'); return +h + (+m) / 60; };
   const hOf = d => d.getHours() + d.getMinutes() / 60;
   const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
   const WATER_TITLE = 'Beber água (meta diária)';
   
   const ICON = {
       check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
       trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
       ban: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
       undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
       bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
       plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
   };
   
   function toast(msg, type, ms) {
       const t = document.createElement('div');
       t.className = 'toast ' + (type || 'ok');
       t.setAttribute('role', 'status');
       t.innerHTML = `<span class="ti">${type === 'err' ? '!' : type === 'bell' ? ICON.bell : ICON.check}</span><span>${esc(msg)}</span>`;
       $('toast-wrap').appendChild(t);
       setTimeout(() => t.remove(), ms || 3600);
   }
   
   async function sha256(txt) {
       try {
           if (window.crypto && crypto.subtle) {
               const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
               return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
           }
       } catch (e) {}
       let h = 5381; for (const c of txt) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
       return 'weak-' + h.toString(16);
   }
   
   
   let state = {
       user: null,
       conversa: null,
       focusTime: 0, focusSaved: 0, focusInterval: null, isFocusing: false,
       tarefaFilter: 'aberto'
   };
   const uid = () => state.user ? state.user.id_estudante : null;
   const catById = id => DB.get('categoria', id);
   const catByName = nome => DB.find('categoria', c => c.nome === nome);
   const isHabit = c => !!DB.find('recorrencia', r => r.id_compromisso === c.id_compromisso);
   const isBloco = c => !!DB.find('bloco_descompressao', b => b.id_compromisso === c.id_compromisso);
   const isOpen = c => c.status === 'pendente' || c.status === 'em_andamento';
   
   function setUserUI() {
       const n = state.user ? state.user.nome : 'Aluno';
       document.querySelectorAll('.js-username').forEach(e => { e.textContent = n; });
       document.querySelectorAll('.js-avatar').forEach(e => { e.textContent = n.charAt(0).toUpperCase(); });
   }
   
   
   const SCREEN_RENDER = {
       'screen-menu': () => renderDashboard(), 'screen-tarefas': () => renderTarefas(), 'screen-habitos': () => renderHabitos(),
       'screen-metas': () => renderMetas(), 'screen-bemestar': () => renderBemestar(), 'screen-config': () => renderConfig()
   };
   
   function navTo(screenId, navId) {
       const isPublic = (screenId === 'screen-login' || screenId === 'screen-cadastro');
       if (!state.user && !isPublic) { screenId = 'screen-login'; navId = null; }
   
       document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
       const target = $(screenId);
       if (target) {
           if (SCREEN_RENDER[screenId]) SCREEN_RENDER[screenId]();
           target.classList.add('active');
       }
       $('app').classList.toggle('public', isPublic);
   
       document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
       if (!isPublic && navId && $(navId)) { $(navId).classList.add('active'); $(navId).setAttribute('aria-current', 'page'); }
   
       if (screenId === 'screen-menu') playRail();
       if (screenId === 'screen-aya') {
           const chatBox = $('chat-messages');
           setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 50);
       }
       window.scrollTo(0, 0);
   }
   
   
   async function doLogin() {
       const email = $('login-email').value.trim().toLowerCase();
       const pass = $('login-pass').value;
   
       if (!email || !pass) { toast('Informe e-mail e senha.', 'err'); return; }
   
       try {
           const hash = await sha256(pass);
           const res = await fetch(`${API_URL}/login`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ email: email, senha_hash: hash })
           });
   
           if (res.ok) {
               const u = await res.json();
               $('login-pass').value = '';
               startSession(u);
           } else {
               const err = await res.json();
               toast(err.detail || 'E-mail ou senha incorretos.', 'err');
           }
       } catch (error) {
           toast('Servidor offline. Verifique o backend.', 'err');
       }
   }
   
   async function doCadastro() {
       const v = id => $(id).value.trim();
       const nome = v('cad-nome'), email = v('cad-email').toLowerCase(), senha = $('cad-senha').value, nasc = v('cad-nasc');
       const instId = $('cad-inst-id').value;
       const curso = v('cad-curso');
       const turnoCurso = $('cad-curso-turno').value;
       const dur = parseInt($('cad-curso-duracao').value, 10);
   
       if (!nome || !email || !senha || !nasc || !curso) { toast('Preencha todos os campos.', 'err'); return; }
       if (!instId) { toast('Escolha sua escola na lista de busca.', 'err'); return; }
       if (senha.length < 6) { toast('A senha precisa ter ao menos 6 caracteres.', 'err'); return; }
   
       try {
           
           let cursoId = null;
           const resBusca = await fetch(`${API_URL}/cursos/buscar?id_instituicao=${instId}&nome=${encodeURIComponent(curso)}&turno=${turnoCurso}`);
           if (resBusca.ok) {
               const existente = await resBusca.json();
               if (existente && existente.id_curso) cursoId = existente.id_curso;
           }
   
        
           if (!cursoId) {
               const resCurso = await fetch(`${API_URL}/cursos`, {
                   method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ id_instituicao: parseInt(instId, 10), nome: curso, turno: turnoCurso, duracao_semestres: dur })
               });
               const cursoData = await resCurso.json();
               if (!resCurso.ok) { toast('Erro no curso: ' + JSON.stringify(cursoData), 'err'); return; }
               cursoId = cursoData.id_curso;
           }
   
           
           const senhaHash = await sha256(senha);
           const resEst = await fetch(`${API_URL}/estudantes`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_instituicao: parseInt(instId, 10),
                   id_curso: cursoId,
                   nome: nome,
                   data_nascimento: nasc,
                   email: email,
                   senha_hash: senhaHash,
                   ano_escolar: $('cad-ano').value,
                   turno_escolar: $('cad-turno-escolar').value
               })
           });
           const estData = await resEst.json();
           if (!resEst.ok) { toast('Erro no estudante: ' + JSON.stringify(estData), 'err'); return; }
   
           toast('Conta criada. Bem-vindo(a) ao Flow.');
           $('form-cadastro').reset();
           $('cad-inst-id').value = '';
           startSession(estData);
       } catch (e) {
           toast('Erro de rede. Verifique o backend.', 'err');
       }
   }
   
   function startSession(u) {
       state.user = u;
   
    
       DB.d.session = u.id_estudante;
       DB.save();
   
       setUserUI();
       loadConversa();
       checkLembretes();
       navTo('screen-menu', 'nav-dashboard');
   }
   
   function logout() {
       if (state.conversa) DB.update('conversa', state.conversa.id_conversa, { encerrada_em: fmtTs(new Date()) });
       if (state.isFocusing) { clearInterval(state.focusInterval); state.isFocusing = false; saveFocus(); }
       state.user = null; state.conversa = null; state.focusTime = 0; state.focusSaved = 0;
       DB.d.session = null; DB.save();
       navTo('screen-login');
   }
   
   function updateName(newName) {
       if (newName.trim() === '' || !state.user) return;
       state.user = DB.update('estudante', uid(), { nome: newName.trim() });
       setUserUI();
   }
   

   function renderConfig() {
       const u = state.user;
       if (!u) return;
       $('config-name').value = u.nome;
       $('config-email').value = u.email;
       const i = DB.get('instituicao', u.id_instituicao), c = DB.get('curso', u.id_curso);
       $('config-inst').value = i ? `${i.nome} (${i.cidade}/${i.uf})` : 'Não cadastrada';
       $('config-curso').value = c ? `${c.nome}, ${c.turno}, ${c.duracao_semestres} semestres` : 'Não cadastrado';
       $('config-ano').value = u.ano_escolar || '1_ano';
       $('config-turno').value = u.turno_escolar || 'manha';
       renderJornadas();
   }
   
   function saveConfig() {
       state.user = DB.update('estudante', uid(), { ano_escolar: $('config-ano').value, turno_escolar: $('config-turno').value });
       toast('Ajustes salvos.');
   }
   
   function openModal(id) {
       $(id).classList.add('open');
       const f = $(id).querySelector('input[type=text], input[type=time]');
       if (f) setTimeout(() => f.focus(), 60);
   }
   function closeModal(id) { $(id).classList.remove('open'); }
   document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(m => m.classList.remove('open')); });
   
   function fillCategorias(selId, preferida) {
       $(selId).innerHTML = DB.d.categoria.map(c => `<option value="${c.id_categoria}" ${c.nome === preferida ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
   }
   
   const TIPO_JORNADA = { aprendiz: 'Aprendiz', estagiario: 'Estagiário(a)' };
   function jornadasHoje() {
       if (!state.user) return [];
       const hoje = todayStr(), dow = isoDow(new Date());
       return DB.where('jornada_trabalho', j => j.id_estudante === uid() && j.vigencia_inicio <= hoje && (!j.vigencia_fim || j.vigencia_fim >= hoje)
           && DB.find('jornada_dia', d => d.id_jornada === j.id_jornada && d.dia_semana === dow));
   }
   function jornadaCarga() {
       const a = $('j-inicio').value, b = $('j-fim').value;
       if (!a || !b) return null;
       return Math.round((hhmm(b) - hhmm(a)) * 100) / 100;
   }
   function updateCarga() {
       const c = jornadaCarga();
       $('j-carga').textContent = c === null ? 'Informe o início e o fim.'
           : c <= 0 ? 'O fim precisa ser depois do início.'
           : c > 8 ? `${fmtH(c)} por dia passa do limite de 8 h.`
           : `Carga diária de ${fmtH(c)}.`;
   }
   function openJornada() {
       $('form-jornada').reset();
       $('j-inicio').value = '08:00'; $('j-fim').value = '14:00';
       $('j-vig-ini').value = todayStr();
       document.querySelectorAll('#j-dias .day-chip').forEach((b, i) => b.classList.toggle('on', i < 5));
       updateCarga();
       openModal('modal-jornada');
   }
   function saveJornada() {
       const empresa = $('j-empresa').value.trim();
       if (!empresa) { toast('Informe o nome da empresa.', 'err'); return; }
       const carga = jornadaCarga();
       if (carga === null || carga <= 0) { toast('O fim precisa ser depois do início.', 'err'); return; }
       if (carga > 8) { toast('A carga diária não pode passar de 8 horas.', 'err'); return; }
       const dias = Array.from(document.querySelectorAll('#j-dias .day-chip.on')).map(b => parseInt(b.dataset.d, 10));
       if (!dias.length) { toast('Escolha ao menos um dia da semana.', 'err'); return; }
       const vi = $('j-vig-ini').value, vf = $('j-vig-fim').value || null;
       if (!vi) { toast('Informe quando a jornada começa.', 'err'); return; }
       if (vf && vf < vi) { toast('O fim da vigência não pode ser antes do início.', 'err'); return; }
       const j = DB.insert('jornada_trabalho', {
           id_estudante: uid(), tipo: $('j-tipo').value, empresa, hora_inicio: $('j-inicio').value + ':00', hora_fim: $('j-fim').value + ':00',
           carga_horaria_diaria: carga, vigencia_inicio: vi, vigencia_fim: vf
       });
       dias.forEach(d => DB.insert('jornada_dia', { id_jornada: j.id_jornada, dia_semana: d }));
       closeModal('modal-jornada'); toast('Jornada salva.');
       renderJornadas(); renderRail();
   }
   function deleteJornada(id) {
       if (confirm('Excluir esta jornada?')) { DB.remove('jornada_trabalho', id); toast('Jornada excluída.'); renderJornadas(); renderRail(); }
   }
   function renderJornadas() {
       const box = $('jornada-list');
       if (!box) return;
       const js = DB.where('jornada_trabalho', j => j.id_estudante === uid());
       if (!js.length) { box.innerHTML = '<p class="muted">Nenhuma jornada cadastrada.</p>'; return; }
       box.innerHTML = '<ul class="list">' + js.map(j => {
           const dias = DB.where('jornada_dia', d => d.id_jornada === j.id_jornada).map(d => d.dia_semana).sort();
           const diasTxt = dias.join() === '1,2,3,4,5' ? 'seg a sex' : dias.map(d => DIAS[d].toLowerCase()).join(', ');
           return `<li class="jrow"><div class="jmain"><strong>${TIPO_JORNADA[j.tipo]} em ${esc(j.empresa)}</strong>
               <span>${j.hora_inicio.slice(0, 5)} às ${j.hora_fim.slice(0, 5)}, ${diasTxt}</span>
               <span>${fmtH(j.carga_horaria_diaria)} por dia</span></div>
               <button class="ib del" onclick="deleteJornada(${j.id_jornada})">${ICON.trash}</button></li>`;
       }).join('') + '</ul>';
   }
   
   function fmtAntec(m) {
       if (m === 0) return 'no horário';
       if (m < 60) return `${m} min antes`;
       if (m < 1440) return `${m / 60} h antes`;
       return `${m / 1440} dia antes`;
   }
   function checkLembretes() {
       if (!state.user) return;
       const agora = fmtTs(new Date());
       DB.where('lembrete', l => l.id_estudante === uid() && !l.enviado && l.data_hora <= agora).forEach(l => {
           const c = l.id_compromisso ? DB.get('compromisso', l.id_compromisso) : null;
           DB.update('lembrete', l.id_lembrete, { enviado: true });
           if (!c || isOpen(c)) toast(l.mensagem, 'bell', 10000);
       });
   }
   
   function minhasTarefas() { return DB.where('compromisso', c => c.id_estudante === uid() && !isHabit(c) && !isBloco(c)); }
   function openTarefa(idMeta) {
       $('form-tarefa').reset(); fillCategorias('tarefa-categoria', 'Estudo');
       const metas = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa');
       $('tarefa-meta').innerHTML = '<option value="">Nenhuma</option>' + metas.map(m => `<option value="${m.id_meta}" ${m.id_meta === idMeta ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('');
       const a = new Date(); a.setMinutes(0, 0, 0); a.setHours(a.getHours() + 1);
       const b = new Date(a); b.setHours(b.getHours() + 1);
       $('tarefa-inicio').value = toInput(a); $('tarefa-fim').value = toInput(b);
       openModal('modal-tarefa');
   }
   function saveTarefa() {
       const titulo = $('tarefa-titulo').value.trim();
       if (!titulo) { toast('Dê um título à tarefa.', 'err'); return; }
       const a = new Date($('tarefa-inicio').value), b = new Date($('tarefa-fim').value);
       if (isNaN(a) || isNaN(b)) { toast('Informe início e fim.', 'err'); return; }
       if ($('tarefa-dia-inteiro').checked) { a.setHours(0, 0, 0, 0); b.setHours(23, 59, 59, 0); }
       if (!(b > a)) { toast('O fim precisa ser depois do início.', 'err'); return; }
       const idMeta = parseInt($('tarefa-meta').value, 10) || null;
       const c = DB.insert('compromisso', {
           id_estudante: uid(), id_categoria: parseInt($('tarefa-categoria').value, 10), id_semana: null, id_meta: idMeta,
           titulo, descricao: $('tarefa-descricao').value.trim() || null,
           data_inicio: fmtTs(a), data_fim: fmtTs(b), dia_inteiro: $('tarefa-dia-inteiro').checked,
           local: $('tarefa-local').value.trim() || null, prioridade: $('tarefa-prioridade').value,
           status: 'pendente', origem: 'manual', criado_em: fmtTs(new Date())
       });
       const ant = $('tarefa-lembrete').value;
       if (ant !== '') {
           const m = parseInt(ant, 10);
           DB.insert('lembrete', { id_estudante: uid(), id_compromisso: c.id_compromisso, canal: 'in_app', antecedencia_min: m, enviado: false, data_hora: fmtTs(new Date(a.getTime() - m * 60000)), mensagem: `${titulo} ${m === 0 ? 'começa agora' : 'começa em ' + fmtAntec(m).replace(' antes', '')}` });
       }
       closeModal('modal-tarefa'); toast('Tarefa adicionada.'); refreshAfterChange(); checkLembretes();
   }
   const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
   const STATUS_NEXT = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' };
   const PRIO_LABEL = { baixa: 'Prioridade baixa', media: 'Média', alta: 'Prioridade alta', urgente: 'Urgente' };
   
   function fmtRange(c) {
       const a = new Date(c.data_inicio), b = new Date(c.data_fim);
       const d = a.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
       if (c.dia_inteiro) return d + ', dia inteiro';
       const t = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
       if (fmtDate(a) === fmtDate(b)) return `${d}, ${t(a)} às ${t(b)}`;
       return `${d} ${t(a)} até ${b.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${t(b)}`;
   }
   function taskRow(c, compact) {
       const cat = catById(c.id_categoria) || { nome: '?', cor_hex: '#8A8EAB' };
       const meta = c.id_meta ? DB.get('meta', c.id_meta) : null;
       const lem = DB.find('lembrete', l => l.id_compromisso === c.id_compromisso);
       const done = c.status === 'concluido', cancel = c.status === 'cancelado';
       const late = isOpen(c) && new Date(c.data_fim) < new Date();
       const bits = [`<span>${esc(fmtRange(c))}</span>`];
       if (c.local) bits.push(`<span>${esc(c.local)}</span>`);
       bits.push(`<span class="dotname"><i></i>${esc(cat.nome)}</span>`);
       if (c.prioridade !== 'media') bits.push(`<span class="prio p-${c.prioridade}">${PRIO_LABEL[c.prioridade]}</span>`);
       if (meta && !compact) bits.push(`<span class="goal-tag">Meta: ${esc(meta.titulo)}</span>`);
       if (lem && !compact) bits.push(`<span class="bell">${ICON.bell}${esc(fmtAntec(lem.antecedencia_min))}</span>`);
       if (late) bits.push('<span class="late">Atrasada</span>');
       const actions = compact ? '' : `<div class="task-actions">${cancel ? `<button class="status s-cancelado" onclick="setTarefaStatus(${c.id_compromisso}, 'pendente')">Reativar</button>` : `<button class="status s-${c.status}" onclick="cycleTarefa(${c.id_compromisso})">${STATUS_LABEL[c.status]}</button><button class="ib" onclick="setTarefaStatus(${c.id_compromisso}, 'cancelado')">${ICON.ban}</button>`}<button class="ib del" onclick="deleteTarefa(${c.id_compromisso})">${ICON.trash}</button></div>`;
       return `<li class="task ${done ? 'is-done' : ''} ${cancel ? 'is-cancel' : ''}" style="--cat:${esc(cat.cor_hex)}">
           <button class="tick" role="checkbox" aria-checked="${done}" ${cancel ? 'disabled' : ''} onclick="toggleTarefaDone(${c.id_compromisso})">${ICON.check}</button>
           <div class="task-body"><div class="task-title">${esc(c.titulo)}</div>${c.descricao && !compact ? `<div class="task-desc">${esc(c.descricao)}</div>` : ''}<div class="task-meta">${bits.join('')}</div></div>${actions}</li>`;
   }
   function renderTarefas() {
       const list = $('subject-list'); if (!list) return;
       const f = state.tarefaFilter;
       const rows = minhasTarefas().filter(c => f === 'aberto' ? isOpen(c) : c.status === f);
       rows.sort((x, y) => f === 'aberto' ? x.data_inicio.localeCompare(y.data_inicio) : y.data_inicio.localeCompare(x.data_inicio));
       if (!rows.length) {
           const msg = { aberto: ['Nenhuma tarefa em aberto', 'Crie a primeira para ela aparecer na linha do dia.'], concluido: ['Nada concluído ainda', 'As tarefas que você marcar como feitas ficam aqui.'], cancelado: ['Nenhuma tarefa cancelada', 'As que você cancelar ficam aqui, caso mude de ideia.'] }[f];
           list.innerHTML = `<div class="empty"><strong>${msg[0]}</strong><p>${msg[1]}</p>${f === 'aberto' ? `<button class="btn" onclick="openTarefa()">${ICON.plus}Nova tarefa</button>` : ''}</div>`;
           return;
       }
       if (f !== 'aberto') { list.innerHTML = `<ul class="list panel">${rows.map(c => taskRow(c)).join('')}</ul>`; return; }
       const now = new Date(), order = ['Atrasadas', 'Hoje', 'Amanhã', 'Próximos 7 dias', 'Mais adiante'], groups = {};
       rows.forEach(c => {
           const dd = dayDiff(new Date(c.data_inicio));
           const g = new Date(c.data_fim) < now ? 'Atrasadas' : dd <= 0 ? 'Hoje' : dd === 1 ? 'Amanhã' : dd <= 7 ? 'Próximos 7 dias' : 'Mais adiante';
           (groups[g] = groups[g] || []).push(c);
       });
       list.innerHTML = order.filter(g => groups[g]).map(g => `<section class="group"><h3 class="group-h ${g === 'Atrasadas' ? 'is-late' : ''}">${g}<span>${groups[g].length}</span></h3><ul class="list panel">${groups[g].map(c => taskRow(c)).join('')}</ul></section>`).join('');
   }
   function cycleTarefa(id) { const c = DB.get('compromisso', id); if (c && STATUS_NEXT[c.status]) setTarefaStatus(id, STATUS_NEXT[c.status]); }
   function toggleTarefaDone(id) { const c = DB.get('compromisso', id); if (c) setTarefaStatus(id, c.status === 'concluido' ? 'pendente' : 'concluido'); }
   function setTarefaStatus(id, st) { DB.update('compromisso', id, { status: st }); refreshAfterChange(); }
   function deleteTarefa(id) { if (confirm('Excluir esta tarefa definitivamente?')) { DB.remove('compromisso', id); toast('Tarefa excluída.'); refreshAfterChange(); } }
   function filterTarefas(type) { state.tarefaFilter = type; document.querySelectorAll('#screen-tarefas .tab').forEach(p => { p.classList.remove('active'); p.setAttribute('aria-selected', 'false'); }); $('f-' + type).classList.add('active'); $('f-' + type).setAttribute('aria-selected', 'true'); renderTarefas(); }
   function refreshAfterChange() { renderDashboard(); renderTarefas(); renderMetas(); renderHabitos(); }
   
   function meusHabitos() { return DB.where('compromisso', c => c.id_estudante === uid() && c.status !== 'cancelado' && c.titulo !== WATER_TITLE && isHabit(c)); }
   function habitDays(c) { const r = DB.find('recorrencia', x => x.id_compromisso === c.id_compromisso); if (!r || r.tipo === 'diaria') return [1, 2, 3, 4, 5, 6, 7]; return DB.where('recorrencia_dia', d => d.id_recorrencia === r.id_recorrencia).map(d => d.dia_semana); }
   const checkinOf = (c, dateStr) => DB.find('habito_checkin', k => k.id_compromisso === c.id_compromisso && k.data === dateStr);
   function streakOf(c) { const days = habitDays(c); const d = new Date(); let n = 0; for (let i = 0; i < 400; i++) { if (days.includes(isoDow(d))) { if (checkinOf(c, fmtDate(d))) n++; else if (i > 0) break; } d.setDate(d.getDate() - 1); } return n; }
   function openHabito() { $('form-habito').reset(); fillCategorias('habito-categoria', 'Pessoal'); document.querySelectorAll('#habito-dias .day-chip').forEach(b => b.classList.remove('on')); $('habito-dias-wrap').classList.add('hidden'); openModal('modal-habito'); }
   function toggleDiasHabito() { $('habito-dias-wrap').classList.toggle('hidden', $('habito-tipo').value !== 'semanal'); }
   function criarHabitoBase(titulo, descricao, idCategoria, tipo, dias) {
       const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 0);
       const c = DB.insert('compromisso', { id_estudante: uid(), id_categoria: idCategoria, id_semana: null, id_meta: null, titulo, descricao, data_inicio: fmtTs(s), data_fim: fmtTs(e), dia_inteiro: true, local: null, prioridade: 'media', status: 'pendente', origem: 'recorrencia', criado_em: fmtTs(new Date()) });
       const r = DB.insert('recorrencia', { id_compromisso: c.id_compromisso, tipo, intervalo: 1, data_fim: null, ocorrencias_geradas: 0 });
       if (tipo === 'semanal') dias.forEach(d => DB.insert('recorrencia_dia', { id_recorrencia: r.id_recorrencia, dia_semana: d }));
       return c;
   }
   function saveHabito() { const titulo = $('habito-titulo').value.trim(); if (!titulo) { toast('Dê um nome ao hábito.', 'err'); return; } const tipo = $('habito-tipo').value; const dias = Array.from(document.querySelectorAll('#habito-dias .day-chip.on')).map(b => parseInt(b.dataset.d, 10)); if (tipo === 'semanal' && !dias.length) { toast('Escolha ao menos um dia da semana.', 'err'); return; } criarHabitoBase(titulo, $('habito-descricao').value.trim() || null, parseInt($('habito-categoria').value, 10), tipo, dias); closeModal('modal-habito'); toast('Hábito criado.'); renderHabitos(); renderDashboard(); }
   function toggleCheckin(id) { const c = DB.get('compromisso', id); if (!c) return; const hoje = todayStr(), ex = checkinOf(c, hoje); if (ex) DB.remove('habito_checkin', ex.id_checkin); else DB.insert('habito_checkin', { id_compromisso: id, data: hoje, quantidade: 1, criado_em: fmtTs(new Date()) }); renderHabitos(); renderDashboard(); }
   function deleteHabito(id) { if (confirm('Excluir este hábito e todo o histórico dele?')) { DB.remove('compromisso', id); toast('Hábito excluído.'); renderHabitos(); renderDashboard(); } }
   const streakTxt = n => `${n} ${plural(n, 'dia seguido', 'dias seguidos')}`;
   function renderHabitos() {
       const list = $('habit-list'); if (!list) return;
       const hs = meusHabitos();
       if (!hs.length) { list.innerHTML = `<div class="empty"><strong>Nenhum hábito ainda</strong><p>Comece com algo pequeno.</p><button class="btn green" onclick="openHabito()">${ICON.plus}Novo hábito</button></div>`; return; }
       const LET = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
       list.innerHTML = '<ul class="list panel">' + hs.map(c => {
           const cat = catById(c.id_categoria) || { nome: '?', cor_hex: '#8A8EAB' }; const rec = DB.find('recorrencia', r => r.id_compromisso === c.id_compromisso); const days = habitDays(c); const hoje = new Date(), hojeOn = days.includes(isoDow(hoje)); const done = !!checkinOf(c, fmtDate(hoje)); const st = streakOf(c); const freq = rec && rec.tipo === 'semanal' ? days.map(d => DIAS[d]).join(' ') : 'Todos os dias';
           let strip = ''; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const on = days.includes(isoDow(d)), ck = !!checkinOf(c, fmtDate(d)); const cls = (ck ? 'done' : (on && i > 0 ? 'miss' : (on ? '' : 'off'))) + (i === 0 ? ' today' : ''); strip += `<span class="d ${cls}"><i></i><em>${LET[d.getDay()]}</em></span>`; }
           return `<li class="habit" style="--cat:${esc(cat.cor_hex)}"><button class="tick big" role="checkbox" aria-checked="${done}" ${hojeOn ? '' : 'disabled'} onclick="toggleCheckin(${c.id_compromisso})">${ICON.check}</button><div class="habit-body"><div class="task-title">${esc(c.titulo)}</div><div class="task-meta"><span>${esc(freq)}</span><span class="dotname"><i></i>${esc(cat.nome)}</span></div></div><div class="week">${strip}</div><div class="streak ${st ? '' : 'zero'}"><b>${st}</b><span>${plural(st, 'dia seguido', 'dias seguidos')}</span></div><button class="ib del" onclick="deleteHabito(${c.id_compromisso})">${ICON.trash}</button></li>`;
       }).join('') + '</ul>';
   }
   
   function metaProgress(m) { const linked = DB.where('compromisso', c => c.id_meta === m.id_meta && c.status !== 'cancelado'); if (linked.length) { const done = linked.filter(c => c.status === 'concluido').length; return { pct: Math.round(done / linked.length * 100), auto: true, total: linked.length, done, linked }; } return { pct: m.progresso_manual, auto: false, total: 0, done: 0, linked: [] }; }
   function openMeta() { $('form-meta').reset(); openModal('modal-meta'); }
   function saveMeta() { const titulo = $('meta-titulo').value.trim(); if (!titulo) { toast('Dê um nome à meta.', 'err'); return; } DB.insert('meta', { id_estudante: uid(), titulo, descricao: $('meta-descricao').value.trim() || null, prazo: $('meta-prazo').value || null, progresso_manual: 0, status: 'ativa', criado_em: fmtTs(new Date()) }); closeModal('modal-meta'); toast('Meta criada.'); renderMetas(); renderDashboard(); }
   function bumpMeta(id, delta) { const m = DB.get('meta', id); if (!m) return; DB.update('meta', id, { progresso_manual: Math.max(0, Math.min(100, m.progresso_manual + delta)) }); renderMetas(); }
   function toggleMeta(id) { const m = DB.get('meta', id); if (!m) return; if (m.status === 'ativa') { DB.update('meta', id, { status: 'concluida', progresso_manual: 100 }); toast('Meta concluída. Parabéns!'); } else DB.update('meta', id, { status: 'ativa' }); renderMetas(); renderDashboard(); }
   function deleteMeta(id) { if (confirm('Excluir esta meta? As tarefas vinculadas continuam existindo.')) { DB.remove('meta', id); toast('Meta excluída.'); renderMetas(); renderDashboard(); renderTarefas(); } }
   function renderMetas() {
       const list = $('meta-list'); if (!list) return;
       const ms = DB.where('meta', m => m.id_estudante === uid() && m.status !== 'cancelada').sort((a, b) => (a.status === b.status ? (a.prazo || '9999').localeCompare(b.prazo || '9999') : (a.status === 'ativa' ? -1 : 1)));
       if (!ms.length) { list.innerHTML = `<div class="empty"><strong>Nenhuma meta ainda</strong><p>Defina onde quer chegar.</p><button class="btn pink" onclick="openMeta()">${ICON.plus}Nova meta</button></div>`; return; }
       list.innerHTML = '<ul class="list panel">' + ms.map(m => {
           const p = metaProgress(m), fin = m.status === 'concluida'; let prazo = '';
           if (m.prazo) { const dias = Math.round((new Date(m.prazo + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000); const txt = fin ? `Prazo era ${fmtBR(m.prazo)}` : (dias < 0 ? `Atrasada há ${-dias} ${plural(-dias, 'dia', 'dias')}` : dias === 0 ? 'Vence hoje' : `Faltam ${dias} ${plural(dias, 'dia', 'dias')}`); prazo = `<span class="${!fin && dias < 0 ? 'late' : ''}">${txt}</span>`; }
           const tasks = p.linked.slice(0, 4).map(c => `<li class="${c.status === 'concluido' ? 'ok' : ''}"><i>${c.status === 'concluido' ? ICON.check : ''}</i>${esc(c.titulo)}</li>`).join('');
           const more = p.linked.length > 4 ? `<li class="more">e mais ${p.linked.length - 4}</li>` : '';
           return `<li class="goal ${fin ? 'is-done' : ''}"><div class="goal-fig" aria-hidden="true"><b>${p.pct}</b><span>%</span></div><div class="goal-main"><h3>${esc(m.titulo)}</h3>${m.descricao ? `<p class="task-desc">${esc(m.descricao)}</p>` : ''}<div class="bar" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.pct}%"></i></div><div class="task-meta">${prazo}<span>${p.auto ? `${p.done} de ${p.total} ${plural(p.total, 'tarefa', 'tarefas')}` : 'Progresso manual'}</span>${fin ? '<span class="goal-tag">Concluída</span>' : ''}</div>${tasks ? `<ul class="goal-tasks">${tasks}${more}</ul>` : ''}<div class="goal-actions">${!fin ? `<button class="btn ghost sm" onclick="openTarefa(${m.id_meta})">${ICON.plus}Tarefa</button>` : ''}${!fin && !p.auto ? `<button class="btn ghost sm" onclick="bumpMeta(${m.id_meta}, -10)">−10%</button><button class="btn ghost sm" onclick="bumpMeta(${m.id_meta}, 10)">+10%</button>` : ''}<span class="grow"></span><button class="btn ${fin ? 'ghost' : 'green'} sm" onclick="toggleMeta(${m.id_meta})">${fin ? 'Reabrir' : 'Concluir meta'}</button><button class="ib del" onclick="deleteMeta(${m.id_meta})">${ICON.trash}</button></div></div></li>`;
       }).join('') + '</ul>';
   }
   
   const RAIL_START = 6, RAIL_END = 24, ROW_H = 30;
   const TURNO_AULA = { manha: [7, 12.5, 'manhã'], tarde: [13, 18, 'tarde'], noite: [19, 22.5, 'noite'] };
   const railPct = h => Math.max(0, Math.min(100, (h - RAIL_START) / (RAIL_END - RAIL_START) * 100));
   function blk(s, e, color, label, o) { o = o || {}; const l = railPct(s), r = railPct(e); if (r - l < 0.4) return ''; return `<div class="blk ${o.cls || ''}" style="left:${l}%;width:${r - l}%;--c:${esc(color)};--row:${o.row || 0};--i:${o.i || 0}" title="${esc(o.title || label)}"><span>${esc(label)}</span></div>`; }
   function renderRail() {
       const box = $('rail'); if (!box || !state.user) return;
       const now = new Date(), ds = startOfDay(now), de = new Date(ds.getTime() + 86400000);
       const ticks = [6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${railPct(h)}%">${h === 24 ? '0h' : h + 'h'}</span>`).join('');
       const aula = TURNO_AULA[state.user.turno_escolar] || TURNO_AULA.manha;
       const escola = isoDow(now) <= 5 ? blk(aula[0], aula[1], 'var(--indigo)', `Aula da ${aula[2]}`, { cls: 'routine', title: `Aula da ${aula[2]} (horário estimado)` }) : '<span class="lane-empty">Sem aula hoje</span>';
       const jh = jornadasHoje();
       let trabalho; if (jh.length) trabalho = jh.map((j, i) => blk(hhmm(j.hora_inicio), hhmm(j.hora_fim), 'var(--cyan)', j.empresa, { cls: 'routine', i, title: `${j.empresa}, ${j.hora_inicio.slice(0, 5)} às ${j.hora_fim.slice(0, 5)}` })).join(''); else if (DB.find('jornada_trabalho', j => j.id_estudante === uid())) trabalho = '<span class="lane-empty">Sem jornada hoje</span>'; else trabalho = `<span class="lane-empty"><button class="link" onclick="navTo('screen-config', 'nav-config')">Cadastrar jornada de trabalho</button></span>`;
       const items = minhasTarefas().filter(c => !c.dia_inteiro && c.status !== 'cancelado' && new Date(c.data_inicio) < de && new Date(c.data_fim) > ds).map(c => { const a = new Date(c.data_inicio), b = new Date(c.data_fim); return { c, s: a < ds ? 0 : hOf(a), e: b >= de ? 24 : hOf(b) }; }).sort((x, y) => x.s - y.s);
       const ends = []; items.forEach(it => { let r = ends.findIndex(e => e <= it.s); if (r < 0) { r = ends.length; ends.push(0); } ends[r] = it.e; it.row = r; });
       const tarefas = items.length ? items.map((it, i) => blk(it.s, it.e, (catById(it.c.id_categoria) || {}).cor_hex || '#8A8EAB', it.c.titulo, { row: it.row, i, cls: it.c.status === 'concluido' ? 'done' : '' })).join('') : '<span class="lane-empty">Nada com horário hoje</span>';
       const rowsN = Math.max(1, ends.length);
       const nowPct = railPct(hOf(now));
       box.innerHTML = `<div class="rail-axis"><span></span><div class="ticks">${ticks}</div></div><div class="rail-body"><div class="lane" style="--lane:0"><div class="lane-name">Escola</div><div class="track" style="height:48px">${escola}</div></div><div class="lane" style="--lane:1"><div class="lane-name">Trabalho</div><div class="track" style="height:48px">${trabalho}</div></div><div class="lane" style="--lane:2"><div class="lane-name">Seu dia</div><div class="track" style="height:${rowsN * ROW_H + 18}px">${tarefas}</div></div><div class="now-wrap"><div class="now" style="left:${nowPct}%"><i>agora</i></div></div></div>`;
   }
   function playRail() { const r = $('rail'); if (!r) return; r.classList.remove('rail-enter'); void r.offsetWidth; r.classList.add('rail-enter'); clearTimeout(playRail._t); playRail._t = setTimeout(() => r.classList.remove('rail-enter'), 2000); }
   function tarefasDeHoje() { const now = new Date(), ds = startOfDay(now), de = new Date(ds.getTime() + 86400000); return minhasTarefas().filter(c => isOpen(c) && (new Date(c.data_fim) < now || (new Date(c.data_inicio) < de && new Date(c.data_fim) > ds))).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)); }
   function renderDashboard() {
       if (!state.user) return;
       const now = new Date(), h = now.getHours(); const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
       $('today-title').textContent = `${saud}, ${state.user.nome.split(' ')[0]}.`;
       $('today-date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); $('today-date').setAttribute('datetime', todayStr());
       const abertas = minhasTarefas().filter(isOpen).length; const hs = meusHabitos().filter(c => habitDays(c).includes(isoDow(now))); const feitos = hs.filter(c => checkinOf(c, todayStr())).length; const metas = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa').length;
       const lk = (cls, nav, scr, txt) => `<button class="fig ${cls}" onclick="navTo('${scr}', '${nav}')">${txt}</button>`;
       $('today-summary').innerHTML = 'Você tem ' + lk('f-task', 'nav-tarefas', 'screen-tarefas', abertas ? `${abertas} ${plural(abertas, 'tarefa', 'tarefas')} em aberto` : 'nenhuma tarefa em aberto') + ', ' + lk('f-habit', 'nav-habitos', 'screen-habitos', hs.length ? `${feitos} de ${hs.length} ${plural(hs.length, 'hábito feito', 'hábitos feitos')} hoje` : 'nenhum hábito para hoje') + ', ' + lk('f-goal', 'nav-metas', 'screen-metas', metas ? `${metas} ${plural(metas, 'meta ativa', 'metas ativas')}` : 'nenhuma meta ativa') + ' e ' + lk('f-water', 'nav-bemestar', 'screen-bemestar', `${fmtL(waterToday())} de água`) + '.';
       renderRail();
       const ts = tarefasDeHoje();
       $('today-tasks').innerHTML = ts.length ? `<ul class="list panel">${ts.slice(0, 6).map(c => taskRow(c, true)).join('')}</ul>${ts.length > 6 ? `<p class="more-link"><button class="link" onclick="navTo('screen-tarefas', 'nav-tarefas')">Ver as outras ${ts.length - 6}</button></p>` : ''}` : `<div class="empty small"><strong>Dia livre de tarefas</strong><p>Nada pendente para hoje.</p><button class="btn ghost sm" onclick="openTarefa()">${ICON.plus}Nova tarefa</button></div>`;
       $('today-habits').innerHTML = hs.length ? '<ul class="list panel">' + hs.map(c => { const cat = catById(c.id_categoria) || { cor_hex: '#8A8EAB' }, done = !!checkinOf(c, todayStr()), st = streakOf(c); return `<li class="task ${done ? 'is-done' : ''}" style="--cat:${esc(cat.cor_hex)}"><button class="tick" role="checkbox" aria-checked="${done}" onclick="toggleCheckin(${c.id_compromisso})">${ICON.check}</button><div class="task-body"><div class="task-title">${esc(c.titulo)}</div><div class="task-meta"><span>${streakTxt(st)}</span></div></div></li>`; }).join('') + '</ul>' : `<div class="empty small"><strong>Nenhum hábito para hoje</strong><p>Crie um para acompanhar sua sequência.</p><button class="btn ghost sm" onclick="openHabito()">${ICON.plus}Novo hábito</button></div>`;
   }
   
   const meterHTML = (filled, total) => Array.from({ length: total }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
   function waterHabit(create) { let c = DB.find('compromisso', x => x.id_estudante === uid() && x.titulo === WATER_TITLE); if (!c && create) c = criarHabitoBase(WATER_TITLE, 'Meta: 2000 ml por dia', catByName('Saúde').id_categoria, 'diaria', []); return c; }
   function waterToday() { if (!state.user) return 0; const c = waterHabit(false); if (!c) return 0; const k = checkinOf(c, todayStr()); return k ? k.quantidade : 0; }
   function addWater() { const cur = waterToday(); if (cur < 2000) { const c = waterHabit(true), k = checkinOf(c, todayStr()); if (k) DB.update('habito_checkin', k.id_checkin, { quantidade: cur + 250 }); else DB.insert('habito_checkin', { id_compromisso: c.id_compromisso, data: todayStr(), quantidade: 250, criado_em: fmtTs(new Date()) }); updateWaterUI(); } }
   function updateWaterUI() { if (!$('water-meter')) return; const w = waterToday(); $('water-meter').innerHTML = meterHTML(Math.floor(w / 250), 8); $('water-text').textContent = `${fmtL(w)} de 2 L`; }
   function blocoHoje(tipo) { return DB.where('bloco_descompressao', b => b.tipo === tipo).map(b => ({ b, c: DB.get('compromisso', b.id_compromisso) })).find(x => x.c && x.c.id_estudante === uid() && x.c.data_inicio.slice(0, 10) === todayStr()); }
   function addBloco(tipo, titulo, minutos, concluidoQuando) {
       const x = blocoHoje(tipo);
       if (x) { const novo = x.b.duracao_min + minutos; const ini = new Date(x.c.data_inicio); DB.update('bloco_descompressao', x.b.id_bloco, { duracao_min: novo }); DB.update('compromisso', x.c.id_compromisso, { data_fim: fmtTs(new Date(ini.getTime() + novo * 60000)), status: novo >= concluidoQuando ? 'concluido' : 'em_andamento' }); }
       else { const ini = new Date(); ini.setHours(0, 0, 0, 0); const c = DB.insert('compromisso', { id_estudante: uid(), id_categoria: catByName('Descompressão').id_categoria, id_semana: null, id_meta: null, titulo, descricao: null, data_inicio: fmtTs(ini), data_fim: fmtTs(new Date(ini.getTime() + minutos * 60000)), dia_inteiro: false, local: null, prioridade: 'media', status: minutos >= concluidoQuando ? 'concluido' : 'em_andamento', origem: 'manual', criado_em: fmtTs(new Date()) }); DB.insert('bloco_descompressao', { id_compromisso: c.id_compromisso, tipo, duracao_min: minutos, obrigatorio: false, sugestao_sistema: false }); }
   }
   const sleepMinutes = () => { const x = blocoHoje('sono'); return x ? x.b.duracao_min : 0; };
   const focusTodayMin = () => { const x = blocoHoje('offline'); return x ? x.b.duracao_min : 0; };
   function addSleep() { if (sleepMinutes() < 480) { addBloco('sono', 'Sono', 60, 480); updateSleepUI(); } }
   function updateSleepUI() { if (!$('sleep-meter')) return; const h = sleepMinutes() / 60; $('sleep-meter').innerHTML = meterHTML(Math.floor(h), 8); $('sleep-text').textContent = `${fmtH(h)} de 8 h`; }
   function saveFocus() { const add = Math.floor(state.focusTime / 60) - Math.floor(state.focusSaved / 60); if (add > 0) { addBloco('offline', 'Foco / Meditação', add, 1); state.focusSaved = state.focusTime; } }
   const clock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
   function toggleFocus() {
       const btn = $('btn-focus'), text = $('focus-text'), bar = $('focus-bar');
       if (!state.isFocusing && state.focusTime >= 300) { state.focusTime = 0; state.focusSaved = 0; bar.style.width = '0%'; $('focus-clock').textContent = '00:00'; }
       if (state.isFocusing) { clearInterval(state.focusInterval); state.isFocusing = false; saveFocus(); btn.textContent = 'Continuar'; text.textContent = 'Foco pausado. Respire fundo.'; }
       else { state.isFocusing = true; btn.textContent = 'Pausar'; text.textContent = 'Focando. Deixe o celular de lado.'; state.focusInterval = setInterval(() => { state.focusTime++; bar.style.width = `${(state.focusTime / 300) * 100}%`; $('focus-clock').textContent = clock(state.focusTime); if (state.focusTime >= 300) { clearInterval(state.focusInterval); state.isFocusing = false; saveFocus(); btn.textContent = 'Recomeçar'; text.textContent = `Você completou 5 minutos. Hoje já são ${focusTodayMin()} min de foco.`; } }, 1000); }
   }
   function renderBemestar() { updateWaterUI(); updateSleepUI(); if (!state.isFocusing && state.focusTime === 0) { const m = focusTodayMin(); $('focus-text').textContent = m ? `Hoje você já focou ${m} min. Inicie para mais 5.` : 'Inicie para focar por 5 minutos.'; $('focus-bar').style.width = '0%'; $('focus-clock').textContent = '00:00'; $('btn-focus').textContent = 'Iniciar'; } }
   
   const AYA_GREETING = `Oi! Eu sou a <strong>Aya</strong>, sua assistente. 🌸<br><br>Pergunte sobre suas tarefas, hábitos e metas, ou peça uma dica de foco.<br><br><i>(Psst... há um segredo escondido aqui. Tente digitar "flow")</i>`;
   const fmtMsg = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
   const RISCO = ['me matar', 'suicid', 'quero morrer', 'não quero mais viver', 'nao quero mais viver', 'me machucar', 'automutila', 'acabar com tudo', 'sumir para sempre'];
   const detectRisco = t => RISCO.some(k => t.toLowerCase().includes(k));
   function appendMsg(role, html) { const box = $('chat-messages'); if (!box) return; const d = document.createElement('div'); d.className = 'msg ' + (role === 'user' ? 'user' : 'aya'); d.innerHTML = `<div class="bub">${html}</div>`; box.appendChild(d); box.scrollTop = box.scrollHeight; }
   function loadConversa() { const abertas = DB.where('conversa', c => c.id_estudante === uid() && !c.encerrada_em); state.conversa = abertas.length ? abertas[abertas.length - 1] : null; if ($('chat-messages')) $('chat-messages').innerHTML = ''; appendMsg('aya', AYA_GREETING); if (state.conversa) { DB.where('mensagem', m => m.id_conversa === state.conversa.id_conversa && m.papel !== 'system').forEach(m => appendMsg(m.papel, fmtMsg(m.conteudo))); } }
   function ensureConversa(primeiraMsg) { if (!state.conversa) { state.conversa = DB.insert('conversa', { id_estudante: uid(), titulo: primeiraMsg.slice(0, 60), contexto: { origem: 'frontend_demo' }, iniciada_em: fmtTs(new Date()), encerrada_em: null }); } return state.conversa; }
   function saveMsg(papel, conteudo, risco) { DB.insert('mensagem', { id_conversa: state.conversa.id_conversa, papel, conteudo, tokens: null, modelo_usado: papel === 'assistant' ? 'aya-demo-local' : null, risco_detectado: !!risco, criada_em: fmtTs(new Date()) }); }
   function handleEnter(e) { if (e.key === 'Enter') sendMessage(); }
   function askAya(text) { if ($('chat-input')) { $('chat-input').value = text; sendMessage(); } }
   function sendMessage() {
       const input = $('chat-input'); const text = input.value.trim(); if (text === '' || !state.user) return;
       ensureConversa(text); const risco = detectRisco(text); saveMsg('user', text, risco); appendMsg('user', esc(text)); input.value = '';
       $('screen-aya').classList.add('aya-typing'); const box = $('chat-messages'); box.scrollTop = box.scrollHeight;
       setTimeout(() => {
           let response = ''; const lowerText = text.toLowerCase();
           if (lowerText === 'flow' || lowerText === 'segredo') { response = `🌟 **Você encontrou o Modo Turbo!** 🌟\n\nAs cores da tela vão girar por 10 segundos. Aproveite o caos colorido!`; document.body.classList.add('turbo-active'); $('navbar').classList.add('turbo'); $('aya-face').innerText = '🤯'; setTimeout(() => { document.body.classList.remove('turbo-active'); $('navbar').classList.remove('turbo'); $('aya-face').innerText = '✨'; }, 10000); }
           else if (risco) { response = 'Sinto muito que você esteja passando por isso, e fico feliz que tenha me contado. 💜 Você não precisa lidar com isso sozinho(a).\n\nSe estiver em perigo agora, ligue **192 (SAMU)** ou **190**. O **CVV** atende 24h, de graça, pelo **188** (ou pelo chat em cvv.org.br).\n\nSe puder, fale também hoje com alguém de confiança: um familiar, professor ou colega. Eu continuo aqui com você.'; }
           else if (lowerText.includes('dica') || lowerText.includes('foco')) { response = 'Uma ótima dica de foco é a Técnica Pomodoro: estude por 25 minutos e descanse 5. Quer que eu inicie o timer na aba de Bem-estar?'; }
           else if (lowerText.includes('água') || lowerText.includes('agua') || lowerText.includes('beber')) { response = `A hidratação é fundamental para o cérebro! Hoje você bebeu ${fmtL(waterToday())} de 2 L. Vá até a aba Bem-estar e registre mais 250 ml. 💧`; }
           else if (/tarefa|agenda|compromisso/.test(lowerText)) { const ab = minhasTarefas().filter(isOpen); const urg = ab.filter(c => c.prioridade === 'urgente' || c.prioridade === 'alta').length; response = ab.length ? `Você tem **${ab.length}** ${plural(ab.length, 'tarefa', 'tarefas')} em aberto${urg ? `, sendo **${urg}** de prioridade alta ou urgente` : ''}. Comece pela mais urgente e vá marcando o status conforme avança!` : 'Você não tem tarefas em aberto. Quer criar uma agora na aba Tarefas?'; }
           else if (/h[áa]bito|rotina|sequ[êe]ncia/.test(lowerText)) { const hs = meusHabitos().filter(c => habitDays(c).includes(isoDow(new Date()))); const feitos = hs.filter(c => checkinOf(c, todayStr())).length; response = hs.length ? `Hoje você completou **${feitos} de ${hs.length}** hábitos. ${feitos === hs.length ? 'Tudo certo, parabéns!' : 'Falta pouco, bora manter a sequência!'}` : 'Você ainda não tem hábitos para hoje. Que tal criar um bem pequeno na aba Hábitos?'; }
           else if (/meta|objetivo/.test(lowerText)) { const ms = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa'); response = ms.length ? `Você tem **${ms.length}** ${plural(ms.length, 'meta ativa', 'metas ativas')}. Dica: vincule tarefas a cada meta para o progresso ser calculado automaticamente.` : 'Você ainda não tem metas. Criar uma dá direção para as tarefas!'; }
           else if (lowerText.includes('estudo') || lowerText.includes('matéria') || lowerText.includes('prova')) { response = 'Para os estudos, recomendo revisar as tarefas da categoria Estudo que ainda estão em aberto. Quer que eu te ajude a fazer um cronograma?'; }
           else if (/(^|\s)(oi|olá|ola|bom dia|boa tarde|boa noite)(\s|[!.,?]|$)/.test(lowerText)) { response = `Olá, ${state.user.nome}! Como estão seus estudos hoje? Estou aqui para ajudar no que precisar. 🌸`; }
           else { response = 'Entendi! Como uma IA de demonstração, ainda estou aprendendo. Mas posso te ajudar com dicas de foco, água, tarefas, hábitos e metas. O que acha?'; }
           saveMsg('assistant', response, false); $('screen-aya').classList.remove('aya-typing'); appendMsg('aya', fmtMsg(response));
       }, 900);
   }
   
   
   let todasInstituicoes = [];
   
   async function carregarInstituicoes() {
       try {
           const res = await fetch(`${API_URL}/instituicoes`);
           if (res.ok) todasInstituicoes = await res.json();
       } catch (e) { console.error(e); }
   }
   
   function filtrarInstituicoes() {
       const termo = $('cad-busca-inst').value.trim().toLowerCase();
       const listaDiv = $('lista-instituicoes');
       listaDiv.innerHTML = '';
       $('cad-inst-id').value = '';
   
       if (termo.length < 2) { listaDiv.classList.add('hidden'); return; }
   
       const filtradas = todasInstituicoes.filter(i =>
           (i.nome || '').toLowerCase().includes(termo) || (i.cidade || '').toLowerCase().includes(termo)
       );
   
       if (!filtradas.length) {
           listaDiv.innerHTML = '<div class="inst-vazio">Nenhuma escola encontrada.</div>';
       } else {
           filtradas.slice(0, 30).forEach(inst => {
               const item = document.createElement('div');
               item.className = 'inst-item';
               item.innerHTML = `<strong>${esc(inst.nome)}</strong><span>${esc(inst.cidade)} · ${esc(inst.uf)}</span>`;
               item.onclick = () => {
                   $('cad-busca-inst').value = inst.nome;
                   $('cad-inst-id').value = inst.id_instituicao;
                   listaDiv.classList.add('hidden');
               };
               listaDiv.appendChild(item);
           });
       }
       listaDiv.classList.remove('hidden');
   }
   
   (function iniciarBuscaInstituicao() {
       carregarInstituicoes();
       const busca = $('cad-busca-inst');
       if (!busca) return;
       busca.addEventListener('input', filtrarInstituicoes);
       document.addEventListener('click', e => {
           if (!busca.contains(e.target) && !$('lista-instituicoes').contains(e.target)) {
               $('lista-instituicoes').classList.add('hidden');
           }
       });
   })();
   

   DB.init();
   setInterval(() => { if (state.user && $('screen-menu').classList.contains('active')) renderRail(); }, 60000);
   setInterval(checkLembretes, 20000);

   navTo('screen-login');

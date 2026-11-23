/* =====================================================================
   Flow Agendas - script.js (Versão Integrada com API + Protótipo)
   ===================================================================== */

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
   
   /* ================= ESTADO E CACHES DA API ================= */
   let state = {
       user: null,
       conversa: null,
       focusTime: 0, focusSaved: 0, focusTarget: 300, focusInterval: null, isFocusing: false,
       tarefaFilter: 'aberto'
   };
   let compromissosCache = [];
   let metasCache = [];
   let abaEstudoAtual = null;
   
   const uid = () => state.user ? state.user.id_estudante : null;
   const catById = id => DB.get('categoria', id);
   const catByName = nome => DB.find('categoria', c => c.nome === nome);
   const isHabit = c => c.origem === 'recorrencia' || !!DB.find('recorrencia', r => r.id_compromisso === c.id_compromisso);
   const isBloco = c => !!DB.find('bloco_descompressao', b => b.id_compromisso === c.id_compromisso);
   const isOpen = c => c.status === 'pendente' || c.status === 'em_andamento';
   
   async function syncCompromissos() {
       try {
           const res = await fetch(`${API_URL}/compromissos`);
           if (res.ok) compromissosCache = await res.json();
       } catch (e) {}
       return compromissosCache;
   }
   
   async function syncMetas() {
       if (!state.user) return [];
       try {
           const res = await fetch(`${API_URL}/metas/${uid()}`);
           if (res.ok) metasCache = await res.json();
       } catch (e) {}
       return metasCache;
   }
   
   function setUserUI() {
       const n = state.user ? state.user.nome : 'Aluno';
       document.querySelectorAll('.js-username').forEach(e => { e.textContent = n; });
       document.querySelectorAll('.js-avatar').forEach(e => { e.textContent = n.charAt(0).toUpperCase(); });
   }
   
   /* ================= NAVEGAÇÃO ================= */
   const SCREEN_RENDER = {
       'screen-menu': () => renderDashboard(), 'screen-tarefas': () => renderTarefas(), 'screen-estudos': () => renderEstudos(),
       'screen-habitos': () => renderHabitos(), 'screen-metas': () => renderMetas(), 'screen-bemestar': () => renderBemestar(),
       'screen-categorias': () => renderCategorias(), 'screen-config': () => renderConfig()
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
   
   /* ================= LOGIN E CADASTRO ================= */
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
       const cursoId = $('cad-curso').value;
   
       if (!nome || !email || !senha || !nasc) { toast('Preencha todos os campos.', 'err'); return; }
       if (!instId) { toast('Escolha sua escola na lista de busca.', 'err'); return; }
       if (!cursoId) { toast('Escolha o seu curso ou ensino regular.', 'err'); return; }
       if (senha.length < 6) { toast('A senha precisa ter ao menos 6 caracteres.', 'err'); return; }
   
       try {
           const senhaHash = await sha256(senha);
           const resEst = await fetch(`${API_URL}/estudantes`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_instituicao: parseInt(instId, 10),
                   id_curso: cursoId === SEM_CURSO ? null : parseInt(cursoId, 10),
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
           resetCursos();
           startSession(estData);
       } catch (e) {
           toast('Erro de rede. Verifique o backend.', 'err');
       }
   }
   
   function startSession(u) {
       state.user = u;
       abaEstudoAtual = u.ano_escolar || '1_ano';
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
       abaEstudoAtual = null;
       compromissosCache = [];
       metasCache = [];
       DB.d.session = null; DB.save();
       navTo('screen-login');
   }
   
   function updateName(newName) {
       if (newName.trim() === '' || !state.user) return;
       state.user = DB.update('estudante', uid(), { nome: newName.trim() });
       setUserUI();
   }
   
   /* ================= AJUSTES E MODAIS ================= */
   async function renderConfig() {
       const u = state.user;
       if (!u) return;
   
       $('config-name').value = u.nome;
       $('config-email').value = u.email;
       $('config-ano').value = u.ano_escolar || '1_ano';
       $('config-turno').value = u.turno_escolar || 'manha';
       $('config-inst').value = 'Carregando...';
       $('config-curso').value = 'Carregando...';
       renderJornadas();
   
       try {
           const resInst = await fetch(`${API_URL}/instituicoes`);
           const todasInst = await resInst.json();
           const i = todasInst.find(x => x.id_instituicao == u.id_instituicao);
           $('config-inst').value = i ? `${i.nome} (${i.cidade}/${i.uf})` : 'Não cadastrada';
   
           if (u.id_curso) {
               const resCurso = await fetch(`${API_URL}/cursos`);
               const todosCursos = await resCurso.json();
               const c = todosCursos.find(x => x.id_curso == u.id_curso);
               $('config-curso').value = c ? `${c.nome} (${c.turno}, ${c.duracao_semestres} semestres)` : 'Não cadastrado';
           } else {
               $('config-curso').value = 'Ensino regular (sem curso técnico)';
           }
       } catch (e) {
           $('config-inst').value = 'Erro ao carregar';
           $('config-curso').value = 'Erro ao carregar';
       }
   }
   
   function saveConfig() {
       state.user = DB.update('estudante', uid(), { ano_escolar: $('config-ano').value, turno_escolar: $('config-turno').value });
       abaEstudoAtual = state.user.ano_escolar || '1_ano';
       toast('Ajustes salvos.');
   }
   
   function openModal(id) {
       $(id).classList.add('open');
       const f = $(id).querySelector('input[type=text], input[type=time]');
       if (f) setTimeout(() => f.focus(), 60);
   }
   function closeModal(id) {
       $(id).classList.remove('open');
       if (id === 'modal-conteudo' && $('conteudo-media')) $('conteudo-media').innerHTML = '';
   }
   document.addEventListener('keydown', e => {
       if (e.key === 'Escape') document.querySelectorAll('.overlay.open').forEach(m => closeModal(m.id));
   });
   
   function fillCategorias(selId, preferida) {
       $(selId).innerHTML = DB.d.categoria.map(c => `<option value="${c.id_categoria}" ${c.nome === preferida ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
   }
   
   /* ================= JORNADA DE TRABALHO ================= */
   const TIPO_JORNADA = { aprendiz: 'Aprendiz', estagiario: 'Estagiário(a)' };
   
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
   
   async function saveJornada() {
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
   
       try {
           const res = await fetch(`${API_URL}/jornadas`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_estudante: uid(), tipo: $('j-tipo').value, empresa,
                   hora_inicio: $('j-inicio').value, hora_fim: $('j-fim').value,
                   carga_horaria_diaria: carga, vigencia_inicio: vi, vigencia_fim: vf
               })
           });
           const data = await res.json();
           if (!res.ok) { toast('Erro ao salvar jornada: ' + data.detail, 'err'); return; }
   
           for (const d of dias) {
               await fetch(`${API_URL}/jornada_dia`, {
                   method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ id_jornada: data.id_jornada, dia_semana: d })
               });
           }
   
           closeModal('modal-jornada');
           toast('Jornada salva.');
           renderJornadas();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   async function deleteJornada(id) {
       if (confirm('Excluir esta jornada?')) {
           try {
               await fetch(`${API_URL}/jornadas/${id}`, { method: 'DELETE' });
               toast('Jornada excluída.');
               renderJornadas();
           } catch (e) { toast('Erro ao excluir.', 'err'); }
       }
   }
   
   async function renderJornadas() {
       const box = $('jornada-list');
       if (!box) return;
       try {
           const res = await fetch(`${API_URL}/jornadas`);
           const todas = await res.json();
           const js = todas.filter(j => j.id_estudante === uid());
           if (!js.length) { box.innerHTML = '<p class="muted">Nenhuma jornada cadastrada.</p>'; return; }
           box.innerHTML = '<ul class="list">' + js.map(j => `<li class="jrow"><div class="jmain"><strong>${TIPO_JORNADA[j.tipo]} em ${esc(j.empresa)}</strong><span>${j.hora_inicio.slice(0, 5)} às ${j.hora_fim.slice(0, 5)}</span><span>${fmtH(j.carga_horaria_diaria)} por dia</span></div><button class="ib del" onclick="deleteJornada(${j.id_jornada})">${ICON.trash}</button></li>`).join('') + '</ul>';
       } catch (e) { box.innerHTML = 'Erro ao carregar jornadas.'; }
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
           const c = l.id_compromisso ? compromissosCache.find(x => x.id_compromisso === l.id_compromisso) : null;
           DB.update('lembrete', l.id_lembrete, { enviado: true });
           if (!c || isOpen(c)) toast(l.mensagem, 'bell', 10000);
       });
   }
   
   function minhasTarefas() {
       return compromissosCache.filter(c => c.id_estudante === uid() && c.origem === 'manual');
   }
   
   /* ================= TAREFAS ================= */
   async function openTarefa(idMeta) {
       $('form-tarefa').reset();
       await Promise.all([carregarCategoriasNoForm('tarefa-categoria', 'Estudo'), syncMetas()]);
       const metasAtivas = metasCache.filter(m => m.status === 'ativa');
       $('tarefa-meta').innerHTML = '<option value="">Nenhuma</option>' + metasAtivas.map(m => `<option value="${m.id_meta}" ${Number(m.id_meta) === Number(idMeta) ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('');
       const a = new Date(); a.setMinutes(0, 0, 0); a.setHours(a.getHours() + 1);
       const b = new Date(a); b.setHours(b.getHours() + 1);
       $('tarefa-inicio').value = toInput(a); $('tarefa-fim').value = toInput(b);
       openModal('modal-tarefa');
   }
   
   async function saveTarefa() {
       const titulo = $('tarefa-titulo').value.trim();
       if (!titulo) { toast('Dê um título à tarefa.', 'err'); return; }
       const a = new Date($('tarefa-inicio').value), b = new Date($('tarefa-fim').value);
       if (isNaN(a) || isNaN(b)) { toast('Informe início e fim.', 'err'); return; }
       const diaInteiro = $('tarefa-dia-inteiro').checked;
       if (diaInteiro) { a.setHours(0, 0, 0, 0); b.setHours(23, 59, 59, 0); }
       if (!(b > a)) { toast('O fim precisa ser depois do início.', 'err'); return; }
       const rawMeta = $('tarefa-meta').value;
       const idMeta = rawMeta ? parseInt(rawMeta, 10) : null;
   
       const payload = {
           id_estudante: uid(), id_categoria: parseInt($('tarefa-categoria').value, 10), id_meta: idMeta,
           titulo, descricao: $('tarefa-descricao').value.trim() || null,
           data_inicio: fmtTs(a), data_fim: fmtTs(b), dia_inteiro: diaInteiro,
           local: $('tarefa-local').value.trim() || null, prioridade: $('tarefa-prioridade').value,
           status: 'pendente', origem: 'manual'
       };
   
       try {
           const res = await fetch(`${API_URL}/compromissos`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
           });
           const data = await res.json();
           if (!res.ok) {
               const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
               toast('Erro ao salvar a tarefa: ' + msg, 'err');
               return;
           }
           const ant = $('tarefa-lembrete').value;
           if (ant !== '') {
               const m = parseInt(ant, 10);
               DB.insert('lembrete', {
                   id_estudante: uid(), id_compromisso: data.id_compromisso, canal: 'in_app', antecedencia_min: m, enviado: false,
                   data_hora: fmtTs(new Date(a.getTime() - m * 60000)),
                   mensagem: `${titulo} ${m === 0 ? 'começa agora' : 'começa em ' + fmtAntec(m).replace(' antes', '')}`
               });
           }
           closeModal('modal-tarefa');
           toast('Tarefa adicionada.');
           await syncCompromissos();
           if (idMeta) await recalcMetaFromTasks(idMeta);
           await refreshAfterChange();
           checkLembretes();
       } catch (e) { toast('Erro de rede. Verifique o backend.', 'err'); }
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
       const cat = c.categoria || catById(c.id_categoria) || { nome: '?', cor_hex: '#8A8EAB' };
       const meta = c.id_meta ? metasCache.find(m => m.id_meta === c.id_meta) : null;
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
       return `<li class="task ${done ? 'is-done' : ''} ${cancel ? 'is-cancel' : ''}" style="--cat:${esc(cat.cor_hex)}"><button class="tick" role="checkbox" aria-checked="${done}" ${cancel ? 'disabled' : ''} onclick="toggleTarefaDone(${c.id_compromisso})">${ICON.check}</button><div class="task-body"><div class="task-title">${esc(c.titulo)}</div>${c.descricao && !compact ? `<div class="task-desc">${esc(c.descricao)}</div>` : ''}<div class="task-meta">${bits.join('')}</div></div>${actions}</li>`;
   }
   
   async function renderTarefas() {
       const list = $('subject-list'); if (!list) return;
       const f = state.tarefaFilter;
       try { await Promise.all([syncCompromissos(), syncMetas()]); }
       catch (e) { list.innerHTML = '<div class="empty"><strong>Não foi possível carregar as tarefas</strong><p>Verifique se o servidor está ligado.</p></div>'; return; }
       if (state.tarefaFilter !== f) return;
   
       const rows = compromissosCache
           .filter(c => c.id_estudante === uid() && c.origem === 'manual')
           .filter(c => f === 'aberto' ? isOpen(c) : c.status === f);
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
   
   function cycleTarefa(id) {
       const c = compromissosCache.find(x => x.id_compromisso === id);
       if (c && STATUS_NEXT[c.status]) setTarefaStatus(id, STATUS_NEXT[c.status]);
   }
   
   function toggleTarefaDone(id) {
       const c = compromissosCache.find(x => x.id_compromisso === id);
       if (c) setTarefaStatus(id, c.status === 'concluido' ? 'pendente' : 'concluido');
   }
   
   async function setTarefaStatus(id, st) {
       let c = compromissosCache.find(x => x.id_compromisso === id);
       if (!c) { await syncCompromissos(); c = compromissosCache.find(x => x.id_compromisso === id); }
       if (!c) return;
   
       const payload = {
           id_estudante: c.id_estudante, id_categoria: c.id_categoria, id_meta: c.id_meta || null,
           titulo: c.titulo, descricao: c.descricao || null, data_inicio: c.data_inicio, data_fim: c.data_fim,
           dia_inteiro: !!c.dia_inteiro, local: c.local || null, prioridade: c.prioridade || 'media',
           status: st, origem: c.origem || 'manual'
       };
   
       try {
           const res = await fetch(`${API_URL}/compromissos/${id}`, {
               method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
           });
           if (!res.ok) { toast('Erro ao atualizar status da tarefa.', 'err'); return; }
           if (st === 'concluido') toast('Tarefa concluída!');
           await syncCompromissos();
           if (c.id_meta) await recalcMetaFromTasks(c.id_meta);
           await refreshAfterChange();
       } catch (e) { toast('Erro de rede ao atualizar tarefa.', 'err'); }
   }
   
   async function deleteTarefa(id) {
       if (!confirm('Excluir esta tarefa definitivamente?')) return;
       const c = compromissosCache.find(x => x.id_compromisso === id);
       const idMetaVinculada = c ? c.id_meta : null;
       try {
           const res = await fetch(`${API_URL}/compromissos/${id}`, { method: 'DELETE' });
           if (!res.ok) { toast('Não foi possível excluir a tarefa.', 'err'); return; }
           compromissosCache = compromissosCache.filter(x => x.id_compromisso !== id);
           toast('Tarefa excluída.');
           if (idMetaVinculada) await recalcMetaFromTasks(idMetaVinculada);
           await refreshAfterChange();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   function filterTarefas(type) {
       state.tarefaFilter = type;
       document.querySelectorAll('#screen-tarefas .tab').forEach(p => { p.classList.remove('active'); p.setAttribute('aria-selected', 'false'); });
       $('f-' + type).classList.add('active');
       $('f-' + type).setAttribute('aria-selected', 'true');
       renderTarefas();
   }
   
   async function refreshAfterChange() {
       await Promise.all([syncCompromissos(), syncMetas()]);
       await Promise.all([renderDashboard(), renderTarefas(), renderMetas(), renderHabitos()]);
   }
   
   /* ================= HÁBITOS E BEM-ESTAR ================= */
   function meusHabitos() { return compromissosCache.filter(c => c.id_estudante === uid() && c.status !== 'cancelado' && c.titulo !== WATER_TITLE && isHabit(c)); }
   function habitDays(c) { const r = DB.find('recorrencia', x => x.id_compromisso === c.id_compromisso); if (!r || r.tipo === 'diaria') return [1, 2, 3, 4, 5, 6, 7]; return DB.where('recorrencia_dia', d => d.id_recorrencia === r.id_recorrencia).map(d => d.dia_semana); }
   const checkinOf = (c, dateStr) => DB.find('habito_checkin', k => k.id_compromisso === c.id_compromisso && k.data === dateStr);
   function streakOf(c) { const days = habitDays(c); const d = new Date(); let n = 0; for (let i = 0; i < 400; i++) { if (days.includes(isoDow(d))) { if (checkinOf(c, fmtDate(d))) n++; else if (i > 0) break; } d.setDate(d.getDate() - 1); } return n; }
   
   async function openHabito() {
       $('form-habito').reset();
       await carregarCategoriasNoForm('habito-categoria', 'Pessoal');
       document.querySelectorAll('#habito-dias .day-chip').forEach(b => b.classList.remove('on'));
       $('habito-dias-wrap').classList.add('hidden');
       openModal('modal-habito');
   }
   
   function toggleDiasHabito() { $('habito-dias-wrap').classList.toggle('hidden', $('habito-tipo').value !== 'semanal'); }
   
   async function saveHabito() {
       const titulo = $('habito-titulo').value.trim();
       if (!titulo) { toast('Dê um nome ao hábito.', 'err'); return; }
       const tipo = $('habito-tipo').value;
       const dias = Array.from(document.querySelectorAll('#habito-dias .day-chip.on')).map(b => parseInt(b.dataset.d, 10));
       if (tipo === 'semanal' && !dias.length) { toast('Escolha ao menos um dia da semana.', 'err'); return; }
       const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 0);
   
       try {
           const res = await fetch(`${API_URL}/compromissos`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_estudante: uid(), id_categoria: parseInt($('habito-categoria').value, 10),
                   titulo, descricao: $('habito-descricao').value.trim() || null,
                   data_inicio: fmtTs(s), data_fim: fmtTs(e), dia_inteiro: true, local: null,
                   prioridade: 'media', status: 'pendente', origem: 'recorrencia'
               })
           });
           if (!res.ok) { toast('Erro ao criar hábito.', 'err'); return; }
           if (tipo === 'semanal') dias.forEach(d => DB.insert('recorrencia_dia', { id_recorrencia: 1, dia_semana: d }));
           closeModal('modal-habito');
           toast('Hábito criado.');
           renderHabitos();
           renderDashboard();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   async function toggleCheckin(id) {
       const hoje = todayStr();
       try {
           const resGet = await fetch(`${API_URL}/checkins/${id}`);
           const checkins = await resGet.json();
           const existe = checkins.find(c => c.data === hoje);
           if (existe) {
               await fetch(`${API_URL}/checkins/${id}/${hoje}`, { method: 'DELETE' });
           } else {
               await fetch(`${API_URL}/checkins`, {
                   method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ id_compromisso: parseInt(id, 10), data: hoje, quantidade: 1 })
               });
           }
           renderHabitos();
           renderDashboard();
       } catch (e) {}
   }
   
   async function deleteHabito(id) {
       if (confirm('Excluir este hábito e todo o histórico dele?')) {
           await fetch(`${API_URL}/compromissos/${id}`, { method: 'DELETE' });
           toast('Hábito excluído.');
           renderHabitos();
           renderDashboard();
       }
   }
   
   const streakTxt = n => `${n} ${plural(n, 'dia seguido', 'dias seguidos')}`;
   
   async function renderHabitos() {
       const list = $('habit-list'); if (!list) return;
       try {
           const res = await fetch(`${API_URL}/compromissos`);
           const todas = await res.json();
           const hs = todas.filter(c => c.id_estudante === uid() && c.origem === 'recorrencia' && c.status !== 'cancelado' && c.titulo !== WATER_TITLE);
           if (!hs.length) { list.innerHTML = `<div class="empty"><strong>Nenhum hábito ainda</strong><p>Comece com algo pequeno.</p><button class="btn green" onclick="openHabito()">${ICON.plus}Novo hábito</button></div>`; return; }
   
           list.innerHTML = '<ul class="list panel">' + hs.map(c => {
               const cat = c.categoria || catById(c.id_categoria) || { nome: '?', cor_hex: '#8A8EAB' };
               const days = [1, 2, 3, 4, 5];
               const hoje = new Date(), hojeOn = days.includes(isoDow(hoje));
               return `<li class="habit" style="--cat:${esc(cat.cor_hex)}"><button class="tick big" role="checkbox" aria-checked="false" ${hojeOn ? '' : 'disabled'} onclick="toggleCheckin(${c.id_compromisso})">${ICON.check}</button><div class="habit-body"><div class="task-title">${esc(c.titulo)}</div><div class="task-meta"><span>Semanal</span><span class="dotname"><i></i>${esc(cat.nome)}</span></div></div><div class="week"><span class="d"><i></i><em>D</em></span></div><div class="streak zero"><b>0</b><span>dias</span></div><button class="ib del" onclick="deleteHabito(${c.id_compromisso})">${ICON.trash}</button></li>`;
           }).join('') + '</ul>';
       } catch (e) { list.innerHTML = 'Erro ao carregar hábitos.'; }
   }
   
   const meterHTML = (filled, total) => Array.from({ length: total }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
   
   async function getValidCategoryId() {
       try {
           const res = await fetch(`${API_URL}/categorias`);
           const cats = await res.json();
           if (cats.length > 0) return cats[0].id_categoria;
           const newCat = await fetch(`${API_URL}/categorias`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ nome: 'Geral', cor_hex: '#8A8EAB', peso_energia: 1, padrao_sistema: true })
           });
           const data = await newCat.json();
           return data.id_categoria;
       } catch (e) { return null; }
   }
   
   async function waterHabit(create) {
       try {
           const res = await fetch(`${API_URL}/compromissos`);
           const todos = await res.json();
           let c = todos.find(x => x.id_estudante === uid() && x.titulo === WATER_TITLE);
           if (!c && create) {
               const catId = await getValidCategoryId();
               if (!catId) return null;
               const s = new Date(); s.setHours(0, 0, 0, 0);
               const e = new Date(s); e.setHours(23, 59, 59, 0);
               const r = await fetch(`${API_URL}/compromissos`, {
                   method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                       id_estudante: uid(), id_categoria: catId, titulo: WATER_TITLE,
                       data_inicio: fmtTs(s), data_fim: fmtTs(e), dia_inteiro: true,
                       origem: 'recorrencia', prioridade: 'media', status: 'pendente'
                   })
               });
               if (!r.ok) return null;
               c = await r.json();
           }
           return c;
       } catch (e) { return null; }
   }
   
   async function waterToday() {
       if (!state.user) return 0;
       const c = await waterHabit(false);
       if (!c) return 0;
       try {
           const res = await fetch(`${API_URL}/checkins/${c.id_compromisso}`);
           const dados = await res.json();
           const k = dados.find(d => d.data === todayStr());
           return k ? k.quantidade : 0;
       } catch (e) { return 0; }
   }
   
   let waterBusy = false;
   async function setWaterAmount(novoValor) {
       if (waterBusy || !state.user) return;
       waterBusy = true;
       try {
           const cur = await waterToday();
           if (cur === 0 && novoValor === 0) return;
           const c = await waterHabit(novoValor > 0);
           if (!c) return;
           const hoje = todayStr();
           let res;
           if (cur === 0) {
               res = await fetch(`${API_URL}/checkins`, {
                   method: 'POST', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ id_compromisso: c.id_compromisso, data: hoje, quantidade: novoValor })
               });
               if (res.status === 409) {
                   res = await fetch(`${API_URL}/checkins/${c.id_compromisso}/${hoje}`, {
                       method: 'PUT', headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ quantidade: novoValor })
                   });
               }
           } else {
               res = await fetch(`${API_URL}/checkins/${c.id_compromisso}/${hoje}`, {
                   method: 'PUT', headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ quantidade: novoValor })
               });
           }
           if (res && res.ok) await updateWaterUI();
       } catch (e) { toast('Erro ao atualizar água.', 'err'); }
       finally { waterBusy = false; }
   }
   
   async function addWater() {
       const cur = await waterToday();
       if (cur >= 2000) { toast('Meta diária de 2 L já atingida!'); return; }
       await setWaterAmount(Math.min(2000, cur + 250));
   }
   
   async function subWater() {
       const cur = await waterToday();
       if (cur <= 0) return;
       await setWaterAmount(Math.max(0, cur - 250));
   }
   
   async function updateWaterUI() {
       if (!$('water-meter')) return;
       const w = await waterToday();
       $('water-meter').innerHTML = meterHTML(Math.floor(w / 250), 8);
       $('water-text').textContent = `${fmtL(w)} de 2 L`;
       if ($('water-pct')) $('water-pct').textContent = `${Math.round((w / 2000) * 100)}%`;
   }
   
   async function addBloco(tipo, titulo, minutos, concluidoQuando) {
       try {
           const catId = await getValidCategoryId();
           if (!catId) return;
           const s = new Date();
           const duracao = minutos > 0 ? minutos : 1;
           const e = new Date(s.getTime() + duracao * 60000);
           const res = await fetch(`${API_URL}/compromissos`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_estudante: uid(), id_categoria: catId, titulo,
                   data_inicio: fmtTs(s), data_fim: fmtTs(e), dia_inteiro: false,
                   prioridade: 'media', status: duracao >= concluidoQuando ? 'concluido' : 'em_andamento',
                   origem: 'manual'
               })
           });
           if (!res.ok) return;
           const c = await res.json();
           await fetch(`${API_URL}/blocos_descompressao`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ id_compromisso: c.id_compromisso, tipo, duracao_min: duracao, obrigatorio: false, sugestao_sistema: false })
           });
       } catch (e) {}
   }
   
   async function getBlocosHoje() {
       if (!state.user) return [];
       try {
           const res = await fetch(`${API_URL}/blocos_descompressao/estudante/${uid()}`);
           if (!res.ok) return [];
           const blocos = await res.json();
           const hoje = todayStr();
           return blocos.filter(b => b.compromisso && fmtDate(new Date(b.compromisso.data_inicio)) === hoje);
       } catch (e) { return []; }
   }
   
   async function addSleep() {
       await addBloco('sono', 'Registro de sono', 60, 480);
       toast('+ 1 h de sono registrada.');
       await updateSleepUI();
   }
   
   async function updateSleepUI() {
       if (!$('sleep-meter')) return;
       const blocos = await getBlocosHoje();
       const minSono = blocos.filter(b => b.tipo === 'sono').reduce((acc, b) => acc + (b.duracao_min || 0), 0);
       const horas = Math.min(8, Math.round((minSono / 60) * 10) / 10);
       $('sleep-meter').innerHTML = meterHTML(Math.min(8, Math.floor(horas)), 8);
       $('sleep-text').textContent = `${fmtH(horas)} de 8 h`;
       if ($('sleep-pct')) $('sleep-pct').textContent = `${Math.min(100, Math.round((horas / 8) * 100))}%`;
   }
   
   async function updateFocusTodayUI() {
       if (!$('focus-today')) return;
       const blocos = await getBlocosHoje();
       const minFoco = blocos.filter(b => b.tipo === 'offline').reduce((acc, b) => acc + (b.duracao_min || 0), 0);
       $('focus-today').textContent = `${minFoco} min hoje`;
   }
   
   function setFocusPreset(minutos) {
       if (state.isFocusing) { toast('Pause o timer antes de trocar o tempo.', 'err'); return; }
       state.focusTarget = minutos * 60;
       state.focusTime = 0;
       $('focus-clock').textContent = clock(state.focusTarget);
       $('focus-bar').style.width = '0%';
       $('focus-text').textContent = `Pronto para focar por ${minutos} minutos.`;
       document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.min) === minutos));
   }
   
   async function saveFocus() {
       if (state.focusTime >= 60) {
           const mins = Math.floor(state.focusTime / 60);
           await addBloco('offline', 'Foco e descompressão', mins, 1);
           state.focusTime = 0;
           await updateFocusTodayUI();
       }
   }
   
   const clock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
   
   function toggleFocus() {
       const btn = $('btn-focus'), text = $('focus-text'), bar = $('focus-bar');
       const alvo = state.focusTarget || 300;
       if (!state.isFocusing && state.focusTime >= alvo) {
           state.focusTime = 0;
           bar.style.width = '0%';
           $('focus-clock').textContent = clock(alvo);
       }
       if (state.isFocusing) {
           clearInterval(state.focusInterval);
           state.isFocusing = false;
           saveFocus();
           btn.textContent = 'Continuar';
           text.textContent = 'Foco pausado. Respire fundo.';
       } else {
           state.isFocusing = true;
           btn.textContent = 'Pausar';
           text.textContent = 'Focando. Deixe notificações de lado.';
           state.focusInterval = setInterval(() => {
               state.focusTime++;
               const restante = Math.max(0, alvo - state.focusTime);
               bar.style.width = `${Math.min(100, (state.focusTime / alvo) * 100)}%`;
               $('focus-clock').textContent = clock(restante);
               if (state.focusTime >= alvo) {
                   clearInterval(state.focusInterval);
                   state.isFocusing = false;
                   saveFocus();
                   btn.textContent = 'Recomeçar';
                   text.textContent = `Sessão de ${Math.round(alvo / 60)} min concluída!`;
                   toast('Sessão de foco concluída!');
               }
           }, 1000);
       }
   }
   
   const CONTEUDOS_BEMESTAR = [
       {
           id: 'vid-resp', cat: 'desestresse', tag: 'Vídeo-aula · Desestresse', duracao: '5 min',
           titulo: 'Respiração Guiada 4-7-8 para Ansiedade',
           resumo: 'Exercício prático para desacelerar os batimentos entre o trabalho e a aula.',
           youtubeId: 'aNXKjGFUlMs',
           passos: ['Inspire pelo nariz contando até 4.', 'Segure o ar contando até 7.', 'Expire devagar pela boca contando até 8.', 'Repita 4 ciclos antes de estudar.']
       },
       {
           id: 'vid-foco', cat: 'concentracao', tag: 'Vídeo-aula · Concentração', duracao: '6 min',
           titulo: 'Como Estudar Cansado: Blocos Curtos de Foco',
           resumo: 'Estratégia realista para jovens aprendizes e estagiários renderem sem esgotamento.',
           youtubeId: 'mNBmG24djoY',
           passos: ['Escolha apenas 1 matéria por bloco.', 'Use o timer de 15 ou 25 minutos acima.', 'Ao terminar, faça 5 minutos de pausa longe de telas.']
       },
       {
           id: 'vid-along', cat: 'desestresse', tag: 'Vídeo-aula · Corpo & Energia', duracao: '7 min',
           titulo: 'Alongamento Rápido para Pescoço e Ombros',
           resumo: 'Alivie a tensão acumulada após horas sentado no estágio ou na escola.',
           youtubeId: 'g_tea8ZNk5A',
           passos: ['Gire os ombros para trás 10 vezes devagar.', 'Incline a cabeça lateralmente por 20 segundos.', 'Estique os braços acima da cabeça e respire fundo 3 vezes.']
       }
   ];
   
   let bemestarFiltro = 'todos';
   let conteudosCombinados = [];
   
   function filterBemestarConteudo(filtro, btn) {
       bemestarFiltro = filtro;
       document.querySelectorAll('#screen-bemestar .tab').forEach(t => t.classList.remove('active'));
       if (btn) btn.classList.add('active');
       renderWellnessCards();
   }
   
   function renderWellnessCards() {
       const box = $('wellness-cards');
       if (!box) return;
       const lista = bemestarFiltro === 'todos' ? conteudosCombinados : conteudosCombinados.filter(c => c.cat === bemestarFiltro);
       box.innerHTML = lista.map((item, idx) => `
           <article class="media-card">
               <div>
                   <div class="media-top"><span class="well-badge">${esc(item.tag)}</span><span class="media-dur">${esc(item.duracao)}</span></div>
                   <h3>${esc(item.titulo)}</h3>
                   <p>${esc(item.resumo)}</p>
               </div>
               <div class="media-foot">
                   ${item.lido ? '<span class="read-pill">Concluído</span>' : '<span></span>'}
                   <button class="btn ghost sm" type="button" onclick="openConteudo(${idx})">${item.youtubeId ? 'Assistir aula' : 'Ler guia'}</button>
               </div>
           </article>
       `).join('');
   }
   
   function openConteudo(idx) {
       const lista = bemestarFiltro === 'todos' ? conteudosCombinados : conteudosCombinados.filter(c => c.cat === bemestarFiltro);
       const item = lista[idx];
       if (!item) return;
   
       $('conteudo-tag').textContent = item.tag;
       $('t-conteudo').textContent = item.titulo;
       $('conteudo-sub').textContent = `${item.duracao} · Apoio ao estudante`;
   
       const media = $('conteudo-media');
       if (item.youtubeId) {
           media.classList.remove('hidden');
           media.innerHTML = `<iframe src="https://www.youtube.com/embed/${esc(item.youtubeId)}" title="${esc(item.titulo)}" allowfullscreen></iframe>`;
       } else {
           media.classList.add('hidden');
           media.innerHTML = '';
       }
   
       $('conteudo-texto').innerHTML = item.passos.map(p => `<p>• ${esc(p)}</p>`).join('');
       const btnDoc = $('btn-concluir-doc');
       if (item.id_documento && !item.lido) {
           btnDoc.classList.remove('hidden');
           btnDoc.onclick = () => marcarDocumentoLido(item.id_documento);
       } else {
           btnDoc.classList.add('hidden');
       }
       openModal('modal-conteudo');
   }
   
   async function marcarDocumentoLido(idDoc) {
       if (!state.user) return;
       try {
           const res = await fetch(`${API_URL}/estudantes/${uid()}/documentos`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ id_documento: idDoc })
           });
           if (res.ok || res.status === 409) {
               toast('Guia registrado no seu histórico!');
               closeModal('modal-conteudo');
               await loadWellnessContent();
           }
       } catch (e) { toast('Erro ao registrar leitura.', 'err'); }
   }
   
   async function loadWellnessContent() {
       let docsDb = [], lidosIds = new Set();
       try {
           const [resDocs, resLidos] = await Promise.all([
               fetch(`${API_URL}/documentos`),
               state.user ? fetch(`${API_URL}/estudantes/${uid()}/documentos`) : Promise.resolve(null)
           ]);
           if (resDocs.ok) docsDb = await resDocs.json();
           if (resLidos && resLidos.ok) {
               const lidos = await resLidos.json();
               lidos.forEach(x => lidosIds.add(x.id_documento));
           }
       } catch (e) {}
   
       const extras = docsDb.map(d => ({
           id: `doc-${d.id_documento}`, id_documento: d.id_documento,
           cat: d.tipo === 'conteudo_educativo' ? 'concentracao' : 'desestresse',
           tag: `Guia · ${d.tipo}`, duracao: 'Leitura rápida', titulo: d.titulo,
           resumo: `Fonte: ${d.fonte}`, youtubeId: null, lido: lidosIds.has(d.id_documento),
           passos: [`Material cadastrado na base de apoio (${d.fonte}).`, 'Clique em "Marcar guia como lido" para registrar.']
       }));
       conteudosCombinados = [...CONTEUDOS_BEMESTAR, ...extras];
       renderWellnessCards();
   }
   
   async function renderBemestar() {
       await Promise.all([updateWaterUI(), updateSleepUI(), updateFocusTodayUI(), loadWellnessContent()]);
       if (!state.isFocusing && state.focusTime === 0) {
           const alvo = state.focusTarget || 300;
           $('focus-text').textContent = `Pronto para focar por ${Math.round(alvo / 60)} minutos.`;
           $('focus-bar').style.width = '0%';
           $('focus-clock').textContent = clock(alvo);
           $('btn-focus').textContent = 'Iniciar foco';
       }
   }
   
   /* ================= METAS ================= */
   function openMeta() { $('form-meta').reset(); openModal('modal-meta'); }
   
   async function recalcMetaFromTasks(idMeta) {
       const m = metasCache.find(x => x.id_meta === Number(idMeta));
       if (!m) return;
       const vinculadas = compromissosCache.filter(c => c.id_estudante === uid() && c.id_meta === Number(idMeta) && c.status !== 'cancelado');
       if (!vinculadas.length) return;
       const concluidas = vinculadas.filter(c => c.status === 'concluido').length;
       const pct = Math.round((concluidas / vinculadas.length) * 100);
       const novoStatus = pct >= 100 ? 'concluida' : 'ativa';
   
       try {
           await fetch(`${API_URL}/metas/${m.id_meta}`, {
               method: 'PUT', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ titulo: m.titulo, descricao: m.descricao || null, prazo: m.prazo || null, progresso_manual: pct, status: novoStatus })
           });
       } catch (e) {}
   }
   
   async function setMetaProgress(id, valor) {
       let m = metasCache.find(x => x.id_meta === id);
       if (!m) { await syncMetas(); m = metasCache.find(x => x.id_meta === id); }
       if (!m) return;
       const pct = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
       const novoStatus = pct >= 100 ? 'concluida' : 'ativa';
   
       try {
           const res = await fetch(`${API_URL}/metas/${id}`, {
               method: 'PUT', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ titulo: m.titulo, descricao: m.descricao || null, prazo: m.prazo || null, progresso_manual: pct, status: novoStatus })
           });
           if (res.ok) {
               if (pct === 100 && m.progresso_manual < 100) toast('Meta atingiu 100%. Parabéns!');
               await refreshAfterChange();
           } else { toast('Erro ao atualizar progresso da meta.', 'err'); }
       } catch (e) { toast('Erro de rede ao atualizar meta.', 'err'); }
   }
   
   async function adjustMetaProgress(id, delta) {
       let m = metasCache.find(x => x.id_meta === id);
       if (!m) { await syncMetas(); m = metasCache.find(x => x.id_meta === id); }
       if (!m) return;
       await setMetaProgress(id, (m.progresso_manual || 0) + delta);
   }
   
   async function renderMetas() {
       const list = $('meta-list'); if (!list) return;
       try { await Promise.all([syncMetas(), syncCompromissos()]); }
       catch (e) { list.innerHTML = '<div class="empty"><strong>Erro ao carregar metas</strong><p>Verifique o servidor.</p></div>'; return; }
   
       if (!metasCache.length) {
           list.innerHTML = `<div class="empty"><strong>Nenhuma meta ainda</strong><p>Defina onde quer chegar.</p><button class="btn pink" onclick="openMeta()">${ICON.plus}Nova meta</button></div>`;
           return;
       }
   
       list.innerHTML = '<ul class="list panel">' + metasCache.map(m => {
           const vinculadas = compromissosCache.filter(c => c.id_estudante === uid() && c.id_meta === m.id_meta && c.status !== 'cancelado');
           const concluidas = vinculadas.filter(c => c.status === 'concluido').length;
           const pct = m.progresso_manual || 0;
           const fin = m.status === 'concluida';
           const tasksHTML = vinculadas.length
               ? `<ul class="goal-tasks">${vinculadas.slice(0, 5).map(t => `<li class="${t.status === 'concluido' ? 'ok' : ''}"><i>${t.status === 'concluido' ? ICON.check : ''}</i><span>${esc(t.titulo)}</span></li>`).join('')}${vinculadas.length > 5 ? `<li class="more">+ ${vinculadas.length - 5} tarefas vinculadas</li>` : ''}</ul>`
               : '';
           const infoOrigem = vinculadas.length
               ? `<span>${concluidas} de ${vinculadas.length} ${plural(vinculadas.length, 'tarefa concluída', 'tarefas concluídas')}</span>`
               : `<span>Progresso manual</span>`;
   
           return `<li class="goal ${fin ? 'is-done' : ''}">
               <div class="goal-fig" aria-hidden="true"><b>${pct}</b><span>%</span></div>
               <div class="goal-main">
                   <h3>${esc(m.titulo)}</h3>
                   ${m.descricao ? `<p class="task-desc">${esc(m.descricao)}</p>` : ''}
                   <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
                   <div class="task-meta">${m.prazo ? `<span>Prazo: ${fmtBR(m.prazo)}</span>` : ''}${infoOrigem}${fin ? '<span class="goal-tag">Concluída</span>' : ''}</div>
                   ${tasksHTML}
                   <div class="goal-actions">
                       <div class="goal-pct-box">
                           <button class="btn ghost sm" type="button" onclick="adjustMetaProgress(${m.id_meta}, -10)">-10%</button>
                           <input class="goal-pct-input" type="number" min="0" max="100" value="${pct}" onchange="setMetaProgress(${m.id_meta}, this.value)">
                           <button class="btn ghost sm" type="button" onclick="adjustMetaProgress(${m.id_meta}, 10)">+10%</button>
                       </div>
                       <button class="btn ghost sm" type="button" onclick="openTarefa(${m.id_meta})">${ICON.plus}Tarefa</button>
                       <span class="grow"></span>
                       <button class="btn ${fin ? 'ghost' : 'green'} sm" type="button" onclick="toggleMeta(${m.id_meta})">${fin ? 'Reabrir' : 'Concluir meta'}</button>
                       <button class="ib del" type="button" onclick="deleteMeta(${m.id_meta})">${ICON.trash}</button>
                   </div>
               </div>
           </li>`;
       }).join('') + '</ul>';
   }
   
   async function saveMeta() {
       const titulo = $('meta-titulo').value.trim();
       if (!titulo) { toast('Dê um nome à meta.', 'err'); return; }
       try {
           const res = await fetch(`${API_URL}/metas`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ id_estudante: uid(), titulo, descricao: $('meta-descricao').value.trim() || null, prazo: $('meta-prazo').value || null, progresso_manual: 0, status: 'ativa' })
           });
           if (!res.ok) { toast('Erro ao salvar meta.', 'err'); return; }
           closeModal('modal-meta');
           toast('Meta criada.');
           await refreshAfterChange();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   async function deleteMeta(id) {
       if (confirm('Excluir esta meta? As tarefas vinculadas continuam existindo.')) {
           await fetch(`${API_URL}/metas/${id}`, { method: 'DELETE' });
           toast('Meta excluída.');
           await refreshAfterChange();
       }
   }
   
   async function toggleMeta(id) {
       let m = metasCache.find(x => x.id_meta === id);
       if (!m) { await syncMetas(); m = metasCache.find(x => x.id_meta === id); }
       if (!m) return;
       const isAtiva = m.status === 'ativa';
       try {
           const res = await fetch(`${API_URL}/metas/${id}`, {
               method: 'PUT', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ titulo: m.titulo, descricao: m.descricao || null, prazo: m.prazo || null, progresso_manual: isAtiva ? 100 : 0, status: isAtiva ? 'concluida' : 'ativa' })
           });
           if (res.ok) {
               toast(isAtiva ? 'Meta concluída. Parabéns!' : 'Meta reaberta.');
               await refreshAfterChange();
           }
       } catch (e) { toast('Erro ao atualizar meta.', 'err'); }
   }
   
   /* ================= HOJE, AYA E CATEGORIAS ================= */
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
   
       const items = minhasTarefas().filter(c => !c.dia_inteiro && c.status !== 'cancelado' && new Date(c.data_inicio) < de && new Date(c.data_fim) > ds).map(c => { const a = new Date(c.data_inicio), b = new Date(c.data_fim); return { c, s: a < ds ? 0 : hOf(a), e: b >= de ? 24 : hOf(b) }; }).sort((x, y) => x.s - y.s);
       const ends = []; items.forEach(it => { let r = ends.findIndex(e => e <= it.s); if (r < 0) { r = ends.length; ends.push(0); } ends[r] = it.e; it.row = r; });
       const tarefas = items.length ? items.map((it, i) => blk(it.s, it.e, (it.c.categoria || catById(it.c.id_categoria) || {}).cor_hex || '#8A8EAB', it.c.titulo, { row: it.row, i, cls: it.c.status === 'concluido' ? 'done' : '' })).join('') : '<span class="lane-empty">Nada com horário hoje</span>';
       const rowsN = Math.max(1, ends.length);
       const nowPct = railPct(hOf(now));
   
       box.innerHTML = `<div class="rail-axis"><span></span><div class="ticks">${ticks}</div></div><div class="rail-body"><div class="lane" style="--lane:0"><div class="lane-name">Escola</div><div class="track" style="height:48px">${escola}</div></div><div class="lane" style="--lane:1"><div class="lane-name">Seu dia</div><div class="track" style="height:${rowsN * ROW_H + 18}px">${tarefas}</div></div><div class="now-wrap"><div class="now" style="left:${nowPct}%"><i>agora</i></div></div></div>`;
   }
   
   function playRail() { const r = $('rail'); if (!r) return; r.classList.remove('rail-enter'); void r.offsetWidth; r.classList.add('rail-enter'); clearTimeout(playRail._t); playRail._t = setTimeout(() => r.classList.remove('rail-enter'), 2000); }
   function tarefasDeHoje() { const now = new Date(), ds = startOfDay(now), de = new Date(ds.getTime() + 86400000); return minhasTarefas().filter(c => isOpen(c) && (new Date(c.data_fim) < now || (new Date(c.data_inicio) < de && new Date(c.data_fim) > ds))).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)); }
   
   async function renderDashboard() {
       if (!state.user) return;
       await Promise.all([syncCompromissos(), syncMetas()]);
       const now = new Date(), h = now.getHours(); const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
       $('today-title').textContent = `${saud}, ${state.user.nome.split(' ')[0]}.`;
       $('today-date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); $('today-date').setAttribute('datetime', todayStr());
       const abertas = minhasTarefas().filter(isOpen).length;
       const metas = metasCache.filter(m => m.status === 'ativa').length;
   
       const lk = (cls, nav, scr, txt) => `<button class="fig ${cls}" onclick="navTo('${scr}', '${nav}')">${txt}</button>`;
       $('today-summary').innerHTML = 'Você tem ' + lk('f-task', 'nav-tarefas', 'screen-tarefas', abertas ? `${abertas} ${plural(abertas, 'tarefa', 'tarefas')} em aberto` : 'nenhuma tarefa em aberto') + ' e ' + lk('f-goal', 'nav-metas', 'screen-metas', metas ? `${metas} ${plural(metas, 'meta ativa', 'metas ativas')}` : 'nenhuma meta ativa') + '.';
       renderRail();
   
       const ts = tarefasDeHoje();
       $('today-tasks').innerHTML = ts.length ? `<ul class="list panel">${ts.slice(0, 6).map(c => taskRow(c, true)).join('')}</ul>${ts.length > 6 ? `<p class="more-link"><button class="link" onclick="navTo('screen-tarefas', 'nav-tarefas')">Ver as outras ${ts.length - 6}</button></p>` : ''}` : `<div class="empty small"><strong>Dia livre de tarefas</strong><p>Nada pendente para hoje.</p><button class="btn ghost sm" onclick="openTarefa()">${ICON.plus}Nova tarefa</button></div>`;
       $('today-habits').innerHTML = `<div class="empty small"><strong>Hábitos no banco</strong><p>Confira a aba de hábitos.</p></div>`;
   }
   
   const AYA_GREETING = `Oi! Eu sou a <strong>Aya</strong>, sua assistente. 🌸<br><br>Pergunte sobre suas tarefas, hábitos e metas, ou peça uma dica de foco.`;
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
       setTimeout(async () => {
           let response = ''; const lowerText = text.toLowerCase();
           if (risco) { response = 'Sinto muito que você esteja passando por isso, e fico feliz que tenha me contado. 💜 Você não precisa lidar com isso sozinho(a).\n\nSe estiver em perigo agora, ligue **192 (SAMU)** ou **190**. O **CVV** atende 24h, de graça, pelo **188** (ou pelo chat em cvv.org.br).\n\nSe puder, fale também hoje com alguém de confiança: um familiar, professor ou colega. Eu continuo aqui com você.'; }
           else if (lowerText.includes('dica') || lowerText.includes('foco')) { response = 'Uma ótima dica de foco é a Técnica Pomodoro: estude por 25 minutos e descanse 5. Quer que eu inicie o timer na aba de Bem-estar?'; }
           else if (lowerText.includes('água') || lowerText.includes('agua') || lowerText.includes('beber')) { const ml = await waterToday(); response = `Hoje você já registrou **${fmtL(ml)}** de água (meta de 2 L). Continue se hidratando na aba Bem-estar! 💧`; }
           else if (/tarefa|agenda|compromisso/.test(lowerText)) { await syncCompromissos(); const ab = minhasTarefas().filter(isOpen); response = ab.length ? `Você tem **${ab.length}** tarefas em aberto.` : 'Você não tem tarefas em aberto.'; }
           else if (/h[áa]bito|rotina/.test(lowerText)) { response = 'Mantenha a sequência! Confira a aba Hábitos.'; }
           else if (/meta|objetivo/.test(lowerText)) { await syncMetas(); const at = metasCache.filter(m => m.status === 'ativa'); response = at.length ? `Você tem **${at.length}** metas ativas.` : 'Você ainda não tem metas ativas.'; }
           else if (lowerText.includes('estudo') || lowerText.includes('prova')) { response = 'Na aba **Estudos** você encontra os tópicos do 1º ao 3º ano, PAS-UEM e ENEM para assistir videoaulas, marcar o que já revisou ou agendar na rotina!'; }
           else if (/(^|\s)(oi|olá|ola|bom dia|boa tarde|boa noite)(\s|[!.,?]|$)/.test(lowerText)) { response = `Olá, ${state.user.nome}! Como estão seus estudos hoje? 🌸`; }
           else { response = 'Entendi! Como uma IA de demonstração, ainda estou aprendendo.'; }
           saveMsg('assistant', response, false); $('screen-aya').classList.remove('aya-typing'); appendMsg('aya', fmtMsg(response));
       }, 900);
   }
   
   let categoriasCache = [];
   const corValida = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#8A8EAB');
   
   async function renderCategorias() {
       const box = $('lista-categorias'); if (!box) return;
       try {
           const res = await fetch(`${API_URL}/categorias`);
           if (!res.ok) throw new Error('HTTP ' + res.status);
           categoriasCache = await res.json();
       } catch (e) {
           box.innerHTML = '<div class="empty small cat-empty"><strong>Não foi possível carregar</strong><p>Tente de novo.</p></div>';
           $('cat-count').textContent = '';
           return;
       }
       const lista = categoriasCache.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
       $('cat-count').textContent = lista.length ? `${lista.length} categorias` : '';
       if (!lista.length) { box.innerHTML = '<div class="empty small cat-empty"><strong>Nenhuma ainda</strong></div>'; return; }
   
       box.innerHTML = lista.map(c => {
           const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < c.peso_energia ? 'on' : ''}"></i>`).join('');
           const excluir = c.padrao_sistema ? '' : `<button class="ib del" type="button" onclick="deleteCategoria(${c.id_categoria})">${ICON.trash}</button>`;
           return `<div class="panel cat-card" style="--cat:${corValida(c.cor_hex)}"><span class="cat-swatch"></span><div class="cat-info"><div class="cat-name"><span>${esc(c.nome)}</span>${c.padrao_sistema ? '<em class="cat-tag">Padrão</em>' : ''}</div><div class="cat-energy">${dots}</div></div>${excluir}</div>`;
       }).join('');
   }
   
   async function saveCategoria(event) {
       if (event) event.preventDefault();
       const nome = $('categoria-nome').value.trim();
       const cor = $('categoria-cor').value;
       const peso = parseInt($('categoria-peso').value, 10);
       if (!nome) { toast('Dê um nome.', 'err'); return; }
       try {
           const res = await fetch(`${API_URL}/categorias`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ nome, cor_hex: cor.toUpperCase(), peso_energia: peso })
           });
           if (!res.ok) { toast('Erro ao salvar.', 'err'); return; }
           toast('Categoria criada.'); $('form-categoria').reset(); renderCategorias();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   async function deleteCategoria(id) {
       if (!confirm('Excluir esta categoria?')) return;
       try {
           const res = await fetch(`${API_URL}/categorias/${id}`, { method: 'DELETE' });
           if (!res.ok) {
               const data = await res.json().catch(() => ({}));
               toast(data.code === '23503' ? 'Em uso por tarefas. Não pode excluir.' : 'Erro ao excluir.', 'err');
               return;
           }
           toast('Categoria excluída.'); renderCategorias();
       } catch (e) { toast('Erro de rede.', 'err'); }
   }
   
   async function carregarCategoriasNoForm(selId, preferida) {
       try {
           const res = await fetch(`${API_URL}/categorias`);
           if (!res.ok) return;
           const cats = await res.json();
           if (!cats.length) return;
           cats.sort((a, b) => a.id_categoria - b.id_categoria);
           $(selId).innerHTML = cats.map(c => `<option value="${c.id_categoria}" ${c.nome === preferida ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
       } catch (e) {}
   }
   
   /* ================= BUSCA DE INSTITUIÇÃO NO CADASTRO ================= */
   let todasInstituicoes = [];
   async function carregarInstituicoes() { try { const res = await fetch(`${API_URL}/instituicoes`); if (res.ok) todasInstituicoes = await res.json(); } catch (e) {} }
   const SEM_CURSO = 'sem-curso';
   function resetCursos() { const sel = $('cad-curso'); if (!sel) return; sel.innerHTML = '<option value="">Escolha a escola primeiro</option>'; sel.disabled = false; }
   
   async function carregarCursosDaEscola(idInstituicao) {
       const sel = $('cad-curso');
       sel.innerHTML = '<option value="">Carregando...</option>';
       sel.disabled = true;
       try {
           const res = await fetch(`${API_URL}/cursos/por_instituicao/${idInstituicao}`);
           if (String($('cad-inst-id').value) !== String(idInstituicao)) return;
           const cursos = res.ok ? await res.json() : [];
           if (!cursos.length) { sel.innerHTML = `<option value="${SEM_CURSO}">Ensino regular</option>`; sel.disabled = false; return; }
           sel.innerHTML = '<option value="" disabled selected>Selecione o curso</option>' + cursos.map(c => `<option value="${c.id_curso}">${esc(c.nome)}</option>`).join('') + `<option value="${SEM_CURSO}">Ensino regular</option>`;
           sel.disabled = false;
       } catch (e) { sel.innerHTML = '<option value="">Erro.</option>'; }
   }
   
   function filtrarInstituicoes() {
       const termo = $('cad-busca-inst').value.trim().toLowerCase();
       const listaDiv = $('lista-instituicoes');
       listaDiv.innerHTML = '';
       $('cad-inst-id').value = '';
       resetCursos();
       if (termo.length < 2) { listaDiv.classList.add('hidden'); return; }
       const filtradas = todasInstituicoes.filter(i => (i.nome || '').toLowerCase().includes(termo) || (i.cidade || '').toLowerCase().includes(termo));
       if (!filtradas.length) { listaDiv.innerHTML = '<div class="inst-vazio">Nenhuma encontrada.</div>'; }
       else {
           filtradas.slice(0, 30).forEach(inst => {
               const item = document.createElement('div');
               item.className = 'inst-item';
               item.innerHTML = `<strong>${esc(inst.nome)}</strong><span>${esc(inst.cidade)} · ${esc(inst.uf)}</span>`;
               item.onclick = () => { $('cad-busca-inst').value = inst.nome; $('cad-inst-id').value = inst.id_instituicao; listaDiv.classList.add('hidden'); carregarCursosDaEscola(inst.id_instituicao); };
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
       document.addEventListener('click', e => { if (!busca.contains(e.target) && !$('lista-instituicoes').contains(e.target)) $('lista-instituicoes').classList.add('hidden'); });
   })();
   
   /* ================= ESTUDOS (ENSINO MÉDIO, PAS-UEM E ENEM) ================= */
   const TRILHAS_ESTUDO = {
       '1_ano': {
           badge: '1ª Série · Peso 1 no PAS-UEM',
           titulo: '1º Ano do Ensino Médio & PAS 1',
           dica: 'No PAS 1, as questões são de somatória (01, 02, 04, 08, 16) e a redação pede gêneros como Carta de Solicitação ou Comentário (15 a 22 linhas).',
           materias: [
               {
                   nome: 'Matemática', cor: '#4B3FE4',
                   topicos: [
                       { id: '1_mat_1', texto: 'Conjuntos numéricos e intervalos', youtubeId: 'Y_mYgLkuEl4', resumo: 'Introdução aos conjuntos naturais, inteiros, racionais e reais.' },
                       { id: '1_mat_2', texto: 'Função afim (1º grau) e função quadrática (2º grau)', youtubeId: 'hdMFlAv5GkU', resumo: 'Conceitos iniciais, gráfico e lei de formação da função do 1º grau.' },
                       { id: '1_mat_3', texto: 'Função exponencial e logaritmos' },
                       { id: '1_mat_4', texto: 'Geometria plana: triângulos, polígonos e áreas' }
                   ]
               },
               {
                   nome: 'Física & Química', cor: '#0A8FB3',
                   topicos: [
                       { id: '1_fis_1', texto: 'Física: Cinemática (MRU, MRUV e queda livre)', youtubeId: 'oVb3WV1CLSE', resumo: 'Conceitos fundamentais de movimento uniforme e velocidade média.' },
                       { id: '1_fis_2', texto: 'Física: Leis de Newton, trabalho e energia' },
                       { id: '1_qui_1', texto: 'Química: Estrutura atômica e Tabela Periódica' },
                       { id: '1_qui_2', texto: 'Química: Ligações químicas, ácidos, bases e estequiometria' }
                   ]
               },
               {
                   nome: 'Biologia', cor: '#0E9F6E',
                   topicos: [
                       { id: '1_bio_1', texto: 'Bioquímica celular (água, sais, proteínas e vitaminas)' },
                       { id: '1_bio_2', texto: 'Citologia: organelas e divisão celular (mitose e meiose)', youtubeId: 'V_hAOq5iWvA', resumo: 'Estrutura da célula e função das principais organelas.' },
                       { id: '1_bio_3', texto: 'Histologia animal e embriologia básica' }
                   ]
               },
               {
                   nome: 'Humanas & Linguagens', cor: '#E0287D',
                   topicos: [
                       { id: '1_hum_1', texto: 'História: Antiguidade Clássica, Idade Média e Brasil Colônia', youtubeId: 'amV13tcqti8', resumo: 'Resumo dos principais pontos do período colonial brasileiro.' },
                       { id: '1_hum_2', texto: 'Geografia: Cartografia, relevo, clima e biomas brasileiros' },
                       { id: '1_lin_1', texto: 'Literatura: Trovadorismo, Quinhentismo e Barroco' },
                       { id: '1_lin_2', texto: 'Redação PAS 1: estrutura da Carta e do Comentário' }
                   ]
               }
           ]
       },
       '2_ano': {
           badge: '2ª Série · Peso 2 no PAS-UEM',
           titulo: '2º Ano do Ensino Médio & PAS 2',
           dica: 'O PAS 2 já tem peso 2 na nota final. Foque em interpretação de textos, trigonometria, termologia e nos gêneros Artigo de Opinião e Resumo.',
           materias: [
               {
                   nome: 'Matemática', cor: '#4B3FE4',
                   topicos: [
                       { id: '2_mat_1', texto: 'Trigonometria no triângulo retângulo e no ciclo', youtubeId: '5Ez1qFwyNxc', resumo: 'Seno, cosseno e tangente aplicados ao triângulo retângulo.' },
                       { id: '2_mat_2', texto: 'Matrizes, determinantes e sistemas lineares' },
                       { id: '2_mat_3', texto: 'Análise combinatória (arranjo, permutação e combinação)' },
                       { id: '2_mat_4', texto: 'Probabilidade e estatística básica' }
                   ]
               },
               {
                   nome: 'Física & Química', cor: '#0A8FB3',
                   topicos: [
                       { id: '2_fis_1', texto: 'Física: Termologia, calorimetria e termodinâmica', youtubeId: 'QUvmXOY2WvI', resumo: 'Temperatura, calor e escalas termométricas.' },
                       { id: '2_fis_2', texto: 'Física: Óptica geométrica e ondulatória' },
                       { id: '2_qui_1', texto: 'Química: Soluções e cálculo de concentração' },
                       { id: '2_qui_2', texto: 'Química: Termoquímica, cinética e equilíbrio químico' }
                   ]
               },
               {
                   nome: 'Biologia', cor: '#0E9F6E',
                   topicos: [
                       { id: '2_bio_1', texto: 'Classificação dos seres vivos, vírus e bactérias' },
                       { id: '2_bio_2', texto: 'Botânica: grupos vegetais e fisiologia das plantas' },
                       { id: '2_bio_3', texto: 'Fisiologia humana (digestório, respiratório e circulatório)' }
                   ]
               },
               {
                   nome: 'Humanas & Linguagens', cor: '#E0287D',
                   topicos: [
                       { id: '2_hum_1', texto: 'História: Revolução Industrial, Francesa e Brasil Império', youtubeId: 't6nJNv-pNr8', resumo: 'Fases e impactos da Revolução Industrial.' },
                       { id: '2_hum_2', texto: 'Geografia: Urbanização, industrialização e geografia agrária' },
                       { id: '2_lin_1', texto: 'Literatura: Romantismo, Realismo e Machado de Assis' },
                       { id: '2_lin_2', texto: 'Redação PAS 2: Artigo de Opinião e Resumo' }
                   ]
               }
           ]
       },
       '3_ano': {
           badge: '3ª Série · Peso 2 + Específicas no PAS-UEM',
           titulo: '3º Ano do Ensino Médio & PAS 3',
           dica: 'No PAS 3 você escolhe duas matérias específicas conforme o curso desejado, e a nota da etapa tem peso 2. Revise bastante História do Paraná e obras literárias.',
           materias: [
               {
                   nome: 'Matemática', cor: '#4B3FE4',
                   topicos: [
                       { id: '3_mat_1', texto: 'Geometria espacial (prismas, cilindros, cones e esferas)', youtubeId: 'GMWEiRH0PLI', resumo: 'Introdução aos sólidos geométricos e cálculo de volume.' },
                       { id: '3_mat_2', texto: 'Geometria analítica (ponto, reta e circunferência)' },
                       { id: '3_mat_3', texto: 'Polinômios e equações algébricas' },
                       { id: '3_mat_4', texto: 'Matemática financeira (juros simples e compostos)' }
                   ]
               },
               {
                   nome: 'Física & Química', cor: '#0A8FB3',
                   topicos: [
                       { id: '3_fis_1', texto: 'Física: Eletrostática e eletrodinâmica (circuitos)', youtubeId: '46nINK2nsX8', resumo: 'Corrente elétrica, tensão e resistores.' },
                       { id: '3_fis_2', texto: 'Física: Eletromagnetismo e noções de Física Moderna' },
                       { id: '3_qui_1', texto: 'Química Orgânica: cadeias carbônicas, funções e isomeria', youtubeId: 'BDmo-yGv0L4', resumo: 'Classificação das cadeias carbônicas e postulados de Kekulé.' },
                       { id: '3_qui_2', texto: 'Química: Eletroquímica (pilhas e eletrólise) e radioatividade' }
                   ]
               },
               {
                   nome: 'Biologia', cor: '#0E9F6E',
                   topicos: [
                       { id: '3_bio_1', texto: 'Genética: Leis de Mendel, grupos sanguíneos e biotecnologia', youtubeId: '4c3bEWWvA9c', resumo: 'Fundamentos da 1ª Lei de Mendel e cruzamentos.' },
                       { id: '3_bio_2', texto: 'Evolução biológica e origem das espécies' },
                       { id: '3_bio_3', texto: 'Ecologia: cadeias alimentares, ciclos e impactos ambientais' }
                   ]
               },
               {
                   nome: 'Humanas & Linguagens', cor: '#E0287D',
                   topicos: [
                       { id: '3_hum_1', texto: 'História: Guerras Mundiais, Guerra Fria e Brasil República' },
                       { id: '3_hum_2', texto: 'História do Paraná e Geopolítica da Globalização' },
                       { id: '3_lin_1', texto: 'Literatura: Pré-Modernismo, Modernismo e Contemporânea' },
                       { id: '3_lin_2', texto: 'Obras literárias obrigatórias da UEM' }
                   ]
               }
           ]
       },
       'enem': {
           badge: 'Revisão Geral · ENEM, UEM e UFPR',
           titulo: 'ENEM & Vestibulares',
           dica: 'O ENEM cobra 180 questões objetivas contextualizadas e uma redação dissertativo-argumentativa de até 30 linhas com proposta de intervenção.',
           materias: [
               {
                   nome: 'Matemática e suas Tecnologias', cor: '#4B3FE4',
                   topicos: [
                       { id: 'en_mat_1', texto: 'Razão, proporção, regra de três e porcentagem', youtubeId: 'OjOyNmTt7Mw', resumo: 'Cálculo rápido de porcentagem e regra de três simples.' },
                       { id: 'en_mat_2', texto: 'Leitura e interpretação de gráficos e tabelas' },
                       { id: 'en_mat_3', texto: 'Média, moda, mediana e probabilidade' },
                       { id: 'en_mat_4', texto: 'Geometria plana e espacial aplicada ao cotidiano' }
                   ]
               },
               {
                   nome: 'Ciências da Natureza', cor: '#0E9F6E',
                   topicos: [
                       { id: 'en_nat_1', texto: 'Ecologia, sustentabilidade e problemas ambientais', youtubeId: 'XvdePktAui8', resumo: 'Conceitos essenciais de ecologia que mais caem no ENEM.' },
                       { id: 'en_nat_2', texto: 'Energia, eletricidade residencial e ondulatória' },
                       { id: 'en_nat_3', texto: 'Química ambiental, pH e funções orgânicas' },
                       { id: 'en_nat_4', texto: 'Imunologia, vacinas e saúde pública' }
                   ]
               },
               {
                   nome: 'Ciências Humanas', cor: '#0A8FB3',
                   topicos: [
                       { id: 'en_hum_1', texto: 'Era Vargas, Ditadura Militar e Redemocratização', youtubeId: 'ZcTDWBqUju8', resumo: 'Resumo completo da Era Vargas (1930-1945).' },
                       { id: 'en_hum_2', texto: 'Movimentos sociais, cidadania e direitos humanos' },
                       { id: 'en_hum_3', texto: 'Geografia agrária, fontes de energia e urbanização' }
                   ]
               },
               {
                   nome: 'Linguagens & Redação Nota 1000', cor: '#E0287D',
                   topicos: [
                       { id: 'en_lin_1', texto: 'Interpretação de texto, gêneros digitais e variações linguísticas' },
                       { id: 'en_lin_2', texto: 'Funções da linguagem e figuras de linguagem' },
                       { id: 'en_lin_3', texto: 'Redação ENEM: tese, repertório sociocultural e intervenção', youtubeId: 'MeKHJVPNV30', resumo: 'Como montar a estrutura completa da redação dissertativo-argumentativa.' }
                   ]
               }
           ]
       }
   };
   
   function getTopicosConcluidos() {
       if (!state.user) return [];
       try { return JSON.parse(localStorage.getItem('flow_estudos_' + uid()) || '[]'); }
       catch (e) { return []; }
   }
   
   function salvarTopicosConcluidos(lista) {
       if (!state.user) return;
       try { localStorage.setItem('flow_estudos_' + uid(), JSON.stringify(lista)); } catch (e) {}
   }
   
   function mudarAbaEstudos(aba) {
       abaEstudoAtual = aba;
       renderEstudos();
   }
   
   function toggleTopicoEstudo(idTopico) {
       const concluidos = getTopicosConcluidos();
       const pos = concluidos.indexOf(idTopico);
       if (pos >= 0) {
           concluidos.splice(pos, 1);
       } else {
           concluidos.push(idTopico);
           toast('Tópico marcado como estudado!');
       }
       salvarTopicosConcluidos(concluidos);
       renderEstudos();
   }
   
   function buscarTopicoEstudo(idTopico) {
       for (const chave of Object.keys(TRILHAS_ESTUDO)) {
           for (const mat of TRILHAS_ESTUDO[chave].materias) {
               const achou = mat.topicos.find(t => t.id === idTopico);
               if (achou) return { topico: achou, materia: mat.nome };
           }
       }
       return null;
   }
   
   function abrirAulaEstudo(idTopico) {
       const info = buscarTopicoEstudo(idTopico);
       if (!info || !info.topico.youtubeId) return;
   
       $('conteudo-tag').textContent = 'Videoaula · ' + info.materia;
       $('t-conteudo').textContent = info.topico.texto;
       $('conteudo-sub').textContent = 'Material de revisão · YouTube';
   
       const media = $('conteudo-media');
       media.classList.remove('hidden');
       media.innerHTML = `<iframe src="https://www.youtube.com/embed/${esc(info.topico.youtubeId)}" title="${esc(info.topico.texto)}" allowfullscreen></iframe>`;
   
       const url = `https://www.youtube.com/watch?v=${esc(info.topico.youtubeId)}`;
       $('conteudo-texto').innerHTML = `
           <p>${esc(info.topico.resumo || 'Assista à videoaula e depois reserve um bloco de exercícios na sua agenda.')}</p>
           <p><a class="link" href="${url}" target="_blank" rel="noopener noreferrer">Abrir vídeo direto no YouTube ↗</a></p>
       `;
       $('btn-concluir-doc').classList.add('hidden');
       openModal('modal-conteudo');
   }
   
   async function agendarTopicoEstudo(idTopico) {
       const info = buscarTopicoEstudo(idTopico);
       if (!info) return;
       await openTarefa();
       $('tarefa-titulo').value = 'Estudar: ' + info.topico.texto;
   }
   
   async function criarMetaDaTrilha() {
       if (!state.user) return;
       const aba = abaEstudoAtual || state.user.ano_escolar || '1_ano';
       const trilha = TRILHAS_ESTUDO[aba];
       if (!trilha) return;
   
       try {
           const res = await fetch(`${API_URL}/metas`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                   id_estudante: uid(),
                   titulo: 'Concluir trilha: ' + trilha.titulo,
                   descricao: trilha.dica,
                   prazo: null,
                   progresso_manual: 0,
                   status: 'ativa'
               })
           });
           if (res.ok) {
               toast('Meta criada! Veja na aba Metas.');
               await syncMetas();
           } else {
               toast('Erro ao criar meta.', 'err');
           }
       } catch (e) {
           toast('Erro de rede.', 'err');
       }
   }
   
   function renderEstudos() {
       if (!state.user) return;
       if (!abaEstudoAtual || !TRILHAS_ESTUDO[abaEstudoAtual]) {
           abaEstudoAtual = state.user.ano_escolar || '1_ano';
       }
   
       document.querySelectorAll('#screen-estudos .tab').forEach(b => b.classList.remove('active'));
       const tabAtiva = $('tab-estudo-' + abaEstudoAtual);
       if (tabAtiva) tabAtiva.classList.add('active');
   
       const trilha = TRILHAS_ESTUDO[abaEstudoAtual];
       const concluidos = getTopicosConcluidos();
   
       let total = 0, feitos = 0;
       trilha.materias.forEach(m => {
           m.topicos.forEach(t => { total++; if (concluidos.includes(t.id)) feitos++; });
       });
       const pct = total ? Math.round((feitos / total) * 100) : 0;
   
       $('estudos-resumo').innerHTML = `
           <div class="study-banner-top">
               <div>
                   <span class="well-badge">${esc(trilha.badge)}</span>
                   <h2>${esc(trilha.titulo)}</h2>
                   <p>${esc(trilha.dica)}</p>
               </div>
               <div class="study-pct">${pct}%</div>
           </div>
           <div class="bar"><i style="width:${pct}%"></i></div>
           <p class="task-meta"><span>${feitos} de ${total} tópicos estudados</span></p>
       `;
   
       $('estudos-lista').innerHTML = trilha.materias.map(m => {
           const feitosMat = m.topicos.filter(t => concluidos.includes(t.id)).length;
           const itensHTML = m.topicos.map(t => {
               const ok = concluidos.includes(t.id);
               const btnAula = t.youtubeId ? `<button class="btn sm" type="button" onclick="abrirAulaEstudo('${t.id}')">Aula</button>` : '';
               return `
                   <li class="study-item ${ok ? 'ok' : ''}" style="--cat:${esc(m.cor)}">
                       <button class="tick" type="button" role="checkbox" aria-checked="${ok}" onclick="toggleTopicoEstudo('${t.id}')">${ICON.check}</button>
                       <span>${esc(t.texto)}</span>
                       <div class="study-btns">
                           ${btnAula}
                           <button class="btn ghost sm" type="button" onclick="agendarTopicoEstudo('${t.id}')">+ Agendar</button>
                       </div>
                   </li>
               `;
           }).join('');
   
           return `
               <article class="panel study-card" style="--c:${esc(m.cor)}">
                   <div class="study-card-head">
                       <i class="study-dot"></i>
                       <h3>${esc(m.nome)}</h3>
                       <span>${feitosMat}/${m.topicos.length}</span>
                   </div>
                   <ul class="study-items">${itensHTML}</ul>
               </article>
           `;
       }).join('');
   }
   
   /* ================= INICIALIZAÇÃO ================= */
   DB.init();
   setInterval(() => { if (state.user && $('screen-menu').classList.contains('active')) renderRail(); }, 60000);
   setInterval(checkLembretes, 20000);
   navTo('screen-login');

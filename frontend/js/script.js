/* =====================================================================
   Flow Agendas — protótipo
   CAMADA DE DADOS: espelha o schema PostgreSQL (mesmos nomes de tabela e
   coluna). Hoje persiste em localStorage; para ligar a um backend, troque
   apenas as funções do objeto DB por chamadas à API.

   Mapa tela → tabelas
     Login/Cadastro → instituicao, curso, estudante
     Tarefas        → compromisso (+ categoria, meta)
     Hábitos        → compromisso + recorrencia + recorrencia_dia + habito_checkin (nova)
     Metas          → meta (nova) + compromisso.id_meta (nova)
     Água           → hábito "Beber água" + habito_checkin.quantidade
     Sono / Foco    → compromisso + bloco_descompressao (tipo 'sono' / 'offline')
     Chat da Aya    → conversa + mensagem (risco_detectado)
   ===================================================================== */

const PK = {
    instituicao: 'id_instituicao', curso: 'id_curso', estudante: 'id_estudante', categoria: 'id_categoria',
    compromisso: 'id_compromisso', recorrencia: 'id_recorrencia', bloco_descompressao: 'id_bloco',
    conversa: 'id_conversa', mensagem: 'id_mensagem', meta: 'id_meta', habito_checkin: 'id_checkin'
};
const TABLES = Object.keys(PK).concat(['recorrencia_dia']);

const DB = {
    KEY: 'flow_agendas_db_v2', d: null,
    init() {
        let raw = null;
        try { raw = localStorage.getItem(this.KEY); } catch (e) {}
        try { this.d = raw ? JSON.parse(raw) : null; } catch (e) { this.d = null; }
        if (!this.d) this.d = { seq: {}, session: null };
        TABLES.forEach(t => { if (!this.d[t]) this.d[t] = []; });
        if (!this.d.categoria.length) {
            [['Estudo', '#4F46E5', 4], ['Trabalho', '#0EA5E9', 5], ['Lazer', '#EC4899', 1],
             ['Saúde', '#10B981', 2], ['Descompressão', '#8B5CF6', 1], ['Pessoal', '#F59E0B', 3]]
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
        }
        if (t === 'meta') this.where('compromisso', c => c.id_meta === id).forEach(c => { c.id_meta = null; }); // ON DELETE SET NULL
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
const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const WATER_TITLE = 'Beber água (meta diária)';

function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.textContent = msg;
    $('toast-wrap').appendChild(t);
    setTimeout(() => t.remove(), 3500);
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

/* ================= ESTADO ================= */
let state = {
    user: null,            // linha de `estudante`
    conversa: null,        // linha de `conversa`
    focusTime: 0, focusSaved: 0, focusInterval: null, isFocusing: false,
    tarefaFilter: 'aberto'
};
const uid = () => state.user.id_estudante;
const catById = id => DB.get('categoria', id);
const catByName = nome => DB.find('categoria', c => c.nome === nome);
const isHabit = c => !!DB.find('recorrencia', r => r.id_compromisso === c.id_compromisso);
const isBloco = c => !!DB.find('bloco_descompressao', b => b.id_compromisso === c.id_compromisso);

/* ================= NAVEGAÇÃO ================= */
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

    const navLinks = $('nav-links'), userArea = $('user-area');
    if (isPublic) {
        navLinks.classList.add('hidden'); userArea.classList.add('hidden');
    } else {
        navLinks.classList.remove('hidden'); userArea.classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        if (navId) $(navId).classList.add('active');
    }

    if (screenId === 'screen-aya') {
        const chatBox = $('chat-messages');
        setTimeout(() => chatBox.scrollTop = chatBox.scrollHeight, 50);
    }
    window.scrollTo(0, 0);
}

/* ================= LOGIN / CADASTRO / SESSÃO ================= */
async function doLogin() {
    const email = $('login-email').value.trim().toLowerCase();
    const pass = $('login-pass').value;
    if (!email || !pass) { toast('Informe e-mail e senha.', 'err'); return; }
    const u = DB.find('estudante', e => e.email === email);
    const hash = await sha256(pass);
    if (!u || u.senha_hash !== hash) { toast('E-mail ou senha incorretos.', 'err'); return; }
    $('login-pass').value = '';
    startSession(u);
}

async function doCadastro() {
    const v = id => $(id).value.trim();
    const nome = v('cad-nome'), email = v('cad-email').toLowerCase(), senha = $('cad-senha').value, nasc = $('cad-nasc').value;
    const inst = v('cad-inst'), cidade = v('cad-cidade'), uf = v('cad-uf').toUpperCase(), curso = v('cad-curso');
    const dur = parseInt($('cad-curso-duracao').value, 10);

    if (!nome || !email || !senha || !nasc || !inst || !cidade || !uf || !curso) { toast('Preencha todos os campos.', 'err'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('E-mail inválido.', 'err'); return; }
    if (senha.length < 6) { toast('A senha precisa ter ao menos 6 caracteres.', 'err'); return; }
    if (!/^[A-Z]{2}$/.test(uf)) { toast('UF deve ter 2 letras (ex: PR).', 'err'); return; }
    if (!(dur > 0)) { toast('A duração do curso deve ser maior que zero.', 'err'); return; }
    const lim = new Date(); lim.setFullYear(lim.getFullYear() - 14);          // ck_estudante_idade
    if (new Date(nasc + 'T00:00:00') > lim) { toast('É preciso ter pelo menos 14 anos.', 'err'); return; }
    if (DB.find('estudante', e => e.email === email)) { toast('Este e-mail já está cadastrado.', 'err'); return; } // uq_estudante_email

    let i = DB.find('instituicao', x => x.nome.toLowerCase() === inst.toLowerCase() && x.cidade.toLowerCase() === cidade.toLowerCase() && x.uf === uf); // uq_instituicao
    if (!i) i = DB.insert('instituicao', { nome: inst, tipo: $('cad-inst-tipo').value, cidade, uf, criado_em: fmtTs(new Date()) });
    const turnoCurso = $('cad-curso-turno').value;
    let c = DB.find('curso', x => x.id_instituicao === i.id_instituicao && x.nome.toLowerCase() === curso.toLowerCase() && x.turno === turnoCurso); // uq_curso
    if (!c) c = DB.insert('curso', { id_instituicao: i.id_instituicao, nome: curso, turno: turnoCurso, duracao_semestres: dur });

    const u = DB.insert('estudante', {
        id_instituicao: i.id_instituicao, id_curso: c.id_curso, nome, data_nascimento: nasc, email,
        senha_hash: await sha256(senha), ano_escolar: $('cad-ano').value, turno_escolar: $('cad-turno-escolar').value,
        criado_em: fmtTs(new Date())
    });
    toast('Conta criada! Bem-vindo(a) ao Flow.');
    startSession(u);
}

function startSession(u) {
    state.user = u;
    DB.d.session = u.id_estudante; DB.save();
    $('display-username').innerText = u.nome;
    $('avatar-letter').innerText = u.nome.charAt(0).toUpperCase();
    loadConversa();
    navTo('screen-menu', 'nav-dashboard');
}

function logout() {
    if (state.conversa) { DB.update('conversa', state.conversa.id_conversa, { encerrada_em: fmtTs(new Date()) }); }
    if (state.isFocusing) { clearInterval(state.focusInterval); state.isFocusing = false; saveFocus(); }
    state.user = null; state.conversa = null; state.focusTime = 0; state.focusSaved = 0;
    DB.d.session = null; DB.save();
    navTo('screen-login');
}

function updateName(newName) {
    if (newName.trim() === '' || !state.user) return;
    state.user = DB.update('estudante', uid(), { nome: newName.trim() });
    $('display-username').innerText = state.user.nome;
    $('avatar-letter').innerText = state.user.nome.charAt(0).toUpperCase();
    $('greeting-text').innerText = `O que vamos fazer hoje, ${state.user.nome}?`;
}

function renderConfig() {
    const u = state.user;
    $('config-name').value = u.nome;
    $('config-email').value = u.email;
    const i = DB.get('instituicao', u.id_instituicao), c = DB.get('curso', u.id_curso);
    $('config-inst').value = i ? `${i.nome} — ${i.cidade}/${i.uf}` : '';
    $('config-curso').value = c ? `${c.nome} (${c.turno}, ${c.duracao_semestres} sem.)` : '';
    $('config-ano').value = u.ano_escolar;
    $('config-turno').value = u.turno_escolar;
}

function saveConfig() {
    state.user = DB.update('estudante', uid(), { ano_escolar: $('config-ano').value, turno_escolar: $('config-turno').value });
    toast('Configurações salvas!');
}

/* ================= MODAIS ================= */
function openModal(id) { $(id).classList.add('open'); const f = $(id).querySelector('input[type=text]'); if (f) f.focus(); }
function closeModal(id) { $(id).classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });

function fillCategorias(selId, preferida) {
    $(selId).innerHTML = DB.d.categoria.map(c => `<option value="${c.id_categoria}" ${c.nome === preferida ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
}

/* ================= TAREFAS (compromisso) ================= */
function minhasTarefas() {
    return DB.where('compromisso', c => c.id_estudante === uid() && !isHabit(c) && !isBloco(c));
}

function openTarefa(idMeta) {
    $('form-tarefa').reset();
    fillCategorias('tarefa-categoria', 'Estudo');
    const metas = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa');
    $('tarefa-meta').innerHTML = '<option value="">— nenhuma —</option>' + metas.map(m => `<option value="${m.id_meta}" ${m.id_meta === idMeta ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('');
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
    if (!(b > a)) { toast('O fim precisa ser depois do início.', 'err'); return; }   // ck_compromisso_periodo
    const idMeta = parseInt($('tarefa-meta').value, 10) || null;
    DB.insert('compromisso', {
        id_estudante: uid(), id_categoria: parseInt($('tarefa-categoria').value, 10), id_semana: null, id_meta: idMeta,
        titulo, descricao: $('tarefa-descricao').value.trim() || null,
        data_inicio: fmtTs(a), data_fim: fmtTs(b), dia_inteiro: $('tarefa-dia-inteiro').checked,
        local: $('tarefa-local').value.trim() || null, prioridade: $('tarefa-prioridade').value,
        status: 'pendente', origem: 'manual', criado_em: fmtTs(new Date())
    });
    closeModal('modal-tarefa'); toast('Tarefa adicionada!');
    refreshAfterChange();
}

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído ✓', cancelado: 'Cancelado' };
const STATUS_CLASS = { pendente: 'status-pendente', em_andamento: 'status-andamento', concluido: 'status-concluido', cancelado: 'status-cancelado' };
const STATUS_NEXT = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' };

function fmtRange(c) {
    const a = new Date(c.data_inicio), b = new Date(c.data_fim);
    const d = a.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    if (c.dia_inteiro) return d + ' · dia inteiro';
    const t = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (fmtDate(a) === fmtDate(b)) return `${d} · ${t(a)}–${t(b)}`;
    return `${d} ${t(a)} → ${b.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${t(b)}`;
}

function renderTarefas() {
    const list = $('subject-list');
    const f = state.tarefaFilter;
    const rows = minhasTarefas().filter(c => f === 'aberto' ? (c.status === 'pendente' || c.status === 'em_andamento') : c.status === f);
    rows.sort((x, y) => f === 'aberto' ? x.data_inicio.localeCompare(y.data_inicio) : y.data_inicio.localeCompare(x.data_inicio));

    if (!rows.length) {
        const msg = { aberto: 'Nenhuma tarefa em aberto.', concluido: 'Nada concluído ainda.', cancelado: 'Nenhuma tarefa cancelada.' }[f];
        list.innerHTML = `<div class="empty-state"><p>${msg}</p>${f === 'aberto' ? '<button class="btn" onclick="openTarefa()">+ Nova tarefa</button>' : ''}</div>`;
        return;
    }
    const now = new Date();
    list.innerHTML = rows.map(c => {
        const cat = catById(c.id_categoria) || { nome: '?', cor_hex: '#94A3B8' };
        const meta = c.id_meta ? DB.get('meta', c.id_meta) : null;
        const done = c.status === 'concluido', cancel = c.status === 'cancelado';
        const late = (c.status === 'pendente' || c.status === 'em_andamento') && new Date(c.data_fim) < now;
        return `
        <div class="subject-row" style="--cat:${cat.cor_hex}">
            <div class="subject-info">
                <h4 style="${done || cancel ? 'text-decoration: line-through; color: #9CA3AF;' : ''}">${esc(c.titulo)}</h4>
                <p>${esc(fmtRange(c))}${c.local ? ' · ' + esc(c.local) : ''}</p>
                ${c.descricao ? `<p>${esc(c.descricao)}</p>` : ''}
                <div class="meta-chips">
                    <span class="chip"><span class="dotc" style="background:${cat.cor_hex}"></span>${esc(cat.nome)}</span>
                    <span class="prio prio-${c.prioridade}">${c.prioridade}</span>
                    ${meta ? `<span class="chip">Meta: ${esc(meta.titulo)}</span>` : ''}
                    ${late ? '<span class="chip late">atrasada</span>' : ''}
                </div>
            </div>
            <div class="row-actions">
                ${cancel ? `<span class="status-badge ${STATUS_CLASS.cancelado}" onclick="setTarefaStatus(${c.id_compromisso}, 'pendente')">Reativar</span>`
                         : `<span class="status-badge ${STATUS_CLASS[c.status]}" onclick="cycleTarefa(${c.id_compromisso})">${STATUS_LABEL[c.status]}</span>
                            <button class="icon-btn" title="Cancelar" onclick="setTarefaStatus(${c.id_compromisso}, 'cancelado')">⊘</button>`}
                <button class="icon-btn del" title="Excluir" onclick="deleteTarefa(${c.id_compromisso})">🗑</button>
            </div>
        </div>`;
    }).join('');
}

function cycleTarefa(id) { const c = DB.get('compromisso', id); if (c && STATUS_NEXT[c.status]) setTarefaStatus(id, STATUS_NEXT[c.status]); }
function setTarefaStatus(id, st) { DB.update('compromisso', id, { status: st }); refreshAfterChange(); }
function deleteTarefa(id) { if (confirm('Excluir esta tarefa definitivamente?')) { DB.remove('compromisso', id); toast('Tarefa excluída.'); refreshAfterChange(); } }
function filterTarefas(type) {
    state.tarefaFilter = type;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    $('f-' + type).classList.add('active');
    renderTarefas();
}

function refreshAfterChange() { renderDashboard(); renderTarefas(); renderMetas(); renderHabitos(); }

/* ================= HÁBITOS (compromisso + recorrencia + habito_checkin) ================= */
function meusHabitos() {
    return DB.where('compromisso', c => c.id_estudante === uid() && c.status !== 'cancelado' && c.titulo !== WATER_TITLE && isHabit(c));
}
function habitDays(c) {
    const r = DB.find('recorrencia', x => x.id_compromisso === c.id_compromisso);
    if (!r || r.tipo === 'diaria') return [1, 2, 3, 4, 5, 6, 7];
    return DB.where('recorrencia_dia', d => d.id_recorrencia === r.id_recorrencia).map(d => d.dia_semana);
}
const checkinOf = (c, dateStr) => DB.find('habito_checkin', k => k.id_compromisso === c.id_compromisso && k.data === dateStr);
function streakOf(c) {
    const days = habitDays(c); const d = new Date(); let n = 0;
    for (let i = 0; i < 400; i++) {
        if (days.includes(isoDow(d))) {
            if (checkinOf(c, fmtDate(d))) n++; else if (i > 0) break;
        }
        d.setDate(d.getDate() - 1);
    }
    return n;
}

function openHabito() {
    $('form-habito').reset();
    fillCategorias('habito-categoria', 'Pessoal');
    document.querySelectorAll('#habito-dias .day-chip').forEach(b => b.classList.remove('on'));
    $('habito-dias-wrap').classList.add('hidden');
    openModal('modal-habito');
}
function toggleDiasHabito() { $('habito-dias-wrap').classList.toggle('hidden', $('habito-tipo').value !== 'semanal'); }

function criarHabitoBase(titulo, descricao, idCategoria, tipo, dias) {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setHours(23, 59, 59, 0);
    const c = DB.insert('compromisso', {
        id_estudante: uid(), id_categoria: idCategoria, id_semana: null, id_meta: null, titulo, descricao,
        data_inicio: fmtTs(s), data_fim: fmtTs(e), dia_inteiro: true, local: null, prioridade: 'media',
        status: 'pendente', origem: 'recorrencia', criado_em: fmtTs(new Date())
    });
    const r = DB.insert('recorrencia', { id_compromisso: c.id_compromisso, tipo, intervalo: 1, data_fim: null, ocorrencias_geradas: 0 });
    if (tipo === 'semanal') dias.forEach(d => DB.insert('recorrencia_dia', { id_recorrencia: r.id_recorrencia, dia_semana: d }));
    return c;
}

function saveHabito() {
    const titulo = $('habito-titulo').value.trim();
    if (!titulo) { toast('Dê um nome ao hábito.', 'err'); return; }
    const tipo = $('habito-tipo').value;
    const dias = Array.from(document.querySelectorAll('#habito-dias .day-chip.on')).map(b => parseInt(b.dataset.d, 10));
    if (tipo === 'semanal' && !dias.length) { toast('Escolha ao menos um dia da semana.', 'err'); return; }
    criarHabitoBase(titulo, $('habito-descricao').value.trim() || null, parseInt($('habito-categoria').value, 10), tipo, dias);
    closeModal('modal-habito'); toast('Hábito criado!');
    renderHabitos(); renderDashboard();
}

function toggleCheckin(id) {
    const c = DB.get('compromisso', id); if (!c) return;
    const hoje = todayStr(), ex = checkinOf(c, hoje);
    if (ex) DB.remove('habito_checkin', ex.id_checkin);
    else DB.insert('habito_checkin', { id_compromisso: id, data: hoje, quantidade: 1, criado_em: fmtTs(new Date()) });
    renderHabitos(); renderDashboard();
}

function deleteHabito(id) { if (confirm('Excluir este hábito e todo o histórico dele?')) { DB.remove('compromisso', id); toast('Hábito excluído.'); renderHabitos(); renderDashboard(); } }

function renderHabitos() {
    const list = $('habit-list');
    const hs = meusHabitos();
    if (!hs.length) {
        list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Nenhum hábito ainda.</p><button class="btn btn-green" onclick="openHabito()">+ Novo hábito</button></div>`;
        return;
    }
    const LET = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    list.innerHTML = hs.map(c => {
        const cat = catById(c.id_categoria) || { nome: '?', cor_hex: '#94A3B8' };
        const rec = DB.find('recorrencia', r => r.id_compromisso === c.id_compromisso);
        const days = habitDays(c);
        const hoje = new Date(), hojeOn = days.includes(isoDow(hoje));
        const done = !!checkinOf(c, fmtDate(hoje));
        const st = streakOf(c);
        const freq = rec && rec.tipo === 'semanal' ? days.map(d => DIAS[d]).join(' · ') : 'Todos os dias';
        let strip = '';
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const on = days.includes(isoDow(d)), ck = !!checkinOf(c, fmtDate(d));
            const cls = (ck ? 'done' : (on && i > 0 ? 'miss' : (on ? '' : 'off'))) + (i === 0 ? ' today' : '');
            strip += `<div class="wk ${cls}"><i>${ck ? '✓' : ''}</i>${LET[d.getDay()]}</div>`;
        }
        return `
        <div class="habit-card">
            <div class="habit-top">
                <div class="habit-check ${done ? 'done' : ''} ${hojeOn ? '' : 'off'}" ${hojeOn ? `onclick="toggleCheckin(${c.id_compromisso})"` : 'title="Hoje não é dia deste hábito"'}>✓</div>
                <div class="habit-info">
                    <h4>${esc(c.titulo)}</h4>
                    <p>${esc(freq)}</p>
                    <div class="meta-chips"><span class="chip"><span class="dotc" style="background:${cat.cor_hex}"></span>${esc(cat.nome)}</span></div>
                </div>
                <div class="habit-side">
                    <span class="streak ${st ? '' : 'zero'}">${st} ${st === 1 ? 'dia' : 'dias'}</span>
                    <button class="icon-btn del" title="Excluir" onclick="deleteHabito(${c.id_compromisso})">🗑</button>
                </div>
            </div>
            <div class="week-strip">${strip}</div>
        </div>`;
    }).join('');
}

/* ================= METAS (meta) ================= */
function metaProgress(m) {
    const linked = DB.where('compromisso', c => c.id_meta === m.id_meta && c.status !== 'cancelado');
    if (linked.length) {
        const done = linked.filter(c => c.status === 'concluido').length;
        return { pct: Math.round(done / linked.length * 100), auto: true, total: linked.length, done };
    }
    return { pct: m.progresso_manual, auto: false, total: 0, done: 0 };
}

function openMeta() { $('form-meta').reset(); openModal('modal-meta'); }

function saveMeta() {
    const titulo = $('meta-titulo').value.trim();
    if (!titulo) { toast('Dê um nome à meta.', 'err'); return; }
    DB.insert('meta', {
        id_estudante: uid(), titulo, descricao: $('meta-descricao').value.trim() || null,
        prazo: $('meta-prazo').value || null, progresso_manual: 0, status: 'ativa', criado_em: fmtTs(new Date())
    });
    closeModal('modal-meta'); toast('Meta criada!');
    renderMetas(); renderDashboard();
}

function bumpMeta(id, delta) {
    const m = DB.get('meta', id); if (!m) return;
    DB.update('meta', id, { progresso_manual: Math.max(0, Math.min(100, m.progresso_manual + delta)) });
    renderMetas();
}
function toggleMeta(id) {
    const m = DB.get('meta', id); if (!m) return;
    if (m.status === 'ativa') { DB.update('meta', id, { status: 'concluida', progresso_manual: 100 }); toast('Meta concluída! Parabéns!'); }
    else DB.update('meta', id, { status: 'ativa' });
    renderMetas(); renderDashboard();
}
function deleteMeta(id) { if (confirm('Excluir esta meta? As tarefas vinculadas continuam existindo.')) { DB.remove('meta', id); toast('Meta excluída.'); renderMetas(); renderDashboard(); renderTarefas(); } }

function renderMetas() {
    const list = $('meta-list');
    const ms = DB.where('meta', m => m.id_estudante === uid() && m.status !== 'cancelada')
        .sort((a, b) => (a.status === b.status ? (a.prazo || '9999').localeCompare(b.prazo || '9999') : (a.status === 'ativa' ? -1 : 1)));
    if (!ms.length) {
        list.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>Nenhuma meta ainda.</p><button class="btn btn-pink" onclick="openMeta()">+ Nova meta</button></div>`;
        return;
    }
    list.innerHTML = ms.map(m => {
        const p = metaProgress(m), fin = m.status === 'concluida';
        let prazo = '';
        if (m.prazo) {
            const dias = Math.round((new Date(m.prazo + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000);
            const txt = fin ? m.prazo.split('-').reverse().join('/') : (dias < 0 ? `atrasada ${-dias}d` : dias === 0 ? 'vence hoje' : `faltam ${dias} dias`);
            prazo = `<span class="chip ${!fin && dias < 0 ? 'late' : ''}">Prazo: ${txt}</span>`;
        }
        return `
        <div class="meta-card ${fin ? 'done-meta' : ''}">
            <h4>${esc(m.titulo)}</h4>
            ${m.descricao ? `<p class="desc">${esc(m.descricao)}</p>` : ''}
            <div class="meta-chips">${prazo}${p.auto ? `<span class="chip">${p.done}/${p.total} tarefas</span>` : '<span class="chip">progresso manual</span>'}${fin ? '<span class="chip">concluída</span>' : ''}</div>
            <div class="meta-progress">
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${p.pct}%"></div></div>
                <span class="pct">${p.pct}%</span>
            </div>
            <div class="meta-actions">
                ${!fin ? `<button class="mini-btn" onclick="openTarefa(${m.id_meta})">+ tarefa</button>` : ''}
                ${!fin && !p.auto ? `<button class="mini-btn" onclick="bumpMeta(${m.id_meta}, -10)">−10%</button><button class="mini-btn" onclick="bumpMeta(${m.id_meta}, 10)">+10%</button>` : ''}
                <span class="spacer"></span>
                <button class="mini-btn ok" onclick="toggleMeta(${m.id_meta})">${fin ? 'Reabrir' : 'Concluir'}</button>
                <button class="icon-btn del" title="Excluir" onclick="deleteMeta(${m.id_meta})">🗑</button>
            </div>
        </div>`;
    }).join('');
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
    if (!state.user) return;
    $('greeting-text').innerText = `O que vamos fazer hoje, ${state.user.nome}?`;
    const abertas = minhasTarefas().filter(c => c.status === 'pendente' || c.status === 'em_andamento');
    const hoje = abertas.filter(c => c.data_inicio.slice(0, 10) <= todayStr() && c.data_fim.slice(0, 10) >= todayStr()).length;
    $('stat-tarefas').innerText = abertas.length;
    $('stat-tarefas-lbl').innerText = `tarefas em aberto${hoje ? ` · ${hoje} hoje` : ''}`;
    const hs = meusHabitos().filter(c => habitDays(c).includes(isoDow(new Date())));
    $('stat-habitos').innerText = `${hs.filter(c => checkinOf(c, todayStr())).length}/${hs.length}`;
    $('stat-metas').innerText = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa').length;
    $('stat-agua').innerText = `${waterToday() / 1000}L`;
}

/* ================= BEM-ESTAR ================= */
// Água = hábito diário "Beber água" + habito_checkin.quantidade (ml acumulados no dia)
function waterHabit(create) {
    let c = DB.find('compromisso', x => x.id_estudante === uid() && x.titulo === WATER_TITLE);
    if (!c && create) c = criarHabitoBase(WATER_TITLE, 'Meta: 2000 ml por dia', catByName('Saúde').id_categoria, 'diaria', []);
    return c;
}
function waterToday() {
    const c = waterHabit(false); if (!c) return 0;
    const k = checkinOf(c, todayStr()); return k ? k.quantidade : 0;
}
function addWater() {
    const cur = waterToday();
    if (cur < 2000) {
        const c = waterHabit(true), k = checkinOf(c, todayStr());
        if (k) DB.update('habito_checkin', k.id_checkin, { quantidade: cur + 250 });
        else DB.insert('habito_checkin', { id_compromisso: c.id_compromisso, data: todayStr(), quantidade: 250, criado_em: fmtTs(new Date()) });
        updateWaterUI();
    }
}
function updateWaterUI() {
    const w = waterToday();
    $('water-bar').style.width = `${(w / 2000) * 100}%`;
    $('water-text').innerText = `Você bebeu ${w / 1000}L de uma meta de 2L`;
}

// Sono / foco = compromisso + bloco_descompressao (tipo 'sono' / 'offline')
function blocoHoje(tipo) {
    return DB.where('bloco_descompressao', b => b.tipo === tipo)
        .map(b => ({ b, c: DB.get('compromisso', b.id_compromisso) }))
        .find(x => x.c && x.c.id_estudante === uid() && x.c.data_inicio.slice(0, 10) === todayStr());
}
function addBloco(tipo, titulo, minutos, concluidoQuando) {
    const x = blocoHoje(tipo);
    if (x) {
        const novo = x.b.duracao_min + minutos;
        const ini = new Date(x.c.data_inicio);
        DB.update('bloco_descompressao', x.b.id_bloco, { duracao_min: novo });
        DB.update('compromisso', x.c.id_compromisso, { data_fim: fmtTs(new Date(ini.getTime() + novo * 60000)), status: novo >= concluidoQuando ? 'concluido' : 'em_andamento' });
    } else {
        const ini = new Date(); ini.setHours(0, 0, 0, 0);
        const c = DB.insert('compromisso', {
            id_estudante: uid(), id_categoria: catByName('Descompressão').id_categoria, id_semana: null, id_meta: null,
            titulo, descricao: null, data_inicio: fmtTs(ini), data_fim: fmtTs(new Date(ini.getTime() + minutos * 60000)),
            dia_inteiro: false, local: null, prioridade: 'media', status: minutos >= concluidoQuando ? 'concluido' : 'em_andamento',
            origem: 'manual', criado_em: fmtTs(new Date())
        });
        DB.insert('bloco_descompressao', { id_compromisso: c.id_compromisso, tipo, duracao_min: minutos, obrigatorio: false, sugestao_sistema: false });
    }
}
const sleepMinutes = () => { const x = blocoHoje('sono'); return x ? x.b.duracao_min : 0; };
const focusTodayMin = () => { const x = blocoHoje('offline'); return x ? x.b.duracao_min : 0; };

function addSleep() {
    if (sleepMinutes() < 480) { addBloco('sono', 'Sono', 60, 480); updateSleepUI(); }
}
function updateSleepUI() {
    const h = sleepMinutes() / 60;
    $('sleep-bar').style.width = `${(h / 8) * 100}%`;
    $('sleep-text').innerText = `Você dormiu ${h}h de uma meta de 8h`;
}

function saveFocus() {
    const add = Math.floor(state.focusTime / 60) - Math.floor(state.focusSaved / 60);   // só minutos completos
    if (add > 0) { addBloco('offline', 'Foco / Meditação', add, 1); state.focusSaved = state.focusTime; }
}

function toggleFocus() {
    const btn = $('btn-focus'), text = $('focus-text'), bar = $('focus-bar');

    if (!state.isFocusing && state.focusTime >= 300) {   // recomeçar após concluir
        state.focusTime = 0; state.focusSaved = 0; bar.style.width = '0%';
    }

    if (state.isFocusing) {
        clearInterval(state.focusInterval);
        state.isFocusing = false;
        saveFocus();
        btn.innerText = 'Continuar';
        text.innerText = 'Foco pausado. Respire fundo.';
    } else {
        state.isFocusing = true;
        btn.innerText = 'Pausar';
        state.focusInterval = setInterval(() => {
            state.focusTime++;
            bar.style.width = `${(state.focusTime / 300) * 100}%`;
            const min = Math.floor(state.focusTime / 60), sec = state.focusTime % 60;
            text.innerText = `Focando... ${min}m ${sec}s`;
            if (state.focusTime >= 300) {
                clearInterval(state.focusInterval);
                state.isFocusing = false;
                saveFocus();
                btn.innerText = 'Concluído!';
                text.innerText = `Parabéns! Você completou 5 minutos de foco. Hoje: ${focusTodayMin()} min no total.`;
            }
        }, 1000);
    }
}

function renderBemestar() {
    updateWaterUI(); updateSleepUI();
    if (!state.isFocusing && state.focusTime === 0) {
        const m = focusTodayMin();
        $('focus-text').innerText = m ? `Hoje você já focou ${m} min. Pressione iniciar para mais 5.` : 'Pressione iniciar para focar por 5 minutos.';
        $('focus-bar').style.width = '0%'; $('btn-focus').innerText = 'Iniciar';
    }
}

/* ================= CHAT DA AYA (conversa + mensagem) ================= */
const AYA_GREETING = `Olá! Eu sou a <strong>Aya</strong>, sua assistente. 🌸<br><br>Digite "dica" para foco, "água" para lembrar de se hidratar ou pergunte sobre suas tarefas, hábitos e metas.<br><br><i>(Psst... há um segredo escondido aqui. Tente digitar "flow")</i>`;
const fmtMsg = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
const RISCO = ['me matar', 'suicid', 'quero morrer', 'não quero mais viver', 'nao quero mais viver', 'me machucar', 'automutila', 'acabar com tudo', 'sumir para sempre'];
const detectRisco = t => RISCO.some(k => t.toLowerCase().includes(k));

function appendMsg(role, html) {
    const box = $('chat-messages');
    const d = document.createElement('div');
    d.className = 'message ' + (role === 'user' ? 'user' : 'aya');
    d.innerHTML = `<div class="msg-bubble">${html}</div>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function loadConversa() {
    const abertas = DB.where('conversa', c => c.id_estudante === uid() && !c.encerrada_em);
    state.conversa = abertas.length ? abertas[abertas.length - 1] : null;
    $('chat-messages').innerHTML = '';
    appendMsg('aya', AYA_GREETING);
    if (state.conversa) {
        DB.where('mensagem', m => m.id_conversa === state.conversa.id_conversa && m.papel !== 'system')
            .forEach(m => appendMsg(m.papel, fmtMsg(m.conteudo)));
    }
}

function ensureConversa(primeiraMsg) {
    if (!state.conversa) {
        state.conversa = DB.insert('conversa', {
            id_estudante: uid(), titulo: primeiraMsg.slice(0, 60), contexto: { origem: 'frontend_demo' },
            iniciada_em: fmtTs(new Date()), encerrada_em: null
        });
    }
    return state.conversa;
}

function saveMsg(papel, conteudo, risco) {
    DB.insert('mensagem', {
        id_conversa: state.conversa.id_conversa, papel, conteudo, tokens: null,
        modelo_usado: papel === 'assistant' ? 'aya-demo-local' : null, risco_detectado: !!risco, criada_em: fmtTs(new Date())
    });
}

function handleEnter(e) { if (e.key === 'Enter') sendMessage(); }

function sendMessage() {
    const input = $('chat-input');
    const text = input.value.trim();
    if (text === '' || !state.user) return;

    ensureConversa(text);
    const risco = detectRisco(text);
    saveMsg('user', text, risco);
    appendMsg('user', esc(text));
    input.value = '';

    $('screen-aya').classList.add('aya-typing');

    setTimeout(() => {
        let response = '';
        const lowerText = text.toLowerCase();

        // ---- INÍCIO DO EASTER EGG ----
        if (lowerText === 'flow' || lowerText === 'segredo') {
            response = `🌟 **Você encontrou o Modo Turbo!** 🌟\n\nAs cores da tela vão girar por 10 segundos. Aproveite!`;

            document.body.classList.add('turbo-active');
            $('navbar').classList.add('turbo');
            $('aya-face').innerText = '🤯';

            setTimeout(() => {
                document.body.classList.remove('turbo-active');
                $('navbar').classList.remove('turbo');
                $('aya-face').innerText = '✨';
            }, 10000);
        }
        // ---- FIM DO EASTER EGG ----
        else if (risco) {
            response = 'Sinto muito que você esteja passando por isso, e fico feliz que tenha me contado. 💜 Você não precisa lidar com isso sozinho(a).\n\nSe estiver em perigo agora, ligue **192 (SAMU)** ou **190**. O **CVV** atende 24h, de graça, pelo **188** (ou pelo chat em cvv.org.br).\n\nSe puder, fale também hoje com alguém de confiança: um familiar, professor ou colega. Eu continuo aqui com você.';
        } else if (lowerText.includes('dica') || lowerText.includes('foco')) {
            response = 'Uma ótima dica de foco é a Técnica Pomodoro: estude por 25 minutos e descanse 5. Quer que eu inicie o timer na aba de Bem-estar?';
        } else if (lowerText.includes('água') || lowerText.includes('agua') || lowerText.includes('beber')) {
            response = `A hidratação é fundamental para o cérebro! Hoje você bebeu ${waterToday() / 1000}L de 2L. Vá até a aba Bem-estar e registre mais 250ml. 💧`;
        } else if (/tarefa|agenda|compromisso/.test(lowerText)) {
            const ab = minhasTarefas().filter(c => c.status === 'pendente' || c.status === 'em_andamento');
            const urg = ab.filter(c => c.prioridade === 'urgente' || c.prioridade === 'alta').length;
            response = ab.length ? `Você tem **${ab.length}** tarefa(s) em aberto${urg ? `, sendo **${urg}** de prioridade alta ou urgente` : ''}. Comece pela mais urgente e vá marcando o status conforme avança!` : 'Você não tem tarefas em aberto. Quer criar uma agora na aba Tarefas?';
        } else if (/h[áa]bito|rotina|sequ[êe]ncia/.test(lowerText)) {
            const hs = meusHabitos().filter(c => habitDays(c).includes(isoDow(new Date())));
            const feitos = hs.filter(c => checkinOf(c, todayStr())).length;
            response = hs.length ? `Hoje você completou **${feitos} de ${hs.length}** hábitos. ${feitos === hs.length ? 'Tudo certo, parabéns!' : 'Falta pouco, bora manter a sequência!'}` : 'Você ainda não tem hábitos para hoje. Que tal criar um bem pequeno na aba Hábitos?';
        } else if (/meta|objetivo/.test(lowerText)) {
            const ms = DB.where('meta', m => m.id_estudante === uid() && m.status === 'ativa');
            response = ms.length ? `Você tem **${ms.length}** meta(s) ativa(s). Dica: vincule tarefas a cada meta para o progresso ser calculado automaticamente.` : 'Você ainda não tem metas. Criar uma dá direção para as tarefas!';
        } else if (lowerText.includes('estudo') || lowerText.includes('matéria') || lowerText.includes('prova')) {
            response = 'Para os estudos, recomendo revisar as tarefas da categoria Estudo que ainda estão em aberto. Quer que eu te ajude a fazer um cronograma?';
        } else if (/(^|\s)(oi|olá|ola|bom dia|boa tarde|boa noite)(\s|[!.,?]|$)/.test(lowerText)) {
            response = `Olá, ${state.user.nome}! Como estão seus estudos hoje? Estou aqui para ajudar no que precisar. 🌸`;
        } else {
            response = 'Entendi! Como uma IA de demonstração, ainda estou aprendendo. Mas posso te ajudar com dicas de foco, água, tarefas, hábitos e metas. O que acha?';
        }

        saveMsg('assistant', response, false);
        $('screen-aya').classList.remove('aya-typing');
        appendMsg('aya', fmtMsg(response));
    }, 900);
}

/* ================= INICIALIZAÇÃO ================= */
DB.init();
const savedUser = DB.d.session ? DB.get('estudante', DB.d.session) : null;
if (savedUser) startSession(savedUser); else navTo('screen-login');

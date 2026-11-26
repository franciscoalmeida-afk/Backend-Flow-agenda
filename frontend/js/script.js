/* =====================================================================
   Flow Agendas - script.js (Integrado com API FastAPI + Supabase)
   ===================================================================== */

const API_URL = 'http://127.0.0.1:8000';

/* =====================================================================
   1. BANCO LOCAL AUXILIAR (LEMBRETES E SESSÃO)
   ===================================================================== */
const PK = {
    instituicao: 'id_instituicao',
    curso: 'id_curso',
    estudante: 'id_estudante',
    categoria: 'id_categoria',
    compromisso: 'id_compromisso',
    recorrencia: 'id_recorrencia',
    bloco_descompressao: 'id_bloco',
    meta: 'id_meta',
    habito_checkin: 'id_checkin',
    jornada_trabalho: 'id_jornada',
    lembrete: 'id_lembrete'
};
const TABLES = Object.keys(PK).concat(['recorrencia_dia', 'jornada_dia']);

const DB = {
    KEY: 'flow_agendas_db_v2',
    d: null,

    init() {
        let raw = null;
        try {
            raw = localStorage.getItem(this.KEY);
        } catch (e) {}

        try {
            this.d = raw ? JSON.parse(raw) : null;
        } catch (e) {
            this.d = null;
        }

        if (!this.d) {
            this.d = { seq: {}, session: null };
        }

        for (const tabela of TABLES) {
            if (!this.d[tabela]) {
                this.d[tabela] = [];
            }
        }
        this.save();
    },

    save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(this.d));
        } catch (e) {}
    },

    insert(tabela, linha) {
        const chave = PK[tabela];
        if (chave) {
            this.d.seq[tabela] = (this.d.seq[tabela] || 0) + 1;
            linha[chave] = this.d.seq[tabela];
        }
        this.d[tabela].push(linha);
        this.save();
        return linha;
    },

    where(tabela, filtro) {
        return this.d[tabela].filter(filtro);
    },

    find(tabela, filtro) {
        return this.d[tabela].find(filtro);
    },

    get(tabela, id) {
        return this.d[tabela].find(r => r[PK[tabela]] === id);
    },

    update(tabela, id, dados) {
        const registro = this.get(tabela, id);
        if (registro) {
            Object.assign(registro, dados);
            this.save();
        }
        return registro;
    }
};

/* =====================================================================
   2. FUNÇÕES UTILITÁRIAS (DATAS, TEXTOS, ÍCONES E AVISOS)
   ===================================================================== */
function $(id) {
    return document.getElementById(id);
}

function esc(texto) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, c => mapa[c]);
}

function pad(numero) {
    return String(numero).padStart(2, '0');
}

function fmtDate(data) {
    return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function fmtTs(data) {
    return `${fmtDate(data)}T${pad(data.getHours())}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
}

function toInput(data) {
    return `${fmtDate(data)}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function todayStr() {
    return fmtDate(new Date());
}

function isoDow(data) {
    return data.getDay() === 0 ? 7 : data.getDay();
}

function startOfDay(data) {
    const copia = new Date(data);
    copia.setHours(0, 0, 0, 0);
    return copia;
}

function dayDiff(data) {
    return Math.round((startOfDay(data) - startOfDay(new Date())) / 86400000);
}

function fmtBR(dataStr) {
    return dataStr.split('-').reverse().join('/');
}

function fmtL(ml) {
    return `${(ml / 1000).toLocaleString('pt-BR')} L`;
}

function fmtH(horas) {
    return `${String(horas).replace('.', ',')} h`;
}

function plural(qtd, singular, pluralTxt) {
    return qtd === 1 ? singular : pluralTxt;
}

function hhmm(horaStr) {
    const partes = horaStr.split(':');
    return Number(partes[0]) + Number(partes[1]) / 60;
}

function hOf(data) {
    return data.getHours() + data.getMinutes() / 60;
}

const WATER_TITLE = 'Beber água (meta diária)';

const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    ban: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

function toast(msg, type, ms) {
    const aviso = document.createElement('div');
    aviso.className = 'toast ' + (type || 'ok');
    aviso.setAttribute('role', 'status');
    const icone = type === 'err' ? '!' : type === 'bell' ? ICON.bell : ICON.check;
    aviso.innerHTML = `<span class="ti">${icone}</span><span>${esc(msg)}</span>`;
    $('toast-wrap').appendChild(aviso);
    setTimeout(() => aviso.remove(), ms || 3600);
}

async function sha256(txt) {
    try {
        if (window.crypto && crypto.subtle) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {}

    let h = 5381;
    for (const c of txt) {
        h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
    }
    return 'weak-' + h.toString(16);
}

/* =====================================================================
   3. ESTADO GLOBAL DA APLICAÇÃO E SINCRONIZAÇÃO COM API
   ===================================================================== */
let state = {
    user: null,
    focusTime: 0,
    focusSaved: 0,
    focusTarget: 300,
    focusInterval: null,
    isFocusing: false,
    tarefaFilter: 'aberto'
};

let compromissosCache = [];
let metasCache = [];
let categoriasCache = [];
let jornadasCache = [];
let abaEstudoAtual = null;

function uid() {
    return state.user ? state.user.id_estudante : null;
}

function catById(id) {
    return categoriasCache.find(c => c.id_categoria === id) || DB.get('categoria', id);
}

function isOpen(c) {
    return c.status === 'pendente' || c.status === 'em_andamento';
}

async function syncCompromissos() {
    try {
        const res = await fetch(`${API_URL}/compromissos`);
        if (res.ok) {
            compromissosCache = await res.json();
        }
    } catch (e) {}
    return compromissosCache;
}

async function syncMetas() {
    if (!state.user) return [];
    try {
        const res = await fetch(`${API_URL}/metas/${uid()}`);
        if (res.ok) {
            metasCache = await res.json();
        }
    } catch (e) {}
    return metasCache;
}

async function syncJornadas() {
    if (!state.user) return [];
    try {
        const res = await fetch(`${API_URL}/jornadas`);
        if (res.ok) {
            const todas = await res.json();
            jornadasCache = todas.filter(j => j.id_estudante === uid());
        }
    } catch (e) {}
    return jornadasCache;
}

function setUserUI() {
    const nome = state.user ? state.user.nome : 'Aluno';
    document.querySelectorAll('.js-username').forEach(el => {
        el.textContent = nome;
    });
    document.querySelectorAll('.js-avatar').forEach(el => {
        el.textContent = nome.charAt(0).toUpperCase();
    });
}

/* =====================================================================
   4. NAVEGAÇÃO ENTRE TELAS
   ===================================================================== */
const SCREEN_RENDER = {
    'screen-menu': () => renderDashboard(),
    'screen-tarefas': () => renderTarefas(),
    'screen-estudos': () => renderEstudos(),
    'screen-habitos': () => renderHabitos(),
    'screen-metas': () => renderMetas(),
    'screen-bemestar': () => renderBemestar(),
    'screen-categorias': () => renderCategorias(),
    'screen-config': () => renderConfig()
};

function navTo(screenId, navId) {
    const isPublic = (screenId === 'screen-login' || screenId === 'screen-cadastro');
    if (!state.user && !isPublic) {
        screenId = 'screen-login';
        navId = null;
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = $(screenId);
    if (target) {
        if (SCREEN_RENDER[screenId]) {
            SCREEN_RENDER[screenId]();
        }
        target.classList.add('active');
    }

    $('app').classList.toggle('public', isPublic);

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
    });

    if (!isPublic && navId && $(navId)) {
        $(navId).classList.add('active');
        $(navId).setAttribute('aria-current', 'page');
    }

    window.scrollTo(0, 0);
}

/* =====================================================================
   5. TELAS DE LOGIN E CADASTRO
   ===================================================================== */
async function doLogin() {
    const email = $('login-email').value.trim().toLowerCase();
    const pass = $('login-pass').value;
    if (!email || !pass) {
        toast('Informe e-mail e senha.', 'err');
        return;
    }

    try {
        const hash = await sha256(pass);
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, senha_hash: hash })
        });
        if (res.ok) {
            const usuario = await res.json();
            $('login-pass').value = '';
            startSession(usuario);
        } else {
            const err = await res.json();
            toast(err.detail || 'E-mail ou senha incorretos.', 'err');
        }
    } catch (error) {
        toast('Servidor offline. Verifique o backend.', 'err');
    }
}

async function doCadastro() {
    const nome = $('cad-nome').value.trim();
    const email = $('cad-email').value.trim().toLowerCase();
    const senha = $('cad-senha').value;
    const nasc = $('cad-nasc').value.trim();
    const instId = $('cad-inst-id').value;
    const cursoId = $('cad-curso').value;

    if (!nome || !email || !senha || !nasc) {
        toast('Preencha todos os campos.', 'err');
        return;
    }
    if (!instId) {
        toast('Escolha sua escola na lista de busca.', 'err');
        return;
    }
    if (!cursoId) {
        toast('Escolha o seu curso ou ensino regular.', 'err');
        return;
    }
    if (senha.length < 6) {
        toast('A senha precisa ter ao menos 6 caracteres.', 'err');
        return;
    }

    try {
        const senhaHash = await sha256(senha);
        const resEst = await fetch(`${API_URL}/estudantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        if (!resEst.ok) {
            toast('Erro no cadastro: ' + JSON.stringify(estData), 'err');
            return;
        }

        toast('Conta criada. Bem-vindo(a) ao Flow.');
        $('form-cadastro').reset();
        $('cad-inst-id').value = '';
        resetCursos();
        startSession(estData);
    } catch (e) {
        toast('Erro de rede. Verifique o backend.', 'err');
    }
}

function startSession(usuario) {
    state.user = usuario;
    abaEstudoAtual = usuario.ano_escolar || '1_ano';
    DB.d.session = usuario.id_estudante;
    DB.save();
    setUserUI();
    checkLembretes();
    navTo('screen-menu', 'nav-dashboard');
}

function logout() {
    if (state.isFocusing) {
        clearInterval(state.focusInterval);
        state.isFocusing = false;
        saveFocus();
    }
    state.user = null;
    state.focusTime = 0;
    state.focusSaved = 0;
    abaEstudoAtual = null;
    compromissosCache = [];
    metasCache = [];
    categoriasCache = [];
    jornadasCache = [];
    DB.d.session = null;
    DB.save();
    navTo('screen-login');
}

/* =====================================================================
   6. TELA DE AJUSTES, PERFIL E MODAIS GERAIS
   ===================================================================== */
function updateName(newName) {
    if (newName.trim() === '' || !state.user) return;
    state.user.nome = newName.trim();
    setUserUI();
}

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
        const inst = todasInst.find(x => x.id_instituicao == u.id_instituicao);
        $('config-inst').value = inst ? `${inst.nome} (${inst.cidade}/${inst.uf})` : 'Não cadastrada';

        if (u.id_curso) {
            const resCurso = await fetch(`${API_URL}/cursos`);
            const todosCursos = await resCurso.json();
            const curso = todosCursos.find(x => x.id_curso == u.id_curso);
            $('config-curso').value = curso ? `${curso.nome} (${curso.turno}, ${curso.duracao_semestres} semestres)` : 'Não cadastrado';
        } else {
            $('config-curso').value = 'Ensino regular (sem curso técnico)';
        }
    } catch (e) {
        $('config-inst').value = 'Erro ao carregar';
        $('config-curso').value = 'Erro ao carregar';
    }
}

function saveConfig() {
    if (!state.user) return;
    state.user.ano_escolar = $('config-ano').value;
    state.user.turno_escolar = $('config-turno').value;
    abaEstudoAtual = state.user.ano_escolar || '1_ano';
    toast('Ajustes salvos.');
}

function openModal(id) {
    $(id).classList.add('open');
    const campo = $(id).querySelector('input[type=text], input[type=time]');
    if (campo) {
        setTimeout(() => campo.focus(), 60);
    }
}

function closeModal(id) {
    $(id).classList.remove('open');
    if (id === 'modal-conteudo' && $('conteudo-media')) {
        $('conteudo-media').innerHTML = '';
    }
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.overlay.open').forEach(m => closeModal(m.id));
    }
});

/* =====================================================================
   7. JORNADA DE TRABALHO (DENTRO DA TELA AJUSTES E LINHA DO DIA)
   ===================================================================== */
const TIPO_JORNADA = { aprendiz: 'Aprendiz', estagiario: 'Estagiário(a)' };

function jornadaCarga() {
    const inicio = $('j-inicio').value;
    const fim = $('j-fim').value;
    if (!inicio || !fim) return null;
    return Math.round((hhmm(fim) - hhmm(inicio)) * 100) / 100;
}

function updateCarga() {
    const carga = jornadaCarga();
    if (carga === null) {
        $('j-carga').textContent = 'Informe o início e o fim.';
    } else if (carga <= 0) {
        $('j-carga').textContent = 'O fim precisa ser depois do início.';
    } else if (carga > 8) {
        $('j-carga').textContent = `${fmtH(carga)} por dia passa do limite de 8 h.`;
    } else {
        $('j-carga').textContent = `Carga diária de ${fmtH(carga)}.`;
    }
}

function openJornada() {
    $('form-jornada').reset();
    $('j-inicio').value = '08:00';
    $('j-fim').value = '14:00';
    $('j-vig-ini').value = todayStr();
    document.querySelectorAll('#j-dias .day-chip').forEach((btn, idx) => {
        btn.classList.toggle('on', idx < 5);
    });
    updateCarga();
    openModal('modal-jornada');
}

async function saveJornada() {
    const empresa = $('j-empresa').value.trim();
    if (!empresa) {
        toast('Informe o nome da empresa.', 'err');
        return;
    }
    const carga = jornadaCarga();
    if (carga === null || carga <= 0) {
        toast('O fim precisa ser depois do início.', 'err');
        return;
    }
    if (carga > 8) {
        toast('A carga diária não pode passar de 8 horas.', 'err');
        return;
    }

    const dias = [];
    document.querySelectorAll('#j-dias .day-chip.on').forEach(btn => {
        dias.push(parseInt(btn.dataset.d, 10));
    });
    if (!dias.length) {
        toast('Escolha ao menos um dia da semana.', 'err');
        return;
    }

    const vi = $('j-vig-ini').value;
    const vf = $('j-vig-fim').value || null;
    if (!vi) {
        toast('Informe quando a jornada começa.', 'err');
        return;
    }
    if (vf && vf < vi) {
        toast('O fim da vigência não pode ser antes do início.', 'err');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/jornadas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_estudante: uid(),
                tipo: $('j-tipo').value,
                empresa: empresa,
                hora_inicio: $('j-inicio').value,
                hora_fim: $('j-fim').value,
                carga_horaria_diaria: carga,
                vigencia_inicio: vi,
                vigencia_fim: vf
            })
        });
        const data = await res.json();
        if (!res.ok) {
            toast('Erro ao salvar jornada: ' + data.detail, 'err');
            return;
        }

        for (const dia of dias) {
            await fetch(`${API_URL}/jornada_dia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_jornada: data.id_jornada, dia_semana: dia })
            });
        }

        closeModal('modal-jornada');
        toast('Jornada salva.');
        renderJornadas();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
}

async function deleteJornada(id) {
    if (!confirm('Excluir esta jornada?')) return;
    try {
        await fetch(`${API_URL}/jornadas/${id}`, { method: 'DELETE' });
        toast('Jornada excluída.');
        renderJornadas();
    } catch (e) {
        toast('Erro ao excluir.', 'err');
    }
}

async function renderJornadas() {
    const box = $('jornada-list');
    if (!box) return;
    try {
        const res = await fetch(`${API_URL}/jornadas`);
        const todas = await res.json();
        const minhas = todas.filter(j => j.id_estudante === uid());
        if (!minhas.length) {
            box.innerHTML = '<p class="muted">Nenhuma jornada cadastrada.</p>';
            return;
        }
        const itens = minhas.map(j => `
            <li class="jrow">
                <div class="jmain">
                    <strong>${TIPO_JORNADA[j.tipo]} em ${esc(j.empresa)}</strong>
                    <span>${j.hora_inicio.slice(0, 5)} às ${j.hora_fim.slice(0, 5)}</span>
                    <span>${fmtH(j.carga_horaria_diaria)} por dia</span>
                </div>
                <button class="ib del" onclick="deleteJornada(${j.id_jornada})">${ICON.trash}</button>
            </li>
        `).join('');
        box.innerHTML = `<ul class="list">${itens}</ul>`;
    } catch (e) {
        box.innerHTML = 'Erro ao carregar jornadas.';
    }
}

/* =====================================================================
   8. TELA DE TAREFAS E LEMBRETES
   ===================================================================== */
function fmtAntec(m) {
    if (m === 0) return 'no horário';
    if (m < 60) return `${m} min antes`;
    if (m < 1440) return `${m / 60} h antes`;
    return `${m / 1440} dia antes`;
}

function checkLembretes() {
    if (!state.user) return;
    const agora = fmtTs(new Date());
    const pendentes = DB.where('lembrete', l => l.id_estudante === uid() && !l.enviado && l.data_hora <= agora);
    for (const l of pendentes) {
        const comp = l.id_compromisso ? compromissosCache.find(x => x.id_compromisso === l.id_compromisso) : null;
        DB.update('lembrete', l.id_lembrete, { enviado: true });
        if (!comp || isOpen(comp)) {
            toast(l.mensagem, 'bell', 10000);
        }
    }
}

function minhasTarefas() {
    return compromissosCache.filter(c => c.id_estudante === uid() && c.origem === 'manual');
}

async function openTarefa(idMeta) {
    $('form-tarefa').reset();
    await Promise.all([carregarCategoriasNoForm('tarefa-categoria', 'Estudo'), syncMetas()]);
    const metasAtivas = metasCache.filter(m => m.status === 'ativa');
    const opcoesMeta = metasAtivas.map(m => `<option value="${m.id_meta}" ${Number(m.id_meta) === Number(idMeta) ? 'selected' : ''}>${esc(m.titulo)}</option>`).join('');
    $('tarefa-meta').innerHTML = '<option value="">Nenhuma</option>' + opcoesMeta;

    const inicio = new Date();
    inicio.setMinutes(0, 0, 0);
    inicio.setHours(inicio.getHours() + 1);
    const fim = new Date(inicio);
    fim.setHours(fim.getHours() + 1);

    $('tarefa-inicio').value = toInput(inicio);
    $('tarefa-fim').value = toInput(fim);
    openModal('modal-tarefa');
}

async function saveTarefa() {
    const titulo = $('tarefa-titulo').value.trim();
    if (!titulo) {
        toast('Dê um título à tarefa.', 'err');
        return;
    }

    const inicio = new Date($('tarefa-inicio').value);
    const fim = new Date($('tarefa-fim').value);
    if (isNaN(inicio) || isNaN(fim)) {
        toast('Informe início e fim.', 'err');
        return;
    }

    const diaInteiro = $('tarefa-dia-inteiro').checked;
    if (diaInteiro) {
        inicio.setHours(0, 0, 0, 0);
        fim.setHours(23, 59, 59, 0);
    }
    if (!(fim > inicio)) {
        toast('O fim precisa ser depois do início.', 'err');
        return;
    }

    const rawMeta = $('tarefa-meta').value;
    const idMeta = rawMeta ? parseInt(rawMeta, 10) : null;

    const payload = {
        id_estudante: uid(),
        id_categoria: parseInt($('tarefa-categoria').value, 10),
        id_meta: idMeta,
        titulo: titulo,
        descricao: $('tarefa-descricao').value.trim() || null,
        data_inicio: fmtTs(inicio),
        data_fim: fmtTs(fim),
        dia_inteiro: diaInteiro,
        local: $('tarefa-local').value.trim() || null,
        prioridade: $('tarefa-prioridade').value,
        status: 'pendente',
        origem: 'manual'
    };

    try {
        const res = await fetch(`${API_URL}/compromissos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            const msg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data);
            toast('Erro ao salvar a tarefa: ' + msg, 'err');
            return;
        }

        const ant = $('tarefa-lembrete').value;
        if (ant !== '') {
            const minutos = parseInt(ant, 10);
            DB.insert('lembrete', {
                id_estudante: uid(),
                id_compromisso: data.id_compromisso,
                canal: 'in_app',
                antecedencia_min: minutos,
                enviado: false,
                data_hora: fmtTs(new Date(inicio.getTime() - minutos * 60000)),
                mensagem: `${titulo} ${minutos === 0 ? 'começa agora' : 'começa em ' + fmtAntec(minutos).replace(' antes', '')}`
            });
        }

        closeModal('modal-tarefa');
        toast('Tarefa adicionada.');
        await syncCompromissos();
        if (idMeta) {
            await recalcMetaFromTasks(idMeta);
        }
        await refreshAfterChange();
        checkLembretes();
    } catch (e) {
        toast('Erro de rede. Verifique o backend.', 'err');
    }
}

const STATUS_LABEL = { pendente: 'Pendente', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
const STATUS_NEXT = { pendente: 'em_andamento', em_andamento: 'concluido', concluido: 'pendente' };
const PRIO_LABEL = { baixa: 'Prioridade baixa', media: 'Média', alta: 'Prioridade alta', urgente: 'Urgente' };

function fmtRange(c) {
    const a = new Date(c.data_inicio);
    const b = new Date(c.data_fim);
    const dia = a.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    if (c.dia_inteiro) return dia + ', dia inteiro';
    const hora = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (fmtDate(a) === fmtDate(b)) return `${dia}, ${hora(a)} às ${hora(b)}`;
    return `${dia} ${hora(a)} até ${b.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} ${hora(b)}`;
}

function taskRow(c, compact) {
    const cat = c.categoria || catById(c.id_categoria) || { nome: '?', cor_hex: '#8E8999' };
    const meta = c.id_meta ? metasCache.find(m => m.id_meta === c.id_meta) : null;
    const lem = DB.find('lembrete', l => l.id_compromisso === c.id_compromisso);
    const done = c.status === 'concluido';
    const cancel = c.status === 'cancelado';
    const late = isOpen(c) && new Date(c.data_fim) < new Date();

    const bits = [`<span>${esc(fmtRange(c))}</span>`];
    if (c.local) bits.push(`<span>${esc(c.local)}</span>`);
    bits.push(`<span class="dotname"><i></i>${esc(cat.nome)}</span>`);
    if (c.prioridade !== 'media') bits.push(`<span class="prio p-${c.prioridade}">${PRIO_LABEL[c.prioridade]}</span>`);
    if (meta && !compact) bits.push(`<span class="goal-tag">Meta: ${esc(meta.titulo)}</span>`);
    if (lem && !compact) bits.push(`<span class="bell">${ICON.bell}${esc(fmtAntec(lem.antecedencia_min))}</span>`);
    if (late) bits.push('<span class="late">Atrasada</span>');

    let actions = '';
    if (!compact) {
        if (cancel) {
            actions = `<div class="task-actions"><button class="status s-cancelado" onclick="setTarefaStatus(${c.id_compromisso}, 'pendente')">Reativar</button><button class="ib del" onclick="deleteTarefa(${c.id_compromisso})">${ICON.trash}</button></div>`;
        } else {
            actions = `<div class="task-actions"><button class="status s-${c.status}" onclick="cycleTarefa(${c.id_compromisso})">${STATUS_LABEL[c.status]}</button><button class="ib" onclick="setTarefaStatus(${c.id_compromisso}, 'cancelado')">${ICON.ban}</button><button class="ib del" onclick="deleteTarefa(${c.id_compromisso})">${ICON.trash}</button></div>`;
        }
    }

    return `
        <li class="task ${done ? 'is-done' : ''} ${cancel ? 'is-cancel' : ''}" style="--cat:${esc(cat.cor_hex)}">
            <button class="tick" role="checkbox" aria-checked="${done}" ${cancel ? 'disabled' : ''} onclick="toggleTarefaDone(${c.id_compromisso})">${ICON.check}</button>
            <div class="task-body">
                <div class="task-title">${esc(c.titulo)}</div>
                ${c.descricao && !compact ? `<div class="task-desc">${esc(c.descricao)}</div>` : ''}
                <div class="task-meta">${bits.join('')}</div>
            </div>
            ${actions}
        </li>
    `;
}

async function renderTarefas() {
    const list = $('subject-list');
    if (!list) return;
    const filtro = state.tarefaFilter;

    try {
        await Promise.all([syncCompromissos(), syncMetas()]);
    } catch (e) {
        list.innerHTML = '<div class="empty"><strong>Não foi possível carregar as tarefas</strong><p>Verifique se o servidor está ligado.</p></div>';
        return;
    }
    if (state.tarefaFilter !== filtro) return;

    const rows = compromissosCache
        .filter(c => c.id_estudante === uid() && c.origem === 'manual')
        .filter(c => filtro === 'aberto' ? isOpen(c) : c.status === filtro);

    rows.sort((x, y) => filtro === 'aberto' ? x.data_inicio.localeCompare(y.data_inicio) : y.data_inicio.localeCompare(x.data_inicio));

    if (!rows.length) {
        const mensagens = {
            aberto: ['Nenhuma tarefa em aberto', 'Crie a primeira para ela aparecer na linha do dia.'],
            concluido: ['Nada concluído ainda', 'As tarefas que você marcar como feitas ficam aqui.'],
            cancelado: ['Nenhuma tarefa cancelada', 'As que você cancelar ficam aqui, caso mude de ideia.']
        };
        const msg = mensagens[filtro];
        const btnNova = filtro === 'aberto' ? `<button class="btn" onclick="openTarefa()">${ICON.plus}Nova tarefa</button>` : '';
        list.innerHTML = `<div class="empty"><strong>${msg[0]}</strong><p>${msg[1]}</p>${btnNova}</div>`;
        return;
    }

    if (filtro !== 'aberto') {
        list.innerHTML = `<ul class="list panel">${rows.map(c => taskRow(c)).join('')}</ul>`;
        return;
    }

    const now = new Date();
    const order = ['Atrasadas', 'Hoje', 'Amanhã', 'Próximos 7 dias', 'Mais adiante'];
    const groups = {};

    for (const c of rows) {
        const dd = dayDiff(new Date(c.data_inicio));
        let grupo = 'Mais adiante';
        if (new Date(c.data_fim) < now) grupo = 'Atrasadas';
        else if (dd <= 0) grupo = 'Hoje';
        else if (dd === 1) grupo = 'Amanhã';
        else if (dd <= 7) grupo = 'Próximos 7 dias';

        if (!groups[grupo]) groups[grupo] = [];
        groups[grupo].push(c);
    }

    list.innerHTML = order
        .filter(g => groups[g])
        .map(g => `<section class="group"><h3 class="group-h ${g === 'Atrasadas' ? 'is-late' : ''}">${g}<span>${groups[g].length}</span></h3><ul class="list panel">${groups[g].map(c => taskRow(c)).join('')}</ul></section>`)
        .join('');
}

function cycleTarefa(id) {
    const c = compromissosCache.find(x => x.id_compromisso === id);
    if (c && STATUS_NEXT[c.status]) {
        setTarefaStatus(id, STATUS_NEXT[c.status]);
    }
}

function toggleTarefaDone(id) {
    const c = compromissosCache.find(x => x.id_compromisso === id);
    if (c) {
        setTarefaStatus(id, c.status === 'concluido' ? 'pendente' : 'concluido');
    }
}

async function setTarefaStatus(id, st) {
    let c = compromissosCache.find(x => x.id_compromisso === id);
    if (!c) {
        await syncCompromissos();
        c = compromissosCache.find(x => x.id_compromisso === id);
    }
    if (!c) return;

    const payload = {
        id_estudante: c.id_estudante,
        id_categoria: c.id_categoria,
        id_meta: c.id_meta || null,
        titulo: c.titulo,
        descricao: c.descricao || null,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        dia_inteiro: !!c.dia_inteiro,
        local: c.local || null,
        prioridade: c.prioridade || 'media',
        status: st,
        origem: c.origem || 'manual'
    };

    try {
        const res = await fetch(`${API_URL}/compromissos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            toast('Erro ao atualizar status da tarefa.', 'err');
            return;
        }
        if (st === 'concluido') {
            toast('Tarefa concluída!');
        }
        await syncCompromissos();
        if (c.id_meta) {
            await recalcMetaFromTasks(c.id_meta);
        }
        await refreshAfterChange();
    } catch (e) {
        toast('Erro de rede ao atualizar tarefa.', 'err');
    }
}

async function deleteTarefa(id) {
    if (!confirm('Excluir esta tarefa definitivamente?')) return;
    const c = compromissosCache.find(x => x.id_compromisso === id);
    const idMetaVinculada = c ? c.id_meta : null;

    try {
        const res = await fetch(`${API_URL}/compromissos/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            toast('Não foi possível excluir a tarefa.', 'err');
            return;
        }
        compromissosCache = compromissosCache.filter(x => x.id_compromisso !== id);
        toast('Tarefa excluída.');
        if (idMetaVinculada) {
            await recalcMetaFromTasks(idMetaVinculada);
        }
        await refreshAfterChange();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
}

function filterTarefas(type) {
    state.tarefaFilter = type;
    document.querySelectorAll('#screen-tarefas .tab').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
    });
    $('f-' + type).classList.add('active');
    $('f-' + type).setAttribute('aria-selected', 'true');
    renderTarefas();
}

async function refreshAfterChange() {
    await Promise.all([syncCompromissos(), syncMetas(), syncJornadas()]);
    await Promise.all([renderDashboard(), renderTarefas(), renderMetas(), renderHabitos()]);
}

/* =====================================================================
   9. TELA DE HÁBITOS
   ===================================================================== */
async function openHabito() {
    $('form-habito').reset();
    await carregarCategoriasNoForm('habito-categoria', 'Pessoal');
    document.querySelectorAll('#habito-dias .day-chip').forEach(b => b.classList.remove('on'));
    $('habito-dias-wrap').classList.add('hidden');
    openModal('modal-habito');
}

function toggleDiasHabito() {
    $('habito-dias-wrap').classList.toggle('hidden', $('habito-tipo').value !== 'semanal');
}

async function saveHabito() {
    const titulo = $('habito-titulo').value.trim();
    if (!titulo) {
        toast('Dê um nome ao hábito.', 'err');
        return;
    }
    const tipo = $('habito-tipo').value;
    const dias = [];
    document.querySelectorAll('#habito-dias .day-chip.on').forEach(b => {
        dias.push(parseInt(b.dataset.d, 10));
    });
    if (tipo === 'semanal' && !dias.length) {
        toast('Escolha ao menos um dia da semana.', 'err');
        return;
    }

    const s = new Date();
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setHours(23, 59, 59, 0);

    try {
        const res = await fetch(`${API_URL}/compromissos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_estudante: uid(),
                id_categoria: parseInt($('habito-categoria').value, 10),
                titulo: titulo,
                descricao: $('habito-descricao').value.trim() || null,
                data_inicio: fmtTs(s),
                data_fim: fmtTs(e),
                dia_inteiro: true,
                local: null,
                prioridade: 'media',
                status: 'pendente',
                origem: 'recorrencia'
            })
        });
        if (!res.ok) {
            toast('Erro ao criar hábito.', 'err');
            return;
        }
        closeModal('modal-habito');
        toast('Hábito criado.');
        renderHabitos();
        renderDashboard();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_compromisso: parseInt(id, 10), data: hoje, quantidade: 1 })
            });
            toast('Hábito marcado hoje!');
        }
        renderHabitos();
        renderDashboard();
    } catch (e) {}
}

async function deleteHabito(id) {
    if (!confirm('Excluir este hábito e todo o histórico dele?')) return;
    await fetch(`${API_URL}/compromissos/${id}`, { method: 'DELETE' });
    toast('Hábito excluído.');
    renderHabitos();
    renderDashboard();
}

async function renderHabitos() {
    const list = $('habit-list');
    if (!list) return;
    try {
        const res = await fetch(`${API_URL}/compromissos`);
        const todas = await res.json();
        const hs = todas.filter(c => c.id_estudante === uid() && c.origem === 'recorrencia' && c.status !== 'cancelado' && c.titulo !== WATER_TITLE);
        if (!hs.length) {
            list.innerHTML = `<div class="empty"><strong>Nenhum hábito ainda</strong><p>Comece com algo pequeno.</p><button class="btn green" onclick="openHabito()">${ICON.plus}Novo hábito</button></div>`;
            return;
        }

        const hoje = todayStr();
        const itensHTML = [];

        for (const c of hs) {
            const cat = c.categoria || catById(c.id_categoria) || { nome: '?', cor_hex: '#8E8999' };
            let marcadoHoje = false;
            let totalDias = 0;

            try {
                const resCheck = await fetch(`${API_URL}/checkins/${c.id_compromisso}`);
                if (resCheck.ok) {
                    const checks = await resCheck.json();
                    totalDias = checks.length;
                    marcadoHoje = checks.some(k => k.data === hoje);
                }
            } catch (e) {}

            itensHTML.push(`
                <li class="habit" style="--cat:${esc(cat.cor_hex)}">
                    <button class="tick big" role="checkbox" aria-checked="${marcadoHoje}" onclick="toggleCheckin(${c.id_compromisso})">${ICON.check}</button>
                    <div class="habit-body">
                        <div class="task-title">${esc(c.titulo)}</div>
                        <div class="task-meta">
                            <span>Rotina diária</span>
                            <span class="dotname"><i></i>${esc(cat.nome)}</span>
                        </div>
                    </div>
                    <div class="week">
                        <span class="d ${marcadoHoje ? 'done' : ''} today"><i></i><em>Hoje</em></span>
                    </div>
                    <div class="streak ${totalDias === 0 ? 'zero' : ''}">
                        <b>${totalDias}</b>
                        <span>${plural(totalDias, 'dia feito', 'dias feitos')}</span>
                    </div>
                    <button class="ib del" onclick="deleteHabito(${c.id_compromisso})">${ICON.trash}</button>
                </li>
            `);
        }

        list.innerHTML = `<ul class="list panel">${itensHTML.join('')}</ul>`;
    } catch (e) {
        list.innerHTML = 'Erro ao carregar hábitos.';
    }
}

/* =====================================================================
   10. TELA DE BEM-ESTAR (ÁGUA, SONO, FOCO E VÍDEO-AULAS)
   ===================================================================== */
function meterHTML(filled, total) {
    let html = '';
    for (let i = 0; i < total; i++) {
        html += `<i class="${i < filled ? 'on' : ''}"></i>`;
    }
    return html;
}

async function waterHabit(create) {
    try {
        const res = await fetch(`${API_URL}/compromissos`);
        const todos = await res.json();
        let c = todos.find(x => x.id_estudante === uid() && x.titulo === WATER_TITLE);
        if (!c && create) {
            const catId = await getValidCategoryId();
            if (!catId) return null;
            const s = new Date();
            s.setHours(0, 0, 0, 0);
            const e = new Date(s);
            e.setHours(23, 59, 59, 0);
            const r = await fetch(`${API_URL}/compromissos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_estudante: uid(),
                    id_categoria: catId,
                    titulo: WATER_TITLE,
                    data_inicio: fmtTs(s),
                    data_fim: fmtTs(e),
                    dia_inteiro: true,
                    origem: 'recorrencia',
                    prioridade: 'media',
                    status: 'pendente'
                })
            });
            if (!r.ok) return null;
            c = await r.json();
        }
        return c;
    } catch (e) {
        return null;
    }
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
    } catch (e) {
        return 0;
    }
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_compromisso: c.id_compromisso, data: hoje, quantidade: novoValor })
            });
            if (res.status === 409) {
                res = await fetch(`${API_URL}/checkins/${c.id_compromisso}/${hoje}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantidade: novoValor })
                });
            }
        } else {
            res = await fetch(`${API_URL}/checkins/${c.id_compromisso}/${hoje}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantidade: novoValor })
            });
        }
        if (res && res.ok) {
            await updateWaterUI();
        }
    } catch (e) {
        toast('Erro ao atualizar água.', 'err');
    } finally {
        waterBusy = false;
    }
}

async function addWater() {
    const cur = await waterToday();
    if (cur >= 2000) {
        toast('Meta diária de 2 L já atingida!');
        return;
    }
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
    if ($('water-pct')) {
        $('water-pct').textContent = `${Math.round((w / 2000) * 100)}%`;
    }
}

/* Salva blocos de Sono e Foco com origem 'semana_especial' para não misturar com Tarefas */
async function addBloco(tipo, titulo, minutos, concluidoQuando) {
    try {
        const catId = await getValidCategoryId();
        if (!catId) return;
        const s = new Date();
        const duracao = minutos > 0 ? minutos : 1;
        const e = new Date(s.getTime() + duracao * 60000);
        const res = await fetch(`${API_URL}/compromissos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_estudante: uid(),
                id_categoria: catId,
                titulo: titulo,
                data_inicio: fmtTs(s),
                data_fim: fmtTs(e),
                dia_inteiro: false,
                prioridade: 'media',
                status: duracao >= concluidoQuando ? 'concluido' : 'em_andamento',
                origem: 'semana_especial'
            })
        });
        if (!res.ok) return;
        const c = await res.json();
        await fetch(`${API_URL}/blocos_descompressao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_compromisso: c.id_compromisso,
                tipo: tipo,
                duracao_min: duracao,
                obrigatorio: false,
                sugestao_sistema: false
            })
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
    } catch (e) {
        return [];
    }
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
    if ($('sleep-pct')) {
        $('sleep-pct').textContent = `${Math.min(100, Math.round((horas / 8) * 100))}%`;
    }
}

async function updateFocusTodayUI() {
    if (!$('focus-today')) return;
    const blocos = await getBlocosHoje();
    const minFoco = blocos.filter(b => b.tipo === 'offline').reduce((acc, b) => acc + (b.duracao_min || 0), 0);
    $('focus-today').textContent = `${minFoco} min hoje`;
}

function setFocusPreset(minutos) {
    if (state.isFocusing) {
        toast('Pause o timer antes de trocar o tempo.', 'err');
        return;
    }
    state.focusTarget = minutos * 60;
    state.focusTime = 0;
    $('focus-clock').textContent = clock(state.focusTarget);
    $('focus-bar').style.width = '0%';
    $('focus-text').textContent = `Pronto para focar por ${minutos} minutos.`;
    document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('active', Number(b.dataset.min) === minutos);
    });
}

async function saveFocus() {
    if (state.focusTime >= 60) {
        const mins = Math.floor(state.focusTime / 60);
        await addBloco('offline', 'Foco e descompressão', mins, 1);
        state.focusTime = 0;
        await updateFocusTodayUI();
    }
}

function clock(segundos) {
    return `${pad(Math.floor(segundos / 60))}:${pad(segundos % 60)}`;
}

function toggleFocus() {
    const btn = $('btn-focus');
    const text = $('focus-text');
    const bar = $('focus-bar');
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
        id: 'vid-resp',
        cat: 'desestresse',
        tag: 'Vídeo-aula · Desestresse',
        duracao: '5 min',
        titulo: 'Respiração Guiada 4-7-8 para Ansiedade',
        resumo: 'Exercício prático para desacelerar os batimentos entre o trabalho e a aula.',
        youtubeId: 'aNXKjGFUlMs',
        passos: ['Inspire pelo nariz contando até 4.', 'Segure o ar contando até 7.', 'Expire devagar pela boca contando até 8.', 'Repita 4 ciclos antes de estudar.']
    },
    {
        id: 'vid-foco',
        cat: 'concentracao',
        tag: 'Vídeo-aula · Concentração',
        duracao: '6 min',
        titulo: 'Como Estudar Cansado: Blocos Curtos de Foco',
        resumo: 'Estratégia realista para jovens aprendizes e estagiários renderem sem esgotamento.',
        youtubeId: 'mNBmG24djoY',
        passos: ['Escolha apenas 1 matéria por bloco.', 'Use o timer de 15 ou 25 minutos acima.', 'Ao terminar, faça 5 minutos de pausa longe de telas.']
    },
    {
        id: 'vid-along',
        cat: 'desestresse',
        tag: 'Vídeo-aula · Corpo & Energia',
        duracao: '7 min',
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_documento: idDoc })
        });
        if (res.ok || res.status === 409) {
            toast('Guia registrado no seu histórico!');
            closeModal('modal-conteudo');
            await loadWellnessContent();
        }
    } catch (e) {
        toast('Erro ao registrar leitura.', 'err');
    }
}

async function loadWellnessContent() {
    let docsDb = [];
    const lidosIds = new Set();
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
        id: `doc-${d.id_documento}`,
        id_documento: d.id_documento,
        cat: d.tipo === 'conteudo_educativo' ? 'concentracao' : 'desestresse',
        tag: `Guia · ${d.tipo}`,
        duracao: 'Leitura rápida',
        titulo: d.titulo,
        resumo: `Fonte: ${d.fonte}`,
        youtubeId: null,
        lido: lidosIds.has(d.id_documento),
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

/* =====================================================================
   11. TELA DE METAS
   ===================================================================== */
function openMeta() {
    $('form-meta').reset();
    openModal('modal-meta');
}

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
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: m.titulo,
                descricao: m.descricao || null,
                prazo: m.prazo || null,
                progresso_manual: pct,
                status: novoStatus
            })
        });
    } catch (e) {}
}

async function setMetaProgress(id, valor) {
    let m = metasCache.find(x => x.id_meta === id);
    if (!m) {
        await syncMetas();
        m = metasCache.find(x => x.id_meta === id);
    }
    if (!m) return;
    const pct = Math.max(0, Math.min(100, Math.round(Number(valor) || 0)));
    const novoStatus = pct >= 100 ? 'concluida' : 'ativa';

    try {
        const res = await fetch(`${API_URL}/metas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: m.titulo,
                descricao: m.descricao || null,
                prazo: m.prazo || null,
                progresso_manual: pct,
                status: novoStatus
            })
        });
        if (res.ok) {
            if (pct === 100 && m.progresso_manual < 100) {
                toast('Meta atingiu 100%. Parabéns!');
            }
            await refreshAfterChange();
        } else {
            toast('Erro ao atualizar progresso da meta.', 'err');
        }
    } catch (e) {
        toast('Erro de rede ao atualizar meta.', 'err');
    }
}

async function adjustMetaProgress(id, delta) {
    let m = metasCache.find(x => x.id_meta === id);
    if (!m) {
        await syncMetas();
        m = metasCache.find(x => x.id_meta === id);
    }
    if (!m) return;
    await setMetaProgress(id, (m.progresso_manual || 0) + delta);
}

async function renderMetas() {
    const list = $('meta-list');
    if (!list) return;
    try {
        await Promise.all([syncMetas(), syncCompromissos()]);
    } catch (e) {
        list.innerHTML = '<div class="empty"><strong>Erro ao carregar metas</strong><p>Verifique o servidor.</p></div>';
        return;
    }

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

        return `
            <li class="goal ${fin ? 'is-done' : ''}">
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
            </li>
        `;
    }).join('') + '</ul>';
}

async function saveMeta() {
    const titulo = $('meta-titulo').value.trim();
    if (!titulo) {
        toast('Dê um nome à meta.', 'err');
        return;
    }
    try {
        const res = await fetch(`${API_URL}/metas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_estudante: uid(),
                titulo: titulo,
                descricao: $('meta-descricao').value.trim() || null,
                prazo: $('meta-prazo').value || null,
                progresso_manual: 0,
                status: 'ativa'
            })
        });
        if (!res.ok) {
            toast('Erro ao salvar meta.', 'err');
            return;
        }
        closeModal('modal-meta');
        toast('Meta criada.');
        await refreshAfterChange();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
}

async function deleteMeta(id) {
    if (!confirm('Excluir esta meta? As tarefas vinculadas continuam existindo.')) return;
    await fetch(`${API_URL}/metas/${id}`, { method: 'DELETE' });
    toast('Meta excluída.');
    await refreshAfterChange();
}

async function toggleMeta(id) {
    let m = metasCache.find(x => x.id_meta === id);
    if (!m) {
        await syncMetas();
        m = metasCache.find(x => x.id_meta === id);
    }
    if (!m) return;
    const isAtiva = m.status === 'ativa';
    try {
        const res = await fetch(`${API_URL}/metas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo: m.titulo,
                descricao: m.descricao || null,
                prazo: m.prazo || null,
                progresso_manual: isAtiva ? 100 : 0,
                status: isAtiva ? 'concluida' : 'ativa'
            })
        });
        if (res.ok) {
            toast(isAtiva ? 'Meta concluída. Parabéns!' : 'Meta reaberta.');
            await refreshAfterChange();
        }
    } catch (e) {
        toast('Erro ao atualizar meta.', 'err');
    }
}

/* =====================================================================
   12. TELA HOJE (DASHBOARD E LINHA DO TEMPO)
   ===================================================================== */
const RAIL_START = 6;
const RAIL_END = 24;
const ROW_H = 30;
const TURNO_AULA = {
    manha: [7, 12.5, 'manhã'],
    tarde: [13, 18, 'tarde'],
    noite: [19, 22.5, 'noite']
};

function railPct(hora) {
    return Math.max(0, Math.min(100, (hora - RAIL_START) / (RAIL_END - RAIL_START) * 100));
}

function blk(s, e, color, label, o) {
    o = o || {};
    const l = railPct(s);
    const r = railPct(e);
    if (r - l < 0.4) return '';
    return `<div class="blk ${o.cls || ''}" style="left:${l}%;width:${r - l}%;--c:${esc(color)};--row:${o.row || 0}" title="${esc(o.title || label)}"><span>${esc(label)}</span></div>`;
}

function renderRail() {
    const box = $('rail');
    if (!box || !state.user) return;
    const now = new Date();
    const ds = startOfDay(now);
    const de = new Date(ds.getTime() + 86400000);

    const ticks = [6, 9, 12, 15, 18, 21, 24]
        .map(h => `<span style="left:${railPct(h)}%">${h === 24 ? '0h' : h + 'h'}</span>`)
        .join('');

    const aula = TURNO_AULA[state.user.turno_escolar] || TURNO_AULA.manha;
    const escola = isoDow(now) <= 5
        ? blk(aula[0], aula[1], '#E25C84', `Aula da ${aula[2]}`, { cls: 'routine', title: `Aula da ${aula[2]} (horário estimado)` })
        : '<span class="lane-empty">Sem aula hoje</span>';

    const hoje = todayStr();
    const jornadaHoje = jornadasCache.find(j => (!j.vigencia_inicio || j.vigencia_inicio <= hoje) && (!j.vigencia_fim || j.vigencia_fim >= hoje));
    const trabalho = jornadaHoje
        ? blk(hhmm(jornadaHoje.hora_inicio), hhmm(jornadaHoje.hora_fim), '#0A8FB3', `${TIPO_JORNADA[jornadaHoje.tipo] || 'Trabalho'} · ${jornadaHoje.empresa}`, { cls: 'work' })
        : '<span class="lane-empty">Sem jornada ativa</span>';

    const items = minhasTarefas()
        .filter(c => !c.dia_inteiro && c.status !== 'cancelado' && new Date(c.data_inicio) < de && new Date(c.data_fim) > ds)
        .map(c => {
            const a = new Date(c.data_inicio);
            const b = new Date(c.data_fim);
            return { c, s: a < ds ? 0 : hOf(a), e: b >= de ? 24 : hOf(b) };
        })
        .sort((x, y) => x.s - y.s);

    const ends = [];
    for (const it of items) {
        let r = ends.findIndex(e => e <= it.s);
        if (r < 0) {
            r = ends.length;
            ends.push(0);
        }
        ends[r] = it.e;
        it.row = r;
    }

    const tarefas = items.length
        ? items.map(it => blk(it.s, it.e, (it.c.categoria || catById(it.c.id_categoria) || {}).cor_hex || '#E25C84', it.c.titulo, { row: it.row, cls: it.c.status === 'concluido' ? 'done' : '' })).join('')
        : '<span class="lane-empty">Nada com horário hoje</span>';

    const rowsN = Math.max(1, ends.length);
    const nowPct = railPct(hOf(now));

    box.innerHTML = `
        <div class="rail-axis"><span></span><div class="ticks">${ticks}</div></div>
        <div class="rail-body">
            <div class="lane">
                <div class="lane-name">Escola</div>
                <div class="track" style="height:48px">${escola}</div>
            </div>
            <div class="lane">
                <div class="lane-name">Trabalho</div>
                <div class="track" style="height:48px">${trabalho}</div>
            </div>
            <div class="lane">
                <div class="lane-name">Seu dia</div>
                <div class="track" style="height:${rowsN * ROW_H + 18}px">${tarefas}</div>
            </div>
            <div class="now-wrap"><div class="now" style="left:${nowPct}%"><i>agora</i></div></div>
        </div>
    `;
}

function tarefasDeHoje() {
    const now = new Date();
    const ds = startOfDay(now);
    const de = new Date(ds.getTime() + 86400000);
    return minhasTarefas()
        .filter(c => isOpen(c) && (new Date(c.data_fim) < now || (new Date(c.data_inicio) < de && new Date(c.data_fim) > ds)))
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

async function renderDashboard() {
    if (!state.user) return;
    await Promise.all([syncCompromissos(), syncMetas(), syncJornadas()]);
    const now = new Date();
    const h = now.getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    $('today-title').textContent = `${saud}, ${state.user.nome.split(' ')[0]}.`;
    $('today-date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('today-date').setAttribute('datetime', todayStr());

    const abertas = minhasTarefas().filter(isOpen).length;
    const metas = metasCache.filter(m => m.status === 'ativa').length;

    const lk = (cls, nav, scr, txt) => `<button class="fig ${cls}" onclick="navTo('${scr}', '${nav}')">${txt}</button>`;
    const txtTarefas = abertas ? `${abertas} ${plural(abertas, 'tarefa', 'tarefas')} em aberto` : 'nenhuma tarefa em aberto';
    const txtMetas = metas ? `${metas} ${plural(metas, 'meta ativa', 'metas ativas')}` : 'nenhuma meta ativa';
    $('today-summary').innerHTML = 'Você tem ' + lk('f-task', 'nav-tarefas', 'screen-tarefas', txtTarefas) + ' e ' + lk('f-goal', 'nav-metas', 'screen-metas', txtMetas) + '.';

    renderRail();

    const ts = tarefasDeHoje();
    $('today-tasks').innerHTML = ts.length
        ? `<ul class="list panel">${ts.slice(0, 6).map(c => taskRow(c, true)).join('')}</ul>${ts.length > 6 ? `<p class="more-link"><button class="link" onclick="navTo('screen-tarefas', 'nav-tarefas')">Ver as outras ${ts.length - 6}</button></p>` : ''}`
        : `<div class="empty small"><strong>Dia livre de tarefas</strong><p>Nada pendente para hoje.</p><button class="btn ghost sm" onclick="openTarefa()">${ICON.plus}Nova tarefa</button></div>`;

    const hs = compromissosCache.filter(c => c.id_estudante === uid() && c.origem === 'recorrencia' && c.status !== 'cancelado' && c.titulo !== WATER_TITLE);
    $('today-habits').innerHTML = hs.length
        ? `<ul class="list panel">${hs.slice(0, 5).map(hItem => `<li class="task"><div class="task-body"><div class="task-title">${esc(hItem.titulo)}</div></div><button class="btn ghost sm" onclick="navTo('screen-habitos', 'nav-habitos')">Marcar</button></li>`).join('')}</ul>`
        : `<div class="empty small"><strong>Nenhum hábito ativo</strong><p>Crie um hábito para acompanhar aqui.</p><button class="btn ghost sm" onclick="openHabito()">${ICON.plus}Novo hábito</button></div>`;
}

/* =====================================================================
   13. TELA DE CATEGORIAS (ISOLADAS POR ESTUDANTE)
   ===================================================================== */
function corValida(c) {
    return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#8E8999';
}

async function renderCategorias() {
    const box = $('lista-categorias');
    if (!box || !state.user) return;
    try {
        const res = await fetch(`${API_URL}/categorias?id_estudante=${uid()}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        categoriasCache = await res.json();
    } catch (e) {
        box.innerHTML = '<div class="empty small cat-empty"><strong>Não foi possível carregar</strong><p>Tente de novo.</p></div>';
        $('cat-count').textContent = '';
        return;
    }

    const lista = categoriasCache.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    $('cat-count').textContent = lista.length ? `${lista.length} categorias` : '';
    if (!lista.length) {
        box.innerHTML = '<div class="empty small cat-empty"><strong>Nenhuma ainda</strong></div>';
        return;
    }

    box.innerHTML = lista.map(c => {
        let dots = '';
        for (let i = 0; i < 5; i++) {
            dots += `<i class="${i < c.peso_energia ? 'on' : ''}"></i>`;
        }
        const excluir = c.padrao_sistema ? '' : `<button class="ib del" type="button" onclick="deleteCategoria(${c.id_categoria})">${ICON.trash}</button>`;
        return `
            <div class="panel cat-card" style="--cat:${corValida(c.cor_hex)}">
                <span class="cat-swatch"></span>
                <div class="cat-info">
                    <div class="cat-name"><span>${esc(c.nome)}</span>${c.padrao_sistema ? '<em class="cat-tag">Padrão</em>' : ''}</div>
                    <div class="cat-energy">${dots}</div>
                </div>
                ${excluir}
            </div>
        `;
    }).join('');
}

async function saveCategoria(event) {
    if (event) event.preventDefault();
    const nome = $('categoria-nome').value.trim();
    const cor = $('categoria-cor').value;
    const peso = parseInt($('categoria-peso').value, 10);
    if (!nome) {
        toast('Dê um nome.', 'err');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_estudante: uid(),
                nome: nome,
                cor_hex: cor.toUpperCase(),
                peso_energia: peso,
                padrao_sistema: false
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast(err.detail || 'Erro ao salvar.', 'err');
            return;
        }
        toast('Categoria criada.');
        $('form-categoria').reset();
        $('categoria-cor').value = '#E25C84';
        renderCategorias();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
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
        toast('Categoria excluída.');
        renderCategorias();
    } catch (e) {
        toast('Erro de rede.', 'err');
    }
}

async function carregarCategoriasNoForm(selId, preferida) {
    try {
        const url = state.user ? `${API_URL}/categorias?id_estudante=${uid()}` : `${API_URL}/categorias`;
        const res = await fetch(url);
        if (!res.ok) return;
        const cats = await res.json();
        if (!cats.length) return;
        cats.sort((a, b) => a.id_categoria - b.id_categoria);
        $(selId).innerHTML = cats.map(c => `<option value="${c.id_categoria}" ${c.nome === preferida ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
    } catch (e) {}
}

async function getValidCategoryId() {
    try {
        const url = state.user ? `${API_URL}/categorias?id_estudante=${uid()}` : `${API_URL}/categorias`;
        const res = await fetch(url);
        const cats = await res.json();
        if (cats.length > 0) return cats[0].id_categoria;
        const newCat = await fetch(`${API_URL}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: 'Geral', cor_hex: '#8E8999', peso_energia: 1, padrao_sistema: true })
        });
        const data = await newCat.json();
        return data.id_categoria;
    } catch (e) {
        return null;
    }
}

/* =====================================================================
   14. BUSCA DE INSTITUIÇÃO E CURSO NO CADASTRO
   ===================================================================== */
let todasInstituicoes = [];
const SEM_CURSO = 'sem-curso';

async function carregarInstituicoes() {
    try {
        const res = await fetch(`${API_URL}/instituicoes`);
        if (res.ok) {
            todasInstituicoes = await res.json();
        }
    } catch (e) {}
}

function resetCursos() {
    const sel = $('cad-curso');
    if (!sel) return;
    sel.innerHTML = '<option value="">Escolha a escola primeiro</option>';
    sel.disabled = false;
}

async function carregarCursosDaEscola(idInstituicao) {
    const sel = $('cad-curso');
    sel.innerHTML = '<option value="">Carregando...</option>';
    sel.disabled = true;
    try {
        const res = await fetch(`${API_URL}/cursos/por_instituicao/${idInstituicao}`);
        if (String($('cad-inst-id').value) !== String(idInstituicao)) return;
        const cursos = res.ok ? await res.json() : [];
        if (!cursos.length) {
            sel.innerHTML = `<option value="${SEM_CURSO}">Ensino regular</option>`;
            sel.disabled = false;
            return;
        }
        sel.innerHTML = '<option value="" disabled selected>Selecione o curso</option>'
            + cursos.map(c => `<option value="${c.id_curso}">${esc(c.nome)}</option>`).join('')
            + `<option value="${SEM_CURSO}">Ensino regular</option>`;
        sel.disabled = false;
    } catch (e) {
        sel.innerHTML = '<option value="">Erro.</option>';
    }
}

function filtrarInstituicoes() {
    const termo = $('cad-busca-inst').value.trim().toLowerCase();
    const listaDiv = $('lista-instituicoes');
    listaDiv.innerHTML = '';
    $('cad-inst-id').value = '';
    resetCursos();

    if (termo.length < 2) {
        listaDiv.classList.add('hidden');
        return;
    }

    const filtradas = todasInstituicoes.filter(i =>
        (i.nome || '').toLowerCase().includes(termo) || (i.cidade || '').toLowerCase().includes(termo)
    );

    if (!filtradas.length) {
        listaDiv.innerHTML = '<div class="inst-vazio">Nenhuma encontrada.</div>';
    } else {
        filtradas.slice(0, 30).forEach(inst => {
            const item = document.createElement('div');
            item.className = 'inst-item';
            item.innerHTML = `<strong>${esc(inst.nome)}</strong><span>${esc(inst.cidade)} · ${esc(inst.uf)}</span>`;
            item.onclick = () => {
                $('cad-busca-inst').value = inst.nome;
                $('cad-inst-id').value = inst.id_instituicao;
                listaDiv.classList.add('hidden');
                carregarCursosDaEscola(inst.id_instituicao);
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

/* =====================================================================
   15. TELA DE ESTUDOS (ENSINO MÉDIO, PAS-UEM E ENEM)
   ===================================================================== */
const TRILHAS_ESTUDO = {
    '1_ano': {
        badge: '1ª Série · Peso 1 no PAS-UEM',
        titulo: '1º Ano do Ensino Médio & PAS 1',
        dica: 'No PAS 1, as questões são de somatória (01, 02, 04, 08, 16) e a redação pede gêneros como Carta de Solicitação ou Comentário (15 a 22 linhas).',
        materias: [
            {
                nome: 'Matemática',
                cor: '#E25C84',
                topicos: [
                    { id: '1_mat_1', texto: 'Conjuntos numéricos e intervalos', youtubeId: 'Y_mYgLkuEl4', resumo: 'Introdução aos conjuntos naturais, inteiros, racionais e reais.' },
                    { id: '1_mat_2', texto: 'Função afim (1º grau) e função quadrática (2º grau)', youtubeId: 'hdMFlAv5GkU', resumo: 'Conceitos iniciais, gráfico e lei de formação da função do 1º grau.' },
                    { id: '1_mat_3', texto: 'Função exponencial e logaritmos' },
                    { id: '1_mat_4', texto: 'Geometria plana: triângulos, polígonos e áreas' }
                ]
            },
            {
                nome: 'Física & Química',
                cor: '#0A8FB3',
                topicos: [
                    { id: '1_fis_1', texto: 'Física: Cinemática (MRU, MRUV e queda livre)', youtubeId: 'oVb3WV1CLSE', resumo: 'Conceitos fundamentais de movimento uniforme e velocidade média.' },
                    { id: '1_fis_2', texto: 'Física: Leis de Newton, trabalho e energia' },
                    { id: '1_qui_1', texto: 'Química: Estrutura atômica e Tabela Periódica' },
                    { id: '1_qui_2', texto: 'Química: Ligações químicas, ácidos, bases e estequiometria' }
                ]
            },
            {
                nome: 'Biologia',
                cor: '#4CD964',
                topicos: [
                    { id: '1_bio_1', texto: 'Bioquímica celular (água, sais, proteínas e vitaminas)' },
                    { id: '1_bio_2', texto: 'Citologia: organelas e divisão celular (mitose e meiose)', youtubeId: 'V_hAOq5iWvA', resumo: 'Estrutura da célula e função das principais organelas.' },
                    { id: '1_bio_3', texto: 'Histologia animal e embriologia básica' }
                ]
            },
            {
                nome: 'Humanas & Linguagens',
                cor: '#B8335F',
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
                nome: 'Matemática',
                cor: '#E25C84',
                topicos: [
                    { id: '2_mat_1', texto: 'Trigonometria no triângulo retângulo e no ciclo', youtubeId: '5Ez1qFwyNxc', resumo: 'Seno, cosseno e tangente aplicados ao triângulo retângulo.' },
                    { id: '2_mat_2', texto: 'Matrizes, determinantes e sistemas lineares' },
                    { id: '2_mat_3', texto: 'Análise combinatória (arranjo, permutação e combinação)' },
                    { id: '2_mat_4', texto: 'Probabilidade e estatística básica' }
                ]
            },
            {
                nome: 'Física & Química',
                cor: '#0A8FB3',
                topicos: [
                    { id: '2_fis_1', texto: 'Física: Termologia, calorimetria e termodinâmica', youtubeId: 'QUvmXOY2WvI', resumo: 'Temperatura, calor e escalas termométricas.' },
                    { id: '2_fis_2', texto: 'Física: Óptica geométrica e ondulatória' },
                    { id: '2_qui_1', texto: 'Química: Soluções e cálculo de concentração' },
                    { id: '2_qui_2', texto: 'Química: Termoquímica, cinética e equilíbrio químico' }
                ]
            },
            {
                nome: 'Biologia',
                cor: '#4CD964',
                topicos: [
                    { id: '2_bio_1', texto: 'Classificação dos seres vivos, vírus e bactérias' },
                    { id: '2_bio_2', texto: 'Botânica: grupos vegetais e fisiologia das plantas' },
                    { id: '2_bio_3', texto: 'Fisiologia humana (digestório, respiratório e circulatório)' }
                ]
            },
            {
                nome: 'Humanas & Linguagens',
                cor: '#B8335F',
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
                nome: 'Matemática',
                cor: '#E25C84',
                topicos: [
                    { id: '3_mat_1', texto: 'Geometria espacial (prismas, cilindros, cones e esferas)', youtubeId: 'GMWEiRH0PLI', resumo: 'Introdução aos sólidos geométricos e cálculo de volume.' },
                    { id: '3_mat_2', texto: 'Geometria analítica (ponto, reta e circunferência)' },
                    { id: '3_mat_3', texto: 'Polinômios e equações algébricas' },
                    { id: '3_mat_4', texto: 'Matemática financeira (juros simples e compostos)' }
                ]
            },
            {
                nome: 'Física & Química',
                cor: '#0A8FB3',
                topicos: [
                    { id: '3_fis_1', texto: 'Física: Eletrostática e eletrodinâmica (circuitos)', youtubeId: '46nINK2nsX8', resumo: 'Corrente elétrica, tensão e resistores.' },
                    { id: '3_fis_2', texto: 'Física: Eletromagnetismo e noções de Física Moderna' },
                    { id: '3_qui_1', texto: 'Química Orgânica: cadeias carbônicas, funções e isomeria', youtubeId: 'BDmo-yGv0L4', resumo: 'Classificação das cadeias carbônicas e postulados de Kekulé.' },
                    { id: '3_qui_2', texto: 'Química: Eletroquímica (pilhas e eletrólise) e radioatividade' }
                ]
            },
            {
                nome: 'Biologia',
                cor: '#4CD964',
                topicos: [
                    { id: '3_bio_1', texto: 'Genética: Leis de Mendel, grupos sanguíneos e biotecnologia', youtubeId: '4c3bEWWvA9c', resumo: 'Fundamentos da 1ª Lei de Mendel e cruzamentos.' },
                    { id: '3_bio_2', texto: 'Evolução biológica e origem das espécies' },
                    { id: '3_bio_3', texto: 'Ecologia: cadeias alimentares, ciclos e impactos ambientais' }
                ]
            },
            {
                nome: 'Humanas & Linguagens',
                cor: '#B8335F',
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
                nome: 'Matemática e suas Tecnologias',
                cor: '#E25C84',
                topicos: [
                    { id: 'en_mat_1', texto: 'Razão, proporção, regra de três e porcentagem', youtubeId: 'OjOyNmTt7Mw', resumo: 'Cálculo rápido de porcentagem e regra de três simples.' },
                    { id: 'en_mat_2', texto: 'Leitura e interpretação de gráficos e tabelas' },
                    { id: 'en_mat_3', texto: 'Média, moda, mediana e probabilidade' },
                    { id: 'en_mat_4', texto: 'Geometria plana e espacial aplicada ao cotidiano' }
                ]
            },
            {
                nome: 'Ciências da Natureza',
                cor: '#4CD964',
                topicos: [
                    { id: 'en_nat_1', texto: 'Ecologia, sustentabilidade e problemas ambientais', youtubeId: 'XvdePktAui8', resumo: 'Conceitos essenciais de ecologia que mais caem no ENEM.' },
                    { id: 'en_nat_2', texto: 'Energia, eletricidade residencial e ondulatória' },
                    { id: 'en_nat_3', texto: 'Química ambiental, pH e funções orgânicas' },
                    { id: 'en_nat_4', texto: 'Imunologia, vacinas e saúde pública' }
                ]
            },
            {
                nome: 'Ciências Humanas',
                cor: '#0A8FB3',
                topicos: [
                    { id: 'en_hum_1', texto: 'Era Vargas, Ditadura Militar e Redemocratização', youtubeId: 'ZcTDWBqUju8', resumo: 'Resumo completo da Era Vargas (1930-1945).' },
                    { id: 'en_hum_2', texto: 'Movimentos sociais, cidadania e direitos humanos' },
                    { id: 'en_hum_3', texto: 'Geografia agrária, fontes de energia e urbanização' }
                ]
            },
            {
                nome: 'Linguagens & Redação Nota 1000',
                cor: '#B8335F',
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
    try {
        return JSON.parse(localStorage.getItem('flow_estudos_' + uid()) || '[]');
    } catch (e) {
        return [];
    }
}

function salvarTopicosConcluidos(lista) {
    if (!state.user) return;
    try {
        localStorage.setItem('flow_estudos_' + uid(), JSON.stringify(lista));
    } catch (e) {}
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

    let total = 0;
    let feitos = 0;
    trilha.materias.forEach(m => {
        m.topicos.forEach(t => {
            total++;
            if (concluidos.includes(t.id)) feitos++;
        });
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

/* =====================================================================
   16. INICIALIZAÇÃO DO SISTEMA
   ===================================================================== */
DB.init();
setInterval(() => {
    if (state.user && $('screen-menu').classList.contains('active')) {
        renderRail();
    }
}, 60000);
setInterval(checkLembretes, 20000);
navTo('screen-login');

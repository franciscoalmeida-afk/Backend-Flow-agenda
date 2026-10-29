const API_URL = 'http://127.0.0.1:8000/categorias';

const formulario = document.querySelector('#form-categoria');
const campoId = document.querySelector('#id-categoria');
const campoNome = document.querySelector('#nome');
const campoCor = document.querySelector('#cor_hex');
const campoPeso = document.querySelector('#peso_energia');
const lista = document.querySelector('#lista-categorias');
const mensagem = document.querySelector('#mensagem');

function mostrarMensagem(texto, erro = false) {
    mensagem.textContent = texto;
    mensagem.className = erro ? 'mensagem erro' : 'mensagem';
    mensagem.hidden = false;
}

function limparFormulario() {
    formulario.reset();
    campoId.value = '';
    document.querySelector("#titulo-formulario").textContent = "Nova Categoria";
}

async function requisicao(caminho = '', metodo = 'GET', dados = null) {
    const opcoes = { method: metodo };
    if (dados) {
        opcoes.headers = { 'Content-Type': 'application/json' };
        opcoes.body = JSON.stringify(dados);
    }
    try {
        const resposta = await fetch(API_URL + caminho, opcoes);
        if (resposta.status === 204) return null;
        const conteudo = await resposta.json();
        if (!resposta.ok) throw new Error(conteudo.detail || 'Erro na operação');
        return conteudo;
    } catch (erro) {
        throw new Error("Não foi possível acessar a API. Verifique se o backend está rodando.");
    }
}

function exibirCategorias(categorias) {
    lista.replaceChildren();
    document.querySelector("#total-categorias").textContent = `${categorias.length} registro(s)`;
    
    if (categorias.length === 0) {
        const linha = lista.insertRow();
        const celula = linha.insertCell();
        celula.colSpan = 5;
        celula.className = 'vazio';
        celula.textContent = 'Nenhuma categoria encontrada.';
        return;
    }

    for (const cat of categorias) {
        const linha = lista.insertRow();
        linha.insertCell().textContent = cat.id_categoria;
        linha.insertCell().textContent = cat.nome;
        
        const corCell = linha.insertCell();
        corCell.innerHTML = `<span style="background:${cat.cor_hex}; padding: 5px 15px; border-radius:5px; color:white; font-weight:bold;">${cat.cor_hex}</span>`;
        
        linha.insertCell().textContent = cat.peso_energia;
        
        const acoes = linha.insertCell();
        
        const editar = document.createElement('button');
        editar.className = 'botao botao-principal';
        editar.textContent = 'Editar';
        editar.style.marginRight = '5px';
        editar.onclick = () => {
            campoId.value = cat.id_categoria;
            campoNome.value = cat.nome;
            campoCor.value = cat.cor_hex;
            campoPeso.value = cat.peso_energia;
            document.querySelector("#titulo-formulario").textContent = `Editando Categoria #${cat.id_categoria}`;
        };

        const excluir = document.createElement('button');
        excluir.className = 'botao botao-secundario';
        excluir.textContent = 'Excluir';
        excluir.onclick = async () => {
            if(confirm(`Tem certeza que deseja excluir a categoria ${cat.nome}?`)) {
                try {
                    await requisicao(`/${cat.id_categoria}`, 'DELETE');
                    mostrarMensagem('Categoria excluída!');
                    listarCategorias();
                } catch(e) { mostrarMensagem(e.message, true); }
            }
        };
        
        acoes.append(editar, excluir);
    }
}

async function listarCategorias() {
    try {
        const dados = await requisicao();
        exibirCategorias(dados);
    } catch (e) { 
        mostrarMensagem(e.message, true); 
        lista.replaceChildren();
    }
}

formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = campoId.value;
    const dados = {
        nome: campoNome.value,
        cor_hex: campoCor.value,
        peso_energia: parseInt(campoPeso.value)
    };
    
    try {
        await requisicao(id ? `/${id}` : '', id ? 'PUT' : 'POST', dados);
        limparFormulario();
        mostrarMensagem(id ? 'Atualizado com sucesso!' : 'Criado com sucesso!');
        listarCategorias();
    } catch (e) { mostrarMensagem(e.message, true); }
});

document.querySelector('#botao-limpar').onclick = limparFormulario;

// Inicializa a lista ao abrir a página
listarCategorias();
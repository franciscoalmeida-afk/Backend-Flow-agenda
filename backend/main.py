from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from database import supabase
import schemas

app = FastAPI(
    title="API do Flow Agendas",
    version="1.0.0",
    description="API de agenda dinâmica para jovens aprendizes e estagiários"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# TRATAMENTO GLOBAL DE ERROS DO SUPABASE
# =====================================================================
@app.exception_handler(APIError)
async def supabase_api_error_handler(request: Request, exc: APIError):
    mensagem = exc.message or "Erro no banco de dados."
    if exc.details:
        mensagem += f" Detalhes: {exc.details}"
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": mensagem, "code": exc.code}
    )

@app.get("/", tags=["Início"])
def inicio():
    return {"mensagem": "API do Flow Agendas funcionando!"}

# =====================================================================
# CRUD DE ESTUDANTES (TELA CADASTRO E PERFIL)
# =====================================================================
@app.post("/estudantes", status_code=status.HTTP_201_CREATED, tags=["Estudantes"])
def criar_estudante(est: schemas.EstudanteCreate):
    resposta = supabase.table("estudante").insert(est.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/estudantes", tags=["Estudantes"])
def listar_estudantes():
    return supabase.table("estudante").select("*, curso(*), instituicao(*)").execute().data

@app.put("/estudantes/{id_estudante}", tags=["Estudantes"])
def atualizar_estudante(id_estudante: int, est: schemas.EstudanteCreate):
    resposta = supabase.table("estudante").update(est.model_dump(mode="json")).eq("id_estudante", id_estudante).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")
    return resposta.data[0]

@app.delete("/estudantes/{id_estudante}", status_code=status.HTTP_204_NO_CONTENT, tags=["Estudantes"])
def deletar_estudante(id_estudante: int):
    resposta = supabase.table("estudante").delete().eq("id_estudante", id_estudante).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Estudante não encontrado")
    return None

# =====================================================================
# AUTENTICAÇÃO (TELA LOGIN)
# =====================================================================
@app.post("/login", tags=["Autenticação"])
def fazer_login(dados: schemas.LoginRequest):
    resposta = supabase.table("estudante").select("*").eq("email", dados.email).execute()

    if not resposta.data:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    estudante = resposta.data[0]

    if estudante["senha_hash"] != dados.senha_hash:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    estudante.pop("senha_hash", None)
    return estudante

# =====================================================================
# CRUD DE INSTITUIÇÕES (BUSCA DE ESCOLA NO CADASTRO)
# =====================================================================
@app.post("/instituicoes", status_code=status.HTTP_201_CREATED, tags=["Instituições"])
def criar_instituicao(inst: schemas.InstituicaoCreate):
    resposta = supabase.table("instituicao").insert(inst.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/instituicoes", tags=["Instituições"])
def listar_instituicoes():
    return supabase.table("instituicao").select("*").execute().data

@app.put("/instituicoes/{id_instituicao}", tags=["Instituições"])
def atualizar_instituicao(id_instituicao: int, inst: schemas.InstituicaoCreate):
    resposta = supabase.table("instituicao").update(inst.model_dump(mode="json")).eq("id_instituicao", id_instituicao).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Instituição não encontrada")
    return resposta.data[0]

@app.delete("/instituicoes/{id_instituicao}", status_code=status.HTTP_204_NO_CONTENT, tags=["Instituições"])
def deletar_instituicao(id_instituicao: int):
    resposta = supabase.table("instituicao").delete().eq("id_instituicao", id_instituicao).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Instituição não encontrada")
    return None

# =====================================================================
# CRUD DE CURSOS (SELEÇÃO DE CURSO NO CADASTRO)
# =====================================================================
@app.post("/cursos", status_code=status.HTTP_201_CREATED, tags=["Cursos"])
def criar_curso(curso: schemas.CursoCreate):
    resposta = supabase.table("curso").insert(curso.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/cursos", tags=["Cursos"])
def listar_cursos():
    return supabase.table("curso").select("*, instituicao(*)").execute().data

@app.get("/cursos/por_instituicao/{id_instituicao}", tags=["Cursos"])
def listar_cursos_por_instituicao(id_instituicao: int):
    resposta = supabase.table("curso").select("*").eq("id_instituicao", id_instituicao).execute()
    return resposta.data

@app.get("/cursos/buscar", tags=["Cursos"])
def buscar_curso(id_instituicao: int, nome: str, turno: str):
    resposta = supabase.table("curso").select("*").eq("id_instituicao", id_instituicao).ilike("nome", nome).eq("turno", turno).execute()
    if resposta.data:
        return resposta.data[0]
    return None

@app.put("/cursos/{id_curso}", tags=["Cursos"])
def atualizar_curso(id_curso: int, curso: schemas.CursoCreate):
    resposta = supabase.table("curso").update(curso.model_dump(mode="json")).eq("id_curso", id_curso).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Curso não encontrado")
    return resposta.data[0]

@app.delete("/cursos/{id_curso}", status_code=status.HTTP_204_NO_CONTENT, tags=["Cursos"])
def deletar_curso(id_curso: int):
    resposta = supabase.table("curso").delete().eq("id_curso", id_curso).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Curso não encontrado")
    return None

# =====================================================================
# DOCUMENTOS E GUIAS DE APOIO (TELA BEM-ESTAR)
# =====================================================================
@app.post("/documentos", status_code=status.HTTP_201_CREATED, tags=["Documentos"])
def criar_documento(doc: schemas.DocumentoBaseCreate):
    resposta = supabase.table("documento_base").insert(doc.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/documentos", tags=["Documentos"])
def listar_documentos():
    return supabase.table("documento_base").select("*").execute().data

@app.delete("/documentos/{id_documento}", status_code=status.HTTP_204_NO_CONTENT, tags=["Documentos"])
def deletar_documento(id_documento: int):
    try:
        resposta = supabase.table("documento_base").delete().eq("id_documento", id_documento).execute()
        if not resposta.data:
            raise HTTPException(status_code=404, detail="Documento não encontrado")
    except APIError:
        raise HTTPException(status_code=409, detail="Documento vinculado a estudantes. Desvincule antes de excluir.")
    return None

@app.post("/estudantes/{id_estudante}/documentos", status_code=status.HTTP_201_CREATED, tags=["Estudante_Documento"])
def vincular_documento(id_estudante: int, dados: schemas.EstudanteDocumentoCreate):
    est = supabase.table("estudante").select("id_estudante").eq("id_estudante", id_estudante).execute()
    if not est.data:
        raise HTTPException(status_code=404, detail="Estudante não encontrado.")

    doc = supabase.table("documento_base").select("id_documento").eq("id_documento", dados.id_documento).execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    vinculo = supabase.table("estudante_documento").select("*").eq("id_estudante", id_estudante).eq("id_documento", dados.id_documento).execute()
    if vinculo.data:
        raise HTTPException(status_code=409, detail="Documento já vinculado a este estudante.")

    resposta = supabase.table("estudante_documento").insert({
        "id_estudante": id_estudante,
        "id_documento": dados.id_documento
    }).execute()
    return resposta.data[0]

@app.get("/estudantes/{id_estudante}/documentos", tags=["Estudante_Documento"])
def listar_documentos_do_estudante(id_estudante: int):
    resposta = supabase.table("estudante_documento").select("*, documento_base(*)").eq("id_estudante", id_estudante).execute()
    return resposta.data

@app.delete("/estudantes/{id_estudante}/documentos/{id_documento}", status_code=status.HTTP_204_NO_CONTENT, tags=["Estudante_Documento"])
def desvincular_documento(id_estudante: int, id_documento: int):
    resposta = supabase.table("estudante_documento").delete().eq("id_estudante", id_estudante).eq("id_documento", id_documento).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    return None

# =====================================================================
# CRUD DE CATEGORIAS (TELA CATEGORIAS - ISOLADAS POR ESTUDANTE)
# =====================================================================
@app.post("/categorias", status_code=status.HTTP_201_CREATED, tags=["Categorias"])
def criar_categoria(cat: schemas.CategoriaCreate):
    # Verifica apenas se o mesmo aluno já criou uma categoria com esse nome
    if cat.id_estudante is not None:
        existente = (
            supabase.table("categoria")
            .select("id_categoria")
            .eq("id_estudante", cat.id_estudante)
            .ilike("nome", cat.nome.strip())
            .execute()
        )
        if existente.data:
            raise HTTPException(
                status_code=400,
                detail="Você já criou uma categoria com esse nome."
            )

    resposta = supabase.table("categoria").insert(cat.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/categorias", tags=["Categorias"])
def listar_categorias(id_estudante: int = None):
    query = supabase.table("categoria").select("*")
    if id_estudante is not None:
        query = query.or_(f"padrao_sistema.eq.true,id_estudante.eq.{id_estudante}")
    else:
        query = query.eq("padrao_sistema", True)
    return query.execute().data

@app.put("/categorias/{id_categoria}", tags=["Categorias"])
def atualizar_categoria(id_categoria: int, cat: schemas.CategoriaCreate):
    resposta = supabase.table("categoria").update(cat.model_dump(mode="json")).eq("id_categoria", id_categoria).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return resposta.data[0]

@app.delete("/categorias/{id_categoria}", status_code=status.HTTP_204_NO_CONTENT, tags=["Categorias"])
def deletar_categoria(id_categoria: int):
    try:
        resposta = supabase.table("categoria").delete().eq("id_categoria", id_categoria).execute()
        if not resposta.data:
            raise HTTPException(status_code=404, detail="Categoria não encontrada")
    except APIError:
        raise HTTPException(status_code=409, detail="Categoria vinculada a compromissos. Não pode ser excluída.")
    return None

# =====================================================================
# CRUD DE JORNADAS DE TRABALHO (TELA AJUSTES)
# =====================================================================
@app.post("/jornadas", status_code=status.HTTP_201_CREATED, tags=["Jornadas"])
def criar_jornada(jornada: schemas.JornadaTrabalhoCreate):
    est = supabase.table("estudante").select("id_estudante").eq("id_estudante", jornada.id_estudante).execute()
    if not est.data:
        raise HTTPException(status_code=404, detail="Estudante não encontrado.")

    dados = jornada.model_dump(mode="json")
    if len(dados["hora_inicio"]) == 5:
        dados["hora_inicio"] += ":00"
    if len(dados["hora_fim"]) == 5:
        dados["hora_fim"] += ":00"

    resposta = supabase.table("jornada_trabalho").insert(dados).execute()
    return resposta.data[0]

@app.get("/jornadas", tags=["Jornadas"])
def listar_jornadas():
    return supabase.table("jornada_trabalho").select("*, estudante(*)").execute().data

@app.put("/jornadas/{id_jornada}", tags=["Jornadas"])
def atualizar_jornada(id_jornada: int, jornada: schemas.JornadaTrabalhoCreate):
    dados = jornada.model_dump(mode="json")
    if len(dados["hora_inicio"]) == 5:
        dados["hora_inicio"] += ":00"
    if len(dados["hora_fim"]) == 5:
        dados["hora_fim"] += ":00"
    resposta = supabase.table("jornada_trabalho").update(dados).eq("id_jornada", id_jornada).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Jornada não encontrada")
    return resposta.data[0]

@app.delete("/jornadas/{id_jornada}", status_code=status.HTTP_204_NO_CONTENT, tags=["Jornadas"])
def deletar_jornada(id_jornada: int):
    resposta = supabase.table("jornada_trabalho").delete().eq("id_jornada", id_jornada).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Jornada não encontrada")
    return None

@app.post("/jornada_dia", status_code=status.HTTP_201_CREATED, tags=["Jornadas"])
def criar_jornada_dia(item: dict):
    resposta = supabase.table("jornada_dia").insert(item).execute()
    return resposta.data[0]

# =====================================================================
# CRUD DE COMPROMISSOS (TELAS HOJE, TAREFAS E HÁBITOS)
# =====================================================================
@app.post("/compromissos", status_code=status.HTTP_201_CREATED, tags=["Compromissos"])
def criar_compromisso(comp: schemas.CompromissoCreate):
    est = supabase.table("estudante").select("id_estudante").eq("id_estudante", comp.id_estudante).execute()
    if not est.data:
        raise HTTPException(status_code=404, detail="Estudante não encontrado.")

    cat = supabase.table("categoria").select("id_categoria").eq("id_categoria", comp.id_categoria).execute()
    if not cat.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada.")

    payload = comp.model_dump(mode="json")
    if payload.get("id_meta") is None:
        payload.pop("id_meta", None)

    try:
        resposta = supabase.table("compromisso").insert(payload).execute()
    except APIError as exc:
        if "id_meta" in str(exc.message or "") and "id_meta" in payload:
            payload.pop("id_meta", None)
            resposta = supabase.table("compromisso").insert(payload).execute()
        else:
            raise
    return resposta.data[0]

@app.get("/compromissos", tags=["Compromissos"])
def listar_compromissos():
    return supabase.table("compromisso").select("*, categoria(*), estudante(*)").execute().data

@app.put("/compromissos/{id_compromisso}", tags=["Compromissos"])
def atualizar_compromisso(id_compromisso: int, comp: schemas.CompromissoCreate):
    payload = comp.model_dump(mode="json")
    try:
        resposta = supabase.table("compromisso").update(payload).eq("id_compromisso", id_compromisso).execute()
    except APIError as exc:
        if "id_meta" in str(exc.message or "") and "id_meta" in payload:
            payload.pop("id_meta", None)
            resposta = supabase.table("compromisso").update(payload).eq("id_compromisso", id_compromisso).execute()
        else:
            raise
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado")
    return resposta.data[0]

@app.delete("/compromissos/{id_compromisso}", status_code=status.HTTP_204_NO_CONTENT, tags=["Compromissos"])
def deletar_compromisso(id_compromisso: int):
    resposta = supabase.table("compromisso").delete().eq("id_compromisso", id_compromisso).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Compromisso não encontrado")
    return None

# =====================================================================
# CRUD DE METAS (TELA METAS)
# =====================================================================
@app.post("/metas", status_code=status.HTTP_201_CREATED, tags=["Metas"])
def criar_meta(meta: schemas.MetaCreate):
    resposta = supabase.table("meta").insert(meta.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/metas/{id_estudante}", tags=["Metas"])
def listar_metas_estudante(id_estudante: int):
    resposta = supabase.table("meta").select("*").eq("id_estudante", id_estudante).order("id_meta").execute()
    return resposta.data

@app.put("/metas/{id_meta}", tags=["Metas"])
def atualizar_meta(id_meta: int, meta: schemas.MetaUpdate):
    dados = meta.model_dump(mode="json", exclude_unset=True)
    if not dados:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado para atualização.")
    resposta = supabase.table("meta").update(dados).eq("id_meta", id_meta).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return resposta.data[0]

@app.delete("/metas/{id_meta}", status_code=status.HTTP_204_NO_CONTENT, tags=["Metas"])
def deletar_meta(id_meta: int):
    try:
        supabase.table("compromisso").update({"id_meta": None}).eq("id_meta", id_meta).execute()
    except APIError:
        pass
    supabase.table("meta").delete().eq("id_meta", id_meta).execute()
    return None

# =====================================================================
# CHECK-INS DE HÁBITOS E BLOCOS DE DESCOMPRESSÃO (TELAS HÁBITOS E BEM-ESTAR)
# =====================================================================
@app.post("/checkins", status_code=status.HTTP_201_CREATED, tags=["Hábitos"])
def criar_checkin(checkin: schemas.CheckinCreate):
    try:
        resposta = supabase.table("habito_checkin").insert(checkin.model_dump(mode="json")).execute()
        return resposta.data[0]
    except APIError:
        raise HTTPException(status_code=409, detail="Hábito já marcado para este dia.")

@app.put("/checkins/{id_compromisso}/{data}", tags=["Hábitos"])
def atualizar_checkin(id_compromisso: int, data: str, checkin: schemas.CheckinUpdate):
    if checkin.quantidade == 0:
        supabase.table("habito_checkin").delete().eq("id_compromisso", id_compromisso).eq("data", data).execute()
        return {"id_compromisso": id_compromisso, "data": data, "quantidade": 0}
    resposta = supabase.table("habito_checkin").update({"quantidade": checkin.quantidade}).eq("id_compromisso", id_compromisso).eq("data", data).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Check-in não encontrado para esta data.")
    return resposta.data[0]

@app.get("/checkins/{id_compromisso}", tags=["Hábitos"])
def listar_checkins_habito(id_compromisso: int):
    resposta = supabase.table("habito_checkin").select("*").eq("id_compromisso", id_compromisso).execute()
    return resposta.data

@app.delete("/checkins/{id_compromisso}/{data}", status_code=status.HTTP_204_NO_CONTENT, tags=["Hábitos"])
def deletar_checkin(id_compromisso: int, data: str):
    supabase.table("habito_checkin").delete().eq("id_compromisso", id_compromisso).eq("data", data).execute()
    return None

@app.post("/blocos_descompressao", status_code=status.HTTP_201_CREATED, tags=["Bem-estar"])
def criar_bloco(bloco: schemas.BlocoDescompressaoCreate):
    resposta = supabase.table("bloco_descompressao").insert(bloco.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/blocos_descompressao/estudante/{id_estudante}", tags=["Bem-estar"])
def listar_blocos_estudante(id_estudante: int):
    comps = supabase.table("compromisso").select("id_compromisso, data_inicio, data_fim, titulo, status").eq("id_estudante", id_estudante).execute().data
    if not comps:
        return []
    mapa = {c["id_compromisso"]: c for c in comps}
    blocos = supabase.table("bloco_descompressao").select("*").in_("id_compromisso", list(mapa.keys())).execute().data
    for b in blocos:
        b["compromisso"] = mapa.get(b["id_compromisso"])
    return blocos

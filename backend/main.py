from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from postgrest.exceptions import APIError
from database import supabase
import schemas

app = FastAPI(
    title="API do Projeto Integrador",
    version="1.0.0",
    description="API de agenda dinâmica para jovens aprendizes e estagiários"
)

# Configuração de CORS (Libera o acesso do Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tratamento de erros do Supabase
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
    return {"mensagem": "API funcionando!"}

# ==========================================
# CRUD DE CATEGORIAS
# ==========================================
@app.post("/categorias", status_code=status.HTTP_201_CREATED, tags=["Categorias"])
def criar_categoria(cat: schemas.CategoriaCreate):
    resposta = supabase.table("categoria").insert(cat.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/categorias", tags=["Categorias"])
def listar_categorias():
    return supabase.table("categoria").select("*").execute().data

@app.put("/categorias/{id_categoria}", tags=["Categorias"])
def atualizar_categoria(id_categoria: int, cat: schemas.CategoriaCreate):
    resposta = supabase.table("categoria").update(cat.model_dump(mode="json")).eq("id_categoria", id_categoria).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return resposta.data[0]

@app.delete("/categorias/{id_categoria}", status_code=status.HTTP_204_NO_CONTENT, tags=["Categorias"])
def deletar_categoria(id_categoria: int):
    resposta = supabase.table("categoria").delete().eq("id_categoria", id_categoria).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return None

# ==========================================
# CRUD DE INSTITUIÇÕES
# ==========================================
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

# ==========================================
# CRUD DE CURSOS
# ==========================================
@app.post("/cursos", status_code=status.HTTP_201_CREATED, tags=["Cursos"])
def criar_curso(curso: schemas.CursoCreate):
    resposta = supabase.table("curso").insert(curso.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/cursos", tags=["Cursos"])
def listar_cursos():
    return supabase.table("curso").select("*, instituicao(*)").execute().data

# Lista os cursos de uma instituição (alimenta o select de curso no cadastro)
@app.get("/cursos/por_instituicao/{id_instituicao}", tags=["Cursos"])
def listar_cursos_por_instituicao(id_instituicao: int):
    return (
        supabase.table("curso")
        .select("*")
        .eq("id_instituicao", id_instituicao)
        .order("nome")
        .execute()
        .data
    )

# Busca um curso pelo trio instituição + nome + turno (usada no cadastro para não duplicar cursos)
@app.get("/cursos/buscar", tags=["Cursos"])
def buscar_curso(id_instituicao: int, nome: str, turno: str):
    # Escapa os curingas do LIKE para o ilike funcionar como "igual, sem diferenciar maiúsculas"
    nome_seguro = nome.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    resposta = (
        supabase.table("curso")
        .select("*")
        .eq("id_instituicao", id_instituicao)
        .ilike("nome", nome_seguro)
        .eq("turno", turno)
        .limit(1)
        .execute()
    )
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

# ==========================================
# CRUD DE ESTUDANTES
# ==========================================
@app.post("/estudantes", status_code=status.HTTP_201_CREATED, tags=["Estudantes"])
def criar_estudante(est: schemas.EstudanteCreate):
    resposta = supabase.table("estudante").insert(est.model_dump(mode="json")).execute()
    estudante = resposta.data[0]
    estudante.pop("senha_hash", None)  # não devolve o hash da senha para o frontend
    return estudante

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

# ==========================================
# AUTENTICAÇÃO (LOGIN)
# ==========================================
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

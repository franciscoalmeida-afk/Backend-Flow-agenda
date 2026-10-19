from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from database import supabase
import schemas








app = FastAPI(
  title="API do Projeto Integrador",
  version="1.0.0",
  description="API de agenda dinâmica para jovens aprendizes e estagiários"
)








# ==========================================
# TRATAMENTO GLOBAL DE ERROS DO SUPABASE
# ==========================================
@app.exception_handler(APIError)
async def supabase_api_error_handler(request: Request, exc: APIError):
  mensagem_detalhada = exc.message or "Erro de validação ou restrição no banco de dados."
  if exc.details:
      mensagem_detalhada += f" Detalhes: {exc.details}"




  return JSONResponse(
      status_code=status.HTTP_400_BAD_REQUEST,
      content={"detail": mensagem_detalhada, "code": exc.code}
  )








@app.get("/")
def inicio():
  return {"mensagem": "API e conexão com Supabase funcionando!"}








# ==========================================
# 1. INSTITUIÇÃO
# ==========================================
@app.post("/instituicoes", status_code=status.HTTP_201_CREATED)
def criar_instituicao(inst: schemas.InstituicaoCreate):
  resposta = supabase.table("instituicao").insert(inst.model_dump(mode="json")).execute()
  return resposta.data[0]








@app.get("/instituicoes")
def listar_instituicoes():
  return supabase.table("instituicao").select("*").execute().data








# ==========================================
# 2. CURSO
# ==========================================
@app.post("/cursos", status_code=status.HTTP_201_CREATED)
def criar_curso(curso: schemas.CursoCreate):
  resposta = supabase.table("curso").insert(curso.model_dump(mode="json")).execute()
  return resposta.data[0]








@app.get("/cursos")
def listar_cursos():
  return supabase.table("curso").select("*, instituicao(*)").execute().data








# ==========================================
# 3. ESTUDANTE
# ==========================================
@app.post("/estudantes", status_code=status.HTTP_201_CREATED)
def criar_estudante(estudante: schemas.EstudanteCreate):
  resposta = supabase.table("estudante").insert(estudante.model_dump(mode="json")).execute()
  return resposta.data[0]








@app.get("/estudantes")
def listar_estudantes():
  return supabase.table("estudante").select(
      "*, instituicao(*), curso(*)"
  ).execute().data


# ==========================================
# 4. JORNADA DE TRABALHO
# ==========================================
@app.post("/jornadas", status_code=status.HTTP_201_CREATED)
def criar_jornada(jornada: schemas.JornadaTrabalhoCreate):
   resposta = supabase.table("jornada_trabalho").insert(jornada.model_dump(mode="json")).execute()
   return resposta.data[0]




@app.get("/jornadas")
def listar_jornadas():
   return supabase.table("jornada_trabalho").select(
       "*, estudante(*)"
   ).execute().data




# ==========================================
# 5. JORNADA DIA (só PK composta)
# ==========================================
@app.post("/jornadas-dia", status_code=status.HTTP_201_CREATED)
def criar_jornada_dia(item: schemas.JornadaDiaCreate):
   resposta = supabase.table("jornada_dia").insert(item.model_dump(mode="json")).execute()
   return resposta.data[0]




@app.get("/jornadas-dia")
def listar_jornadas_dia():
   return supabase.table("jornada_dia").select("*").execute().data

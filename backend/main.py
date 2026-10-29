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

@app.get("/")
def inicio():
    return {"mensagem": "API funcionando!"}

# ==========================================
# CRUD DE CATEGORIAS
# ==========================================
@app.post("/categorias", status_code=status.HTTP_201_CREATED)
def criar_categoria(cat: schemas.CategoriaCreate):
    resposta = supabase.table("categoria").insert(cat.model_dump(mode="json")).execute()
    return resposta.data[0]

@app.get("/categorias")
def listar_categorias():
    return supabase.table("categoria").select("*").execute().data

@app.put("/categorias/{id_categoria}")
def atualizar_categoria(id_categoria: int, cat: schemas.CategoriaCreate):
    resposta = supabase.table("categoria").update(cat.model_dump(mode="json")).eq("id_categoria", id_categoria).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return resposta.data[0]

@app.delete("/categorias/{id_categoria}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_categoria(id_categoria: int):
    resposta = supabase.table("categoria").delete().eq("id_categoria", id_categoria).execute()
    if not resposta.data:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    return None
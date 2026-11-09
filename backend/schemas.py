from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

# ==========================================
# CATEGORIA
# ==========================================
class CategoriaCreate(BaseModel):
    nome: str = Field(..., max_length=30)
    cor_hex: str = Field(..., min_length=7, max_length=7)
    peso_energia: int = Field(..., ge=1, le=5)

class CategoriaResponse(BaseModel):
    id_categoria: int
    nome: str
    cor_hex: str
    peso_energia: int
    padrao_sistema: bool

# ==========================================
# INSTITUIÇÃO
# ==========================================
class InstituicaoCreate(BaseModel):
    nome: str
    tipo: str
    cidade: str
    uf: str

# ==========================================
# CURSO
# ==========================================
class CursoCreate(BaseModel):
    id_instituicao: int
    nome: str
    turno: str
    duracao_semestres: int

# ==========================================
# ESTUDANTE
# ==========================================
class EstudanteCreate(BaseModel):
    id_instituicao: int
    id_curso: int
    nome: str = Field(..., max_length=150)
    data_nascimento: date
    email: str = Field(..., max_length=150)
    senha_hash: str = Field(..., max_length=255)
    ano_escolar: str = Field(..., pattern="^(1_ano|2_ano|3_ano)$")
    turno_escolar: str = Field(..., pattern="^(manha|tarde|noite)$")

class EstudanteResponse(BaseModel):
    id_estudante: int
    nome: str
    email: str

# ==========================================
# LOGIN
# ==========================================
class LoginRequest(BaseModel):
    email: str
    senha_hash: str

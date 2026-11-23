from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional

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
    id_curso: Optional[int] = None
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

# ==========================================
# DOCUMENTO BASE
# ==========================================
class DocumentoBaseCreate(BaseModel):
    titulo: str = Field(..., max_length=200)
    tipo: str = Field(..., pattern="^(guia|faq|relato_anonimizado|conteudo_educativo)$")
    fonte: str = Field(..., max_length=150)
    data_criacao: date
    sensivel: bool = False
    hash_conteudo: str = Field(..., min_length=64, max_length=64)

class DocumentoBaseResponse(BaseModel):
    id_documento: int
    titulo: str
    tipo: str
    fonte: str
    data_criacao: date
    sensivel: bool
    hash_conteudo: str

# ==========================================
# ESTUDANTE_DOCUMENTO (N:N)
# ==========================================
class EstudanteDocumentoCreate(BaseModel):
    id_documento: int

# ==========================================
# CATEGORIA
# ==========================================
class CategoriaCreate(BaseModel):
    nome: str = Field(..., max_length=30)
    cor_hex: str = Field(..., pattern="^#[0-9A-Fa-f]{6}$")
    peso_energia: int = Field(..., ge=1, le=5)
    padrao_sistema: bool = False

class CategoriaResponse(BaseModel):
    id_categoria: int
    nome: str
    cor_hex: str
    peso_energia: int
    padrao_sistema: bool

# ==========================================
# JORNADA DE TRABALHO
# ==========================================
class JornadaTrabalhoCreate(BaseModel):
    id_estudante: int
    tipo: str = Field(..., pattern="^(aprendiz|estagiario)$")
    empresa: str = Field(..., max_length=150)
    hora_inicio: str = Field(..., pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    hora_fim: str = Field(..., pattern="^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    carga_horaria_diaria: float = Field(..., gt=0, le=8)
    vigencia_inicio: date
    vigencia_fim: Optional[date] = None

class JornadaTrabalhoResponse(BaseModel):
    id_jornada: int
    id_estudante: int
    tipo: str
    empresa: str
    hora_inicio: str
    hora_fim: str
    carga_horaria_diaria: float
    vigencia_inicio: date
    vigencia_fim: Optional[date] = None

# ==========================================
# COMPROMISSO
# ==========================================
class CompromissoCreate(BaseModel):
    id_estudante: int
    id_categoria: int
    id_meta: Optional[int] = None
    titulo: str = Field(..., max_length=150)
    descricao: Optional[str] = None
    data_inicio: datetime
    data_fim: datetime
    dia_inteiro: bool = False
    local: Optional[str] = Field(None, max_length=150)
    prioridade: str = Field(..., pattern="^(baixa|media|alta|urgente)$")
    status: str = Field("pendente", pattern="^(pendente|em_andamento|concluido|cancelado)$")
    origem: str = Field("manual", pattern="^(manual|recorrencia|semana_especial|integracao_escolar)$")

class CompromissoResponse(BaseModel):
    id_compromisso: int
    id_estudante: int
    id_categoria: int
    id_meta: Optional[int] = None
    titulo: str
    descricao: Optional[str] = None
    data_inicio: datetime
    data_fim: datetime
    dia_inteiro: bool
    local: Optional[str] = None
    prioridade: str
    status: str
    origem: str
    criado_em: datetime

# ==========================================
# METAS
# ==========================================
class MetaCreate(BaseModel):
    id_estudante: int
    titulo: str = Field(..., max_length=150)
    descricao: Optional[str] = None
    prazo: Optional[date] = None
    progresso_manual: int = Field(0, ge=0, le=100)
    status: str = Field("ativa", pattern="^(ativa|concluida|cancelada)$")

class MetaUpdate(BaseModel):
    titulo: Optional[str] = Field(None, max_length=150)
    descricao: Optional[str] = None
    prazo: Optional[date] = None
    progresso_manual: Optional[int] = Field(None, ge=0, le=100)
    status: Optional[str] = Field(None, pattern="^(ativa|concluida|cancelada)$")

class MetaResponse(BaseModel):
    id_meta: int
    id_estudante: int
    titulo: str
    descricao: Optional[str]
    prazo: Optional[date]
    progresso_manual: int
    status: str
    criado_em: datetime

# ==========================================
# HABITO CHECKIN & BLOCO DESCOMPRESSÃO
# ==========================================
class CheckinCreate(BaseModel):
    id_compromisso: int
    data: date
    quantidade: int = 1

class CheckinUpdate(BaseModel):
    quantidade: int = Field(..., ge=0)

class BlocoDescompressaoCreate(BaseModel):
    id_compromisso: int
    tipo: str = Field(..., max_length=50)
    duracao_min: int = Field(..., gt=0)
    obrigatorio: bool = False
    sugestao_sistema: bool = False

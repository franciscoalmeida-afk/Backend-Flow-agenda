from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Literal, Optional




# ==========================================
# INSTITUIÇÃO
# ==========================================
class InstituicaoCreate(BaseModel):
   nome: str = Field(..., max_length=150)
   tipo: Literal["escola", "empresa", "ong", "outro"]
   cidade: str = Field(..., max_length=100)
   uf: str = Field(..., min_length=2, max_length=2)




class InstituicaoResponse(BaseModel):
   id_instituicao: int
   nome: str
   tipo: str
   cidade: str
   uf: str
   criado_em: datetime




# ==========================================
# CURSO
# ==========================================
class CursoCreate(BaseModel):
   id_instituicao: int
   nome: str = Field(..., max_length=150)
   turno: Literal["manha", "tarde", "noite", "integral"]
   duracao_semestres: int = Field(..., gt=0)




class CursoResponse(BaseModel):
   id_curso: int
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
   ano_escolar: Literal["1_ano", "2_ano", "3_ano"]
   turno_escolar: Literal["manha", "tarde", "noite"]




class EstudanteResponse(BaseModel):
   id_estudante: int
   id_instituicao: int
   id_curso: int
   nome: str
   data_nascimento: date
   email: str
   ano_escolar: str
   turno_escolar: str
   criado_em: datetime
  
   # ==========================================
# JORNADA DE TRABALHO
# ==========================================
class JornadaTrabalhoCreate(BaseModel):
   id_estudante: int
   tipo: Literal["aprendiz", "estagiario"]
   empresa: str = Field(..., max_length=150)
   hora_inicio: str  # formato "HH:MM:SS"
   hora_fim: str     # formato "HH:MM:SS"
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
# JORNADA DIA (só PK composta)
# ==========================================
class JornadaDiaCreate(BaseModel):
   id_jornada: int
   dia_semana: int = Field(..., ge=1, le=7)




class JornadaDiaResponse(BaseModel):
   id_jornada: int
   dia_semana: int

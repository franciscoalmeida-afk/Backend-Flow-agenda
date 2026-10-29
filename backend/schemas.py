from pydantic import BaseModel, Field

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
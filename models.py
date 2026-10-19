from sqlalchemy import Column, Integer, String, Text
from database import Base


class instituicao(Base):
   __tablename__ = "instituicao"


   id_instituicao = Column(
       Integer,
       primary_key=True,
       index=True
   )


   nome = Column(
       String(100),
       nullable=False
   )

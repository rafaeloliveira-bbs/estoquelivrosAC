from pydantic import BaseModel

class AlertaMinimoResposta(BaseModel):
    id: int
    livro_id: int
    filial_id: int
    quantidade_atual: int
    minimo_configurado: int
    ativo: bool
    
    class Config:
        from_attributes = True

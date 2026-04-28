from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.alerta_minimo import AlertaMinimo
from app.models.livro import Livro
from app.models.lote import Lote
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def verificar_alertas_minimos(db: Session, filial_id: int = None) -> list:
    """
    Check and create alerts for items below minimum stock.
    Runs as scheduled task daily.
    """
    filtro_query = Livro.estoque_minimo.isnot(None)
    if filial_id:
        filtro_query = (Livro.estoque_minimo.isnot(None)) & (Livro.filial_id == filial_id)
    else:
        filtro_query = Livro.estoque_minimo.isnot(None)
    
    livros_criticos = db.query(Livro).filter(filtro_query).all()
    alertas_criados = []
    
    for livro in livros_criticos:
        # Calculate total available stock
        total_disponivel = db.query(func.sum(Lote.quantidade_disponivel)).filter(
            Lote.livro_id == livro.id,
            Lote.filial_id == livro.filial_id
        ).scalar() or 0
        
        if total_disponivel <= livro.estoque_minimo:
            # Check if alert already exists for this book
            alerta_existe = db.query(AlertaMinimo).filter(
                AlertaMinimo.livro_id == livro.id,
                AlertaMinimo.filial_id == livro.filial_id,
                AlertaMinimo.ativo == True
            ).first()
            
            if not alerta_existe:
                alerta = AlertaMinimo(
                    livro_id=livro.id,
                    filial_id=livro.filial_id,
                    quantidade_atual=int(total_disponivel),
                    minimo_configurado=livro.estoque_minimo,
                    ativo=True,
                    criado_em=datetime.utcnow()
                )
                db.add(alerta)
                alertas_criados.append({
                    "livro_id": livro.id,
                    "livro_titulo": livro.titulo,
                    "isbn": livro.isbn,
                    "quantidade_atual": int(total_disponivel),
                    "minimo": livro.estoque_minimo
                })
    
    db.commit()
    
    if alertas_criados:
        logger.warning(f"Alertas de estoque mínimo criados: {len(alertas_criados)}")
    
    return alertas_criados

def limpar_alertas_resolvidos(db: Session, filial_id: int = None):
    """
    Deactivate alerts for items that are back to acceptable stock.
    """
    query = db.query(AlertaMinimo).filter(AlertaMinimo.ativo == True)
    if filial_id:
        query = query.filter(AlertaMinimo.filial_id == filial_id)
    
    alertas = query.all()
    alertas_resolvidos = []
    
    for alerta in alertas:
        total_disponivel = db.query(func.sum(Lote.quantidade_disponivel)).filter(
            Lote.livro_id == alerta.livro_id,
            Lote.filial_id == alerta.filial_id
        ).scalar() or 0
        
        if total_disponivel > alerta.livro.estoque_minimo:
            alerta.ativo = False
            alerta.verificado_em = datetime.utcnow()
            db.add(alerta)
            alertas_resolvidos.append(alerta.livro.titulo)
    
    db.commit()
    
    if alertas_resolvidos:
        logger.info(f"Alertas resolvidos: {', '.join(alertas_resolvidos)}")
    
    return alertas_resolvidos

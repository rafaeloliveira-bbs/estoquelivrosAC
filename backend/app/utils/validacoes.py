from datetime import datetime

def validar_quantidade(quantidade: int) -> bool:
    """Validate if quantity is positive"""
    return quantidade > 0

def validar_preco(preco: float) -> bool:
    """Validate if price is positive"""
    return preco >= 0

def formatar_data_br(data: datetime) -> str:
    """Format date in Brazilian format"""
    return data.strftime("%d/%m/%Y")

def formatar_data_hora_br(data: datetime) -> str:
    """Format datetime in Brazilian format"""
    return data.strftime("%d/%m/%Y %H:%M:%S")

def formatar_moeda_br(valor: float) -> str:
    """Format currency in Brazilian format"""
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

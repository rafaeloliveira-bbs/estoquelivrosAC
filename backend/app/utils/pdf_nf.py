import re
import io


def _limpar_decimal(s: str) -> float:
    """Converte '1.234,56' ou '185,00' para float."""
    s = s.strip()
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '.')
    return float(s)


def extrair_numero_nf(texto: str) -> str:
    """Extrai o número limpo da NF. 'Nº000.002.206' → '2206'."""
    m = re.search(r'N[ºo°]\s*(\d{3})[.\s](\d{3})[.\s](\d{3})', texto)
    if m:
        return str(int(m.group(1) + m.group(2) + m.group(3)))
    return ''


def extrair_data_emissao(texto: str) -> str:
    """Extrai a data de emissão no formato DD/MM/AAAA."""
    m = re.search(r'DATA\s+DA\s+EMISS[ÃA]O\s+(\d{2}/\d{2}/\d{4})', texto, re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(r'EMISS[ÃA]O[:\s]+(\d{2}/\d{2}/\d{4})', texto, re.IGNORECASE)
    if m:
        return m.group(1)
    dates = re.findall(r'\d{2}/\d{2}/\d{4}', texto)
    return dates[0] if dates else ''


def extrair_itens_danfe(texto: str) -> list[dict]:
    """
    Extrai itens do DANFE.
    Formato de cada linha de produto:
      cod_produto  descrição  NCM(8dig)  CST(3dig)  CFOP(4dig)  UNID  quant  v_unit  v_total  ...
    """
    itens = []
    # NCM (8 dígitos consecutivos) serve como âncora para separar descrição do restante
    pattern = re.compile(
        r'^(\d{7,20})\s+'                  # cod_produto (EAN-13, ISBN, etc.)
        r'(.+?)\s+'                         # descrição (lazy)
        r'\d{8}\s+'                         # NCM (8 dígitos exatos)
        r'\d{3}\s+'                         # CST
        r'\d{4}\s+'                         # CFOP
        r'[A-Z]{1,4}\s+'                    # UNID (ex: UND, CX, PC)
        r'([\d]+(?:[.,][\d]+)?)\s+'         # Quantidade
        r'([\d]+[.,][\d]{1,2})\s+'          # V. UNIT
        r'([\d]+[.,][\d]{1,2})',            # V. TOTAL
        re.MULTILINE,
    )
    for m in pattern.finditer(texto):
        try:
            itens.append({
                'titulo_nf': m.group(2).strip(),
                'quantidade': int(float(m.group(3).replace(',', '.'))),
                'valor_unitario': _limpar_decimal(m.group(4)),
                'valor_total': _limpar_decimal(m.group(5)),
            })
        except (ValueError, IndexError):
            continue
    return itens


def extrair_dados_nf(pdf_bytes: bytes) -> dict:
    """Extrai data de emissão, número da NF e itens de um DANFE em PDF."""
    import pdfplumber

    textos: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                textos.append(t)

    texto = '\n'.join(textos)
    return {
        'data': extrair_data_emissao(texto),
        'numero_nf': extrair_numero_nf(texto),
        'itens': extrair_itens_danfe(texto),
    }

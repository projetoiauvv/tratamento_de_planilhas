"""
Lógica de leitura e tratamento das planilhas.

As transformações reproduzem fielmente as fórmulas de Excel fornecidas:

* WhatsApp:
    =SE(E2="";"";SE(ESQUERDA(SUBSTITUIR(ARRUMAR(E2);"+";"");2)="55";<limpo>;"55"&<limpo>))
  onde <limpo> = ARRUMAR(E2) sem "+", " ", "(", ")", "-".

* Nome:
    =PRI.MAIÚSCULA(ESQUERDA(C2;PROCURAR(" ";C2&" ")-1))

* Sobrenome:
    =PRI.MAIÚSCULA(ARRUMAR(DIREITA(C2;NÚM.CARACT(C2)-PROCURAR(" ";C2))))
"""

import os

import pandas as pd

# Campos de destino exibidos na coluna esquerda do mapeamento.
# 'setor' é especial: não mapeia uma coluna, e sim um valor fixo.
TARGET_FIELDS = [
    {"key": "nome_completo", "label": "Nome completo", "required": True, "type": "column"},
    {"key": "whatsapp", "label": "Whatsapp (com DDD)", "required": True, "type": "column"},
    {"key": "setor", "label": "Setor", "required": True, "type": "setor"},
    {"key": "curso", "label": "Curso", "required": False, "type": "column"},
    {"key": "email", "label": "e-mail", "required": False, "type": "column"},
]

# Setores: rótulo exibido -> valor gravado na planilha tratada.
SETORES = [
    {"label": "Comercial", "value": "COMERCIAL"},
    {"label": "Financeiro", "value": "FINANCEIRO"},
    {"label": "Nova", "value": "NOVA"},
    {"label": "Proead", "value": "PROEAD"},
    {"label": "Central de informação", "value": "CENTRAL"},
    {"label": "Nuprajur", "value": "NUPRAJUR"},
    {"label": "Nace", "value": "NACE"},
    {"label": "Policlínica", "value": "POLICLINICA"},
    {"label": "Hospital veterinário", "value": "VETERINARIO"},
    {"label": "Outros", "value": "OUTROS"},
]

SETOR_OUTROS_VALUE = "OUTROS"

HUBSPOT_COLUMNS = {
    "nome": "Nome",
    "sobrenome": "Sobrenome",
    "whatsapp": "Número de telefone",
    "email": "E-mail",
    "curso": "Nome do Curso",
    "proprietario": "Proprietário do negócio",
    "id_hub": "Negócio ID",
}


def read_table(path: str) -> pd.DataFrame:
    """Lê um arquivo CSV ou XLSX/XLS como DataFrame, tudo como texto."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xls"):
        df = pd.read_excel(path, dtype=str)
    elif ext == ".csv":
        df = _read_csv_robusto(path)
    else:
        raise ValueError(f"Extensão não suportada: {ext}")

    # Normaliza nomes de coluna (string, sem espaços nas pontas).
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _read_csv_robusto(path: str) -> pd.DataFrame:
    """Tenta ler CSV com diferentes codificações e detecção de separador."""
    encodings = ["utf-8-sig", "utf-8", "latin-1"]
    last_error = None
    for enc in encodings:
        try:
            # sep=None + engine='python' detecta o delimitador automaticamente.
            return pd.read_csv(path, dtype=str, sep=None, engine="python", encoding=enc)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise ValueError(f"Falha ao ler CSV: {last_error}")


def _to_text(value) -> str:
    """Converte um valor de célula para texto limpo, tratando NaN/None."""
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value)
    if text.strip().lower() in ("nan", "none"):
        return ""
    return text


def tratar_whatsapp(value) -> str:
    """Reproduz a fórmula de tratamento do WhatsApp."""
    raw = _to_text(value)
    arrumado = raw.strip()  # ARRUMAR (remove espaços das pontas)
    if arrumado == "":
        return ""

    # <limpo>: remove "+", " ", "(", ")", "-".
    limpo = (
        arrumado.replace("+", "")
        .replace(" ", "")
        .replace("(", "")
        .replace(")", "")
        .replace("-", "")
    )

    # Verificação: ESQUERDA(SUBSTITUIR(ARRUMAR(E2);"+";"");2) = "55"
    inicio = arrumado.replace("+", "")[:2]
    if inicio == "55":
        return limpo
    return "55" + limpo


def _pri_maiuscula(texto: str) -> str:
    """Equivalente a PRI.MAIÚSCULA (PROPER): primeira letra de cada palavra."""
    return texto.title()


def tratar_nome(value) -> str:
    """=PRI.MAIÚSCULA(ESQUERDA(C2;PROCURAR(" ";C2&" ")-1))"""
    texto = _to_text(value)
    # PROCURAR(" "; C2 & " ") -> posição do primeiro espaço (sempre existe pois
    # concatenamos um espaço ao final). ESQUERDA pega tudo antes desse espaço.
    primeiro = (texto + " ").split(" ", 1)[0]
    return _pri_maiuscula(primeiro)


def tratar_sobrenome(value) -> str:
    """=PRI.MAIÚSCULA(ARRUMAR(DIREITA(C2;NÚM.CARACT(C2)-PROCURAR(" ";C2))))"""
    texto = _to_text(value)
    # PROCURAR(" "; C2) sem o espaço extra: se não houver espaço, a fórmula
    # original gera erro -> aqui devolvemos vazio (não há sobrenome).
    if " " not in texto:
        return ""
    resto = texto.split(" ", 1)[1].strip()  # DIREITA(...) + ARRUMAR
    return _pri_maiuscula(resto)


def normalizar_setor_outros(value) -> str:
    """Normaliza o setor digitado pelo usuário quando a opção Outros é usada."""
    return _to_text(value).strip().upper()


def process_dataframe(df: pd.DataFrame, mapping: dict, setor: str) -> pd.DataFrame:
    """Aplica o tratamento e devolve o DataFrame final.

    Colunas de saída: Nome, Sobrenome, Whatsapp, Setor, Curso, E-mail.
    """
    col_nome = mapping.get("nome_completo")
    col_whats = mapping.get("whatsapp")
    col_curso = mapping.get("curso")
    col_email = mapping.get("email")

    def _serie(col):
        if col and col in df.columns:
            return df[col]
        return pd.Series([""] * len(df), index=df.index)

    nome_src = _serie(col_nome)
    whats_src = _serie(col_whats)

    out = pd.DataFrame()
    out["Nome"] = nome_src.apply(tratar_nome)
    out["Sobrenome"] = nome_src.apply(tratar_sobrenome)
    out["Whatsapp"] = whats_src.apply(tratar_whatsapp)
    out["Setor"] = setor
    out["Curso"] = _serie(col_curso).apply(_to_text)
    out["E-mail"] = _serie(col_email).apply(_to_text)

    return out


def process_hubspot_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Trata a base HubSpot usando os nomes fixos de coluna do modelo."""
    missing = [col for col in HUBSPOT_COLUMNS.values() if col not in df.columns]
    if missing:
        raise ValueError("Colunas obrigatórias da base HubSpot ausentes: " + ", ".join(missing))

    out = pd.DataFrame()
    out["Nome"] = df[HUBSPOT_COLUMNS["nome"]].apply(lambda value: _pri_maiuscula(_to_text(value).strip()))
    out["Sobrenome"] = df[HUBSPOT_COLUMNS["sobrenome"]].apply(lambda value: _pri_maiuscula(_to_text(value).strip()))
    out["Whatsapp"] = df[HUBSPOT_COLUMNS["whatsapp"]].apply(tratar_whatsapp)
    out["Setor"] = "COMERCIAL"
    out["Curso"] = df[HUBSPOT_COLUMNS["curso"]].apply(_to_text)
    out["E-mail"] = df[HUBSPOT_COLUMNS["email"]].apply(_to_text)
    out["Proprietário do negócio"] = df[HUBSPOT_COLUMNS["proprietario"]].apply(_to_text)
    out["Id Hub"] = df[HUBSPOT_COLUMNS["id_hub"]].apply(_to_text)

    return out

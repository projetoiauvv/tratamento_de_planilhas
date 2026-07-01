"""Testes das transformações de tratamento de planilha."""

import pandas as pd

from processing import (
    process_dataframe,
    tratar_nome,
    tratar_sobrenome,
    tratar_whatsapp,
)


def test_whatsapp_com_55():
    assert tratar_whatsapp("+55 (27) 99999-8888") == "5527999998888"


def test_whatsapp_sem_55():
    assert tratar_whatsapp("(27) 99999-8888") == "5527999998888"


def test_whatsapp_so_numeros_sem_ddi():
    assert tratar_whatsapp("27999998888") == "5527999998888"


def test_whatsapp_vazio():
    assert tratar_whatsapp("") == ""
    assert tratar_whatsapp("   ") == ""
    assert tratar_whatsapp(None) == ""


def test_whatsapp_ja_com_55():
    assert tratar_whatsapp("5527999998888") == "5527999998888"


def test_nome_simples():
    assert tratar_nome("joão da silva") == "João"


def test_nome_unico():
    assert tratar_nome("maria") == "Maria"


def test_sobrenome_simples():
    assert tratar_sobrenome("joão da silva") == "Da Silva"


def test_sobrenome_sem_espaco():
    assert tratar_sobrenome("maria") == ""


def test_sobrenome_espacos_extras():
    assert tratar_sobrenome("ana   paula souza") == "Paula Souza"


def test_process_dataframe():
    df = pd.DataFrame(
        {
            "nome": ["josé carlos pereira", "ana"],
            "fone": ["+55 27 98888-7777", "11999990000"],
            "curso": ["Direito", "Medicina"],
            "mail": ["jose@x.com", "ana@y.com"],
        }
    )
    mapping = {
        "nome_completo": "nome",
        "whatsapp": "fone",
        "curso": "curso",
        "email": "mail",
    }
    out = process_dataframe(df, mapping, "COMERCIAL")

    assert list(out.columns) == [
        "Nome",
        "Sobrenome",
        "Whatsapp",
        "Setor",
        "Curso",
        "E-mail",
    ]
    assert out.loc[0, "Nome"] == "José"
    assert out.loc[0, "Sobrenome"] == "Carlos Pereira"
    assert out.loc[0, "Whatsapp"] == "5527988887777"
    assert out.loc[1, "Whatsapp"] == "5511999990000"
    assert (out["Setor"] == "COMERCIAL").all()
    assert out.loc[1, "Sobrenome"] == ""


def test_normalizar_setor_outros():
    from processing import normalizar_setor_outros

    assert normalizar_setor_outros("  atendimento especial ") == "ATENDIMENTO ESPECIAL"
    assert normalizar_setor_outros(None) == ""


def test_process_hubspot_dataframe():
    from processing import process_hubspot_dataframe

    df = pd.DataFrame(
        {
            "Nome": ["ana"],
            "Sobrenome": ["maria"],
            "Número de telefone": ["(27) 99999-8888"],
            "E-mail": ["ana@example.com"],
            "Nome do Curso": ["Direito"],
            "Proprietário do negócio": ["João Dono"],
            "Negócio ID": ["12345"],
        }
    )

    out = process_hubspot_dataframe(df)

    assert list(out.columns) == [
        "Nome",
        "Sobrenome",
        "Whatsapp",
        "Setor",
        "Curso",
        "E-mail",
        "Proprietário do negócio",
        "Id Hub",
    ]
    assert out.loc[0, "Nome"] == "Ana"
    assert out.loc[0, "Sobrenome"] == "Maria"
    assert out.loc[0, "Whatsapp"] == "5527999998888"
    assert out.loc[0, "Setor"] == "COMERCIAL"
    assert out.loc[0, "Id Hub"] == "12345"

if __name__ == "__main__":
    import sys

    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL {name}: {e}")
    sys.exit(1 if failures else 0)

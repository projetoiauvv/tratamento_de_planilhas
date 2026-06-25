# Tratamento de Planilhas

Aplicativo web para tratamento automático de planilhas. Você envia um arquivo
**CSV** ou **XLSX**, mapeia as colunas para os campos do modelo e baixa a
planilha já tratada.

## Funcionalidades

- Aceita arquivos `.csv`, `.xlsx` e `.xls`.
- Mapeamento interativo de colunas (estilo "Template Fields → Columns in your File"):
  - **Nome completo** *(obrigatório)* — dividido em `Nome` e `Sobrenome`.
  - **Whatsapp (com DDD)** *(obrigatório)* — normalizado.
  - **Setor** *(obrigatório)* — escolhido a partir de uma lista fixa.
  - **Curso** *(opcional)*.
  - **e-mail** *(opcional)*.
- Pré-seleção automática de colunas com nomes parecidos.
- Saída em `.xlsx` com as colunas: `Nome`, `Sobrenome`, `Whatsapp`, `Setor`,
  `Curso`, `E-mail`.

## Regras de tratamento

As transformações reproduzem fielmente as fórmulas de Excel originais.

### WhatsApp

```
=SE(E2="";"";SE(ESQUERDA(SUBSTITUIR(ARRUMAR(E2);"+";"");2)="55";<limpo>;"55"&<limpo>))
```

- Célula vazia permanece vazia.
- Remove `+`, espaços, `(`, `)` e `-`.
- Se já começa com `55`, mantém; caso contrário, prefixa `55`.
- O número é gravado como **texto** para preservar zeros e evitar notação científica.

### Nome / Sobrenome

```
Nome      = PRI.MAIÚSCULA(ESQUERDA(C2;PROCURAR(" ";C2&" ")-1))
Sobrenome = PRI.MAIÚSCULA(ARRUMAR(DIREITA(C2;NÚM.CARACT(C2)-PROCURAR(" ";C2))))
```

- `Nome`: primeira palavra, com inicial maiúscula.
- `Sobrenome`: restante após o primeiro espaço, com iniciais maiúsculas (vazio se não houver espaço).

### Setores

| Opção exibida          | Valor gravado |
|------------------------|---------------|
| Comercial              | `COMERCIAL`   |
| Financeiro             | `FINANCEIRO`  |
| Nova                   | `NOVA`        |
| Proead                 | `PROEAD`      |
| Central de informação  | `CENTRAL`     |
| Nuprajur               | `NUPRAJUR`    |
| Nace                   | `NACE`        |
| Policlínica            | `POLICLINICA` |
| Hospital veterinário   | `VETERINARIO` |

## Como executar

```bash
# 1. Instale as dependências
pip install -r requirements.txt

# 2. Inicie o servidor
python app.py

# 3. Acesse no navegador
# http://localhost:5000
```

## Testes

```bash
python test_processing.py
```

## Estrutura

```
app.py              # rotas Flask (upload / processamento)
processing.py       # leitura e tratamento das planilhas
templates/index.html
static/css/style.css
static/js/main.js
test_processing.py  # testes das transformações
```

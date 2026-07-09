# Tratamento de Planilhas

Aplicativo web para tratamento automático de planilhas. A versão estática em `index.html` fica na raiz do repositório para funcionar no GitHub Pages/raiz da branch `main`: você envia um arquivo **CSV** ou **XLSX**, mapeia as colunas para os campos do modelo, pré-visualiza o resultado e baixa a planilha já tratada diretamente no navegador.

## Funcionalidades

- Aceita arquivos `.csv`, `.xlsx` e `.xls`.
- Escolha inicial entre **Base de dados HubSpot** (modelo fixo sem mapeamento) e **Base de dados padrão**.
- Mapeamento interativo de colunas para a base padrão (estilo "Template Fields → Columns in your File"):
  - **Nome completo** *(obrigatório)* — dividido em `Nome` e `Sobrenome`.
  - **Whatsapp (com DDD)** *(obrigatório)* — normalizado.
  - **Setor** *(obrigatório)* — escolhido a partir de uma lista fixa.
  - **Curso** *(opcional)*.
  - **e-mail** *(opcional)*.
- Pré-seleção automática de colunas com nomes parecidos.
- Pré-visualização no site das primeiras linhas já tratadas antes do download.
- Saída padrão em `.xlsx` com as colunas: `Nome`, `Sobrenome`, `Whatsapp`, `Setor`,
  `Curso`, `E-mail`.
- Saída HubSpot em `.xlsx` também inclui `atribuicao`, `id_hub` e `Etiqueta`, usando `Proprietário do negócio`, `Negócio ID` e `etiqueta` como origem.

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

### Base de dados HubSpot

Quando a opção **Base de dados HubSpot** é escolhida, não há mapeamento manual. O app espera as colunas fixas `Nome`, `Sobrenome`, `Número de telefone`, `E-mail`, `Nome do Curso`, `Proprietário do negócio`, `Negócio ID` e `etiqueta`. O setor é sempre gravado como `COMERCIAL`, `Número de telefone` recebe o mesmo tratamento de Whatsapp e sai como `WhatsApp number`, `Nome do Curso` sai como `curso_aluno`, `Proprietário do negócio` sai como `atribuicao`, `Negócio ID` sai como `id_hub`, e `etiqueta` sai como `Etiqueta`.

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
| Outros                 | texto digitado em maiúsculas |

## Como executar

### Site estático na raiz

Abra `index.html` diretamente ou publique a raiz da branch `main` no GitHub Pages. Essa é a página que deve aparecer em vez do README.

### Servidor Flask opcional

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
index.html          # site estático para GitHub Pages/raiz da branch main
templates/index.html
static/css/style.css
static/js/browser-app.js # tratamento no navegador
static/js/main.js
test_processing.py  # testes das transformações
```

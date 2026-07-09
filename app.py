"""
Aplicativo web para tratamento automático de planilhas.

Fluxo:
  1. O usuário envia um arquivo CSV ou XLSX.
  2. O backend lê os cabeçalhos e devolve as colunas disponíveis.
  3. O usuário mapeia os campos de destino para as colunas do arquivo
     (e escolhe o Setor a partir de uma lista fixa).
  4. O backend gera a planilha tratada e devolve para download.
"""

import io
import os
import uuid

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_file,
)
from werkzeug.utils import secure_filename

from processing import (
    SETOR_OUTROS_VALUE,
    SETORES,
    TARGET_FIELDS,
    normalizar_setor_outros,
    process_dataframe,
    process_hubspot_dataframe,
    read_table,
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH


def _allowed_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


@app.route("/")
def index():
    return render_template(
        "index.html",
        target_fields=TARGET_FIELDS,
        setores=SETORES,
    )


@app.route("/upload", methods=["POST"])
def upload():
    """Recebe o arquivo, salva temporariamente e devolve as colunas."""
    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "Nenhum arquivo selecionado."}), 400

    if not _allowed_file(file.filename):
        return (
            jsonify({"error": "Formato inválido. Envie um arquivo .csv, .xlsx ou .xls."}),
            400,
        )

    original_name = secure_filename(file.filename)
    ext = os.path.splitext(original_name)[1].lower()
    file_id = uuid.uuid4().hex
    stored_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    file.save(stored_path)

    try:
        df = read_table(stored_path)
    except Exception as exc:  # noqa: BLE001 - devolvemos a mensagem ao usuário
        if os.path.exists(stored_path):
            os.remove(stored_path)
        return jsonify({"error": f"Não foi possível ler o arquivo: {exc}"}), 400

    columns = [str(c) for c in df.columns]
    if not columns:
        os.remove(stored_path)
        return jsonify({"error": "O arquivo não possui colunas válidas."}), 400

    return jsonify(
        {
            "file_id": file_id,
            "filename": original_name,
            "columns": columns,
            "row_count": int(len(df)),
        }
    )


def _get_stored_path(file_id: str):
    """Localiza o arquivo salvo (independente da extensão)."""
    for ext in ALLOWED_EXTENSIONS:
        candidate = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
        if os.path.exists(candidate):
            return candidate
    return None


def _validate_payload(data: dict):
    """Valida o mapeamento enviado pelo site e devolve arquivo/mapeamento/setor."""
    file_id = data.get("file_id")
    mode = data.get("mode", "padrao")
    mapping = data.get("mapping") or {}
    setor = data.get("setor")
    setor_outros = data.get("setor_outros")

    if not file_id:
        return None, None, None, "Sessão inválida. Envie o arquivo novamente."

    stored_path = _get_stored_path(file_id)
    if not stored_path:
        return None, None, None, "Arquivo expirado ou não encontrado. Envie novamente."

    if mode == "hubspot":
        return stored_path, None, None, None

    errors = []
    for field in TARGET_FIELDS:
        if field["required"] and field["key"] != "setor":
            if not mapping.get(field["key"]):
                errors.append(f"O campo '{field['label']}' é obrigatório.")

    valid_setores = {s["value"] for s in SETORES}
    if not setor:
        errors.append("O campo 'Setor' é obrigatório.")
    elif setor not in valid_setores:
        errors.append("Setor inválido.")
    elif setor == SETOR_OUTROS_VALUE:
        setor_personalizado = normalizar_setor_outros(setor_outros)
        if not setor_personalizado:
            errors.append("Digite o nome do setor quando selecionar 'Outros'.")
        else:
            setor = setor_personalizado

    if errors:
        return None, None, None, " ".join(errors)

    return stored_path, mapping, setor, None


@app.route("/preview", methods=["POST"])
def preview():
    """Mostra no site uma prévia da planilha já tratada."""
    data = request.get_json(silent=True) or {}
    stored_path, mapping, setor, error = _validate_payload(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        df = read_table(stored_path)
        mode = data.get("mode", "padrao")
        result = process_hubspot_dataframe(df) if mode == "hubspot" else process_dataframe(df, mapping, setor)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Erro ao pré-visualizar: {exc}"}), 400

    preview_df = result.head(10).fillna("")
    return jsonify(
        {
            "columns": [str(c) for c in preview_df.columns],
            "rows": preview_df.astype(str).values.tolist(),
            "total_rows": int(len(result)),
        }
    )


@app.route("/process", methods=["POST"])
def process():
    """Aplica o tratamento e devolve a planilha resultante (XLSX)."""
    data = request.get_json(silent=True) or {}
    stored_path, mapping, setor, error = _validate_payload(data)
    if error:
        return jsonify({"error": error}), 400

    try:
        df = read_table(stored_path)
        mode = data.get("mode", "padrao")
        result = process_hubspot_dataframe(df) if mode == "hubspot" else process_dataframe(df, mapping, setor)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Erro ao processar: {exc}"}), 400

    output = io.BytesIO()
    result.to_excel(output, index=False, engine="openpyxl")
    output.seek(0)

    # Limpeza do arquivo temporário após o processamento.
    try:
        os.remove(stored_path)
    except OSError:
        pass

    return send_file(
        output,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="planilha_tratada.xlsx",
    )


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "Arquivo muito grande (limite de 25 MB)."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

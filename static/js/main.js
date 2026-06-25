(function () {
  "use strict";

  const { targetFields, setores } = window.APP_DATA;

  const fileInput = document.getElementById("file-input");
  const browseBtn = document.getElementById("browse-btn");
  const dropzone = document.getElementById("dropzone");
  const fileInfo = document.getElementById("file-info");
  const stepMap = document.getElementById("step-map");
  const stepProcess = document.getElementById("step-process");
  const mapRows = document.getElementById("map-rows");
  const processBtn = document.getElementById("process-btn");
  const messageEl = document.getElementById("message");

  let state = { fileId: null, columns: [] };

  // ---------- Mensagens ----------
  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + type;
    messageEl.classList.remove("hidden");
  }
  function clearMessage() {
    messageEl.classList.add("hidden");
  }

  // ---------- Upload ----------
  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) uploadFile(fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
  });

  async function uploadFile(file) {
    clearMessage();
    const formData = new FormData();
    formData.append("file", file);

    fileInfo.classList.remove("hidden");
    fileInfo.textContent = "Enviando " + file.name + "…";

    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no envio.");

      state.fileId = data.file_id;
      state.columns = data.columns;
      fileInfo.innerHTML =
        "✓ <strong>" + escapeHtml(data.filename) + "</strong> — " +
        data.columns.length + " colunas, " + data.row_count + " linhas.";
      buildMapping();
      stepMap.classList.remove("hidden");
      stepProcess.classList.remove("hidden");
    } catch (err) {
      fileInfo.classList.add("hidden");
      showMessage(err.message, "error");
    }
  }

  // ---------- Mapeamento ----------
  function buildMapping() {
    mapRows.innerHTML = "";
    targetFields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "map-row";

      const label = document.createElement("div");
      label.className = "field-label";
      label.innerHTML =
        escapeHtml(field.label) +
        (field.required ? '<span class="req">*</span>' : "");

      const select = document.createElement("select");
      select.dataset.key = field.key;
      select.dataset.type = field.type;

      if (field.type === "setor") {
        // Lista fixa de setores (valor gravado = value).
        select.appendChild(makeOption("", "Selecione o setor"));
        setores.forEach((s) =>
          select.appendChild(makeOption(s.value, s.label))
        );
        select.addEventListener("change", () => toggleOtherSectorInput(row, select));
      } else {
        // Colunas do arquivo enviado.
        select.appendChild(makeOption("", "Selecione uma coluna"));
        state.columns.forEach((col) =>
          select.appendChild(makeOption(col, col))
        );
        autoSelect(select, field);
      }

      select.addEventListener("change", () => select.classList.remove("invalid"));

      row.appendChild(label);
      row.appendChild(select);
      if (field.type === "setor") {
        const otherInput = document.createElement("input");
        otherInput.type = "text";
        otherInput.className = "other-sector-input hidden";
        otherInput.dataset.key = "setor_outros";
        otherInput.placeholder = "Digite o nome do setor";
        otherInput.maxLength = 80;
        otherInput.addEventListener("input", () => otherInput.classList.remove("invalid"));
        row.appendChild(otherInput);
      }
      mapRows.appendChild(row);
    });
  }

  function toggleOtherSectorInput(row, select) {
    const input = row.querySelector('input[data-key="setor_outros"]');
    if (!input) return;
    const show = select.value === "OUTROS";
    input.classList.toggle("hidden", !show);
    if (!show) {
      input.value = "";
      input.classList.remove("invalid");
    }
  }

  // Tenta pré-selecionar uma coluna com nome parecido com o campo.
  function autoSelect(select, field) {
    const hints = {
      nome_completo: ["nome completo", "nome", "name", "full name"],
      whatsapp: ["whatsapp", "whats", "celular", "telefone", "fone", "mobile", "phone"],
      curso: ["curso", "course"],
      email: ["e-mail", "email", "mail"],
    };
    const candidates = hints[field.key] || [];
    const match = state.columns.find((col) => {
      const c = col.toLowerCase().trim();
      return candidates.some((h) => c === h || c.includes(h));
    });
    if (match) select.value = match;
  }

  function makeOption(value, text) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  // ---------- Processamento ----------
  processBtn.addEventListener("click", processFile);

  async function processFile() {
    clearMessage();
    const selects = mapRows.querySelectorAll("select");
    const mapping = {};
    let setor = "";
    let setorOutros = "";
    let valid = true;

    selects.forEach((sel) => {
      const key = sel.dataset.key;
      const isSetor = sel.dataset.type === "setor";
      const field = targetFields.find((f) => f.key === key);

      if (isSetor) {
        setor = sel.value;
        if (field.required && !setor) {
          sel.classList.add("invalid");
          valid = false;
        }
        if (setor === "OUTROS") {
          const otherInput = sel.closest(".map-row").querySelector('input[data-key="setor_outros"]');
          setorOutros = otherInput ? otherInput.value.trim() : "";
          if (!setorOutros) {
            if (otherInput) otherInput.classList.add("invalid");
            valid = false;
          }
        }
      } else {
        if (sel.value) mapping[key] = sel.value;
        if (field.required && !sel.value) {
          sel.classList.add("invalid");
          valid = false;
        }
      }
    });

    if (!valid) {
      showMessage("Preencha todos os campos obrigatórios (*).", "error");
      return;
    }

    processBtn.disabled = true;
    const originalLabel = processBtn.textContent;
    processBtn.innerHTML = '<span class="spinner"></span>Processando…';

    try {
      const res = await fetch("/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: state.fileId, mapping, setor, setor_outros: setorOutros }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao processar.");
      }

      const blob = await res.blob();
      downloadBlob(blob, "planilha_tratada.xlsx");
      showMessage("Planilha tratada gerada com sucesso! O download foi iniciado.", "success");
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = originalLabel;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();

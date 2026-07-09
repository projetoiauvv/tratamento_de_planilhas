(function () {
  "use strict";

  const targetFields = [
    { key: "nome_completo", label: "Nome completo", required: true, type: "column" },
    { key: "whatsapp", label: "Whatsapp (com DDD)", required: true, type: "column" },
    { key: "setor", label: "Setor", required: true, type: "setor" },
    { key: "curso", label: "Curso", required: false, type: "column" },
    { key: "email", label: "e-mail", required: false, type: "column" },
  ];

  const setores = [
    { label: "Comercial", value: "COMERCIAL" },
    { label: "Financeiro", value: "FINANCEIRO" },
    { label: "Nova", value: "NOVA" },
    { label: "Proead", value: "PROEAD" },
    { label: "Central de informação", value: "CENTRAL" },
    { label: "Nuprajur", value: "NUPRAJUR" },
    { label: "Nace", value: "NACE" },
    { label: "Policlínica", value: "POLICLINICA" },
    { label: "Hospital veterinário", value: "VETERINARIO" },
    { label: "Outros", value: "OUTROS" },
  ];

  const modeInputs = document.querySelectorAll('input[name="base-mode"]');
  const fileInput = document.getElementById("file-input");
  const browseBtn = document.getElementById("browse-btn");
  const dropzone = document.getElementById("dropzone");
  const fileInfo = document.getElementById("file-info");
  const stepMap = document.getElementById("step-map");
  const stepPreview = document.getElementById("step-preview");
  const stepProcess = document.getElementById("step-process");
  const mapRows = document.getElementById("map-rows");
  const previewBtn = document.getElementById("preview-btn");
  const previewArea = document.getElementById("preview-area");
  const processBtn = document.getElementById("process-btn");
  const messageEl = document.getElementById("message");

  let state = { filename: "", columns: [], rows: [], mode: getSelectedMode() };

  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.mode = getSelectedMode();
      clearMessage();
      resetPreview();
      if (state.rows.length) {
        prepareFlowAfterLoad();
      }
    });
  });

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) loadFile(fileInput.files[0]);
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
    if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
  });

  async function loadFile(file) {
    clearMessage();
    resetPreview();
    fileInfo.classList.remove("hidden");
    fileInfo.textContent = "Lendo " + file.name + "…";

    try {
      if (!window.XLSX) throw new Error("Biblioteca de planilhas não carregada. Recarregue a página.");
      const ext = file.name.split(".").pop().toLowerCase();
      if (!["csv", "xlsx", "xls"].includes(ext)) {
        throw new Error("Formato inválido. Envie um arquivo .csv, .xlsx ou .xls.");
      }

      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("O arquivo não possui abas para leitura.");

      const sheet = workbook.Sheets[firstSheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      if (!rows.length) throw new Error("O arquivo não possui linhas de dados.");

      const columns = Object.keys(rows[0]).map((column) => String(column).trim());
      if (!columns.length) throw new Error("O arquivo não possui colunas válidas.");
      const normalizedRows = rows.map((row) => {
        const normalized = {};
        Object.entries(row).forEach(([key, value]) => {
          normalized[String(key).trim()] = value;
        });
        return normalized;
      });

      state = { filename: file.name, columns, rows: normalizedRows, mode: getSelectedMode() };
      fileInfo.innerHTML =
        "✓ <strong>" + escapeHtml(file.name) + "</strong> — " +
        columns.length + " colunas, " + rows.length + " linhas.";
      prepareFlowAfterLoad();
    } catch (err) {
      fileInfo.classList.add("hidden");
      showMessage(err.message, "error");
    }
  }

  function prepareFlowAfterLoad() {
    const isHubspot = state.mode === "hubspot";
    stepMap.classList.toggle("hidden", isHubspot);
    if (isHubspot) {
      mapRows.innerHTML = "";
      validateHubspotColumns(false);
    } else {
      buildMapping();
    }
    stepPreview.classList.remove("hidden");
    stepProcess.classList.remove("hidden");
  }

  function buildMapping() {
    mapRows.innerHTML = "";
    targetFields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "map-row";

      const label = document.createElement("div");
      label.className = "field-label";
      label.innerHTML = escapeHtml(field.label) + (field.required ? '<span class="req">*</span>' : "");

      const select = document.createElement("select");
      select.dataset.key = field.key;
      select.dataset.type = field.type;

      if (field.type === "setor") {
        select.appendChild(makeOption("", "Selecione o setor"));
        setores.forEach((s) => select.appendChild(makeOption(s.value, s.label)));
        select.addEventListener("change", () => toggleOtherSectorInput(row, select));
      } else {
        select.appendChild(makeOption("", "Selecione uma coluna"));
        state.columns.forEach((col) => select.appendChild(makeOption(col, col)));
        autoSelect(select, field);
      }

      select.addEventListener("change", () => {
        select.classList.remove("invalid");
        resetPreview();
      });

      row.appendChild(label);
      row.appendChild(select);
      if (field.type === "setor") {
        const otherInput = document.createElement("input");
        otherInput.type = "text";
        otherInput.className = "other-sector-input hidden";
        otherInput.dataset.key = "setor_outros";
        otherInput.placeholder = "Digite o nome do setor";
        otherInput.maxLength = 80;
        otherInput.addEventListener("input", () => {
          otherInput.classList.remove("invalid");
          resetPreview();
        });
        row.appendChild(otherInput);
      }
      mapRows.appendChild(row);
    });
  }

  function getSelectedMode() {
    const selected = document.querySelector('input[name="base-mode"]:checked');
    return selected ? selected.value : "hubspot";
  }

  function getPayload() {
    if (state.mode === "hubspot") {
      return { valid: validateHubspotColumns(true), mapping: {}, setor: "COMERCIAL" };
    }

    const selects = mapRows.querySelectorAll("select");
    const mapping = {};
    let setor = "";
    let setorOutros = "";
    let valid = true;

    selects.forEach((sel) => {
      const key = sel.dataset.key;
      const field = targetFields.find((f) => f.key === key);

      if (sel.dataset.type === "setor") {
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
          } else {
            setor = setorOutros.toUpperCase();
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

    return { valid, mapping, setor };
  }

  function processRows(mapping, setor) {
    if (state.mode === "hubspot") {
      return processHubspotRows();
    }

    return state.rows.map((row) => {
      const nomeCompleto = row[mapping.nome_completo];
      return {
        Nome: tratarNome(nomeCompleto),
        Sobrenome: tratarSobrenome(nomeCompleto),
        Whatsapp: tratarWhatsapp(row[mapping.whatsapp]),
        Setor: setor,
        Curso: mapping.curso ? toText(row[mapping.curso]) : "",
        "E-mail": mapping.email ? toText(row[mapping.email]) : "",
      };
    });
  }

  function processHubspotRows() {
    return state.rows.map((row) => ({
      Nome: priMaiuscula(toText(row["Nome"]).trim()),
      Sobrenome: priMaiuscula(toText(row["Sobrenome"]).trim()),
      "WhatsApp number": tratarWhatsapp(row["Número de telefone"]),
      Setor: "COMERCIAL",
      curso_aluno: toText(row["Nome do Curso"]),
      "E-mail": toText(row["E-mail"]),
      atribuicao: toText(row["Proprietário do negócio"]),
      id_hub: toText(row["Negócio ID"]),
    }));
  }

  function validateHubspotColumns(showError) {
    const requiredColumns = [
      "Nome",
      "Sobrenome",
      "Número de telefone",
      "E-mail",
      "Nome do Curso",
      "Proprietário do negócio",
      "Negócio ID",
    ];
    const missing = requiredColumns.filter((column) => !state.columns.includes(column));
    if (missing.length) {
      if (showError) {
        showMessage("A base HubSpot precisa conter estas colunas: " + missing.join(", ") + ".", "error");
      }
      return false;
    }
    return true;
  }

  previewBtn.addEventListener("click", () => {
    clearMessage();
    const { valid, mapping, setor } = getPayload();
    if (!valid) {
      showMessage("Preencha todos os campos obrigatórios (*) para ver a prévia.", "error");
      return;
    }
    renderPreview(processRows(mapping, setor));
  });

  processBtn.addEventListener("click", () => {
    clearMessage();
    const { valid, mapping, setor } = getPayload();
    if (!valid) {
      showMessage("Preencha todos os campos obrigatórios (*).", "error");
      return;
    }

    const processedRows = processRows(mapping, setor);
    const worksheet = window.XLSX.utils.json_to_sheet(processedRows);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "Planilha tratada");
    window.XLSX.writeFile(workbook, "planilha_tratada.xlsx");
    showMessage("Planilha tratada gerada com sucesso! O download foi iniciado.", "success");
  });

  function renderPreview(rows) {
    const previewRows = rows.slice(0, 10);
    const columns = state.mode === "hubspot"
      ? ["Nome", "Sobrenome", "WhatsApp number", "Setor", "curso_aluno", "E-mail", "atribuicao", "id_hub"]
      : ["Nome", "Sobrenome", "Whatsapp", "Setor", "Curso", "E-mail"];
    const thead = "<thead><tr>" + columns.map((c) => "<th>" + escapeHtml(c) + "</th>").join("") + "</tr></thead>";
    const tbody = "<tbody>" + previewRows.map((row) => {
      return "<tr>" + columns.map((col) => "<td>" + escapeHtml(row[col]) + "</td>").join("") + "</tr>";
    }).join("") + "</tbody>";

    previewArea.innerHTML =
      '<p class="preview-count">Prévia de até 10 linhas tratadas. Total no arquivo: ' +
      rows.length.toLocaleString("pt-BR") +
      " linhas.</p>" +
      '<div class="preview-table-wrap"><table class="preview-table">' + thead + tbody + "</table></div>";
    previewArea.classList.remove("hidden");
  }

  function tratarWhatsapp(value) {
    const arrumado = toText(value).trim();
    if (!arrumado) return "";
    const limpo = arrumado.replace(/\+/g, "").replace(/ /g, "").replace(/\(/g, "").replace(/\)/g, "").replace(/-/g, "");
    const inicio = arrumado.replace(/\+/g, "").slice(0, 2);
    return inicio === "55" ? limpo : "55" + limpo;
  }

  function tratarNome(value) {
    const texto = toText(value);
    return priMaiuscula((texto + " ").split(" ", 1)[0]);
  }

  function tratarSobrenome(value) {
    const texto = toText(value);
    if (!texto.includes(" ")) return "";
    return priMaiuscula(texto.split(" ").slice(1).join(" ").trim());
  }

  function priMaiuscula(texto) {
    return texto.toLowerCase().replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
  }

  function toText(value) {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return ["nan", "none"].includes(text.trim().toLowerCase()) ? "" : text;
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

  function resetPreview() {
    if (!previewArea) return;
    previewArea.classList.add("hidden");
    previewArea.innerHTML = "";
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message " + type;
    messageEl.classList.remove("hidden");
  }

  function clearMessage() {
    messageEl.classList.add("hidden");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();

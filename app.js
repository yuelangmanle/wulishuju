const state = {
  items: [],
  extracting: false,
  headers: [],
  maxPoint: 1,
  profiles: [],
  currentProfileId: null,
  paused: false,
  cache: {},
  intervalMs: 1200,
  maxAttempts: 3,
};

const els = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  fileInputMobile: document.getElementById("fileInputMobile"),
  list: document.getElementById("list"),
  countLabel: document.getElementById("countLabel"),
  sortLabel: document.getElementById("sortLabel"),
  extractBtn: document.getElementById("extractBtn"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  checkBtn: document.getElementById("checkBtn"),
  apiStatus: document.getElementById("apiStatus"),
  profileSelect: document.getElementById("profileSelect"),
  profileName: document.getElementById("profileName"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  deleteProfileBtn: document.getElementById("deleteProfileBtn"),
  exportConfigBtn: document.getElementById("exportConfigBtn"),
  importConfigBtn: document.getElementById("importConfigBtn"),
  configImportInput: document.getElementById("configImportInput"),
  intervalMs: document.getElementById("intervalMs"),
  maxAttempts: document.getElementById("maxAttempts"),
  pauseBtn: document.getElementById("pauseBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  filterSelect: document.getElementById("filterSelect"),
  importCsv: document.getElementById("importCsv"),
  includeMeta: document.getElementById("includeMeta"),
  includeErrors: document.getElementById("includeErrors"),
  useCache: document.getElementById("useCache"),
  apiKey: document.getElementById("apiKey"),
  toggleKey: document.getElementById("toggleKey"),
  baseUrl: document.getElementById("baseUrl"),
  provider: document.getElementById("providerSelect"),
  modelInput: document.getElementById("modelInput"),
  addHeaderBtn: document.getElementById("addHeaderBtn"),
  headersList: document.getElementById("headersList"),
  depthStart: document.getElementById("depthStart"),
  depthStep: document.getElementById("depthStep"),
  previewModal: document.getElementById("previewModal"),
  previewImg: document.getElementById("previewImg"),
  previewMeta: document.getElementById("previewMeta"),
  closePreview: document.getElementById("closePreview"),
  mobileModeToggle: document.getElementById("mobileModeToggle"),
};

const depthDefaults = {
  start: "水面 / 0 m",
  step: 1,
};

function init() {
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const savedKey = localStorage.getItem("openai_key") || localStorage.getItem("api_key");
  if (savedKey) {
    els.apiKey.value = savedKey;
  }
  const savedBase = localStorage.getItem("api_base_url");
  if (savedBase) {
    els.baseUrl.value = savedBase;
  }
  const savedProvider = localStorage.getItem("api_provider");
  if (savedProvider) {
    els.provider.value = savedProvider;
  }
  const savedModel = localStorage.getItem("api_model_id");
  if (savedModel) {
    els.modelInput.value = savedModel;
  }
  try {
    const savedHeaders = JSON.parse(localStorage.getItem("api_headers") || "[]");
    if (Array.isArray(savedHeaders)) {
      state.headers = savedHeaders;
    }
  } catch (e) {
    state.headers = [];
  }
  try {
    const cache = JSON.parse(localStorage.getItem("ocr_cache_v1") || "{}");
    state.cache = cache;
  } catch (e) {
    state.cache = {};
  }
  state.intervalMs = parseInt(localStorage.getItem("api_interval_ms") || "1200", 10) || 1200;
  state.maxAttempts = parseInt(localStorage.getItem("api_max_attempts") || "3", 10) || 3;
  if (els.intervalMs) els.intervalMs.value = state.intervalMs;
  if (els.maxAttempts) els.maxAttempts.value = state.maxAttempts;
  loadProfiles();
  renderHeaders();
  depthDefaults.start = els.depthStart.value || depthDefaults.start;
  const val = Number(els.depthStep.value);
  depthDefaults.step = Number.isFinite(val) ? val : depthDefaults.step;

  els.dropZone.addEventListener("click", (e) => {
    // 避免在移动端对同一个 input 连续触发两次文件选择
    if (e.target === els.fileInput || e.target === els.fileInputMobile) return;
    if (isTouch && els.fileInputMobile) return; // 移动端直接点透明 input
    if (els.fileInput) els.fileInput.click();
  });
  ["dragenter", "dragover"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    })
  );
  els.dropZone.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      els.fileInput.value = "";
    }
  });
  if (els.fileInputMobile) {
    els.fileInputMobile.addEventListener("change", (e) => {
      if (e.target.files?.length) {
        handleFiles(e.target.files);
        els.fileInputMobile.value = "";
      }
    });
  }

  els.toggleKey.addEventListener("click", () => {
    els.apiKey.type = els.apiKey.type === "password" ? "text" : "password";
    els.toggleKey.textContent = els.apiKey.type === "password" ? "显示" : "隐藏";
  });
  els.apiKey.addEventListener("input", () => {
    syncAuthHeader(els.apiKey.value.trim());
  });

  els.depthStart.addEventListener("change", () => {
    depthDefaults.start = els.depthStart.value || "水面 / 0 m";
    applyDepthLabels(true);
    renderList();
  });
  els.depthStep.addEventListener("change", () => {
    const val = Number(els.depthStep.value);
    depthDefaults.step = Number.isFinite(val) ? val : 1;
    applyDepthLabels(true);
    renderList();
  });

  els.extractBtn.addEventListener("click", runExtraction);
  els.exportBtn.addEventListener("click", exportExcel);
  els.clearBtn.addEventListener("click", clearAll);
  els.checkBtn.addEventListener("click", checkApi);
  els.closePreview.addEventListener("click", () => togglePreview(false));
  els.previewModal.addEventListener("click", (e) => {
    if (e.target === els.previewModal) togglePreview(false);
  });

  els.addHeaderBtn.addEventListener("click", () => addHeader());
  els.provider.addEventListener("change", persistSettings);
  els.baseUrl.addEventListener("change", persistSettings);
  els.modelInput.addEventListener("change", persistSettings);
  els.saveProfileBtn.addEventListener("click", saveProfile);
  els.deleteProfileBtn.addEventListener("click", deleteProfile);
  els.profileSelect.addEventListener("change", () => {
    applyProfile(els.profileSelect.value);
  });
  els.intervalMs.addEventListener("change", () => {
    const v = parseInt(els.intervalMs.value || "0", 10);
    state.intervalMs = Number.isFinite(v) ? v : 1200;
    localStorage.setItem("api_interval_ms", state.intervalMs);
  });
  els.maxAttempts.addEventListener("change", () => {
    const v = parseInt(els.maxAttempts.value || "0", 10);
    state.maxAttempts = Number.isFinite(v) ? v : 3;
    localStorage.setItem("api_max_attempts", state.maxAttempts);
  });
  els.pauseBtn.addEventListener("click", () => {
    state.paused = true;
    setApiStatus("队列已暂停", "warn");
  });
  els.resumeBtn.addEventListener("click", () => {
    state.paused = false;
    setApiStatus("队列继续", "ok");
  });
  els.filterSelect.addEventListener("change", renderList);
  els.importCsv.addEventListener("change", importCsvData);
  els.exportConfigBtn.addEventListener("click", exportConfig);
  els.importConfigBtn.addEventListener("click", () => els.configImportInput?.click());
  els.configImportInput.addEventListener("change", importConfigFile);
  if (els.mobileModeToggle) {
    const savedMobile = localStorage.getItem("ui_mobile_mode") === "1";
    els.mobileModeToggle.checked = savedMobile;
    applyMobileMode(savedMobile);
    els.mobileModeToggle.addEventListener("change", () => {
      const on = !!els.mobileModeToggle.checked;
      localStorage.setItem("ui_mobile_mode", on ? "1" : "0");
      applyMobileMode(on);
    });
  }
}

async function handleFiles(fileList) {
  const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  const existingCount = state.items.length;
  for (const file of incoming) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const meta = await readMeta(file);
    const captureMs = meta.capture?.getTime?.() ?? captureMsFromName(file.name, file.lastModified) ?? file.lastModified;
    const previewUrl = URL.createObjectURL(file);
    const originalDataUrl = await readFileAsDataURL(file);
    const payloadDataUrl = await buildPayloadDataUrl(file, meta.orientation);
    const cached = state.cache[file.name];
    const cachedHasData =
      cached &&
      cached.result &&
      [cached.result.temperature_c, cached.result.oxygen_mmhg, cached.result.do_percent, cached.result.do_mg_per_l].some(
        (v) => Number.isFinite(v)
      );
    state.items.push({
      id,
      file,
      name: file.name,
      preview: previewUrl,
      payload: payloadDataUrl,
      original: originalDataUrl,
      capture: meta.capture,
      captureMs,
      orientation: meta.orientation,
      isPointStart: existingCount === 0 && state.items.length === 0,
      depthLabel: cached?.depthLabel || "",
      status: cached && els.useCache?.checked && cachedHasData ? cached.status || "done" : "pending",
      result: cached && els.useCache?.checked && cachedHasData ? cached.result || null : null,
      error: null,
      point: cached?.point || undefined,
      isPointStartCached: cached?.isPointStart || false,
    });
  }

  sortItems();
  ensureFirstPointStart();
  assignPointIndices();
  applyDepthLabels();
  renderList();
}

async function readMeta(file) {
  try {
    const data = await exifr.parse(file, ["DateTimeOriginal", "CreateDate", "Orientation"]);
    const capture = data?.DateTimeOriginal || data?.CreateDate || null;
    return { capture, orientation: data?.Orientation };
  } catch (e) {
    return { capture: null, orientation: null };
  }
}

function captureMsFromName(name, fallback) {
  // 支持 MVIMG_20251129_142237.jpg / IMG_2025-11-29-142237 等
  const m = name.match(/(\d{4})[^\d]?(\d{2})[^\d]?(\d{2})[^\d]?[_-]?([0-2]\d)(\d{2})(\d{2})/);
  if (!m) return fallback || null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  const ss = parseInt(m[6], 10);
  const dt = new Date(y, mo, d, hh, mm, ss);
  return dt.getTime?.() || fallback || null;
}

function sortItems() {
  state.items.sort((a, b) => {
    if (a.captureMs && b.captureMs) return a.captureMs - b.captureMs;
    return a.name.localeCompare(b.name);
  });
  ensureFirstPointStart();
  assignPointIndices();
  applyDepthLabels(true);
}

function applyDepthLabels(force = false) {
  const step = Number.isFinite(depthDefaults.step) ? depthDefaults.step : 1;
  let currentPoint = 1;
  let offset = 0;
  state.items.forEach((item, idx) => {
    if (idx === 0 || item.isPointStart) {
      currentPoint = item.point || 1;
      offset = 0;
    }
    if (force || !item.depthLabel) {
      const depthVal = step * offset;
      item.depthLabel = depthLabelForValue(depthVal, currentPoint);
    }
    offset += 1;
  });
}

function ensureFirstPointStart() {
  if (!state.items.length) return;
  const hasStart = state.items.some((i) => i.isPointStart);
  if (!hasStart) {
    state.items[0].isPointStart = true;
  }
  state.items.forEach((item) => {
    if (item.isPointStartCached) item.isPointStart = true;
  });
}

function assignPointIndices() {
  let currentPoint = 1;
  state.items.forEach((item, idx) => {
    if (idx === 0) {
      item.isPointStart = true;
    } else if (item.isPointStart) {
      currentPoint += 1;
    }
    item.point = currentPoint;
  });
  state.maxPoint = currentPoint;
}

function depthLabelForValue(value, point) {
  if (value === 0) return "0 m";
  return `${value} m`;
}

function renderList() {
  els.countLabel.textContent = `${state.items.length} 张`;
  els.list.innerHTML = "";
  const filter = els.filterSelect?.value || "all";
  const items = state.items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "error") return item.status === "error";
    const hasData =
      item.result &&
      [item.result?.temperature_c, item.result?.oxygen_mmhg, item.result?.do_percent, item.result?.do_mg_per_l].some(
        (v) => Number.isFinite(v)
      );
    if (filter === "nodata") return item.status === "done" && !hasData;
    if (filter === "pending") return item.status === "pending";
    if (filter === "done") return item.status === "done" && hasData;
    return true;
  });

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = item.preview;
    img.alt = item.name;
    thumb.appendChild(img);
    thumb.addEventListener("click", () => {
      els.previewImg.src = item.preview;
      const captureText = item.capture ? formatDate(item.capture) : "无拍摄时间";
      els.previewMeta.textContent = `${item.name} · ${captureText} · 深度 ${item.depthLabel || "未填"}`;
      togglePreview(true);
    });

    const body = document.createElement("div");
    body.className = "card-body";
    const row1 = document.createElement("div");
    row1.className = "row";
    const name = document.createElement("div");
    name.textContent = item.name;
    name.style.fontWeight = "600";
    name.style.fontSize = "14px";
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = item.capture ? formatDate(item.capture) : "无时间";
    const pointPill = document.createElement("span");
    pointPill.className = "pill point-pill";
    pointPill.textContent = `采样点 ${item.point || 1}`;
    pointPill.title = item.isPointStart ? "此处为该采样点起点" : "";
    row1.appendChild(name);
    row1.appendChild(pill);
    row1.appendChild(pointPill);

    const row2 = document.createElement("div");
    row2.className = "row";
    const depthLabel = document.createElement("label");
    depthLabel.textContent = "深度";
    const depthInput = document.createElement("input");
    depthInput.className = "depth-input";
    depthInput.value = item.depthLabel || "";
    depthInput.addEventListener("change", (e) => {
      item.depthLabel = e.target.value;
    });
    row2.appendChild(depthLabel);
    row2.appendChild(depthInput);

    const row3 = document.createElement("div");
    row3.className = "row";
    const status = document.createElement("div");
    status.className = "status";
    const hasData =
      item.result &&
      [item.result?.temperature_c, item.result?.oxygen_mmhg, item.result?.do_percent, item.result?.do_mg_per_l].some(
        (v) => Number.isFinite(v)
      );
    if (item.status === "done" && hasData) status.classList.add("done");
    if (item.status === "done" && !hasData) status.classList.add("error", "nodata");
    if (item.status === "error") status.classList.add("error");
    status.title = item.error || item.result?.raw || "";
    status.textContent =
      item.status === "pending"
        ? "未处理"
        : item.status === "processing"
        ? "识别中..."
        : item.status === "done"
        ? summaryText(item.result, hasData)
        : item.error || "出错";
    row3.appendChild(status);

    const row4 = document.createElement("div");
    row4.className = "row";
    const pointBtn = document.createElement("button");
    pointBtn.type = "button";
    pointBtn.className = "tiny-btn";
    pointBtn.textContent = item.isPointStart ? "取消起点" : "设为此起点";
    pointBtn.addEventListener("click", () => {
      if (item.isPointStart && state.items.indexOf(item) === 0) return;
      item.isPointStart = !item.isPointStart;
      ensureFirstPointStart();
      assignPointIndices();
      applyDepthLabels(true);
      renderList();
    });
    row4.appendChild(pointBtn);

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "tiny-btn";
    retryBtn.textContent = item.status === "processing" ? "识别中" : "重试识别";
    retryBtn.disabled = state.extracting || item.status === "processing";
    retryBtn.addEventListener("click", async () => {
      if (state.extracting) return;
      const key = els.apiKey.value.trim();
      const baseUrlRaw = els.baseUrl.value.trim() || "https://api-inference.modelscope.cn/v1";
      const modelId = els.modelInput.value.trim() || "Qwen/Qwen3-Coder-30B-A3B-Instruct";
      if (!key) {
        alert("请先填入 API Key");
        return;
      }
      retryBtn.textContent = "识别中";
      retryBtn.disabled = true;
      item.status = "processing";
      item.error = null;
      renderList();
      try {
        const result = await extractWithRetry(item, key, baseUrlRaw.replace(/\/$/, ""), modelId);
        item.result = result;
        item.status = "done";
        updateCache(item);
      } catch (err) {
        item.status = "error";
        item.error = err.message;
      }
      retryBtn.textContent = "重试识别";
      retryBtn.disabled = false;
      renderList();
    });
    row4.appendChild(retryBtn);

    body.appendChild(row1);
    body.appendChild(row2);
    body.appendChild(row3);
    body.appendChild(row4);

    card.appendChild(thumb);
    card.appendChild(body);
    els.list.appendChild(card);
  });

  els.exportBtn.disabled = !state.items.some((i) => i.result);
}

function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mm = `${d.getMinutes()}`.padStart(2, "0");
  const ss = `${d.getSeconds()}`.padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function summaryText(result, hasDataOverride) {
  if (!result) return "未处理";
  const parts = [];
  if (isFinite(result.temperature_c)) parts.push(`${result.temperature_c}°C`);
  if (isFinite(result.oxygen_mmhg)) parts.push(`${result.oxygen_mmhg} mmHg`);
  if (isFinite(result.do_percent)) parts.push(`${result.do_percent}%`);
  if (isFinite(result.do_mg_per_l)) parts.push(`${result.do_mg_per_l} mg/L`);
  const hasData = typeof hasDataOverride === "boolean" ? hasDataOverride : parts.length > 0;
  return hasData ? parts.join(" · ") : "未识别";
}

function parseNumbersFromText(content) {
  if (!content) return null;
  const raw = typeof content === "string" ? content : JSON.stringify(content);
  const numReg = /-?\d+(?:\.\d+)?/g;
  const nums = raw.match(numReg)?.map((v) => parseFloat(v)) || [];
  if (!nums.length) return null;
  const out = { temperature_c: null, oxygen_mmhg: null, do_percent: null, do_mg_per_l: null, raw };
  nums.forEach((n) => {
    if (out.temperature_c === null && n > -5 && n < 40) out.temperature_c = n;
    else if (out.oxygen_mmhg === null && n > 600 && n < 900) out.oxygen_mmhg = n;
    else if (out.do_percent === null && n >= 0 && n <= 200) out.do_percent = n;
    else if (out.do_mg_per_l === null && n >= 0 && n <= 50) out.do_mg_per_l = n;
  });
  return out;
}

async function runExtraction() {
  if (state.extracting) return;
  const key = els.apiKey.value.trim();
  const baseUrlRaw = els.baseUrl.value.trim() || "https://api-inference.modelscope.cn/v1";
  const baseUrl = baseUrlRaw.replace(/\/$/, "");
  const modelId = els.modelInput.value.trim() || "Qwen/Qwen3-Coder-30B-A3B-Instruct";
  if (!key) {
    alert("请先填入 API Key");
    return;
  }
  localStorage.setItem("api_key", key);
  localStorage.setItem("api_base_url", baseUrl);
  localStorage.setItem("api_provider", els.provider.value);
  localStorage.setItem("api_model_id", modelId);
  persistHeaders();

  state.extracting = true;
  els.extractBtn.textContent = "识别中...";
  els.extractBtn.disabled = true;

  try {
    for (const item of state.items) {
      while (state.paused) {
        await wait(500);
      }
      item.status = "processing";
      item.error = null;
      renderList();
      try {
        const result = await extractWithRetry(item, key, baseUrl, modelId);
        item.result = result;
        item.status = "done";
        updateCache(item);
      } catch (err) {
        console.error("单张处理失败", err);
        item.status = "error";
        item.error = err.message;
      }
      await wait(state.intervalMs);
      renderList();
    }
  } catch (err) {
    console.error(err);
    alert("处理时出现错误: " + err.message);
  } finally {
    state.extracting = false;
    els.extractBtn.textContent = "开始AI识别";
    els.extractBtn.disabled = false;
    renderList();
  }
}

async function extractItem(item, apiKey, baseUrl, modelId, useOriginal = false) {
  const source = useOriginal ? item.original || item.payload || item.preview : item.payload || item.preview;
  const base64 = source.split(",")[1];
  const body = {
    model: modelId,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "你是专业 OCR，目标是从 ProSolo 仪表照片里提取读数。只读取屏幕内的数字，如果看不清返回 null。必须只返回 JSON，不要任何额外文字。",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请提取温度(℃)、氧分压(mmHg)、DO %、DO mg/L。不可推测，看不清请返回 null。只输出 JSON，格式如 {\"temperature_c\":数字或null,\"oxygen_mmhg\":数字或null,\"do_percent\":数字或null,\"do_mg_per_l\":数字或null,\"notes\":\"可选备注\"}",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${item.file.type};base64,${base64}`,
            },
          },
        ],
      },
    ],
  };

  const headers = { "Content-Type": "application/json" };
  let hasAuth = false;
  const customs = (state.headers || []).filter((h) => h && h.name && h.name.trim());
  customs.forEach((h) => {
    const keyName = h.name.trim();
    headers[keyName] = h.value ?? "";
    if (keyName.toLowerCase() === "authorization" && (h.value || "").trim()) hasAuth = true;
  });
  if (!hasAuth) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `接口错误: ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error?.message || msg;
    } catch (e) {
      msg = text || msg;
    }
    item.status = "error";
    item.error = truncateText(msg, 180);
    const error = new Error(msg);
    error.status = res.status;
    throw error;
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = safeParse(content) || parseNumbersFromText(content);
  return parsed || { raw: content };
}

function exportExcel() {
  if (!state.items.length) return;
  const pointMaps = new Map(); // point -> Map(depthKey -> data)
  const depthSet = new Set();
  const depthLabels = new Map(); // depthKey -> label

  state.items.forEach((item, idx) => {
    if (!item.result) return;
    const depthNum = depthToNumber(item.depthLabel, idx);
    const key = depthKey(depthNum);
    depthSet.add(depthNum);
    depthLabels.set(key, item.depthLabel || `${depthNum}`);
    if (!pointMaps.has(item.point)) pointMaps.set(item.point, new Map());
    const target = pointMaps.get(item.point);
    if (!target.has(key)) {
      target.set(key, {
        depth: depthNum,
        temp: numVal(item.result.temperature_c),
        oxy: numVal(item.result.oxygen_mmhg),
        doPercent: numVal(item.result.do_percent),
        doMg: numVal(item.result.do_mg_per_l),
      });
    }
  });

  const depths = Array.from(depthSet).sort((a, b) => a - b);
  const rows = depths.map((d) => {
    const key = depthKey(d);
    const row = { "水深(m)": depthLabels.get(key) || d };
    for (let p = 1; p <= state.maxPoint; p += 1) {
      const m = pointMaps.get(p);
      const entry = m?.get(key);
      row[`点${p}_温度(℃)`] = entry?.temp ?? "";
      row[`点${p}_氧分压mmHg`] = entry?.oxy ?? "";
      row[`点${p}_DO%`] = entry?.doPercent ?? "";
      row[`点${p}_DOmg/L`] = entry?.doMg ?? "";
    }
    return row;
  });

  // Optional append meta/errors
  if (els.includeMeta?.checked || els.includeErrors?.checked) {
    rows.unshift({});
    rows.unshift({}); // blank lines before meta
    rows.unshift({ Note: "以下为额外信息" });
    state.items.forEach((item, idx) => {
      const r = {
        文件名: item.name,
        拍摄时间: item.capture ? formatDate(item.capture) : "",
        采样点: item.point || "",
        深度: item.depthLabel || "",
        状态: item.status,
      };
      if (item.error && els.includeErrors?.checked) r.错误 = item.error;
      rows.push(r);
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ProSolo");
  XLSX.writeFile(wb, "prosolo-readings.xlsx");
}

function addHeader() {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  state.headers.push({ id, name: "Authorization", value: els.apiKey.value ? `Bearer ${els.apiKey.value.trim()}` : "" });
  renderHeaders();
  persistHeaders();
}

function removeHeader(id) {
  state.headers = state.headers.filter((h) => h.id !== id);
  renderHeaders();
  persistHeaders();
}

function renderHeaders() {
  if (!els.headersList) return;
  els.headersList.innerHTML = "";
  if (!state.headers.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "未添加自定义 Header，将默认使用 Authorization: Bearer <Key>";
    els.headersList.appendChild(empty);
    return;
  }
  state.headers.forEach((h) => {
    const row = document.createElement("div");
    row.className = "header-item";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Header 名称";
    nameInput.value = h.name || "";
    nameInput.addEventListener("input", (e) => {
      h.name = e.target.value;
      persistHeaders();
    });

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Header 值";
    valueInput.value = h.value || "";
    valueInput.addEventListener("input", (e) => {
      h.value = e.target.value;
      persistHeaders();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeHeader(h.id));

    row.appendChild(nameInput);
    row.appendChild(valueInput);
    row.appendChild(removeBtn);
    els.headersList.appendChild(row);
  });
}

function persistHeaders() {
  localStorage.setItem("api_headers", JSON.stringify(state.headers));
}

function persistSettings() {
  localStorage.setItem("api_provider", els.provider.value);
  localStorage.setItem("api_base_url", els.baseUrl.value.trim());
  localStorage.setItem("api_model_id", els.modelInput.value.trim());
}

function syncAuthHeader(key) {
  const auth = (state.headers || []).find((h) => h.name?.toLowerCase() === "authorization");
  if (!auth) return;
  auth.value = key ? `Bearer ${key}` : "";
  renderHeaders();
  persistHeaders();
}

function loadProfiles() {
  try {
    const list = JSON.parse(localStorage.getItem("api_profiles") || "[]");
    if (Array.isArray(list)) {
      state.profiles = list;
    }
  } catch (e) {
    state.profiles = [];
  }
  state.currentProfileId = localStorage.getItem("api_profile_current") || null;
  if (!state.currentProfileId && state.profiles.length) {
    state.currentProfileId = state.profiles[0].id;
  }
  renderProfiles();
  if (state.currentProfileId) {
    applyProfile(state.currentProfileId);
  } else {
    // if no profile saved, create a default snapshot
    saveProfile(true);
  }
}

function renderProfiles() {
  if (!els.profileSelect) return;
  els.profileSelect.innerHTML = "";
  state.profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || p.id;
    if (p.id === state.currentProfileId) opt.selected = true;
    els.profileSelect.appendChild(opt);
  });
}

function saveProfile(isAuto = false) {
  const name = (els.profileName?.value || "").trim() || `方案${state.profiles.length + 1}`;
  const profile = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    baseUrl: els.baseUrl.value.trim(),
    modelId: els.modelInput.value.trim(),
    provider: els.provider.value,
    apiKey: els.apiKey.value.trim(),
    headers: state.headers,
  };
  state.profiles.push(profile);
  state.currentProfileId = profile.id;
  persistProfiles();
  renderProfiles();
  els.profileSelect.value = profile.id;
  if (!isAuto) {
    setApiStatus(`已保存方案: ${name}`, "ok");
  }
}

function deleteProfile() {
  const id = els.profileSelect.value;
  if (!id) return;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.currentProfileId === id) state.currentProfileId = state.profiles[0]?.id || null;
  persistProfiles();
  renderProfiles();
  if (state.currentProfileId) applyProfile(state.currentProfileId);
}

function persistProfiles() {
  localStorage.setItem("api_profiles", JSON.stringify(state.profiles));
  if (state.currentProfileId) localStorage.setItem("api_profile_current", state.currentProfileId);
}

function applyProfile(id) {
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return;
  state.currentProfileId = id;
  localStorage.setItem("api_profile_current", id);
  els.baseUrl.value = profile.baseUrl || els.baseUrl.value;
  els.modelInput.value = profile.modelId || els.modelInput.value;
  els.provider.value = profile.provider || els.provider.value;
  if (profile.apiKey) els.apiKey.value = profile.apiKey;
  state.headers = Array.isArray(profile.headers) ? profile.headers : [];
  renderHeaders();
  syncAuthHeader(els.apiKey.value.trim());
  persistSettings();
  persistHeaders();
  setApiStatus(`已切换方案: ${profile.name || profile.id}`, "ok");
}

function applyMobileMode(on) {
  document.body.classList.toggle("mobile-mode", on);
}

function exportConfig() {
  const payload = {
    profiles: state.profiles,
    currentProfileId: state.currentProfileId,
    headers: state.headers,
    intervalMs: state.intervalMs,
    maxAttempts: state.maxAttempts,
    useCache: !!els.useCache?.checked,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `api-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setApiStatus("已导出配置", "ok");
}

async function importConfigFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data.profiles)) state.profiles = data.profiles;
    if (data.currentProfileId) state.currentProfileId = data.currentProfileId;
    if (Array.isArray(data.headers)) state.headers = data.headers;
    if (Number.isFinite(data.intervalMs)) {
      state.intervalMs = data.intervalMs;
      if (els.intervalMs) els.intervalMs.value = state.intervalMs;
      localStorage.setItem("api_interval_ms", state.intervalMs);
    }
    if (Number.isFinite(data.maxAttempts)) {
      state.maxAttempts = data.maxAttempts;
      if (els.maxAttempts) els.maxAttempts.value = state.maxAttempts;
      localStorage.setItem("api_max_attempts", state.maxAttempts);
    }
    if (typeof data.useCache === "boolean" && els.useCache) {
      els.useCache.checked = data.useCache;
    }
    persistProfiles();
    renderProfiles();
    if (state.currentProfileId) applyProfile(state.currentProfileId);
    setApiStatus("已导入配置", "ok");
  } catch (err) {
    setApiStatus(`导入失败: ${err.message}`, "err");
  } finally {
    e.target.value = "";
  }
}

function safeParse(content) {
  if (!content) return null;
  let raw =
    typeof content === "string"
      ? content
      : Array.isArray(content)
      ? content.map((c) => (typeof c === "string" ? c : c?.text || "")).join("")
      : "";
  raw = raw.trim();
  if (raw.startsWith("```")) {
    const parts = raw.split("```");
    raw = parts[1] || raw;
    raw = raw.replace(/^\w+\n/, "");
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      const cleaned = raw.replace(/[\u0000-\u001F]+/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err) {
      return null;
    }
  }
}

function truncateText(str, max = 180) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function hasAnyValue(obj) {
  if (!obj || typeof obj !== "object") return false;
  return ["temperature_c", "oxygen_mmhg", "do_percent", "do_mg_per_l"].some((k) => Number.isFinite(obj[k]));
}

async function extractWithRetry(item, apiKey, baseUrl, modelId) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < state.maxAttempts) {
    attempt += 1;
    try {
      const res = await extractItem(item, apiKey, baseUrl, modelId, true);
      return res;
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      // 如果原图失败，尝试压缩图
      if (item.payload && !err._triedCompressed) {
        try {
          const resCompressed = await extractItem(item, apiKey, baseUrl, modelId, false);
          return resCompressed;
        } catch (e) {
          lastErr = e;
        }
      }
      if (status === 429 || status === 503) {
        const backoff = state.intervalMs * attempt;
        await wait(backoff);
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error("处理失败");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildPayloadDataUrl(file, orientation) {
  try {
    const img = await loadImageFromFile(file);
    const maxSide = 2000;
    const maxBytes = 2500000; // ~2.5 MB to stay under data URI limits
    let scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    let quality = 0.82;

    let dataUrl = renderToDataUrl(img, scale, quality, orientation);
    let bytes = dataUrlByteLength(dataUrl);
    while (bytes > maxBytes && (quality > 0.4 || Math.max(img.naturalWidth, img.naturalHeight) * scale > 900)) {
      if (quality > 0.4) {
        quality -= 0.08;
      } else {
        scale *= 0.9;
      }
      dataUrl = renderToDataUrl(img, scale, quality, orientation);
      bytes = dataUrlByteLength(dataUrl);
    }
    return dataUrl;
  } catch (e) {
    // fallback to original (could fail API if too large)
    return await readFileAsDataURL(file);
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function renderToDataUrl(img, scale, quality, orientation) {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // Note: ignoring EXIF orientation for simplicity; most browsers load upright previews.
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function dataUrlByteLength(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function depthToNumber(label, idx) {
  const reg = /-?\d+(?:\.\d+)?/;
  const found = typeof label === "string" ? label.match(reg) : null;
  if (found) return parseFloat(found[0]);
  const step = Number.isFinite(depthDefaults.step) ? depthDefaults.step : 1;
  // fallback: compute offset within its采样点
  let offset = 0;
  let currentPoint = 1;
  for (let i = 0; i <= idx && i < state.items.length; i += 1) {
    if (i === 0 || state.items[i].isPointStart) {
      currentPoint = state.items[i].point || 1;
      offset = 0;
    }
    if (i === idx) break;
    offset += 1;
  }
  return step * offset;
}

function depthKey(num) {
  const n = Number.isFinite(num) ? num : 0;
  return n.toFixed(3);
}

function numVal(v) {
  return Number.isFinite(v) ? v : "";
}

function updateCache(item) {
  if (!els.useCache?.checked) return;
  state.cache[item.name] = {
    result: item.result,
    status: item.status,
    depthLabel: item.depthLabel,
    point: item.point,
    isPointStart: item.isPointStart,
  };
  localStorage.setItem("ocr_cache_v1", JSON.stringify(state.cache));
}

async function importCsvData(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  lines.forEach((line) => {
    const [name, depth, point, isStart] = line.split(",").map((s) => s?.trim());
    if (!name) return;
    const item = state.items.find((it) => it.name === name);
    if (!item) return;
    if (depth) item.depthLabel = depth;
    if (point) item.point = parseInt(point, 10) || item.point;
    if (isStart === "1") item.isPointStart = true;
  });
  assignPointIndices();
  applyDepthLabels(true);
  renderList();
}

function clearAll() {
  state.items.forEach((i) => {
    if (i.preview?.startsWith("blob:")) URL.revokeObjectURL(i.preview);
  });
  state.items = [];
  state.maxPoint = 1;
  renderList();
}

async function checkApi() {
  const key = els.apiKey.value.trim();
  const baseUrlRaw = els.baseUrl.value.trim() || "https://api-inference.modelscope.cn/v1";
  const baseUrl = baseUrlRaw.replace(/\/$/, "");
  const modelId = els.modelInput.value.trim() || "Qwen/Qwen3-Coder-30B-A3B-Instruct";
  if (!key) {
    alert("请先填入 API Key");
    return;
  }
  setApiStatus("检测中...", "warn");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  const body = {
    model: modelId,
    messages: [{ role: "user", content: "返回一个词：ok" }],
    max_tokens: 5,
  };
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      setApiStatus(`失败 (${res.status}): ${truncateText(txt, 120)}`, "err");
      return;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || "";
    setApiStatus(`正常: ${truncateText(content, 50)}`, "ok");
  } catch (e) {
    setApiStatus(`检测异常: ${e.message}`, "err");
  }
}

function setApiStatus(text, type) {
  if (!els.apiStatus) return;
  els.apiStatus.textContent = `API 状态: ${text}`;
  els.apiStatus.classList.remove("ok", "warn", "err");
  if (type) els.apiStatus.classList.add(type);
}

function togglePreview(show) {
  els.previewModal.classList.toggle("hidden", !show);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

init();

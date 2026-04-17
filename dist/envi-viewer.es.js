let P = class {
  constructor() {
    this.events = {};
  }
  on(t, e) {
    this.events[t] || (this.events[t] = []), this.events[t].push(e);
  }
  emit(t, ...e) {
    this.events[t] && this.events[t].forEach((i) => i(...e));
  }
  off(t, e) {
    this.events[t] && (this.events[t] = this.events[t].filter((i) => i !== e));
  }
}, x = class extends P {
  // --- Private Class Fields ---
  // Core state
  #h = null;
  #t = null;
  #o = null;
  #c = null;
  #s = {
    loadStartTime: 0,
    bandSwitchStartTime: 0,
    isInitialLoading: !1,
    initialVisibleTiles: /* @__PURE__ */ new Set(),
    completedInitialTiles: /* @__PURE__ */ new Set()
  };
  // WebGPU state
  #r = null;
  #B = null;
  #S = null;
  #V = null;
  // Rendering & Tile state
  #y = 512;
  #u = /* @__PURE__ */ new Map();
  #_ = "rendering";
  #d = null;
  #i = { r: 30, g: 20, b: 10 };
  // Viewport state
  #a = 1;
  #m = 0;
  #g = 0;
  // Worker state
  #U;
  #n = [];
  #v = /* @__PURE__ */ new Map();
  #p = /* @__PURE__ */ new Map();
  #w = [];
  #C = 0;
  #R = !1;
  // Transition animation state
  #l = !1;
  #k = null;
  #M = 0;
  // Preloading state
  #f = [];
  #b = !1;
  // Core components & configuration
  #e;
  #P;
  #T;
  #$;
  // Interaction state
  #L = !1;
  #W = { x: 0, y: 0 };
  constructor(t, e = {}) {
    super(), this.#e = t, this.#P = {
      wasmJsPath: e.wasmJsPath || "./pkg/envi_parser.js",
      wasmWasmPath: e.wasmWasmPath || "./pkg/envi_parser_bg.wasm",
      workerPath: e.workerPath || "worker.js"
    }, this.#T = {
      backgroundStats: e.enableBackgroundStats ?? !0,
      tilePreloading: e.enableTilePreloading ?? !0
    };
    function i(s = {}) {
      const h = navigator.hardwareConcurrency || 4;
      let a;
      return h <= 2 ? a = 1 : h <= 4 ? a = Math.floor(h / 2) : h <= 8 ? a = Math.floor(h / 3) : a = Math.min(Math.floor(h / 2), h - 2), a < 1 && (a = 1), s.maxWorkers && Number.isInteger(s.maxWorkers) && s.maxWorkers > 0 && (a = s.maxWorkers), a;
    }
    this.#U = i(e);
  }
  getHeader() {
    return this.#t;
  }
  getImageFile() {
    return this.#c;
  }
  getHdrBytes() {
    return this.#o;
  }
  // --- Public API ---
  async init() {
    this.emit("log", "Library initialization started...");
    try {
      this.#h = await import(this.#P.wasmJsPath);
      const t = await import(this.#P.wasmJsPath), e = new URL(this.#P.wasmWasmPath, import.meta.url).href;
      this.emit("log", e), await t.default(e), t.set_logging_enabled(!1), this.emit("log", "Main thread WASM initialization completed."), await this.#et(), await this.#it(), this.#j(), this.#Y(), this.emit("ready"), this.emit("log", "Library initialization completed and ready.");
    } catch (t) {
      const e = `Initialization failed: ${t.message}`;
      this.emit("error", e), console.error(t);
    }
  }
  /**
   * 创建一个新的 EnviReader 实例供外部模块使用
   * @returns {EnviReader | null}
   */
  createReader() {
    return !this.#h || !this.#o ? (this.emit("error", "WASM 模块或 HDR 数据未准备好，无法创建 Reader。"), null) : new this.#h.EnviReader(this.#o);
  }
  async load(t, e) {
    if (!t || !e) {
      this.emit("error", "必须同时提供 HDR 和 图像文件。");
      return;
    }
    this.emit("loadstart"), this.emit("log", `开始加载: ${t.name}, ${e.name}`), this.#s.loadStartTime = performance.now(), this.#s.isInitialLoading = !0, this.#s.initialVisibleTiles.clear(), this.#s.completedInitialTiles.clear(), this.#u.clear(), this.#d = null, this.#p.clear(), this.#w = [], this.#f = [], this.#b = !1, this.#a = 1, this.#m = 0, this.#g = 0;
    try {
      this.#o = new Uint8Array(await t.arrayBuffer());
      const { EnviReader: i } = await import(this.#P.wasmJsPath), s = new i(this.#o);
      if (this.#t = s.getHeaderAsJsObject(), this.#t.interleave = this.#t.interleave.toLowerCase(), !["bil", "bsq", "bip"].includes(this.#t.interleave))
        throw new Error(`不支持的 Interleave 格式: ${this.#t.interleave}`);
      this.emit("headerloaded", this.#t), this.emit("log", `HDR 解析成功。 格式(Interleave): ${this.#t.interleave}`), this.emit("metadata", {
        fileName: e.name,
        fileSize: e.size,
        // 文件大小 (bytes)
        dimensions: {
          samples: this.#t.samples,
          lines: this.#t.lines,
          bands: this.#t.bands
        },
        format: {
          interleave: this.#t.interleave.toUpperCase(),
          dataType: this.#t.dataType,
          // 假设您的 to_js() 方法会转换这个
          byteOrder: this.#t.byteOrder === 1 ? "LSB" : "MSB"
          // 假设 1=LSB
        }
      }), this.#Y(), this.#c = e, this.emit("log", "正在为初始视图计算统计值..."), this.emit("statechange", { loading: !0, message: "计算统计值..." });
      const n = [this.#i.r, this.#i.g, this.#i.b];
      this.#J(n.filter((h) => !this.#p.has(h)), !0);
    } catch (i) {
      this.emit("error", `文件加载或解析失败: ${i.message}`), this.emit("loadend"), this.emit("statechange", { loading: !1 });
    }
  }
  setBands({ r: t, g: e, b: i }) {
    if (this.#l || !this.#t) return;
    const s = parseInt(t, 10), n = parseInt(e, 10), h = parseInt(i, 10);
    if (s === this.#i.r && n === this.#i.g && h === this.#i.b) return;
    this.#i = { r: s, g: n, b: h }, this.emit("bandschanged", this.#i), this.#s.bandSwitchStartTime = performance.now(), console.log("[PERF-LOG] 计时器启动: Band Switch Time"), this.emit("log", `波段组合已更改为 R:${t}, G:${e}, B:${i}。`);
    const a = [this.#i.r, this.#i.g, this.#i.b], r = a.filter((o) => !this.#p.has(o));
    r.length === 0 ? (this.emit("log", "从缓存加载统计值，开始平滑过渡..."), this.#d = {}, a.forEach((o) => this.#d[o] = this.#p.get(o)), this.#H()) : (this.emit("log", `缓存缺失，正在为波段 ${r.join(",")} 计算统计值...`), this.emit("statechange", { loading: !0, message: "计算统计值..." }), this.#R = !0, this.#J(r, !1));
  }
  destroy() {
    this.emit("log", "销毁 EnviViewer 实例..."), this.#b = !1, this.#f = [], this.#v.clear(), this.#Z(), this.#n.forEach((t) => t.terminate()), this.#n = [], this.#r = null, this.#B = null, this.#S = null, this.#u.clear(), this.#p.clear(), this.emit("destroyed"), this.events = {};
  }
  updateConfig(t = {}) {
    const e = { ...this.#T };
    this.#T = { ...this.#T, ...t }, this.emit("log", `配置已更新: ${JSON.stringify(this.#T)}`), this.#T.backgroundStats && !e.backgroundStats && (this.emit("log", "后台统计已在运行时开启，尝试启动..."), this.#t && this.#K()), this.#T.tilePreloading && !e.tilePreloading && (this.emit("log", "瓦片预加载已在运行时开启，尝试启动..."), this.#t && this.#Q());
  }
  // --- Public Methods to Expose Internal State ---
  // 获取是否有活跃的瓦片请求
  get hasActiveTileRequests() {
    return this.#v.size > 0;
  }
  // 获取是否有后台统计任务
  get hasBackgroundStatsTasks() {
    return this.#w.length > 0;
  }
  // 获取是否有预加载任务
  get hasPreloadTasks() {
    return this.#f.length > 0;
  }
  // 获取是否正在进行波段切换
  get isTransitioning() {
    return this.#l;
  }
  // 获取是否在等待统计值
  get isWaitingForStats() {
    return this.#R;
  }
  // 获取空闲Worker数量
  get idleWorkerCount() {
    return this.#n.length;
  }
  // 获取总Worker数量
  get totalWorkerCount() {
    return this.#U;
  }
  // 在 EnviViewer 类中添加这个新方法
  #F = (t) => {
    if (!this.#t) return;
    const e = this.#e.getBoundingClientRect(), i = t.clientX - e.left, s = t.clientY - e.top, n = i / this.#e.clientWidth * 2 - 1, h = s / this.#e.clientHeight * -2 + 1, { x: a, y: r } = this.#A(), o = (n - this.#m) / this.#a, c = (h - this.#g) / this.#a, l = (o / a + 1) / 2, u = (c / -r + 1) / 2, d = Math.floor(l * this.#t.samples), m = Math.floor(u * this.#t.lines);
    d >= 0 && d < this.#t.samples && m >= 0 && m < this.#t.lines && (this.emit("log", `图像被点击，像素坐标: (${d}, ${m})`), this.emit("image-clicked", { x: d, y: m }));
  };
  // --- Private Methods ---
  #j = () => {
    this.#e.addEventListener("mousedown", this.#O), this.#e.addEventListener("mouseup", this.#z), this.#e.addEventListener("mouseleave", this.#G), this.#e.addEventListener("mousemove", this.#q), this.#e.addEventListener("wheel", this.#D, { passive: !1 }), this.#e.addEventListener("click", this.#F), this.#e.style.cursor = "grab", this.#$ = new ResizeObserver(this.#tt), this.#$.observe(this.#e.parentElement);
  };
  #Z = () => {
    this.#e.removeEventListener("mousedown", this.#O), this.#e.removeEventListener("mouseup", this.#z), this.#e.removeEventListener("mouseleave", this.#G), this.#e.removeEventListener("mousemove", this.#q), this.#e.removeEventListener("wheel", this.#D), this.#e.removeEventListener("click", this.#F), this.#$ && (this.#$.disconnect(), this.#$ = null);
  };
  #tt = () => {
    this.#Y() && this.#x();
  };
  #O = (t) => {
    this.#L = !0, this.#W = { x: t.clientX, y: t.clientY }, this.#e.style.cursor = "grabbing";
  };
  #z = () => {
    this.#L = !1, this.#e.style.cursor = "grab";
  };
  #G = () => {
    this.#L = !1, this.#e.style.cursor = "grab";
  };
  #q = (t) => {
    if (!this.#L || !this.#t || this.#a <= 1) return;
    const e = (t.clientX - this.#W.x) * 2 / this.#e.clientWidth, i = (t.clientY - this.#W.y) * 2 / this.#e.clientHeight;
    this.#m += e, this.#g -= i;
    const { x: s, y: n } = this.#A(), h = (this.#a - 1) * s, a = (this.#a - 1) * n;
    this.#m = Math.max(-h, Math.min(h, this.#m)), this.#g = Math.max(-a, Math.min(a, this.#g)), this.#W = { x: t.clientX, y: t.clientY }, requestAnimationFrame(() => this.#x());
  };
  #D = (t) => {
    if (t.preventDefault(), !this.#t) return;
    const e = this.#e.getBoundingClientRect(), i = (t.clientX - e.left) / e.width * 2 - 1, s = (t.clientY - e.top) / e.height * -2 + 1, n = t.deltaY < 0 ? 1.2 : 1 / 1.2, h = this.#a * n;
    this.#a > 1 && h <= 1 ? (this.#a = 1, this.#m = 0, this.#g = 0) : (this.#a = Math.max(1, h), this.#a > 1 && (this.#m = (this.#m - i) * n + i, this.#g = (this.#g - s) * n + s)), requestAnimationFrame(() => this.#x());
  };
  async #et() {
    try {
      if (!navigator.gpu)
        throw new Error("WebGPU is not supported");
      const t = await navigator.gpu.requestAdapter();
      if (!t)
        throw new Error("Failed to acquire WebGPU adapter");
      this.#r = await t.requestDevice(), this.#B = this.#e.getContext("webgpu");
      const e = navigator.gpu.getPreferredCanvasFormat();
      this.#B.configure({ device: this.#r, format: e, alphaMode: "premultiplied" }), this.emit("log", "WebGPU initialization completed.");
    } catch (t) {
      throw this.emit("error", `WebGPU initialization failed: ${t.message}`), t;
    }
  }
  async #it() {
    const e = `${this.#P.workerPath}?t=${(/* @__PURE__ */ new Date()).getTime()}`;
    console.log(`Loading Worker from URL (cache-busting): ${e}`);
    const i = [];
    for (let s = 0; s < this.#U; s++) {
      const n = new Worker(e, { type: "module" }), h = new Promise((o, c) => {
        n.onmessage = (l) => {
          l.data.type === "init_complete" ? (this.#n.push(n), o()) : l.data.type === "error" ? (this.emit("log", `Worker 初始化错误: ${l.data.message}`), c(new Error(l.data.message))) : this.#st(l);
        }, n.onerror = (l) => {
          this.emit("log", `A worker encountered a fatal error: ${l.message}`), c(l);
        };
      }), a = new URL(this.#P.wasmJsPath, import.meta.url).href, r = new URL(this.#P.wasmWasmPath, import.meta.url).href;
      n.postMessage({ type: "init", payload: { wasmJsPath: a, wasmWasmPath: r } }), i.push(h);
    }
    try {
      await Promise.all(i), this.emit("log", `${this.#n.length} workers initialized and ready.`);
    } catch (s) {
      throw this.emit("error", "Worker pool initialization failed."), console.error("Worker pool init failed:", s), s;
    }
  }
  #st(t) {
    const { type: e, payload: i } = t.data, s = t.target;
    if (e === "stats_complete") {
      const { stats: n, bands: h, isInitial: a } = i;
      for (const r of h)
        n[r] && this.#p.set(r, n[r]);
      if (this.#n.push(s), a) {
        this.#d = {}, [this.#i.r, this.#i.g, this.#i.b].forEach((o) => {
          this.#p.has(o) && (this.#d[o] = this.#p.get(o));
        }), this.emit("log", `Initial statistics calculation completed: ${JSON.stringify(this.#d)}`);
        const r = () => {
          this.#nt(), this.emit("loadend"), this.emit("statechange", { loading: !1 });
        };
        this.#S ? r() : this.#at().then(r), this.#K();
      } else if (!this.#l && this.#R) {
        const r = [this.#i.r, this.#i.g, this.#i.b];
        r.every((c) => this.#p.has(c)) && (this.emit("log", "Requested band statistics computed; starting smooth transition..."), this.#R = !1, this.#d = {}, r.forEach((c) => this.#d[c] = this.#p.get(c)), this.#H());
      }
      this.#N();
    } else if (e === "tile_complete") {
      if (!i || !i.bands) {
        this.emit("log", `[ERROR] Received malformed tile payload; discarded. Payload: ${JSON.stringify(i)}`), this.#n.push(s), this.#I(), this.#E();
        return;
      }
      const n = i.bands;
      if (parseInt(n[0], 10) !== this.#i.r || parseInt(n[1], 10) !== this.#i.g || parseInt(n[2], 10) !== this.#i.b) {
        this.emit("log", `Discarded stale tile (requested bands: ${n.join(",")}, current bands: ${this.#i.r},${this.#i.g},${this.#i.b})`), this.#n.push(s), this.#I(), this.#E();
        return;
      }
      const h = `${i.tile.x},${i.tile.y}`, a = this.#ht(i);
      if (this.#l) {
        if (this.#k.set(h, a), this.#M--, this.#M === 0) {
          const r = performance.now() - this.#s.bandSwitchStartTime;
          console.log(`%c[PERF-LOG] Band switch completed! Time: ${r.toFixed(0)} ms`, "color: green; font-weight: bold;"), this.emit("performance", {
            name: "bandSwitchTime",
            value: r,
            unit: "ms"
          }), this.#e.style.opacity = "0", setTimeout(() => {
            this.#u = this.#k, this.#k = null, this.#l = !1, requestAnimationFrame(() => this.#x()), this.emit("statechange", { loading: !1 }), setTimeout(() => this.#e.style.opacity = "1", 20);
          }, 200);
        }
      } else
        this.#u.set(h, a), this.#s.isInitialLoading && this.#s.initialVisibleTiles.has(h) && (this.#s.completedInitialTiles.add(h), this.#rt()), requestAnimationFrame(() => this.#x());
      this.#n.push(s), this.#I(), this.#E();
    } else if (e === "tile_error") {
      this.#l && (this.#M--, this.#M === 0 && (this.#e.style.opacity = "0", setTimeout(() => {
        this.#u = this.#k, this.#k = null, this.#l = !1, requestAnimationFrame(() => this.#x()), this.emit("statechange", { loading: !1 }), setTimeout(() => this.#e.style.opacity = "1", 20);
      }, 200)));
      const { tile: n, message: h } = i, a = `${n.x},${n.y}`;
      this.emit("log", `Worker failed to load tile (${a}) : ${h || "Unknown error"}`), this.#u.delete(a), this.#n.push(s), this.#I(), this.#E();
    }
  }
  #J(t, e = !1) {
    this.#n.length > 0 ? this.#n.pop().postMessage({ type: "calculate_stats", payload: { hdrBytes: this.#o, imgFile: this.#c, bands: t, header: this.#t, isInitial: e } }) : e ? this.emit("error", "No available worker for initial stats task!") : (this.emit("log", "No idle worker; task queued for background."), t.forEach((i) => {
      this.#w.includes(i) || this.#w.unshift(i);
    }));
  }
  #H() {
    if (this.#l) return;
    this.emit("statechange", { loading: !0, message: "Switching bands..." }), this.#l = !0, this.#k = /* @__PURE__ */ new Map();
    const t = this.#X();
    if (this.#M = t.length, this.#M === 0) {
      this.#l = !1, this.#u.clear(), requestAnimationFrame(() => this.#x()), this.emit("statechange", { loading: !1 });
      return;
    }
    for (const e of t) {
      const i = this.#n.pop();
      if (i) {
        const s = [this.#i.r, this.#i.g, this.#i.b];
        console.log(`[主线程-1-发送任务] (过渡) tile: (${e.x}, ${e.y}), bands:`, s), i.postMessage({ type: "load_tile", payload: { hdrBytes: this.#o, imgFile: this.#c, tile: e, bands: s, globalStats: this.#d, header: this.#t } });
      } else
        this.#M--, this.#v.set(`${e.x},${e.y}`, { tile: e });
    }
    this.#b = !1, this.#f = [];
  }
  #K() {
    if (!this.#T?.backgroundStats) {
      this.emit("log", "后台统计功能已关闭。");
      return;
    }
    this.#w = [];
    for (let t = 1; t <= this.#t.bands; t++)
      this.#p.has(t) || this.#w.push(t);
    if (this.#C = this.#w.length, this.#C === 0) {
      this.emit("log", "所有波段统计值已在缓存中，无需后台计算。");
      return;
    }
    this.emit("log", `开始后台统计... 队列中有 ${this.#w.length} 个波段待处理。`), this.#N();
  }
  #N() {
    if (!this.#l && this.#n.length > 0 && this.#w.length > 0) {
      const t = this.#C, e = this.#w.length - 1, i = t - e, s = t > 0 ? i / t * 100 : 0;
      this.emit("progress", { type: "stats_calculation", processed: i, total: t, progress: s });
      const n = this.#n.pop(), h = this.#w.shift();
      n.postMessage({ type: "calculate_stats", payload: { hdrBytes: this.#o, imgFile: this.#c, bands: [h], header: this.#t, isInitial: !1 } });
    }
  }
  async #at() {
    this.#V = this.#r.createSampler({ magFilter: "linear", minFilter: "linear" });
    const t = this.#r.createShaderModule({
      code: `
            struct TileUniforms { scale: vec2<f32>, offset: vec2<f32> };
            @group(0) @binding(0) var mySampler: sampler; @group(0) @binding(1) var myTexture: texture_2d<f32>;
            @group(0) @binding(2) var<uniform> uniforms: TileUniforms;
            struct VSOutput { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
            @vertex fn vs(@builtin(vertex_index) idx: u32) -> VSOutput {
                var pos = array<vec2<f32>,6>(vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
                var out: VSOutput;
                out.pos = vec4(pos[idx] * uniforms.scale + uniforms.offset, 0.0, 1.0);
                out.uv = pos[idx] * vec2(0.5, -0.5) + 0.5;
                return out;
            }
            @fragment fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
                return textureSample(myTexture, mySampler, uv);
            }`
    });
    this.#S = this.#r.createRenderPipeline({ layout: "auto", vertex: { module: t, entryPoint: "vs" }, fragment: { module: t, entryPoint: "fs", targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }] } }), this.emit("log", "WebGPU 渲染管线创建成功。");
  }
  #ht({ pixels: t, effectiveWidth: e, effectiveHeight: i, tile: s }) {
    const n = this.#r.createTexture({ size: [e, i], format: "rgba8unorm", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.#r.queue.writeTexture({ texture: n }, t, { bytesPerRow: e * 4 }, [e, i]);
    const { x: h, y: a } = this.#A(), r = e / this.#t.samples * h, o = i / this.#t.lines * a, c = ((s.x * this.#y + e / 2) / this.#t.samples * 2 - 1) * h, l = ((s.y * this.#y + i / 2) / this.#t.lines * -2 + 1) * a, u = new Float32Array([r, o, c, l]), d = this.#r.createBuffer({ size: u.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    return this.#r.queue.writeBuffer(d, 0, u), { bindGroup: this.#r.createBindGroup({ layout: this.#S.getBindGroupLayout(0), entries: [{ binding: 0, resource: this.#V }, { binding: 1, resource: n.createView() }, { binding: 2, resource: { buffer: d } }] }), uniformBuffer: d, uniformData: u };
  }
  #I() {
    if (!this.#l)
      for (; this.#n.length > 0 && this.#v.size > 0; ) {
        const t = this.#v.keys().next().value, { tile: e } = this.#v.get(t);
        this.#v.delete(t);
        const i = this.#n.pop(), s = [this.#i.r, this.#i.g, this.#i.b];
        console.log(`[主线程-1-发送任务] tile: (${e.x}, ${e.y}), bands:`, s), i.postMessage({ type: "load_tile", payload: { hdrBytes: this.#o, imgFile: this.#c, tile: e, bands: s, globalStats: this.#d, header: this.#t } });
      }
  }
  #x() {
    if (!this.#t || !this.#r || !this.#S || !this.#d) return;
    const t = this.#X();
    this.#s.isInitialLoading && this.#s.initialVisibleTiles.size === 0 && t.length > 0 && (this.#s.initialVisibleTiles = new Set(t.map((h) => `${h.x},${h.y}`)));
    const e = this.#r.createCommandEncoder(), i = this.#B.getCurrentTexture().createView(), s = e.beginRenderPass({ colorAttachments: [{ view: i, loadOp: this.#l ? "load" : "clear", storeOp: "store", clearValue: { r: 1, g: 1, b: 1, a: 1 } }] });
    s.setPipeline(this.#S);
    let n = !1;
    for (const h of t) {
      const a = `${h.x},${h.y}`, r = this.#u.get(a);
      if (r && r !== this.#_) {
        const { bindGroup: o, uniformBuffer: c, uniformData: l } = r, u = l[2] * this.#a + this.#m, d = l[3] * this.#a + this.#g, m = l[0] * this.#a, f = l[1] * this.#a;
        this.#r.queue.writeBuffer(c, 0, new Float32Array([m, f, u, d])), s.setBindGroup(0, o), s.draw(6);
      } else !r && !this.#l && (this.#u.set(a, this.#_), this.#v.set(a, { tile: h }), n = !0);
    }
    s.end(), this.#r.queue.submit([e.finish()]), n && this.#I(), !this.#b && this.#v.size === 0 && this.#f.length > 0 && this.#E();
  }
  #X() {
    if (!this.#t || !this.#e.clientWidth || !this.#e.clientHeight) return [];
    const t = this.#t.samples, e = this.#t.lines, { x: i, y: s } = this.#A(), n = (-1 - this.#m) / this.#a, h = (1 - this.#m) / this.#a, a = (1 - this.#g) / this.#a, r = (-1 - this.#g) / this.#a, o = (n / i + 1) / 2, c = (h / i + 1) / 2, l = (a / -s + 1) / 2, u = (r / -s + 1) / 2, d = Math.ceil(t / this.#y), m = Math.ceil(e / this.#y), f = Math.max(0, Math.floor(o * t / this.#y)), v = Math.min(d, Math.ceil(c * t / this.#y)), b = Math.max(0, Math.floor(l * e / this.#y)), T = Math.min(m, Math.ceil(u * e / this.#y)), y = [];
    for (let p = b; p < T; p++)
      for (let w = f; w < v; w++)
        y.push({ x: w, y: p });
    return y;
  }
  #nt() {
    const e = Math.min(this.#t.samples, 2048), i = Math.min(this.#t.lines, 2048), s = this.#t.samples / e, n = this.#t.lines / i;
    this.#a = Math.max(s, n), this.#m = 0, this.#g = 0, this.emit("log", `Setting initial focused view: scale ${this.#a.toFixed(2)}x`), requestAnimationFrame(() => this.#x()), setTimeout(() => this.#Q(), 500);
  }
  #Q() {
    if (!this.#T?.tilePreloading) {
      this.emit("log", "Tile preloading is disabled.");
      return;
    }
    if (this.#b || !this.#t || !this.#d) return;
    this.#b = !0, this.#f = [];
    const t = Math.ceil(this.#t.samples / this.#y), e = Math.ceil(this.#t.lines / this.#y), i = this.#X(), s = new Set(i.map((a) => `${a.x},${a.y}`)), n = Math.floor(i.reduce((a, r) => a + r.x, 0) / i.length || 0), h = Math.floor(i.reduce((a, r) => a + r.y, 0) / i.length || 0);
    for (let a = 0; a < e; a++)
      for (let r = 0; r < t; r++) {
        const o = `${r},${a}`;
        if (!s.has(o) && !this.#u.has(o)) {
          const c = Math.abs(r - n) + Math.abs(a - h);
          this.#f.push({ tile: { x: r, y: a }, dist: c });
        }
      }
    this.#f.sort((a, r) => a.dist - r.dist), this.emit("log", `Starting smart preloading: ${this.#f.length} tiles queued for background loading.`), this.#E();
  }
  #E() {
    if (!(!this.#b || this.#l)) {
      for (; this.#n.length > 0 && this.#f.length > 0 && this.#v.size === 0; ) {
        const { tile: t } = this.#f.shift(), e = `${t.x},${t.y}`;
        if (!this.#u.has(e)) {
          this.#u.set(e, this.#_);
          const i = this.#n.pop(), s = [this.#i.r, this.#i.g, this.#i.b];
          console.log(`[主线程-1-发送任务] (预加载) tile: (${t.x}, ${t.y}), bands:`, s), i.postMessage({ type: "load_tile", payload: { hdrBytes: this.#o, imgFile: this.#c, tile: t, bands: s, globalStats: this.#d, header: this.#t } });
        }
      }
      this.#f.length === 0 && this.#b && (this.#b = !1, this.emit("log", "All tile preloads completed."));
    }
  }
  #A() {
    if (!this.#t || !this.#e.clientWidth || !this.#e.clientHeight) return { x: 1, y: 1 };
    const t = this.#t.samples / this.#t.lines, e = this.#e.clientWidth / this.#e.clientHeight;
    let i = 1, s = 1;
    return t > e ? s = e / t : i = t / e, { x: i, y: s };
  }
  #Y() {
    const t = window.devicePixelRatio || 1, e = Math.round(this.#e.clientWidth * t), i = Math.round(this.#e.clientHeight * t);
    return this.#e.width !== e || this.#e.height !== i ? (this.#e.width = e, this.#e.height = i, !0) : !1;
  }
  #rt() {
    if (!(!this.#s.isInitialLoading || this.#s.initialVisibleTiles.size === 0) && this.#s.completedInitialTiles.size >= this.#s.initialVisibleTiles.size) {
      const t = performance.now() - this.#s.loadStartTime;
      console.log("%c[PERF-LOG] All initial tiles loaded. Emitting 'performance' event.", "color: green; font-weight: bold;"), console.log(`%c[PERF-LOG] Time to Initial View: ${t.toFixed(0)} ms`, "color: green; font-weight: bold;"), this.emit("performance", {
        name: "timeToInitialView",
        value: t,
        unit: "ms"
      }), this.#s.isInitialLoading = !1;
    }
  }
};
class M {
  constructor() {
    this.events = {};
  }
  on(t, e) {
    this.events[t] || (this.events[t] = []), this.events[t].push(e);
  }
  emit(t, ...e) {
    this.events[t] && this.events[t].forEach((i) => i(...e));
  }
  off(t, e) {
    this.events[t] && (this.events[t] = this.events[t].filter((i) => i !== e));
  }
}
class E extends M {
  #h;
  #t;
  #o;
  #c;
  #s;
  /**
   * EN: Creates an instance of EnviViewer.
   * ZH: 创建 EnviViewer 的实例。
   * @param {HTMLElement} container The HTML element to render the viewer into.
   * @param {object} options Configuration options.
   * @param {string} options.workerUrl Path to the worker.js file.
   * @param {string} options.wasmJsUrl Path to the wasm-bindgen generated JS file.
   * @param {string} options.wasmWasmUrl Path to the .wasm file.
   */
  constructor(t, e = {}) {
    if (super(), !t)
      throw new Error("A container element must be provided.");
    this.#o = t, this.#c = e, this.#t = document.createElement("canvas"), this.#t.style.width = "100%", this.#t.style.height = "100%", this.#o.appendChild(this.#t), this.#h = new x(this.#t, {
      wasmJsPath: this.#c.wasmJsUrl,
      wasmWasmPath: this.#c.wasmWasmUrl,
      workerPath: this.#c.workerUrl,
      enableBackgroundStats: this.#c.enableBackgroundStats ?? !0,
      enableTilePreloading: this.#c.enableTilePreloading ?? !0
    }), this.#r();
  }
  /**
   * EN: Attaches listeners to the internal viewer instance to propagate events.
   * ZH: 将监听器附加到内部查看器实例以传播事件。
   */
  #r() {
    this.#h.on("log", (t) => this.emit("log", t)), this.#h.on("error", (t) => this.emit("error", t)), this.#h.on("ready", () => this.emit("ready")), this.#h.on("loadstart", () => this.emit("loadstart")), this.#h.on("loadend", () => this.emit("loadend")), this.#h.on("statechange", (t) => this.emit("statechange", t)), this.#h.on("headerloaded", (t) => {
      this.#s = t, this.emit("headerloaded", t);
    }), this.#h.on("progress", (t) => this.emit("progress", t)), this.#h.on("image-clicked", (t) => this.emit("image-clicked", t));
  }
  /**
   * EN: Initializes the viewer and its WebAssembly module. Must be called before other methods.
   * ZH: 初始化查看器及其 WebAssembly 模块。必须在其他方法之前调用。
   * @returns {Promise<void>}
   */
  async init() {
    await this.#h.init();
  }
  /**
   * EN: Loads an ENVI file from a .hdr and a data file.
   * ZH: 从 .hdr 和数据文件加载 ENVI 文件。
   * @param {File} hdrFile The .hdr file.
   * @param {File} dataFile The corresponding data file (e.g., .dat, .img, .bil).
   * @returns {Promise<void>}
   */
  async loadFile(t, e) {
    if (!t || !e)
      throw new Error("Both a .hdr file and a data file must be provided.");
    await this.#h.load(t, e);
  }
  /**
   * EN: Sets the RGB bands to be displayed.
   * ZH: 设置要显示的 RGB 波段。
   * @param {{r: number, g: number, b: number}} bands An object with r, g, and b band numbers.
   */
  setBands(t) {
    this.#h.setBands(t);
  }
  /**
   * EN: Gets the header information of the loaded file.
   * ZH: 获取加载文件的头信息。
   * @returns {object|null} The header object, or null if no file is loaded.
   */
  getHeader() {
    return this.#s;
  }
  /**
   * EN: Gets the spectral profile for a given pixel coordinate.
   * ZH: 获取给定像素坐标的光谱剖面。
   * @param {number} x The x-coordinate.
   * @param {number} y The y-coordinate.
   * @returns {Promise<Float32Array|null>} A promise that resolves to the spectral data.
   */
  getSpectralProfile(t, e) {
    return this.#h.getSpectralProfile(t, e);
  }
  /**
   * EN: Destroys the viewer instance, cleans up resources, and removes the canvas.
   * ZH: 销毁查看器实例，清理资源并移除画布。
   */
  destroy() {
    this.#h.destroy(), this.#o && this.#t && this.#o.removeChild(this.#t), this.events = {};
  }
}
export {
  E as default
};

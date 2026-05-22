import { I18nManager } from "./i18n.js";
import { ScrollSync } from "./sync-scroll.js";
import { BiDirectionJump } from "./bi-direction-jump.js";

class SoMarkDownViewerApp {
    constructor() {
        this.elements = {
            appContainer: document.getElementById("app-container"),
            markdownContent: document.getElementById("markdown-content"),
            splitter: document.getElementById("markdown-splitter"),
            sourceTitle: document.querySelector(".markdown-source-title"),
            previewTitle: document.querySelector(".markdown-preview-title"),
            filePath: document.getElementById("file-path"),
            source: document.getElementById("markdown-source"),
            preview: document.getElementById("markdown-preview"),
            previewViewport: document.getElementById("preview-viewport"),
            lineNumbers: document.getElementById("line-numbers"),
            lineNumbersInner: document.getElementById("line-numbers-inner"),
            lineCountText: document.getElementById("line-count-text"),
            settingPanel: document.getElementById("setting-panel"),
            settingBackdrop: document.getElementById("setting-backdrop"),
            openSettingBtn: document.getElementById("setting-open-btn"),
            closeSettingBtn: document.getElementById("setting-close-btn"),
            openFileBtn: document.getElementById("open-file-btn"),
            localFileInput: document.getElementById("local-file-input"),
            colorChemistryCheckbox: document.getElementById("color-chemistry-checkbox"),
            imageUnderstandingCheckbox: document.getElementById("image-understanding-checkbox"),
            tocLevelSlider: document.getElementById("toc-level-slider"),
            tocLevelValue: document.getElementById("toc-level-value"),
            languageSelect: document.getElementById("language-select")
        };

        this.i18n = new I18nManager();
        this.scrollSync = new ScrollSync({
            editor: this.elements.source,
            previewViewport: this.elements.previewViewport,
            preview: this.elements.preview
        });
        this.biDirectionJump = new BiDirectionJump({
            editor: this.elements.source,
            preview: this.elements.preview
        });

        this.settings = {
            colorChemistry: true,
            imageUnderstanding: true,
            tocLevel: 3,
            language: this.i18n.language
        };

        this.renderer = null;
        this.currentPath = "docs/example.md";
        this.renderPending = false;
        this.lineNumberMeasure = null;
        this.lineNumberResizeObserver = null;
        this.lineNumberUpdatePending = false;
        this.panelTitleResizeObserver = null;
        this.panelSplitRatio = 0.5;
        this.panelResizePointerId = null;
        this.panelResizeUpdatePending = false;
        this.handlePanelResizePointerMove = this.handlePanelResizePointerMove.bind(this);
        this.handlePanelResizePointerEnd = this.handlePanelResizePointerEnd.bind(this);
    }

    async start() {
        this.initSettingsUI();
        this.initLineNumberMeasurement();
        this.initI18n();
        this.initSourceEvents();
        this.initPanelTitleMeasurement();
        this.initPanelResizeEvents();
        this.initFilePickerEvents();
        this.initSettingPanelEvents();
        this.scrollSync.start();
        this.biDirectionJump.start();
        await this.loadInitialContent();
        this.syncSettingsUI();
        this.updateLineNumbers();
        this.renderMarkdown();
    }

    initI18n() {
        this.i18n.onChange(() => {
            this.updateLineNumbers();
            this.syncPanelTitleHeight();
            if (this.renderer === null) {
                this.renderMarkdown();
            }
        });
        this.i18n.setLanguage(this.settings.language);
    }

    initSettingsUI() {
        this.elements.colorChemistryCheckbox.checked = this.settings.colorChemistry;
        this.elements.imageUnderstandingCheckbox.checked = this.settings.imageUnderstanding;
        this.elements.tocLevelSlider.value = String(this.settings.tocLevel);
        this.elements.tocLevelValue.textContent = String(this.settings.tocLevel);
        this.elements.languageSelect.value = this.settings.language;
    }

    syncSettingsUI() {
        this.elements.filePath.textContent = this.currentPath;
        this.elements.tocLevelValue.textContent = String(this.settings.tocLevel);
        this.elements.languageSelect.value = this.settings.language;
    }

    initSourceEvents() {
        this.elements.source.addEventListener("input", () => {
            this.updateLineNumbers();
            this.renderMarkdown();
        });
        this.elements.source.addEventListener("keydown", (event) => {
            this.handleSourceKeyDown(event);
        });
        this.elements.source.addEventListener("scroll", () => {
            this.syncLineNumberScroll();
        });
    }

    initLineNumberMeasurement() {
        const editorContainer = this.elements.source.parentElement;
        if (!editorContainer) {
            return;
        }

        this.lineNumberMeasure = document.createElement("div");
        this.lineNumberMeasure.className = "source-line-measure";
        this.lineNumberMeasure.setAttribute("aria-hidden", "true");
        editorContainer.appendChild(this.lineNumberMeasure);

        if ("ResizeObserver" in window) {
            this.lineNumberResizeObserver = new ResizeObserver(() => {
                this.scheduleLineNumberUpdate();
            });
            this.lineNumberResizeObserver.observe(this.elements.source);
        } else {
            window.addEventListener("resize", () => this.scheduleLineNumberUpdate());
        }
    }

    scheduleLineNumberUpdate() {
        if (this.lineNumberUpdatePending) {
            return;
        }
        this.lineNumberUpdatePending = true;
        window.requestAnimationFrame(() => {
            this.lineNumberUpdatePending = false;
            this.updateLineNumbers();
        });
    }

    initPanelTitleMeasurement() {
        this.syncPanelTitleHeight();
        window.addEventListener("resize", () => this.syncPanelTitleHeight());

        if ("ResizeObserver" in window) {
            this.panelTitleResizeObserver = new ResizeObserver(() => {
                this.syncPanelTitleHeight();
            });
            [this.elements.sourceTitle, this.elements.previewTitle].forEach((title) => {
                if (title) {
                    this.panelTitleResizeObserver.observe(title);
                }
            });
        }
    }

    syncPanelTitleHeight() {
        const { markdownContent, sourceTitle, previewTitle } = this.elements;
        if (!markdownContent || !sourceTitle || !previewTitle) {
            return;
        }

        const titleHeight = Math.max(
            sourceTitle.getBoundingClientRect().height,
            previewTitle.getBoundingClientRect().height
        );
        if (titleHeight <= 0) {
            return;
        }

        markdownContent.style.setProperty("--panel-title-height", `${titleHeight}px`);
    }

    initPanelResizeEvents() {
        const { splitter } = this.elements;
        if (!splitter) {
            return;
        }

        splitter.addEventListener("pointerdown", (event) => this.startPanelResize(event));
        splitter.addEventListener("dblclick", (event) => {
            event.preventDefault();
            this.resetPanelSplit();
        });
        splitter.addEventListener("keydown", (event) => this.handlePanelResizeKeyDown(event));
        window.addEventListener("resize", () => this.constrainPanelSplit());
    }

    startPanelResize(event) {
        if (event.button !== 0 || !this.isPanelResizeEnabled()) {
            return;
        }

        event.preventDefault();
        this.panelResizePointerId = event.pointerId;
        this.elements.appContainer.classList.add("panel-resizing");
        this.elements.splitter.setPointerCapture?.(event.pointerId);
        document.addEventListener("pointermove", this.handlePanelResizePointerMove);
        document.addEventListener("pointerup", this.handlePanelResizePointerEnd);
        document.addEventListener("pointercancel", this.handlePanelResizePointerEnd);
        this.updatePanelSplitFromPointer(event.clientX);
    }

    handlePanelResizePointerMove(event) {
        if (this.panelResizePointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        this.updatePanelSplitFromPointer(event.clientX);
    }

    handlePanelResizePointerEnd(event) {
        if (this.panelResizePointerId !== event.pointerId) {
            return;
        }

        if (this.elements.splitter.hasPointerCapture?.(event.pointerId)) {
            this.elements.splitter.releasePointerCapture(event.pointerId);
        }
        this.panelResizePointerId = null;
        this.elements.appContainer.classList.remove("panel-resizing");
        document.removeEventListener("pointermove", this.handlePanelResizePointerMove);
        document.removeEventListener("pointerup", this.handlePanelResizePointerEnd);
        document.removeEventListener("pointercancel", this.handlePanelResizePointerEnd);
        this.schedulePanelLayoutRefresh();
    }

    handlePanelResizeKeyDown(event) {
        if (!this.isPanelResizeEnabled()) {
            return;
        }

        const step = event.shiftKey ? 0.1 : 0.02;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            this.setPanelSplitRatio(this.panelSplitRatio - step);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            this.setPanelSplitRatio(this.panelSplitRatio + step);
        } else if (event.key === "Enter" || event.key === "Home") {
            event.preventDefault();
            this.resetPanelSplit();
        }
    }

    updatePanelSplitFromPointer(clientX) {
        const metrics = this.getPanelResizeMetrics();
        if (!metrics) {
            return;
        }

        const rawSourceWidth = clientX - metrics.containerLeft;
        const sourceWidth = this.clamp(rawSourceWidth, metrics.minSourceWidth, metrics.maxSourceWidth);
        this.setPanelSplitRatio(sourceWidth / metrics.availablePanelWidth);
    }

    resetPanelSplit() {
        this.setPanelSplitRatio(0.5);
    }

    constrainPanelSplit() {
        if (!this.isPanelResizeEnabled()) {
            return;
        }

        this.setPanelSplitRatio(this.panelSplitRatio);
    }

    setPanelSplitRatio(nextRatio) {
        const metrics = this.getPanelResizeMetrics();
        if (!metrics) {
            return;
        }

        const sourceWidth = this.clamp(
            metrics.availablePanelWidth * nextRatio,
            metrics.minSourceWidth,
            metrics.maxSourceWidth
        );
        this.panelSplitRatio = sourceWidth / metrics.availablePanelWidth;
        this.elements.markdownContent.style.setProperty(
            "--source-panel-width",
            `calc((100% - var(--splitter-hit-size)) * ${this.panelSplitRatio})`
        );
        this.elements.splitter.setAttribute("aria-valuenow", String(Math.round(this.panelSplitRatio * 100)));
        this.schedulePanelLayoutRefresh();
    }

    getPanelResizeMetrics() {
        const { markdownContent, splitter } = this.elements;
        if (!markdownContent || !splitter) {
            return null;
        }

        const containerRect = markdownContent.getBoundingClientRect();
        const splitterWidth = splitter.getBoundingClientRect().width;
        const availablePanelWidth = containerRect.width - splitterWidth;
        if (availablePanelWidth <= 0) {
            return null;
        }

        const styles = window.getComputedStyle(markdownContent);
        const minSourceWidth = this.parseCssPixelValue(styles.getPropertyValue("--source-panel-min-width"), 280);
        const minPreviewWidth = this.parseCssPixelValue(styles.getPropertyValue("--preview-panel-min-width"), 320);
        const maxSourceWidth = Math.max(minSourceWidth, availablePanelWidth - minPreviewWidth);

        return {
            containerLeft: containerRect.left,
            availablePanelWidth,
            minSourceWidth,
            maxSourceWidth
        };
    }

    parseCssPixelValue(value, fallback) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    isPanelResizeEnabled() {
        const { markdownContent, splitter } = this.elements;
        if (!markdownContent || !splitter) {
            return false;
        }

        return window.getComputedStyle(splitter).display !== "none"
            && window.getComputedStyle(markdownContent).flexDirection !== "column";
    }

    schedulePanelLayoutRefresh() {
        if (this.panelResizeUpdatePending) {
            return;
        }

        this.panelResizeUpdatePending = true;
        window.requestAnimationFrame(() => {
            this.panelResizeUpdatePending = false;
            this.scheduleLineNumberUpdate();
            this.scrollSync.refreshMap();
            this.biDirectionJump.refreshMap();
        });
    }

    initFilePickerEvents() {
        this.elements.openFileBtn.addEventListener("click", () => this.openFilePicker());
        this.elements.localFileInput.addEventListener("change", () => {
            this.handleLocalFileSelect();
        });
    }

    openFilePicker() {
        this.elements.localFileInput.click();
    }

    canPreviewFile(fileName) {
        return /\.(md|smd|txt)$/i.test(fileName);
    }

    async handleLocalFileSelect() {
        const selectedFile = this.elements.localFileInput.files?.[0];
        if (!selectedFile) {
            return;
        }
        if (!this.canPreviewFile(selectedFile.name)) {
            this.elements.localFileInput.value = "";
            return;
        }
        try {
            const fileContent = await selectedFile.text();
            this.currentPath = selectedFile.name;
            this.elements.source.value = fileContent;
            this.syncSettingsUI();
            this.updateLineNumbers();
            this.renderMarkdown();
        } finally {
            this.elements.localFileInput.value = "";
        }
    }

    handleSourceKeyDown(event) {
        if (event.key !== "Tab") {
            return;
        }

        event.preventDefault();
        const textarea = this.elements.source;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const tabText = "    ";

        textarea.value = `${textarea.value.slice(0, start)}${tabText}${textarea.value.slice(end)}`;
        const cursor = start + tabText.length;
        textarea.setSelectionRange(cursor, cursor);
        this.updateLineNumbers();
        this.renderMarkdown();
    }

    initSettingPanelEvents() {
        this.elements.openSettingBtn.addEventListener("click", () => this.openSettingPanel());
        this.elements.closeSettingBtn.addEventListener("click", () => this.closeSettingPanel());
        this.elements.settingBackdrop.addEventListener("click", () => this.closeSettingPanel());
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                this.closeSettingPanel();
            }
        });

        this.elements.colorChemistryCheckbox.addEventListener("change", () => {
            this.settings.colorChemistry = this.elements.colorChemistryCheckbox.checked;
            this.renderMarkdown();
        });

        this.elements.imageUnderstandingCheckbox.addEventListener("change", () => {
            this.settings.imageUnderstanding = this.elements.imageUnderstandingCheckbox.checked;
            this.renderMarkdown();
        });

        this.elements.tocLevelSlider.addEventListener("input", () => {
            this.settings.tocLevel = Number.parseInt(this.elements.tocLevelSlider.value, 10) || 3;
            this.elements.tocLevelValue.textContent = String(this.settings.tocLevel);
            this.renderMarkdown();
        });

        this.elements.languageSelect.addEventListener("change", () => {
            this.settings.language = this.elements.languageSelect.value;
            this.i18n.setLanguage(this.settings.language);
        });
    }

    openSettingPanel() {
        this.elements.appContainer.classList.add("settings-open");
        this.elements.settingPanel.classList.add("open");
    }

    closeSettingPanel() {
        this.elements.appContainer.classList.remove("settings-open");
        this.elements.settingPanel.classList.remove("open");
    }

    resolveMarkdownPath() {
        const params = new URLSearchParams(window.location.search);
        const rawPath = params.get("file");
        if (!rawPath) {
            return "docs/example.md";
        }
        return rawPath
            .replace(/^[a-z]+:\/\/[^/]+/i, "")
            .replace(/^\/+/, "");
    }

    async loadInitialContent() {
        this.currentPath = this.resolveMarkdownPath();
        this.syncSettingsUI();
        const targetUrl = new URL(this.currentPath, window.location.origin);
        try {
            const response = await fetch(targetUrl.toString());
            if (!response.ok) {
                throw new Error(String(response.status));
            }
            const text = await response.text();
            this.elements.source.value = text;
        } catch (error) {
            this.elements.source.value = `# ${this.i18n.t("errors.loadFile", { path: this.currentPath })}\n`;
        }
    }

    updateLineNumbers() {
        const sourceText = this.elements.source.value;
        const lines = sourceText.length === 0 ? [""] : sourceText.split("\n");
        const lineHeight = this.syncLineNumberMeasureStyle();
        const lineNumberHtml = lines
            .flatMap((line, index) => this.createLineNumberRows(line, index + 1, lineHeight))
            .join("");

        this.elements.lineNumbersInner.innerHTML = lineNumberHtml;
        this.elements.lineCountText.textContent = this.i18n.t("line.count", { count: lines.length });
        this.syncLineNumberScroll();
    }

    createLineNumberRows(line, lineNumber, lineHeight) {
        const visualLineCount = this.getVisualLineCount(line, lineHeight);
        const rows = [`<div>${lineNumber}</div>`];
        for (let index = 1; index < visualLineCount; index += 1) {
            rows.push('<div aria-hidden="true"></div>');
        }
        return rows;
    }

    getVisualLineCount(line, lineHeight) {
        const measure = this.lineNumberMeasure;
        if (!measure) {
            return 1;
        }

        measure.textContent = line.length > 0 ? line : " ";

        const measuredHeight = measure.getBoundingClientRect().height;
        return Math.max(1, Math.round(measuredHeight / lineHeight));
    }

    syncLineNumberMeasureStyle() {
        const textarea = this.elements.source;
        const textareaStyle = window.getComputedStyle(textarea);
        const measure = this.lineNumberMeasure;
        const toPixelNumber = (value) => Number.parseFloat(value) || 0;
        const fontSize = toPixelNumber(textareaStyle.fontSize);
        const lineHeight = Number.parseFloat(textareaStyle.lineHeight) || fontSize * 1.2;
        const contentWidth = Math.max(
            textarea.clientWidth - toPixelNumber(textareaStyle.paddingLeft) - toPixelNumber(textareaStyle.paddingRight),
            0
        );

        this.elements.lineNumbers.style.paddingTop = textareaStyle.paddingTop;
        this.elements.lineNumbersInner.style.setProperty("--source-line-height", `${lineHeight}px`);

        if (!measure) {
            return lineHeight;
        }

        measure.style.width = `${contentWidth}px`;
        measure.style.fontFamily = textareaStyle.fontFamily;
        measure.style.fontSize = textareaStyle.fontSize;
        measure.style.fontStyle = textareaStyle.fontStyle;
        measure.style.fontWeight = textareaStyle.fontWeight;
        measure.style.fontVariant = textareaStyle.fontVariant;
        measure.style.letterSpacing = textareaStyle.letterSpacing;
        measure.style.lineHeight = `${lineHeight}px`;
        measure.style.tabSize = textareaStyle.tabSize;
        measure.style.wordSpacing = textareaStyle.wordSpacing;

        return lineHeight;
    }

    syncLineNumberScroll() {
        this.elements.lineNumbersInner.style.transform = `translateY(${-this.elements.source.scrollTop}px)`;
    }

    createRenderer() {
        const SoMarkDown = window.SoMarkDown;
        if (!SoMarkDown) {
            return null;
        }
        const includeLevel = Array.from({ length: this.settings.tocLevel }, (_, index) => index + 1);
        return new SoMarkDown({
            html: true,
            typographer: true,
            imgDescEnabled: this.settings.imageUnderstanding,
            lineNumbers: {
                enable: true,
                nested: true
            },
            smiles: {
                disableColors: !this.settings.colorChemistry
            },
            toc: {
                includeLevel
            }
        });
    }

    ensurePreviewLinksOpenInNewPage() {
        const links = this.elements.preview.querySelectorAll("a[href]");
        links.forEach((link) => {
            const href = link.getAttribute("href") || "";
            if (href.startsWith("#")) {
                return;
            }
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener noreferrer");
        });
    }

    renderMarkdown() {
        if (this.renderPending) {
            return;
        }
        this.renderPending = true;
        window.requestAnimationFrame(() => {
            this.renderPending = false;
            this.renderer = this.createRenderer();
            if (!this.renderer) {
                this.elements.preview.innerHTML = "<p>SoMarkDown not loaded.</p>";
                return;
            }
            try {
                this.elements.preview.className = "somarkdown-container theme-dark";
                this.elements.preview.innerHTML = this.renderer.render(this.elements.source.value);
                this.ensurePreviewLinksOpenInNewPage();
            } catch (error) {
                this.elements.preview.innerHTML = `<p>${String(error)}</p>`;
            }
            this.scrollSync.refreshMap();
            this.biDirectionJump.refreshMap();
        });
    }
}

const app = new SoMarkDownViewerApp();
app.start();

import { I18nManager } from "./i18n.js";
import { ScrollSync } from "./sync-scroll.js";
import { BiDirectionJump } from "./bi-direction-jump.js";

class SoMarkDownViewerApp {
    constructor() {
        this.elements = {
            appContainer: document.getElementById("app-container"),
            filePath: document.getElementById("file-path"),
            source: document.getElementById("markdown-source"),
            preview: document.getElementById("markdown-preview"),
            previewViewport: document.getElementById("preview-viewport"),
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
        this.currentPath = "docs/bidirectional-scroll-sync.md";
        this.renderPending = false;
    }

    async start() {
        this.initSettingsUI();
        this.initI18n();
        this.initSourceEvents();
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
            return "docs/bidirectional-scroll-sync.md";
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
        const lineCount = sourceText.length === 0 ? 1 : sourceText.split("\n").length;
        const lineNumberHtml = Array.from({ length: lineCount }, (_, index) => `<div>${index + 1}</div>`).join("");
        this.elements.lineNumbersInner.innerHTML = lineNumberHtml;
        this.elements.lineCountText.textContent = this.i18n.t("line.count", { count: lineCount });
        this.syncLineNumberScroll();
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

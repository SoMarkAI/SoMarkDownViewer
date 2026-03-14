const messages = {
    "zh-CN": {
        "panel.source": "源码",
        "panel.preview": "预览",
        "settings.title": "设置",
        "settings.lineNumbers": "行号映射",
        "settings.colorChemistry": "化学式着色",
        "settings.imageUnderstanding": "图片理解",
        "settings.tocMaxLevel": "目录最大层级",
        "settings.language": "界面语言",
        "settings.about": "关于",
        "settings.aboutText": "SoMarkDown 的目标是为专业场景提供强大灵活的 Markdown 渲染能力，同时为 LLM 提供简洁、无歧义、易解析的 Markdown 标准。",
        "line.count": "{count} 行",
        "errors.loadFile": "文件加载失败：{path}"
    },
    en: {
        "panel.source": "Source",
        "panel.preview": "Preview",
        "settings.title": "Setting",
        "settings.lineNumbers": "Line Number Mapping",
        "settings.colorChemistry": "Color Chemistry",
        "settings.imageUnderstanding": "Image Understanding",
        "settings.tocMaxLevel": "TOC Max Level",
        "settings.language": "Language",
        "settings.about": "About",
        "settings.aboutText": "SoMarkDown delivers a powerful and flexible Markdown rendering solution for professional users while providing LLMs with a concise, unambiguous, and parsable Markdown standard.",
        "line.count": "{count} Lines",
        "errors.loadFile": "Failed to load file: {path}"
    }
};

class I18nManager {
    constructor() {
        this.language = this.detectLanguage();
        this.changeHandlers = [];
    }

    detectLanguage() {
        const lang = (navigator.language || "").toLowerCase();
        if (lang.startsWith("zh")) {
            return "zh-CN";
        }
        return "en";
    }

    onChange(handler) {
        this.changeHandlers.push(handler);
    }

    setLanguage(language) {
        if (!messages[language]) {
            return;
        }
        this.language = language;
        document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
        this.translatePage();
        this.changeHandlers.forEach((handler) => handler(language));
    }

    t(key, replacements = {}) {
        const dict = messages[this.language] || messages.en;
        let text = dict[key] || messages.en[key] || key;
        Object.entries(replacements).forEach(([name, value]) => {
            text = text.replace(`{${name}}`, String(value));
        });
        return text;
    }

    translatePage() {
        const elements = document.querySelectorAll("[data-i18n]");
        elements.forEach((element) => {
            const key = element.getAttribute("data-i18n");
            if (!key) {
                return;
            }
            element.textContent = this.t(key);
        });
    }
}

export { I18nManager };

const STORAGE_NAMESPACE = "somarkdown-viewer";
const HISTORY_INDEX_KEY = `${STORAGE_NAMESPACE}:history:index`;
const SETTINGS_KEY = `${STORAGE_NAMESPACE}:settings`;
const DOCUMENT_KEY_PREFIX = `${STORAGE_NAMESPACE}:document:`;

const DEFAULT_AUTOSAVE_SETTINGS = {
    enabled: true,
    intervalSeconds: 1
};

const CONTEXT_TYPE = {
    EXAMPLE: "example",
    LOCAL_FILE: "local-file",
    HISTORY: "history"
};

class LocalDocStore {
    constructor(storage = window.localStorage) {
        this.storage = storage;
    }

    createDocument(content) {
        const now = Date.now();
        const record = {
            id: this.createUuid(),
            content,
            createdAt: now,
            updatedAt: now
        };

        try {
            this.writeJson(this.getDocumentKey(record.id), record);
            this.upsertIndexEntry(record);
            return { ok: true, record, changed: true };
        } catch (error) {
            this.removeItemSafely(this.getDocumentKey(record.id));
            console.error("Failed to create local document.", error);
            return { ok: false, error };
        }
    }

    getDocument(id) {
        const record = this.readJson(this.getDocumentKey(id), null);
        return this.isValidDocument(record) ? record : null;
    }

    updateDocument(id, content) {
        const current = this.getDocument(id);
        if (!current) {
            return { ok: false, error: new Error(`Local document not found: ${id}`) };
        }
        if (current.content === content) {
            return { ok: true, record: current, changed: false };
        }

        const record = {
            ...current,
            content,
            updatedAt: Date.now()
        };

        try {
            this.writeJson(this.getDocumentKey(id), record);
            this.upsertIndexEntry(record);
            return { ok: true, record, changed: true };
        } catch (error) {
            console.error("Failed to update local document.", error);
            return { ok: false, error };
        }
    }

    deleteDocument(id) {
        try {
            this.storage.removeItem(this.getDocumentKey(id));
            this.writeIndex(this.readIndex().filter((entry) => entry.id !== id));
            return { ok: true };
        } catch (error) {
            console.error("Failed to delete local document.", error);
            return { ok: false, error };
        }
    }

    listDocuments() {
        return this.readIndex()
            .map((entry) => this.getDocument(entry.id))
            .filter((record) => record !== null)
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    readSettings() {
        const settings = this.readJson(SETTINGS_KEY, {});
        return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
    }

    writeSettings(settings) {
        try {
            this.writeJson(SETTINGS_KEY, settings);
            return { ok: true };
        } catch (error) {
            console.error("Failed to save settings.", error);
            return { ok: false, error };
        }
    }

    upsertIndexEntry(record) {
        const nextEntry = {
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        };
        const index = this.readIndex().filter((entry) => entry.id !== record.id);
        index.push(nextEntry);
        this.writeIndex(index);
    }

    readIndex() {
        const index = this.readJson(HISTORY_INDEX_KEY, []);
        if (!Array.isArray(index)) {
            return [];
        }
        return index
            .filter((entry) => this.isValidIndexEntry(entry))
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    writeIndex(index) {
        const normalizedIndex = index
            .filter((entry) => this.isValidIndexEntry(entry))
            .sort((left, right) => right.updatedAt - left.updatedAt);
        this.writeJson(HISTORY_INDEX_KEY, normalizedIndex);
    }

    readJson(key, fallback) {
        try {
            const rawValue = this.storage.getItem(key);
            if (rawValue === null) {
                return fallback;
            }
            return JSON.parse(rawValue);
        } catch (error) {
            console.error(`Failed to read localStorage key: ${key}`, error);
            return fallback;
        }
    }

    writeJson(key, value) {
        this.storage.setItem(key, JSON.stringify(value));
    }

    removeItemSafely(key) {
        try {
            this.storage.removeItem(key);
        } catch (error) {
            console.error(`Failed to remove localStorage key: ${key}`, error);
        }
    }

    getDocumentKey(id) {
        return `${DOCUMENT_KEY_PREFIX}${id}`;
    }

    createUuid() {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
            const random = Math.floor(Math.random() * 16);
            const value = char === "x" ? random : (random & 0x3) | 0x8;
            return value.toString(16);
        });
    }

    isValidDocument(record) {
        return record
            && typeof record === "object"
            && typeof record.id === "string"
            && typeof record.content === "string"
            && Number.isFinite(record.createdAt)
            && Number.isFinite(record.updatedAt);
    }

    isValidIndexEntry(entry) {
        return entry
            && typeof entry === "object"
            && typeof entry.id === "string"
            && Number.isFinite(entry.createdAt)
            && Number.isFinite(entry.updatedAt);
    }
}

class EditorSession {
    constructor({ store, examplePath = "docs/example.md" }) {
        this.store = store;
        this.examplePath = examplePath;
        this.type = CONTEXT_TYPE.EXAMPLE;
        this.storageId = null;
        this.displayName = examplePath;
        this.exampleContent = "";
        this.localFileName = null;
    }

    setExample(content, path = this.examplePath) {
        this.type = CONTEXT_TYPE.EXAMPLE;
        this.storageId = null;
        this.displayName = path;
        this.examplePath = path;
        this.exampleContent = content;
        this.localFileName = null;
    }

    setLocalFile(fileName) {
        this.type = CONTEXT_TYPE.LOCAL_FILE;
        this.storageId = null;
        this.displayName = fileName;
        this.localFileName = fileName;
    }

    setHistoryDocument(record) {
        this.type = CONTEXT_TYPE.HISTORY;
        this.storageId = record.id;
        this.displayName = record.id;
        this.localFileName = null;
    }

    createBlankDocument() {
        const result = this.store.createDocument("");
        if (result.ok) {
            this.setHistoryDocument(result.record);
        }
        return result;
    }

    save(content) {
        if (this.type === CONTEXT_TYPE.HISTORY && this.storageId) {
            const result = this.store.updateDocument(this.storageId, content);
            if (result.ok) {
                this.setHistoryDocument(result.record);
            }
            return result;
        }

        if (this.type === CONTEXT_TYPE.EXAMPLE && content === this.exampleContent) {
            return { ok: true, changed: false, record: null };
        }

        const result = this.store.createDocument(content);
        if (result.ok) {
            this.setHistoryDocument(result.record);
        }
        return result;
    }

    isCurrentHistoryId(id) {
        return this.type === CONTEXT_TYPE.HISTORY && this.storageId === id;
    }

    getDisplayName() {
        return this.displayName;
    }

    getStorageId() {
        return this.storageId;
    }

    getType() {
        return this.type;
    }

    getDownloadBaseName() {
        if (this.type === CONTEXT_TYPE.HISTORY && this.storageId) {
            return this.storageId;
        }
        if (this.type === CONTEXT_TYPE.EXAMPLE) {
            return this.examplePath.split("/").pop() || "example.md";
        }
        return this.localFileName || this.displayName || "download.smd";
    }
}

class AutosaveController {
    constructor({ store, onSave }) {
        this.store = store;
        this.onSave = onSave;
        this.timerId = null;
        this.settings = this.normalizeSettings(this.store.readSettings().autosave);
    }

    getSettings() {
        return { ...this.settings };
    }

    updateSettings(nextSettings) {
        this.settings = this.normalizeSettings({
            ...this.settings,
            ...nextSettings
        });
        this.persistSettings();
        if (!this.isEnabled()) {
            this.cancel();
        }
    }

    schedule() {
        this.cancel();
        if (!this.isEnabled()) {
            return;
        }
        this.timerId = window.setTimeout(() => {
            this.timerId = null;
            this.onSave();
        }, this.settings.intervalSeconds * 1000);
    }

    cancel() {
        if (this.timerId !== null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
    }

    isEnabled() {
        return this.settings.enabled && this.settings.intervalSeconds > 0;
    }

    persistSettings() {
        const currentSettings = this.store.readSettings();
        this.store.writeSettings({
            ...currentSettings,
            autosave: this.settings
        });
    }

    normalizeSettings(settings) {
        const source = settings && typeof settings === "object" ? settings : {};
        const intervalSeconds = Number.parseFloat(source.intervalSeconds);
        return {
            enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_AUTOSAVE_SETTINGS.enabled,
            intervalSeconds: Number.isFinite(intervalSeconds)
                ? Math.max(0, intervalSeconds)
                : DEFAULT_AUTOSAVE_SETTINGS.intervalSeconds
        };
    }
}

function downloadTextFile({ content, fileName }) {
    const anchor = document.createElement("a");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);

    anchor.href = objectUrl;
    anchor.download = normalizeDownloadFileName(fileName);
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function normalizeDownloadFileName(fileName) {
    const safeName = String(fileName || "download.smd").trim() || "download.smd";
    if (/\.[A-Za-z0-9]+$/.test(safeName)) {
        return safeName;
    }
    return `${safeName}.smd`;
}

function getHistoryTitle(content, emptyTitle = "空白文档") {
    const paragraph = String(content || "")
        .split(/\n\s*\n/)
        .map((part) => stripMarkdown(part).trim())
        .find((part) => part.length > 0);

    return paragraph || emptyTitle;
}

function stripMarkdown(text) {
    return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/^\s{0,3}>\s?/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+[.)]\s+/gm, "")
        .replace(/[*_~>#|]/g, "")
        .replace(/\s+/g, " ");
}

function formatRelativeTime(timestamp) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (elapsedSeconds < 60) {
        return `${elapsedSeconds} 秒前`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) {
        return `${elapsedMinutes} 分钟前`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
        return `${elapsedHours} 小时前`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 30) {
        return `${elapsedDays} 天前`;
    }

    const elapsedMonths = Math.floor(elapsedDays / 30);
    if (elapsedDays < 365) {
        return `${elapsedMonths} 月前`;
    }

    return `${Math.floor(elapsedDays / 365)} 年前`;
}

export {
    AutosaveController,
    CONTEXT_TYPE,
    EditorSession,
    LocalDocStore,
    downloadTextFile,
    formatRelativeTime,
    getHistoryTitle,
    normalizeDownloadFileName,
    stripMarkdown
};

import { formatRelativeTime, getHistoryTitle } from "./local-documents.js";

class HistoryPanel {
    constructor({ elements, store, i18n, onOpenDocument, onDeleteActiveDocument }) {
        this.elements = elements;
        this.store = store;
        this.i18n = i18n;
        this.onOpenDocument = onOpenDocument;
        this.onDeleteActiveDocument = onDeleteActiveDocument;
        this.activeDocumentId = null;
    }

    setActiveDocumentId(id) {
        this.activeDocumentId = id;
    }

    open() {
        this.render();
        this.elements.appContainer.classList.add("history-open");
        this.elements.historyPanel.classList.add("open");
    }

    close() {
        this.elements.appContainer.classList.remove("history-open");
        this.elements.historyPanel.classList.remove("open");
    }

    render() {
        const documents = this.store.listDocuments();
        this.elements.historyList.innerHTML = "";

        if (documents.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "history-empty";
            emptyState.textContent = this.i18n.t("history.empty");
            this.elements.historyList.appendChild(emptyState);
            return;
        }

        documents.forEach((record) => {
            this.elements.historyList.appendChild(this.createHistoryItem(record));
        });
    }

    createHistoryItem(record) {
        const item = document.createElement("div");
        item.className = "history-item";
        item.setAttribute("role", "button");
        item.tabIndex = 0;
        item.dataset.documentId = record.id;

        const textColumn = document.createElement("span");
        textColumn.className = "history-item-text";

        const title = document.createElement("span");
        title.className = "history-item-title";
        title.textContent = getHistoryTitle(record.content, this.i18n.t("history.emptyDocumentTitle"));

        const time = document.createElement("span");
        time.className = "history-item-time";
        time.textContent = formatRelativeTime(record.updatedAt);

        const deleteButton = document.createElement("button");
        deleteButton.className = "history-delete-btn";
        deleteButton.type = "button";
        deleteButton.setAttribute("aria-label", this.i18n.t("history.delete"));
        deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';

        textColumn.append(title, time);
        item.append(textColumn, deleteButton);

        item.addEventListener("click", () => {
            this.onOpenDocument(record);
            this.close();
        });
        item.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") {
                return;
            }
            event.preventDefault();
            this.onOpenDocument(record);
            this.close();
        });

        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.deleteDocument(record.id);
        });
        deleteButton.addEventListener("keydown", (event) => {
            event.stopPropagation();
        });

        return item;
    }

    deleteDocument(id) {
        if (!window.confirm(this.i18n.t("history.confirmDelete"))) {
            return;
        }

        const wasActive = this.activeDocumentId === id;
        const result = this.store.deleteDocument(id);
        if (!result.ok) {
            return;
        }

        if (wasActive) {
            this.onDeleteActiveDocument();
        }
        this.render();
    }
}

export { HistoryPanel };

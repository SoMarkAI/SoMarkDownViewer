class BiDirectionJump {
    constructor(options) {
        this.editor = options.editor;
        this.preview = options.preview;
        this.mappedNodes = [];
        this.activeNode = null;
        this.hoverNode = null;
        this.onEditorCursorChange = this.onEditorCursorChange.bind(this);
        this.onPreviewMouseOver = this.onPreviewMouseOver.bind(this);
        this.onPreviewMouseLeave = this.onPreviewMouseLeave.bind(this);
        this.onPreviewDoubleClick = this.onPreviewDoubleClick.bind(this);
    }

    start() {
        this.editor.addEventListener("click", this.onEditorCursorChange);
        this.editor.addEventListener("keyup", this.onEditorCursorChange);
        this.editor.addEventListener("input", this.onEditorCursorChange);
        this.editor.addEventListener("focus", this.onEditorCursorChange);
        this.preview.addEventListener("mouseover", this.onPreviewMouseOver);
        this.preview.addEventListener("mouseleave", this.onPreviewMouseLeave);
        this.preview.addEventListener("dblclick", this.onPreviewDoubleClick);
        this.refreshMap();
    }

    refreshMap() {
        const nodes = Array.from(this.preview.querySelectorAll("[data-line]"));
        this.mappedNodes = nodes
            .map((node) => {
                const line = Number.parseInt(node.getAttribute("data-line"), 10);
                if (Number.isNaN(line)) {
                    return null;
                }
                node.classList.add("bi-direction-jump__target");
                return { line, node };
            })
            .filter((entry) => entry !== null)
            .sort((a, b) => a.line - b.line);
        this.activeNode = null;
        this.hoverNode = null;
        this.syncPreviewHighlight();
    }

    onEditorCursorChange() {
        this.syncPreviewHighlight();
    }

    onPreviewMouseOver(event) {
        const target = event.target.closest("[data-line]");
        if (!target || !this.preview.contains(target)) {
            return;
        }
        this.setHoverNode(target);
    }

    onPreviewMouseLeave() {
        this.setHoverNode(null);
    }

    onPreviewDoubleClick(event) {
        const target = event.target.closest("[data-line]");
        if (!target || !this.preview.contains(target)) {
            return;
        }
        const line = Number.parseInt(target.getAttribute("data-line"), 10);
        if (Number.isNaN(line)) {
            return;
        }
        const cursorPos = this.getLineStartPos(this.editor.value, line);
        this.editor.focus();
        this.editor.setSelectionRange(cursorPos, cursorPos);
        this.scrollEditorToLineIfNeeded(line);
        this.syncPreviewHighlight();
    }

    syncPreviewHighlight() {
        const line = this.getCursorLine(this.editor);
        const target = this.findBestMatchNode(line);
        this.setActiveNode(target);
    }

    getCursorLine(textarea) {
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = textarea.value.slice(0, cursorPos);
        return textBeforeCursor.split("\n").length - 1;
    }

    getLineStartPos(text, line) {
        if (line <= 0) {
            return 0;
        }
        let currentLine = 0;
        let index = 0;
        const textLength = text.length;
        while (index < textLength && currentLine < line) {
            if (text.charCodeAt(index) === 10) {
                currentLine += 1;
            }
            index += 1;
        }
        return index;
    }

    findBestMatchNode(line) {
        if (this.mappedNodes.length === 0) {
            return null;
        }
        let bestNode = null;
        let bestLine = -1;
        for (let index = 0; index < this.mappedNodes.length; index += 1) {
            const entry = this.mappedNodes[index];
            if (entry.line > line) {
                break;
            }
            if (entry.line >= bestLine) {
                bestLine = entry.line;
                bestNode = entry.node;
            }
        }
        if (bestNode) {
            return bestNode;
        }
        return this.mappedNodes[0].node;
    }

    setActiveNode(node) {
        if (this.activeNode && this.activeNode !== node) {
            this.activeNode.classList.remove("bi-direction-jump__target--active");
        }
        this.activeNode = node;
        if (this.activeNode) {
            this.activeNode.classList.add("bi-direction-jump__target--active");
        }
    }

    setHoverNode(node) {
        if (this.hoverNode && this.hoverNode !== node) {
            this.hoverNode.classList.remove("bi-direction-jump__target--hover");
        }
        this.hoverNode = node;
        if (this.hoverNode) {
            this.hoverNode.classList.add("bi-direction-jump__target--hover");
        }
    }

    scrollEditorToLineIfNeeded(line) {
        const lineHeight = Number.parseFloat(window.getComputedStyle(this.editor).lineHeight) || 22;
        const targetTop = line * lineHeight;
        const targetBottom = targetTop + lineHeight;
        const viewportTop = this.editor.scrollTop;
        const viewportBottom = viewportTop + this.editor.clientHeight;
        if (targetTop >= viewportTop && targetBottom <= viewportBottom) {
            return;
        }
        const shouldAlignTop = targetTop < viewportTop;
        const nextTop = shouldAlignTop ? targetTop : targetBottom - this.editor.clientHeight;
        const maxTop = Math.max(this.editor.scrollHeight - this.editor.clientHeight, 0);
        this.editor.scrollTop = Math.min(Math.max(nextTop, 0), maxTop);
    }
}

export { BiDirectionJump };

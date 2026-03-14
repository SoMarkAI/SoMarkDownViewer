class ScrollSync {
    constructor(options) {
        this.editor = options.editor;
        this.previewViewport = options.previewViewport;
        this.preview = options.preview;
        this.lockSide = null;
        this.lineMap = [];
        this.editorLineHeight = 22;
        this.onEditorScroll = this.onEditorScroll.bind(this);
        this.onPreviewScroll = this.onPreviewScroll.bind(this);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    start() {
        this.updateEditorLineHeight();
        this.editor.addEventListener("scroll", this.onEditorScroll);
        this.previewViewport.addEventListener("scroll", this.onPreviewScroll);
        window.addEventListener("resize", () => this.refreshMap());
    }

    refreshMap() {
        const nodes = this.preview.querySelectorAll("[data-line]");
        this.lineMap = Array.from(nodes)
            .map((node) => {
                const line = Number.parseInt(node.getAttribute("data-line"), 10);
                return {
                    line: Number.isNaN(line) ? null : line + 1,
                    top: node.offsetTop
                };
            })
            .filter((entry) => entry.line !== null)
            .sort((a, b) => a.line - b.line || a.top - b.top);
    }

    updateEditorLineHeight() {
        const lineHeight = Number.parseFloat(window.getComputedStyle(this.editor).lineHeight);
        this.editorLineHeight = Number.isNaN(lineHeight) ? 22 : lineHeight;
    }

    onEditorScroll() {
        if (this.lockSide === "preview") {
            return;
        }
        this.lockSide = "editor";
        const maxEditorScroll = Math.max(this.editor.scrollHeight - this.editor.clientHeight, 0);
        const maxPreviewScroll = Math.max(this.previewViewport.scrollHeight - this.previewViewport.clientHeight, 0);
        const epsilon = 1;

        if (maxPreviewScroll <= 0) {
            this.lockSide = null;
            return;
        }

        if (this.editor.scrollTop <= epsilon) {
            this.previewViewport.scrollTop = 0;
        } else if (this.editor.scrollTop >= maxEditorScroll - epsilon) {
            this.previewViewport.scrollTop = maxPreviewScroll;
        } else {
            const line = this.editor.scrollTop / this.editorLineHeight + 1;
            const top = this.interpolateTopByLine(line);
            this.previewViewport.scrollTop = this.clamp(top, 0, maxPreviewScroll);
        }

        window.requestAnimationFrame(() => {
            this.lockSide = null;
        });
    }

    onPreviewScroll() {
        if (this.lockSide === "editor") {
            return;
        }
        this.lockSide = "preview";
        const maxEditorScroll = Math.max(this.editor.scrollHeight - this.editor.clientHeight, 0);
        const maxPreviewScroll = Math.max(this.previewViewport.scrollHeight - this.previewViewport.clientHeight, 0);
        const epsilon = 1;

        if (maxEditorScroll <= 0) {
            this.lockSide = null;
            return;
        }

        if (this.previewViewport.scrollTop <= epsilon) {
            this.editor.scrollTop = 0;
        } else if (this.previewViewport.scrollTop >= maxPreviewScroll - epsilon) {
            this.editor.scrollTop = maxEditorScroll;
        } else {
            const line = this.interpolateLineByTop(this.previewViewport.scrollTop);
            const target = (line - 1) * this.editorLineHeight;
            this.editor.scrollTop = this.clamp(target, 0, maxEditorScroll);
        }

        window.requestAnimationFrame(() => {
            this.lockSide = null;
        });
    }

    interpolateTopByLine(line) {
        if (this.lineMap.length === 0) {
            return 0;
        }
        if (line <= this.lineMap[0].line) {
            return 0;
        }
        for (let index = 1; index < this.lineMap.length; index += 1) {
            const prev = this.lineMap[index - 1];
            const curr = this.lineMap[index];
            if (line <= curr.line) {
                const deltaLine = curr.line - prev.line;
                if (deltaLine <= 0) {
                    return curr.top;
                }
                const ratio = (line - prev.line) / deltaLine;
                return prev.top + (curr.top - prev.top) * ratio;
            }
        }
        return this.lineMap[this.lineMap.length - 1].top;
    }

    interpolateLineByTop(top) {
        if (this.lineMap.length === 0) {
            return 1;
        }
        if (top <= this.lineMap[0].top) {
            return 1;
        }
        for (let index = 1; index < this.lineMap.length; index += 1) {
            const prev = this.lineMap[index - 1];
            const curr = this.lineMap[index];
            if (top <= curr.top) {
                const deltaTop = curr.top - prev.top;
                if (deltaTop <= 0) {
                    return curr.line;
                }
                const ratio = (top - prev.top) / deltaTop;
                return prev.line + (curr.line - prev.line) * ratio;
            }
        }
        return this.lineMap[this.lineMap.length - 1].line;
    }
}

export { ScrollSync };

# SoMarkDown Viewer

[![GitHub](https://img.shields.io/github/license/SoMarkAI/SoMarkDownViewer)](https://github.com/SoMarkAI/SoMarkDownViewer/blob/main/LICENSE)

SoMarkDown Viewer is a web application of [SoMarkDown](https://github.com/SoMarkAI/SoMarkDown), designed for previewing and rendering SoMarkDown documents.

![](docs/assets/screenshot.shadow.png)

SoMarkDown is a Markdown superset built upon [markdown-it](https://github.com/markdown-it/markdown-it), providing enhanced support for professional rendering capabilities including mathematical formulas, chemical structures (SMILES), code syntax highlighting, and more. SoMarkDown also serves as the target protocol for parsing results in the [SoMark](https://somark.ai/) document intelligence parsing product.

This Viewer project is not only a SoMarkDown preview tool, but also provides interactive professional rendering features, including:
1. Real-time editing and rendering of SoMarkDown documents.
2. Bi-directional synchronized scrolling with logical alignment.
3. Bi-directional click-to-jump position mapping.

## Installation

This project is implemented entirely with native HTML, JavaScript, and CSS, and can be launched with a straightforward setup.

1. Clone the repository:

```bash
git clone https://github.com/SoMarkAI/SoMarkDownViewer.git
cd SoMarkDownViewer
```

2. Retrieve the latest SoMarkDown JavaScript and CSS files:

```bash
# -k runs silently
./get_latest_smd.sh
```

> If you encounter network issues, you may manually download the latest `somarkdown.umd.min.js` and `somarkdown.css` files from the [SoMarkDown npm package](https://www.jsdelivr.com/package/npm/somarkdown), and place them under `lib/somarkdown`.

3. Start the project using an HTTP server (for example, Python 3 HTTPServer):

```bash
# Python 3.x
python3 -m http.server 8000
```

4. Open `http://localhost:8000` in your browser to use SoMarkDown Viewer.

## Loading Files

The Viewer supports multiple methods to load SoMarkDown files:

1. Specify the relative file path directly in the URL (relative to the server root), for example: `http://localhost:8000?file=example.md`.
2. Click the "Open File" button on the page and select a local file.

## License

MIT

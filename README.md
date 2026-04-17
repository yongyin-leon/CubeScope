# EnviViewer.js

`EnviViewer.js` is a high-performance, web-based viewer for ENVI (Environment for Visualizing Images) format hyperspectral and geospatial images. It leverages WebAssembly and Web Workers to achieve smooth parsing, rendering, and analysis of large ENVI files directly in the browser.

## ✨ Features

- **High-Performance Rendering**: Utilizes Rust and WebAssembly for the core parsing engine, enabling high-performance rendering even for large files.
- **Responsive UI**: Offloads data processing to a Web Worker to ensure a non-blocking main thread and a smooth user experience.
- **Multi-Band Selection**: Allows users to dynamically select R, G, B bands for false-color display of hyperspectral data.
- **Event-Driven API**: Provides a clean, event-driven API for easy integration into any web application.
- **Modular and Extensible**: Designed with a clear and modular structure, making it easy to extend and maintain.

## 📦 Installation

Install from npm:

```bash
npm install envi_parser_better
```

## 🚀 Usage

Here's a basic example of how to use `EnviViewer.js` in your project.

**1. HTML Setup**

First, create a container element in your HTML file where the viewer will be mounted.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EnviViewer.js Example</title>
    <style>
        #viewerContainer { width: 800px; height: 600px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <div id="viewerContainer"></div>
    <script type="module" src="./main.js"></script>
</body>
</html>
```

**2. JavaScript Initialization**

Next, in your `main.js` file, import the library, create a new instance, and listen for events.

```javascript
import EnviViewer from 'envi_parser_better';

const viewerContainer = document.getElementById('viewerContainer');

// Path to the worker and wasm files
const options = {
    workerUrl: '/public/envi/worker.js',
    wasmJsUrl: '/public/envi/pkg/envi_parser.js',
    wasmWasmUrl: '/public/envi/pkg/envi_parser_bg.wasm'
};

const viewer = new EnviViewer(viewerContainer, options);

viewer.on('ready', () => {
    console.log('Viewer is ready!');
    // Now you can load a file
});

viewer.on('error', (error) => {
    console.error('An error occurred:', error);
});

// To load a file, you need the .hdr file and the corresponding data file
// viewer.loadFile(hdrFile, dataFile);
```

## 📚 API

### `new EnviViewer(container, options)`

Creates a new `EnviViewer` instance.

- `container` (HTMLElement): The DOM element to mount the viewer in.
- `options` (Object): Configuration options.
    - `workerUrl` (String): The URL to the `worker.js` file.
    - `wasmJsUrl` (String): The URL to the WASM JS binding file.
    - `wasmWasmUrl` (String): The URL to the WASM binary file.

### `loadFile(hdrFile, dataFile)`

Loads an ENVI file.

- `hdrFile` (File): The `.hdr` header file.
- `dataFile` (File): The corresponding data file.

### `setBands(bands)`

Sets the RGB bands to display.

- `bands` (Object): An object with `r`, `g`, and `b` properties, e.g., `{ r: 30, g: 20, b: 10 }`.

### `destroy()`

Destroys the viewer instance and cleans up resources.

## 📢 Events

You can listen for events on the `EnviViewer` instance using the `.on()` method.

- `ready`: Fired when the viewer is initialized and ready to load files.
- `headerloaded`: Fired when the ENVI header has been parsed. The parsed header data is passed as an argument.
- `loadstart`: Fired when file loading and processing begins.
- `loadend`: Fired when the image has been fully rendered.
- `statechange`: Fired when internal loading state changes. Payload: `{ loading: boolean, message?: string }`.
- `log`: Fired with internal log messages (string).
- `error`: Fired when an error occurs (string).
- `progress`: Fired with background statistics calculation progress `{ type: 'stats_calculation', processed, total, progress }`.
- `image-clicked`: Fired with clicked pixel coordinates `{ x, y }`.
- `performance`: Fired with performance metrics `{ name: 'timeToInitialView' | 'bandSwitchTime', value, unit }`.

## 🛠️ Development

To set up the project for local development:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/envi-viewer.git
    cd envi-viewer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    This will start a Vite dev server and open the example page.
    ```bash
    npm run dev
    ```

## 📦 Build

To build the library for production, run:

```bash
npm run build
```

This will generate the necessary files in the `dist` directory.

## 📄 License

This project is licensed under the MIT License.
/**
 * @fileoverview Worker-side CubeStore construction for protocol request execution.
 */

import { createEnviFormatAdapter } from '../formats/envi-format-adapter.js';
import { createDataSourceFromDescriptor } from '../sources/data-source.js';
import { CubeStore } from '../store/cube-store.js';

export function createWorkerCubeStore({ sourceId, hdrBytes, dataSource: dataSourceDescriptor, header, wasmModule }) {
    const dataSource = createDataSourceFromDescriptor(dataSourceDescriptor);

    return new CubeStore({
        sourceId,
        header,
        headerBytes: hdrBytes,
        dataSource,
        dataSourceDescriptor,
        formatAdapter: createEnviFormatAdapter({
            getWasmModule: async () => wasmModule,
        }),
    });
}

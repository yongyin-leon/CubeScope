const rendererStatusPattern = /^Renderer (initialization completed|recovered after device loss) \(([^,)]+)(, fallback mode)?\)\.$/;

export function createRendererStatus(preference = 'auto') {
    return {
        preference,
        activeKind: null,
        lastStage: null,
        fallbackMode: false,
        fallbackArmed: false,
        degradedFrom: null,
        nextKind: null,
    };
}

export function applyRendererLogMessage(rendererStatus, message) {
    if (!rendererStatus || !message) {
        return rendererStatus ?? null;
    }

    const normalizedMessage = String(message);
    const statusMatch = normalizedMessage.match(rendererStatusPattern);

    if (statusMatch) {
        const [, stage, activeKind, fallbackMode] = statusMatch;
        rendererStatus.activeKind = activeKind;
        rendererStatus.lastStage = stage === 'recovered after device loss'
            ? 'recovered'
            : 'initialized';
        rendererStatus.fallbackMode = Boolean(fallbackMode);
        return rendererStatus;
    }

    if (normalizedMessage === 'Auto renderer will prefer WebGL after WebGPU device loss.') {
        rendererStatus.fallbackArmed = true;
        rendererStatus.degradedFrom = 'webgpu';
        rendererStatus.nextKind = 'webgl';
    }

    return rendererStatus;
}

export function getActionableErrors(errors = []) {
    return errors.filter(
        (message) => !String(message).includes('Renderer recovery failed: Failed to acquire WebGPU adapter')
    );
}

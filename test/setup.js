// jsdom logs a not-implemented error before returning null. Keep its return
// semantics without flooding test and CI output.
if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  })
}

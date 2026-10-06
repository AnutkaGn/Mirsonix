import '@testing-library/jest-dom/vitest';
import '@/i18n';

/* jsdom lacks a few browser APIs that Radix's popovers and sliders rely on. Stubbing them is enough for behavior tests. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};

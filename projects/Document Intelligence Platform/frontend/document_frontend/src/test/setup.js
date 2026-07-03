// src/test/setup.js
import '@testing-library/jest-dom';
import React from 'react';
globalThis.React = React;

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();
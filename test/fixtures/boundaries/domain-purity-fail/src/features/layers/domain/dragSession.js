import React from 'react';
import { setup } from 'xstate';

export function computePosition() {
  setup({});
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  return React.createElement('div');
}

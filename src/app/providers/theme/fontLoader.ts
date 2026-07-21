const FONT_LOADERS: Record<string, () => Promise<unknown>> = {
  Roboto: () => import('@fontsource/roboto/400.css'),
  'Open Sans': () => import('@fontsource/open-sans/400.css'),
  Lato: () => import('@fontsource/lato/400.css'),
  Montserrat: () => import('@fontsource/montserrat/400.css'),
  'Source Sans 3': () => import('@fontsource/source-sans-3/400.css'),
  Poppins: () => import('@fontsource/poppins/400.css'),
};

export function loadFont(fontId: string): Promise<unknown> {
  return FONT_LOADERS[fontId]?.() ?? Promise.resolve();
}

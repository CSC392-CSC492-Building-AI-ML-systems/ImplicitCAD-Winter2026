import type { languages } from 'monaco-editor'

export const openscadLanguageDef: languages.IMonarchLanguage = {
  keywords: ['module', 'function', 'if', 'else', 'for', 'let', 'each', 'true', 'false', 'undef'],
  builtins: [
    'cube', 'sphere', 'cylinder', 'polyhedron', 'circle', 'square', 'polygon',
    'union', 'difference', 'intersection', 'hull', 'minkowski',
    'translate', 'rotate', 'scale', 'mirror', 'multmatrix',
    'linear_extrude', 'rotate_extrude', 'surface', 'projection',
    'color', 'offset', 'resize',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
    'abs', 'ceil', 'floor', 'round', 'min', 'max', 'pow', 'sqrt', 'exp', 'log', 'ln',
    'len', 'str', 'chr', 'ord', 'concat', 'lookup', 'search',
    'echo', 'render', 'children',
    'torus', 'ellipsoid', 'cone',
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/[a-zA-Z_]\w*/, {
        cases: { '@keywords': 'keyword', '@builtins': 'type.identifier', '@default': 'identifier' },
      }],
      [/\$\w+/, 'variable'],
      [/\d+\.?\d*/, 'number'],
      [/"[^"]*"/, 'string'],
      [/[{}()[\]]/, '@brackets'],
      [/[=<>!]+/, 'operator'],
      [/[;,.]/, 'delimiter'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
}

export const studioLightTheme = {
  base: 'vs' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '94A3B8', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'DC2626' },
    { token: 'type.identifier', foreground: '2563EB' },
    { token: 'identifier', foreground: '1E293B' },
    { token: 'number', foreground: '16A34A' },
    { token: 'string', foreground: '0369A1' },
    { token: 'operator', foreground: 'DC2626' },
    { token: 'variable', foreground: 'B45309' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#1E293B',
    'editorLineNumber.foreground': '#CBD5E1',
    'editorLineNumber.activeForeground': '#64748B',
    'editor.selectionBackground': '#BFDBFE',
    'editor.lineHighlightBackground': '#F8FAFC',
    'editorCursor.foreground': '#2563EB',
    'editorWhitespace.foreground': '#E2E8F0',
    'editor.selectionHighlightBackground': '#BFDBFE44',
    'editorIndentGuide.background': '#F1F5F9',
    'editorIndentGuide.activeBackground': '#E2E8F0',
  },
}

export const studioDarkTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'F87171' },
    { token: 'type.identifier', foreground: '60A5FA' },
    { token: 'identifier', foreground: 'E2E8F0' },
    { token: 'number', foreground: '4ADE80' },
    { token: 'string', foreground: '38BDF8' },
    { token: 'operator', foreground: 'F87171' },
    { token: 'variable', foreground: 'FBBF24' },
  ],
  colors: {
    'editor.background': '#0B0F19',
    'editor.foreground': '#E2E8F0',
    'editorLineNumber.foreground': '#475569',
    'editorLineNumber.activeForeground': '#94A3B8',
    'editor.selectionBackground': '#1E3A5F',
    'editor.lineHighlightBackground': '#111827',
    'editorCursor.foreground': '#3B82F6',
    'editorWhitespace.foreground': '#334155',
    'editor.selectionHighlightBackground': '#1E3A5F44',
    'editorIndentGuide.background': '#1E293B',
    'editorIndentGuide.activeBackground': '#334155',
  },
}

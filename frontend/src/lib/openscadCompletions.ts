import type { Monaco } from '@monaco-editor/react'
import type { editor, Position } from 'monaco-editor'
import { REFERENCE_MAP, ALL_BUILTINS, KEYWORDS, SPECIAL_VARS } from './openscadReference'

const SNIPPET_MAP: Record<string, string> = {
  cube: 'cube([${1:10}, ${2:20}, ${3:30}], center=${4:true});',
  sphere: 'sphere(r=${1:15});',
  cylinder: 'cylinder(h=${1:20}, r=${2:5}, center=${3:true});',
  torus: 'torus(r1=${1:20}, r2=${2:5});',
  ellipsoid: 'ellipsoid(a=${1:10}, b=${2:15}, c=${3:20});',
  union: 'union() {\n\t$0\n}',
  difference: 'difference() {\n\t$0\n}',
  intersection: 'intersection() {\n\t$0\n}',
  translate: 'translate([${1:0}, ${2:0}, ${3:0}])\n\t$0;',
  rotate: 'rotate([${1:0}, ${2:0}, ${3:0}])\n\t$0;',
  scale: 'scale([${1:1}, ${2:1}, ${3:1}])\n\t$0;',
}

let completionRegistered = false
let signatureRegistered = false

export function registerCompletionProvider(monaco: Monaco) {
  if (completionRegistered) return
  completionRegistered = true

  monaco.languages.registerCompletionItemProvider('openscad', {
    provideCompletionItems(model: editor.ITextModel, position: Position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: {
        label: string
        kind: number
        detail?: string
        documentation?: never
        insertText: string
        insertTextRules?: number
        range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number }
      }[] = []

      // Rich completions for documented items
      for (const [name, item] of REFERENCE_MAP) {
        const snippet = SNIPPET_MAP[name]
        const doc = new monaco.editor.MarkdownString()
        doc.appendText(item.desc)
        doc.appendCodeblock(item.template.trim(), 'openscad')

        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: item.syntax,
          documentation: doc as never,
          insertText: snippet || `${name}($0)`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })
      }

      // Basic completions for remaining builtins
      for (const name of ALL_BUILTINS) {
        if (REFERENCE_MAP.has(name)) continue
        suggestions.push({
          label: name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${name}($0)`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        })
      }

      // Keywords
      for (const kw of KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        })
      }

      // Special variables
      for (const sv of SPECIAL_VARS) {
        suggestions.push({
          label: sv,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: sv,
          range,
        })
      }

      return { suggestions }
    },
  })
}

const PARAM_MAP: Record<string, string[]> = {
  cube: ['size', 'center', 'r'],
  sphere: ['r'],
  cylinder: ['h', 'r', 'center'],
  torus: ['r1', 'r2'],
  ellipsoid: ['a', 'b', 'c'],
  translate: ['v'],
  rotate: ['a'],
  scale: ['v'],
  union: ['r'],
  difference: ['r'],
  intersection: ['r'],
}

export function registerSignatureHelpProvider(monaco: Monaco) {
  if (signatureRegistered) return
  signatureRegistered = true

  monaco.languages.registerSignatureHelpProvider('openscad', {
    signatureHelpTriggerCharacters: ['(', ','],

    provideSignatureHelp(model: editor.ITextModel, position: Position) {
      const textUntilPos = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      // Walk backward to find the function name before the opening paren
      let depth = 0
      let parenPos = -1
      for (let i = textUntilPos.length - 1; i >= 0; i--) {
        const ch = textUntilPos[i]
        if (ch === ')') depth++
        else if (ch === '(') {
          if (depth === 0) { parenPos = i; break }
          depth--
        }
      }

      if (parenPos < 0) return undefined

      // Extract function name
      const before = textUntilPos.slice(0, parenPos)
      const nameMatch = before.match(/([a-zA-Z_]\w*)$/)
      if (!nameMatch) return undefined

      const funcName = nameMatch[1]
      const item = REFERENCE_MAP.get(funcName)
      if (!item) return undefined

      // Count commas for activeParameter
      const argsText = textUntilPos.slice(parenPos + 1)
      let commas = 0
      let d = 0
      for (const ch of argsText) {
        if (ch === '(' || ch === '[') d++
        else if (ch === ')' || ch === ']') d--
        else if (ch === ',' && d === 0) commas++
      }

      return {
        value: {
          signatures: [
            {
              label: item.syntax,
              documentation: item.desc,
              parameters: (PARAM_MAP[funcName] || []).map(p => ({ label: p })),
            },
          ],
          activeSignature: 0,
          activeParameter: commas,
        },
        dispose() {},
      }
    },
  })
}

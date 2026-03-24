import { useRef, useCallback, useEffect } from 'react'
import Editor, { DiffEditor, type OnMount, type BeforeMount, type Monaco } from '@monaco-editor/react'
import { Check, ChevronRight, FileCode2, PanelLeftOpen, X as XIcon } from 'lucide-react'
import { openscadLanguageDef, studioLightTheme, studioDarkTheme } from '../lib/openscadLanguage'
import { registerCompletionProvider, registerSignatureHelpProvider } from '../lib/openscadCompletions'
import { useEditorStore } from '../stores/editorStore'
import { useFileTreeStore } from '../stores/fileTreeStore'

interface CodeEditorProps {
  onRender: () => void
  onCodeChange?: (code: string) => void
}

export function CodeEditor({ onRender, onCodeChange }: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const code = useEditorStore((s) => s.code)
  const setCode = useEditorStore((s) => s.setCode)
  const autoRender = useEditorStore((s) => s.autoRender)
  const isDark = useEditorStore((s) => s.isDark)
  const errors = useEditorStore((s) => s.errors)
  const pendingDiff = useEditorStore((s) => s.pendingDiff)
  const acceptDiff = useEditorStore((s) => s.acceptDiff)
  const rejectDiff = useEditorStore((s) => s.rejectDiff)
  const rootName = useFileTreeStore((s) => s.rootName)
  const openFiles = useFileTreeStore((s) => s.openFiles)
  const activeFile = useFileTreeStore((s) => s.activeFile)
  const isDirty = useFileTreeStore((s) => s.isDirty)
  const setActiveFile = useFileTreeStore((s) => s.setActiveFile)
  const requestCloseFile = useFileTreeStore((s) => s.requestCloseFile)
  const revealInExplorer = useFileTreeStore((s) => s.revealInExplorer)
  const fileName = activeFile?.split('/').pop() ?? 'Scratch buffer'
  const filePath = activeFile
    ? [rootName, activeFile].filter(Boolean).join('/')
    : 'Open a folder to edit project files beside the explorer.'
  const saveHint = activeFile ? 'Cmd/Ctrl+S to save' : 'Open Folder to start working from disk'
  const breadcrumbParts = activeFile ? activeFile.split('/') : []

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco
    monaco.languages.register({ id: 'openscad' })
    monaco.languages.setMonarchTokensProvider('openscad', openscadLanguageDef)
    monaco.editor.defineTheme('studio-light', studioLightTheme)
    monaco.editor.defineTheme('studio-dark', studioDarkTheme)
    registerCompletionProvider(monaco)
    registerSignatureHelpProvider(monaco)
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRender()
    })
    editor.onDidChangeCursorPosition((e) => {
      useEditorStore.getState().setCursorPosition(e.position.lineNumber, e.position.column)
    })
  }

  // Sync error markers to Monaco
  useEffect(() => {
    const m = monacoRef.current
    const editor = editorRef.current
    if (!m || !editor) return
    const model = editor.getModel()
    if (!model) return
    m.editor.setModelMarkers(
      model,
      'openscad',
      errors
        .filter((err) => err.line >= 1 && err.line <= model.getLineCount())
        .map((err) => ({
          severity: err.severity === 'warning' ? m.MarkerSeverity.Warning : m.MarkerSeverity.Error,
          message: err.message,
          startLineNumber: err.line,
          startColumn: 1,
          endLineNumber: err.line,
          endColumn: model.getLineMaxColumn(err.line),
        }))
    )
  }, [errors])

  const handleChange = useCallback(
    (value: string | undefined) => {
      const v = value ?? ''
      setCode(v)
      if (autoRender) onCodeChange?.(v)
    },
    [setCode, autoRender, onCodeChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.scad') || file.name.endsWith('.escad'))) {
        const reader = new FileReader()
        reader.onload = () => {
          const content = reader.result as string
          setCode(content)
          onCodeChange?.(content)
        }
        reader.readAsText(file)
      }
    },
    [setCode, onCodeChange],
  )

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {openFiles.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border-default bg-bg-base px-2 py-1.5 shrink-0">
          {openFiles.map((tab) => {
            const tabDirty = tab.savedContent !== tab.draftContent
            const tabActive = tab.path === activeFile

            return (
              <div
                key={tab.path}
                className={`group flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  tabActive
                    ? 'border-accent/40 bg-accent-dim text-text-primary'
                    : 'border-transparent bg-bg-surface text-text-secondary hover:border-border-default hover:text-text-primary'
                }`}
              >
                <button
                  onClick={() => setActiveFile(tab.path)}
                  className="flex min-w-0 items-center gap-2"
                  title={tab.path}
                >
                  <FileCode2 size={13} className={tabActive ? 'text-accent' : 'text-text-muted'} />
                  <span className="max-w-[18ch] truncate">{tab.name}</span>
                </button>
                {tabDirty && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" title="Unsaved changes" />}
                <button
                  aria-label={`Close ${tab.name}`}
                  className="rounded p-0.5 text-text-faint opacity-70 transition hover:bg-bg-hover hover:text-text-primary group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    requestCloseFile(tab.path)
                  }}
                >
                  <XIcon size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-bg-surface/80 px-4 py-2.5 shrink-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-raised text-accent">
            <FileCode2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-text-primary">
                {fileName}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  isDirty
                    ? 'bg-warning/15 text-warning'
                    : activeFile
                      ? 'bg-success/15 text-success'
                      : 'bg-bg-raised text-text-muted'
                }`}
              >
                {isDirty ? 'Unsaved' : activeFile ? 'Saved' : 'Local'}
              </span>
            </div>
            <div className="truncate text-[11px] text-text-muted" title={filePath}>
              {filePath}
            </div>
          </div>
        </div>

        <div className="hidden shrink-0 text-[11px] text-text-muted md:block">
          {saveHint}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-bg-base px-4 py-2 text-[11px] text-text-muted shrink-0">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="rounded bg-bg-raised px-2 py-0.5 font-medium text-text-secondary">
            {rootName ?? 'Workspace'}
          </span>
          {breadcrumbParts.length > 0 ? (
            breadcrumbParts.map((part, index) => {
              const isLast = index === breadcrumbParts.length - 1
              const segmentPath = breadcrumbParts.slice(0, index + 1).join('/')

              return (
                <div key={segmentPath} className="flex items-center gap-1 shrink-0">
                  <ChevronRight size={12} className="text-text-faint" />
                  {isLast ? (
                    <span className="font-medium text-text-primary">{part}</span>
                  ) : (
                    <button
                      onClick={() => revealInExplorer(segmentPath)}
                      className="rounded px-1.5 py-0.5 hover:bg-bg-hover hover:text-text-primary transition-colors"
                    >
                      {part}
                    </button>
                  )}
                </div>
              )
            })
          ) : (
            <span>Scratch buffer</span>
          )}
        </div>

        {activeFile && (
          <button
            onClick={() => revealInExplorer()}
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:text-text-primary md:flex"
          >
            <PanelLeftOpen size={12} />
            Reveal in Explorer
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 relative">
        {pendingDiff && (
          <div className="absolute top-2 right-3 z-[var(--z-panel-overlay)] flex items-center gap-2 px-3 py-1.5 bg-bg-raised border border-border-default rounded-lg shadow-md animate-drop-in">
            <span className="text-xs text-text-secondary font-medium">AI suggested changes</span>
            <button
              onClick={acceptDiff}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-success text-white rounded-md hover:brightness-110 transition-all"
            >
              <Check size={12} />
              Accept
            </button>
            <button
              onClick={rejectDiff}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-bg-base text-text-secondary border border-border-default rounded-md hover:text-text-primary hover:border-border-strong transition-all"
            >
              <XIcon size={12} />
              Reject
            </button>
          </div>
        )}

        {pendingDiff ? (
          <DiffEditor
            height="100%"
            language="openscad"
            theme={isDark ? 'studio-dark' : 'studio-light'}
            original={pendingDiff.original}
            modified={pendingDiff.proposed}
            beforeMount={handleBeforeMount}
            options={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              lineHeight: 22,
              padding: { top: 40 },
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: true,
              renderSideBySide: false,
              smoothScrolling: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language="openscad"
            theme={isDark ? 'studio-dark' : 'studio-light'}
            value={code}
            onChange={handleChange}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            options={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              lineHeight: 22,
              padding: { top: 12 },
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: { indentation: true, bracketPairs: true },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
          />
        )}
      </div>
    </div>
  )
}

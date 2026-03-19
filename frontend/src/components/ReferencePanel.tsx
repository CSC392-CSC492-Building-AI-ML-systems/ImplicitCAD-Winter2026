import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useEditorStore } from '../stores/editorStore'
import { REFERENCE_DATA } from '../lib/openscadReference'

export function ReferencePanel() {
  const [search, setSearch] = useState('')
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ '3d': true, 'csg': true, 'transforms': true })
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const code = useEditorStore((s) => s.code)
  const setCode = useEditorStore((s) => s.setCode)
  const log = useEditorStore((s) => s.log)

  const toggleCat = (id: string) => setExpandedCats((s) => ({ ...s, [id]: !s[id] }))
  const toggleItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedItems((s) => ({ ...s, [id]: !s[id] }))
  }

  const insertTemplate = (template: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Simple append for now, could be smarter if we had editor instance
    setCode(code + (code.endsWith('\n') || code === '' ? '' : '\n\n') + template)
    log('Inserted snippet', 'success')
  }

  const filteredData = useMemo(() => {
    if (!search.trim()) return REFERENCE_DATA
    const term = search.toLowerCase()
    return REFERENCE_DATA.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => 
        item.name.toLowerCase().includes(term) || 
        item.desc.toLowerCase().includes(term)
      ),
    })).filter((cat) => cat.items.length > 0)
  }, [search])

  return (
    <div className="flex flex-col h-full bg-bg-base relative">
      <div className="p-2 border-b border-border-default bg-bg-surface shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search functions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bg-base border border-border-default rounded-md text-[13px] outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredData.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted">No matches found.</div>
        ) : (
          filteredData.map((cat) => (
            <div key={cat.id} className="border-b border-border-default last:border-b-0">
              <button
                onClick={() => toggleCat(cat.id)}
                className="flex items-center gap-2 w-full px-3 py-2 bg-bg-raised text-[11px] font-semibold text-text-secondary hover:text-text-primary uppercase tracking-wider text-left transition-colors"
              >
                {expandedCats[cat.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {cat.title}
              </button>

              {expandedCats[cat.id] && (
                <div className="flex flex-col">
                  {cat.items.map((item) => {
                    const isExp = expandedItems[item.id] || (search.trim() !== '')
                    return (
                      <div key={item.id} className="flex flex-col border-b border-border-default last:border-b-0">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => toggleItem(item.id, e)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(item.id, e as unknown as React.MouseEvent) } }}
                          className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-bg-hover group transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base outline-none"
                        >
                          <div className="flex items-center gap-2">
                            {isExp ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
                            <span className="font-mono text-sm font-medium text-text-primary">{item.name}</span>
                            {item.implicitcadOnly && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-success/15 text-success rounded uppercase tracking-wider">Ext</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => insertTemplate(item.template, e)}
                            aria-label={`Insert ${item.name} template`}
                            className="hidden group-hover:flex items-center gap-1 text-[11px] font-medium text-success hover:text-white hover:bg-success px-2 py-1 rounded border border-success/30 transition-all"
                          >
                            <Plus size={12} /> Insert
                          </button>
                        </div>
                        
                        {isExp && (
                          <div className="px-3 pb-3 pl-8 bg-bg-surface/50">
                            <div className="font-mono text-xs text-accent bg-accent/5 p-1.5 rounded border border-accent/10 inline-block mb-2">
                              {item.syntax}
                            </div>
                            <div className="text-[13px] text-text-secondary leading-relaxed mb-3">
                              {item.desc}
                            </div>
                            <div className="text-[11px] font-semibold uppercase text-text-muted mb-1">Example:</div>
                            <pre className="text-[11px] font-mono text-text-secondary bg-bg-base border border-border-default p-2 rounded-md overflow-x-auto whitespace-pre">
                              {item.template.trim()}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

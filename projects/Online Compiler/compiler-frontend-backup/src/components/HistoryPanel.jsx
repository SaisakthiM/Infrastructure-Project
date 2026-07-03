import { useState } from 'react'

export const HistoryPanel = ({ history, onSelectItem, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = history.filter(item => 
    item.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-compiler-cardBg rounded-lg p-6 w-2xl max-h-96 overflow-y-auto border border-compiler-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-compiler-text">Execution History</h3>
          <button
            onClick={onClose}
            className="text-compiler-textSecondary hover:text-compiler-text"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field w-full mb-4"
        />

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-compiler-textSecondary py-8">No history found</p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onSelectItem(item)
                  onClose()
                }}
                className="w-full p-3 bg-compiler-inputBg rounded-lg hover:bg-compiler-border transition text-left border border-compiler-border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-compiler-accent">{item.language}</span>
                    <p className="text-xs text-compiler-textSecondary mt-1 max-w-xs truncate">
                      {item.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      item.exitCode === 0 
                        ? 'bg-green-900/30 text-green-400' 
                        : 'bg-red-900/30 text-red-400'
                    }`}>
                      {item.exitCode === 0 ? 'Success' : 'Error'}
                    </span>
                    <p className="text-xs text-compiler-textSecondary mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

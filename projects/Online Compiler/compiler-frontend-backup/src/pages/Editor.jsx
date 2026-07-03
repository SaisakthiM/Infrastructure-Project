import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { compilerAPI } from '../services/api'
import { CodeEditor, OutputPanel, LanguageSelector, HistoryPanel } from '../components'

export const Editor = () => {
  const navigate = useNavigate()
  const { user, token, logout } = useAuth()

  const [language, setLanguage] = useState('cpp')
  const [code, setCode] = useState('// Start coding here\n')
  const [output, setOutput] = useState('')
  const [exitCode, setExitCode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [apiUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:8080')

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const response = await compilerAPI.getHistory()
      const historyData = response.data.records || []
      setHistory(historyData)
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const handleExecute = async () => {
    if (!code.trim()) {
      setError('Please write some code first')
      return
    }

    setLoading(true)
    setError('')
    setOutput('')
    setExitCode(null)

    try {
      const { data } = await compilerAPI.executeCode(language, code)
      
      setOutput(data.output || '')
      setExitCode(data.exitCode)
      
      if (data.exitCode !== 0) {
        setError(data.output || 'Execution failed')
      }

      // Reload history
      await loadHistory()
    } catch (err) {
      setError(err.response?.data?.message || 'Execution failed')
      setExitCode(1)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHistory = (item) => {
    setLanguage(item.language)
    setCode(item.code)
    setOutput(item.output)
    setExitCode(item.exitCode)
  }

  const handleClearCode = () => {
    if (window.confirm('Clear the code editor?')) {
      setCode('')
      setOutput('')
      setExitCode(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="h-screen flex flex-col bg-compiler-dark">
      {/* Header */}
      <div className="bg-compiler-cardBg border-b border-compiler-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{'<>'}</div>
            <h1 className="text-xl font-bold text-compiler-accent">Code Compiler</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-compiler-textSecondary">Welcome, <span className="font-semibold text-compiler-text">{user?.username}</span></span>
            <button
              onClick={handleLogout}
              className="bg-compiler-error text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">
          {/* Controls */}
          <div className="flex items-center justify-between bg-compiler-cardBg p-4 rounded-lg border border-compiler-border">
            <LanguageSelector language={language} onChange={setLanguage} />
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={loading}
                className="btn-success"
              >
                {loading ? 'Running...' : 'Run Code'} ▶
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="btn-secondary"
              >
                📋 History
              </button>
              <button
                onClick={handleClearCode}
                className="btn-danger"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && !output && (
            <div className="bg-red-900/30 border border-red-500 text-red-400 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Editor and Output */}
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
            {/* Code Editor */}
            <div className="card overflow-hidden flex flex-col">
              <div className="bg-compiler-inputBg p-4 border-b border-compiler-border">
                <h3 className="font-semibold text-compiler-text">{language.toUpperCase()}</h3>
              </div>
              <CodeEditor 
                code={code} 
                onChange={setCode}
                disabled={loading}
              />
            </div>

            {/* Output */}
            <OutputPanel 
              output={output}
              exitCode={exitCode}
              loading={loading}
              error={error && output ? error : null}
            />
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onSelectItem={handleSelectHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}

export const OutputPanel = ({ output, exitCode, loading, error }) => {
  const statusClass = exitCode === 0 ? 'status-success' : 'status-error'
  const statusText = exitCode === 0 ? 'Success ✓' : 'Error ✗'

  return (
    <div className="flex flex-col h-full bg-compiler-cardBg rounded-lg border border-compiler-border overflow-hidden">
      {/* Header */}
      <div className="bg-compiler-inputBg p-4 border-b border-compiler-border flex items-center justify-between">
        <h3 className="font-semibold text-compiler-text">Output</h3>
        {(output || error) && (
          <span className={`text-xs px-3 py-1 rounded-full ${statusClass}`}>
            {statusText}
          </span>
        )}
      </div>

      {/* Output Area */}
      <div className="flex-1 overflow-y-auto p-4 code-block">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-compiler-textSecondary">
              Executing code...
            </div>
          </div>
        ) : error ? (
          <pre className="text-compiler-error text-sm whitespace-pre-wrap break-words">
            {error}
          </pre>
        ) : output ? (
          <pre className="text-compiler-text text-sm whitespace-pre-wrap break-words">
            {output}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-compiler-textSecondary text-center">
              <p>No output yet</p>
              <p className="text-xs mt-1">Execute code to see results</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

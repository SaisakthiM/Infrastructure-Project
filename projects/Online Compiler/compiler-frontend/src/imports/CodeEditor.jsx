export const CodeEditor = ({ code, onChange, disabled = false }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="// Write your code here..."
          className="w-full h-full bg-compiler-code text-white p-4 resize-none focus:outline-none font-mono text-sm disabled:opacity-50 border border-compiler-border"
          spellCheck="false"
        />
      </div>
    </div>
  )
}

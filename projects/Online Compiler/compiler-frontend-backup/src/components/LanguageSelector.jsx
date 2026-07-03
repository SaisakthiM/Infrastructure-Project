export const LanguageSelector = ({ language, onChange }) => {
  const languages = [
    { id: 'cpp', name: 'C++' },
    { id: 'c', name: 'C' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'javascript', name: 'JavaScript' },
    { id: 'golang', name: 'Go' },
  ]

  return (
    <div className="flex items-center gap-2">
      <label className="font-semibold text-compiler-text">Language:</label>
      <select
        value={language}
        onChange={(e) => onChange(e.target.value)}
        className="input-field bg-compiler-inputBg border border-compiler-border rounded-lg px-3 py-2"
      >
        {languages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}

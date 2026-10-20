// Package vars reads Terraform variable declarations (variable.tf) and
// terraform.tfvars files without any HCL dependency, so the CLI can discover
// on its own which variables an environment needs and which ones still have no
// value. It understands exactly the subset of HCL these files use: quoted
// strings (with ${} interpolation), heredocs, comments, and nested blocks.
package vars

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Var is one `variable "name" { ... }` declaration.
type Var struct {
	Name        string
	Description string
	Type        string // raw type expression, "" when not declared
	HasDefault  bool
	Default     string // raw default expression
	Sensitive   bool
	File        string // file the declaration came from (set by ParseDir)
}

// Required reports whether Terraform will refuse to run without a value.
func (v Var) Required() bool { return !v.HasDefault }

// IsString reports whether values of this variable are plain strings.
func (v Var) IsString() bool {
	t := strings.TrimSpace(v.Type)
	return t == "" || t == "string"
}

// ParseDir parses every *.tf file directly inside dir.
func ParseDir(dir string) ([]Var, error) {
	files, err := filepath.Glob(filepath.Join(dir, "*.tf"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	var all []Var
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			return nil, err
		}
		for _, v := range Parse(string(b)) {
			v.File = filepath.Base(f)
			all = append(all, v)
		}
	}
	return all, nil
}

// Parse extracts the variable declarations from Terraform source.
func Parse(src string) []Var {
	var out []Var
	i := 0
	for {
		i = skipSpace(src, i)
		if i >= len(src) {
			return out
		}
		start := i
		ident := readIdent(src, i)
		if ident == "" {
			i = skipLine(src, i)
			continue
		}
		i += len(ident)

		// block header: labels until '{'
		var labels []string
	header:
		for {
			i = skipInlineSpace(src, i)
			if i >= len(src) {
				return out
			}
			switch {
			case src[i] == '"':
				end := skipString(src, i)
				labels = append(labels, unquote(src[i:end]))
				i = end
			case src[i] == '{':
				bodyStart := i + 1
				end := skipBlock(src, i)
				if ident == "variable" && len(labels) == 1 {
					bodyEnd := end - 1
					if bodyEnd < bodyStart {
						bodyEnd = bodyStart
					}
					v := parseVariableBody(src[bodyStart:bodyEnd])
					v.Name = labels[0]
					out = append(out, v)
				}
				i = end
				break header
			case isIdentStart(src[i]):
				id := readIdent(src, i)
				i += len(id)
			case src[i] == '=':
				// a top-level attribute (not a block): skip its value
				i = scanValue(src, i+1)
				break header
			default:
				i = skipLine(src, start)
				break header
			}
		}
	}
}

func parseVariableBody(body string) Var {
	var v Var
	for _, a := range parseAttrs(body) {
		switch a.key {
		case "description":
			v.Description = unquote(a.raw)
		case "type":
			v.Type = a.raw
		case "default":
			v.HasDefault = true
			v.Default = a.raw
		case "sensitive":
			v.Sensitive = a.raw == "true"
		}
	}
	return v
}

type attr struct {
	key, raw   string
	start, end int // byte span of the whole `key = value` assignment
}

// parseAttrs returns the top-level `key = value` pairs of a block body (or a
// whole tfvars file). Nested blocks are skipped.
func parseAttrs(body string) []attr {
	var out []attr
	i := 0
	for {
		i = skipSpace(body, i)
		for i < len(body) && body[i] == ',' {
			i = skipSpace(body, i+1)
		}
		if i >= len(body) {
			return out
		}
		keyStart := i
		key := readIdent(body, i)
		if key == "" {
			if body[i] == '"' { // quoted key
				end := skipString(body, i)
				key = unquote(body[i:end])
				i = end
			} else {
				i = skipLine(body, i)
				continue
			}
		} else {
			i += len(key)
		}
		i = skipInlineSpace(body, i)
		if i >= len(body) {
			return out
		}
		switch body[i] {
		case '=':
			end := scanValue(body, i+1)
			out = append(out, attr{key: key, raw: strings.TrimSpace(body[i+1 : end]), start: keyStart, end: end})
			i = end
		case '{':
			i = skipBlock(body, i)
		default:
			// a block with labels (e.g. validation {}) or something unknown
			for i < len(body) && body[i] != '{' && body[i] != '\n' {
				if body[i] == '"' {
					i = skipString(body, i)
				} else {
					i++
				}
			}
			if i < len(body) && body[i] == '{' {
				i = skipBlock(body, i)
			}
		}
	}
}

// RemoveKeys returns src without the top-level assignments of the given names
// (used to replace a blank generated value with a real one without creating a
// duplicate assignment, which Terraform rejects).
func RemoveKeys(src string, keys ...string) string {
	drop := map[string]bool{}
	for _, k := range keys {
		drop[k] = true
	}
	attrs := parseAttrs(src)
	for i := len(attrs) - 1; i >= 0; i-- {
		a := attrs[i]
		if !drop[a.key] {
			continue
		}
		end := a.end
		if end < len(src) && src[end] == '\n' {
			end++
		}
		src = src[:a.start] + src[end:]
	}
	return src
}

// ParseTfvars returns the top-level assignments of a terraform.tfvars file as
// name -> raw value expression.
func ParseTfvars(src string) map[string]string {
	m := map[string]string{}
	for _, a := range parseAttrs(src) {
		m[a.key] = a.raw
	}
	return m
}

// ReadTfvars reads a tfvars file; a missing file is an empty result.
func ReadTfvars(path string) (map[string]string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, err
	}
	return ParseTfvars(string(b)), nil
}

// IsEmptyValue treats "", null and blank heredocs as "no value was provided".
func IsEmptyValue(raw string) bool {
	r := strings.TrimSpace(raw)
	if r == "" || r == "null" || r == `""` {
		return true
	}
	if strings.HasPrefix(r, "<<") {
		lines := strings.Split(r, "\n")
		if len(lines) <= 2 {
			return true
		}
		return strings.TrimSpace(strings.Join(lines[1:len(lines)-1], "\n")) == ""
	}
	return false
}

// Missing lists the variables of envDir that Terraform would still prompt
// for: declared without a default and absent (or blank) in terraform.tfvars.
func Missing(envDir string) ([]Var, error) {
	declared, err := ParseDir(envDir)
	if err != nil {
		return nil, err
	}
	set, err := ReadTfvars(filepath.Join(envDir, "terraform.tfvars"))
	if err != nil {
		return nil, err
	}
	var out []Var
	for _, v := range declared {
		if !v.Required() {
			continue
		}
		if raw, ok := set[v.Name]; ok && !IsEmptyValue(raw) {
			continue
		}
		out = append(out, v)
	}
	return out, nil
}

// FormatAssignment renders `name = value` for a tfvars file, quoting strings,
// leaving bool/number/collection values as HCL, and using a heredoc for
// multi-line strings (SSH keys).
func FormatAssignment(v Var, value string) (string, error) {
	t := strings.TrimSpace(v.Type)
	switch {
	case t == "bool":
		b := strings.ToLower(strings.TrimSpace(value))
		if b != "true" && b != "false" {
			return "", fmt.Errorf("%s must be true or false", v.Name)
		}
		return fmt.Sprintf("%s = %s\n", v.Name, b), nil
	case t == "number":
		if _, err := strconv.ParseFloat(strings.TrimSpace(value), 64); err != nil {
			return "", fmt.Errorf("%s must be a number", v.Name)
		}
		return fmt.Sprintf("%s = %s\n", v.Name, strings.TrimSpace(value)), nil
	case t != "" && t != "string":
		// list(...), map(...), object(...): the caller supplies HCL
		return fmt.Sprintf("%s = %s\n", v.Name, strings.TrimSpace(value)), nil
	}
	if strings.Contains(value, "\n") {
		delim := "EOT"
		for strings.Contains(value, delim) {
			delim += "X"
		}
		if !strings.HasSuffix(value, "\n") {
			value += "\n"
		}
		return fmt.Sprintf("%s = <<%s\n%s%s\n", v.Name, delim, value, delim), nil
	}
	return fmt.Sprintf("%s = %s\n", v.Name, Quote(value)), nil
}

// Quote renders s as an HCL string literal (no interpolation: ${ and %{ are escaped).
func Quote(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c == '\\':
			b.WriteString(`\\`)
		case c == '"':
			b.WriteString(`\"`)
		case c == '\n':
			b.WriteString(`\n`)
		case c == '\r':
			b.WriteString(`\r`)
		case c == '\t':
			b.WriteString(`\t`)
		case (c == '$' || c == '%') && i+1 < len(s) && s[i+1] == '{':
			b.WriteByte(c)
			b.WriteByte(c)
		default:
			b.WriteByte(c)
		}
	}
	b.WriteByte('"')
	return b.String()
}

// AppendAssignments appends rendered assignments to a tfvars file, creating it if needed.
func AppendAssignments(path string, lines []string) error {
	if len(lines) == 0 {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	if st, err := f.Stat(); err == nil && st.Size() > 0 {
		if _, err := f.WriteString("\n"); err != nil {
			return err
		}
	}
	for _, l := range lines {
		if _, err := f.WriteString(l); err != nil {
			return err
		}
	}
	return nil
}

// ─── tiny HCL scanner ───────────────────────────────────────────────────────

func isIdentStart(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isIdentChar(c byte) bool {
	return isIdentStart(c) || (c >= '0' && c <= '9') || c == '-'
}

func readIdent(s string, i int) string {
	if i >= len(s) || !isIdentStart(s[i]) {
		return ""
	}
	j := i
	for j < len(s) && isIdentChar(s[j]) {
		j++
	}
	return s[i:j]
}

func skipLine(s string, i int) int {
	for i < len(s) && s[i] != '\n' {
		i++
	}
	if i < len(s) {
		i++
	}
	return i
}

// skipInlineSpace skips spaces/tabs only.
func skipInlineSpace(s string, i int) int {
	for i < len(s) && (s[i] == ' ' || s[i] == '\t' || s[i] == '\r') {
		i++
	}
	return i
}

// skipSpace skips whitespace and comments (including newlines).
func skipSpace(s string, i int) int {
	for i < len(s) {
		switch {
		case s[i] == ' ' || s[i] == '\t' || s[i] == '\r' || s[i] == '\n':
			i++
		case s[i] == '#' || (s[i] == '/' && i+1 < len(s) && s[i+1] == '/'):
			i = skipLine(s, i)
		case s[i] == '/' && i+1 < len(s) && s[i+1] == '*':
			end := strings.Index(s[i+2:], "*/")
			if end < 0 {
				return len(s)
			}
			i += 2 + end + 2
		default:
			return i
		}
	}
	return i
}

// skipString returns the index just past the closing quote of the string starting at s[i].
func skipString(s string, i int) int {
	i++ // opening quote
	for i < len(s) {
		switch {
		case s[i] == '\\':
			i += 2
		case (s[i] == '$' || s[i] == '%') && i+1 < len(s) && s[i+1] == '{' && (i == 0 || s[i-1] != s[i]):
			i = skipInterp(s, i+2)
		case s[i] == '"':
			return i + 1
		case s[i] == '\n':
			return i // unterminated: stop at the line end rather than swallow the file
		default:
			i++
		}
	}
	return i
}

// skipInterp skips the inside of ${ ... } and returns the index after its closing brace.
func skipInterp(s string, i int) int {
	depth := 1
	for i < len(s) && depth > 0 {
		switch s[i] {
		case '"':
			i = skipString(s, i)
			continue
		case '{':
			depth++
		case '}':
			depth--
		}
		i++
	}
	return i
}

// heredocEnd detects a heredoc opener at s[i] ("<<EOF" / "<<-EOF") and returns the index after its terminator line.
func heredocEnd(s string, i int) (int, bool) {
	if !strings.HasPrefix(s[i:], "<<") {
		return i, false
	}
	j := i + 2
	if j < len(s) && s[j] == '-' {
		j++
	}
	id := readIdent(s, j)
	if id == "" {
		return i, false
	}
	j += len(id)
	for j < len(s) && s[j] != '\n' {
		j++
	}
	for j < len(s) {
		j++ // past '\n'
		lineEnd := j
		for lineEnd < len(s) && s[lineEnd] != '\n' {
			lineEnd++
		}
		if strings.TrimSpace(s[j:lineEnd]) == id {
			return lineEnd, true
		}
		j = lineEnd
	}
	return len(s), true
}

// skipBlock: s[i] == '{'. Returns the index after the matching '}'.
func skipBlock(s string, i int) int {
	depth := 0
	for i < len(s) {
		switch {
		case s[i] == '"':
			i = skipString(s, i)
			continue
		case s[i] == '<' && i+1 < len(s) && s[i+1] == '<':
			if end, ok := heredocEnd(s, i); ok {
				i = end
				continue
			}
		case s[i] == '#' || (s[i] == '/' && i+1 < len(s) && s[i+1] == '/'):
			i = skipLine(s, i)
			continue
		case s[i] == '{':
			depth++
		case s[i] == '}':
			depth--
			if depth == 0 {
				return i + 1
			}
		}
		i++
	}
	return i
}

// scanValue returns the index where the expression starting at s[i] ends: the
// newline (or end of input / closing brace of the enclosing body) at bracket depth 0.
func scanValue(s string, i int) int {
	depth := 0
	for i < len(s) {
		c := s[i]
		switch {
		case c == '"':
			i = skipString(s, i)
			continue
		case c == '<' && i+1 < len(s) && s[i+1] == '<':
			if end, ok := heredocEnd(s, i); ok {
				i = end
				continue
			}
		case c == '#' || (c == '/' && i+1 < len(s) && s[i+1] == '/'):
			// comment: ends the value at depth 0, otherwise skip it
			if depth == 0 {
				return i
			}
			i = skipLine(s, i)
			continue
		case c == '{' || c == '[' || c == '(':
			depth++
		case c == '}' || c == ']' || c == ')':
			if depth == 0 {
				return i
			}
			depth--
		case c == '\n':
			if depth == 0 {
				return i
			}
		}
		i++
	}
	return i
}

// unquote strips the quotes of a simple string literal; anything else is returned trimmed.
func unquote(raw string) string {
	r := strings.TrimSpace(raw)
	if len(r) >= 2 && r[0] == '"' && r[len(r)-1] == '"' {
		if u, err := strconv.Unquote(r); err == nil {
			return u
		}
		return r[1 : len(r)-1]
	}
	return r
}

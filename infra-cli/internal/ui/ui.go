package ui

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/fatih/color"
	"golang.org/x/term"
)

var (
	Bold    = color.New(color.Bold)
	Green   = color.New(color.FgGreen, color.Bold)
	Yellow  = color.New(color.FgYellow, color.Bold)
	Red     = color.New(color.FgRed, color.Bold)
	Cyan    = color.New(color.FgCyan, color.Bold)
	Dim     = color.New(color.Faint)
	Magenta = color.New(color.FgMagenta, color.Bold)
)

// Banner prints the CLI header.
func Banner() {
	fmt.Println()
	Cyan.Println("  ╔══════════════════════════════════════════════╗")
	Cyan.Println("  ║       social-platform  CLI  v1.0.0           ║")
	Cyan.Println("  ║   Terraform · Terragrunt · Kind · ArgoCD     ║")
	Cyan.Println("  ╚══════════════════════════════════════════════╝")
	fmt.Println()
}

// Step prints a numbered step header.
func Step(n int, msg string) {
	fmt.Printf("\n")
	Bold.Printf("  [%d] %s\n", n, msg)
}

// Info prints an info line.
func Info(format string, args ...any) {
	fmt.Printf("  "+format+"\n", args...)
}

// Success prints a green success line.
func Success(format string, args ...any) {
	Green.Printf("  ✓ "+format+"\n", args...)
}

// Warn prints a yellow warning.
func Warn(format string, args ...any) {
	Yellow.Printf("  ⚠ "+format+"\n", args...)
}

// Error prints a red error.
func Error(format string, args ...any) {
	Red.Printf("  ✗ "+format+"\n", args...)
}

// Fatal prints an error and exits.
func Fatal(format string, args ...any) {
	Error(format, args...)
	os.Exit(1)
}

// Prompt asks for a plaintext value, showing the current value as default.
func Prompt(label, defaultVal string) string {
	if defaultVal != "" {
		Dim.Printf("  %s [%s]: ", label, defaultVal)
	} else {
		fmt.Printf("  %s: ", label)
	}
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultVal
	}
	return line
}

// PromptSecret asks for a hidden value (password / key). Shows "****" if one
// already exists so the user knows they can skip.
func PromptSecret(label string, hasExisting bool) string {
	hint := ""
	if hasExisting {
		hint = " [keep existing, press Enter to skip]"
	}
	fmt.Printf("  %s%s: ", label, hint)
	raw, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		// Fallback to plain reader in non-TTY environments (CI / piped input).
		reader := bufio.NewReader(os.Stdin)
		line, _ := reader.ReadString('\n')
		return strings.TrimSpace(line)
	}
	val := strings.TrimSpace(string(raw))
	return val
}

// PromptMultiline reads until a line that is exactly "EOF" (like heredoc).
func PromptMultiline(label string) string {
	fmt.Printf("  %s (paste, then type EOF on its own line):\n", label)
	var sb strings.Builder
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "EOF" {
			break
		}
		sb.WriteString(line + "\n")
	}
	return sb.String()
}

// Confirm asks a yes/no question, returns true for yes.
func Confirm(question string) bool {
	fmt.Printf("  %s [y/N]: ", question)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(strings.ToLower(line))
	return line == "y" || line == "yes"
}

// Select presents numbered options and returns the chosen index (0-based).
func Select(question string, options []string) int {
	fmt.Printf("\n  %s\n", question)
	for i, opt := range options {
		Cyan.Printf("    [%d] %s\n", i+1, opt)
	}
	for {
		fmt.Printf("  Choice [1-%d]: ", len(options))
		reader := bufio.NewReader(os.Stdin)
		line, _ := reader.ReadString('\n')
		line = strings.TrimSpace(line)
		var n int
		if _, err := fmt.Sscanf(line, "%d", &n); err == nil && n >= 1 && n <= len(options) {
			return n - 1
		}
		Warn("Please enter a number between 1 and %d", len(options))
	}
}

// Spinner runs a spinner while fn executes, then prints ok/fail.
type Spinner struct {
	msg  string
	done chan struct{}
}

func NewSpinner(msg string) *Spinner {
	s := &Spinner{msg: msg, done: make(chan struct{})}
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	go func() {
		i := 0
		for {
			select {
			case <-s.done:
				return
			default:
				fmt.Printf("\r  %s %s", Cyan.Sprint(frames[i%len(frames)]), msg)
				time.Sleep(80 * time.Millisecond)
				i++
			}
		}
	}()
	return s
}

func (s *Spinner) Stop(ok bool) {
	close(s.done)
	time.Sleep(90 * time.Millisecond)
	if ok {
		fmt.Printf("\r  %s %s\n", Green.Sprint("✓"), s.msg)
	} else {
		fmt.Printf("\r  %s %s\n", Red.Sprint("✗"), s.msg)
	}
}

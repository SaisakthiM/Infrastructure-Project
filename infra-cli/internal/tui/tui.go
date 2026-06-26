// Package tui provides a Bubble Tea terminal user interface for the
// social-platform CLI. It presents a menu-driven interface for all CLI
// operations and executes them with live streaming output.
package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/deploy"
)

// ─── styles ──────────────────────────────────────────────────────────────────

var (
	styleTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#00CFCF")).
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#00CFCF")).
			Padding(0, 2)

	styleSelected = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(lipgloss.Color("#0077CC")).
			Padding(0, 2)

	styleNormal = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#CCCCCC")).
			Padding(0, 2)

	styleEnvSelected = lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#00FF88")).
				Padding(0, 1)

	styleEnvNormal = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#888888")).
			Padding(0, 1)

	styleHelp = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#555555")).
			Italic(true)

	styleSuccess = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF88")).
			Bold(true)

	styleError = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FF4444")).
			Bold(true)

	styleEnvBadge = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFAA00")).
			Bold(true)
)

// ─── menu items ──────────────────────────────────────────────────────────────

type menuItem struct {
	label string
	desc  string
}

var mainMenuItems = []menuItem{
	{"  Deploy", "Apply infrastructure (terragrunt run --all apply)"},
	{"  Destroy", "Destroy infrastructure (with confirmation)"},
	{"  Status", "Show pending changes (terragrunt plan)"},
	{"  Logs", "Stream debug output"},
	{"  Import State", "Import existing Docker resources into Terraform state"},
	{"  Exit", "Quit the TUI"},
}

var envItems = []string{"all", "prod-gateway", "prod-docker", "prod-social", "prod-infra", "prod-manage"}

// ─── model ───────────────────────────────────────────────────────────────────

type screen int

const (
	screenMain screen = iota
	screenEnv
)

type model struct {
	cfg         *config.Config
	screen      screen
	mainCursor  int
	envCursor   int
	selectedOp  int
	statusMsg   string
	statusIsErr bool
	width       int
	height      int
}

type commandDoneMsg struct{ err error }

func (m model) Init() tea.Cmd { return nil }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch m.screen {
		case screenMain:
			switch msg.String() {
			case "ctrl+c", "q":
				return m, tea.Quit
			case "up", "k":
				if m.mainCursor > 0 {
					m.mainCursor--
				}
			case "down", "j":
				if m.mainCursor < len(mainMenuItems)-1 {
					m.mainCursor++
				}
			case "enter", " ":
				m.selectedOp = m.mainCursor
				if m.mainCursor == len(mainMenuItems)-1 {
					return m, tea.Quit
				}
				// Import doesn't need env selection
				if m.mainCursor == 4 {
					return m, m.execCmd(m.mainCursor, "")
				}
				m.screen = screenEnv
				m.envCursor = 0
				m.statusMsg = ""
			}

		case screenEnv:
			switch msg.String() {
			case "ctrl+c", "esc":
				m.screen = screenMain
				m.statusMsg = ""
			case "up", "k":
				if m.envCursor > 0 {
					m.envCursor--
				}
			case "down", "j":
				if m.envCursor < len(envItems)-1 {
					m.envCursor++
				}
			case "enter", " ":
				return m, m.execCmd(m.selectedOp, envItems[m.envCursor])
			}
		}

	case commandDoneMsg:
		m.screen = screenMain
		if msg.err != nil {
			m.statusMsg = "Error: " + msg.err.Error()
			m.statusIsErr = true
		} else {
			m.statusMsg = "Command completed successfully"
			m.statusIsErr = false
		}
	}
	return m, nil
}

func (m model) View() string {
	if m.screen == screenEnv {
		return m.viewEnv()
	}
	return m.viewMain()
}

func (m model) viewMain() string {
	var sb strings.Builder
	sb.WriteString("\n")
	sb.WriteString(lipgloss.PlaceHorizontal(m.width, lipgloss.Center,
		styleTitle.Render("  social-platform  Infrastructure CLI  ")) + "\n\n")

	if m.cfg != nil && m.cfg.InfraDir != "" {
		sb.WriteString(lipgloss.PlaceHorizontal(m.width, lipgloss.Center,
			styleEnvBadge.Render("  infra: "+m.cfg.InfraDir+"  ")) + "\n\n")
	}

	for i, item := range mainMenuItems {
		if i == m.mainCursor {
			sb.WriteString(styleSelected.Render("  "+item.label+"  ") + "\n")
			sb.WriteString(styleHelp.Render("      "+item.desc) + "\n")
		} else {
			sb.WriteString(styleNormal.Render("  "+item.label) + "\n")
		}
	}

	sb.WriteString("\n")
	if m.statusMsg != "" {
		style := styleSuccess
		if m.statusIsErr {
			style = styleError
		}
		sb.WriteString(lipgloss.PlaceHorizontal(m.width, lipgloss.Center,
			style.Render("  "+m.statusMsg+"  ")) + "\n")
	}
	sb.WriteString("\n" + styleHelp.Render("  ↑/↓  k/j  navigate    enter  select    q  quit") + "\n")
	return sb.String()
}

func (m model) viewEnv() string {
	var sb strings.Builder
	op := mainMenuItems[m.selectedOp].label
	sb.WriteString("\n")
	sb.WriteString(styleTitle.Render(fmt.Sprintf("  %s — Select Environment  ", op)) + "\n\n")
	for i, env := range envItems {
		if i == m.envCursor {
			sb.WriteString(styleEnvSelected.Render(fmt.Sprintf("  ▶  %s", env)) + "\n")
		} else {
			sb.WriteString(styleEnvNormal.Render(fmt.Sprintf("     %s", env)) + "\n")
		}
	}
	sb.WriteString("\n" + styleHelp.Render("  ↑/↓  navigate    enter  select    esc  back") + "\n")
	return sb.String()
}

func (m model) execCmd(opIdx int, env string) tea.Cmd {
	return tea.Sequence(
		tea.ExitAltScreen,
		func() tea.Msg {
			err := m.runOperation(opIdx, env)
			fmt.Println("\n  Press Enter to return to the menu...")
			fmt.Scanln()
			return commandDoneMsg{err: err}
		},
		tea.EnterAltScreen,
	)
}

func (m model) runOperation(opIdx int, env string) error {
	e := deploy.Environment(env)
	fmt.Println()
	switch opIdx {
	case 0: // Deploy
		fmt.Printf("  Deploying %s...\n\n", env)
		return deploy.Apply(m.cfg, e, false, "")
	case 1: // Destroy
		fmt.Printf("  ⚠  Destroying %s — are you sure? [y/N]: ", env)
		var ans string
		fmt.Scanln(&ans)
		if strings.ToLower(ans) != "y" {
			fmt.Println("  Aborted.")
			return nil
		}
		return deploy.Destroy(m.cfg, e, false)
	case 2: // Status
		fmt.Printf("  Running plan for %s...\n\n", env)
		return deploy.Status(m.cfg, e)
	case 3: // Logs
		fmt.Printf("  Streaming logs for %s...\n\n", env)
		return deploy.Logs(m.cfg, e)
	case 4: // Import State
		fmt.Println("  Scanning Docker for importable resources...")
		candidates, err := deploy.DetectImportCandidates(m.cfg)
		if err != nil {
			return err
		}
		if len(candidates) == 0 {
			fmt.Println("  No matching Docker resources found.")
			return nil
		}
		fmt.Printf("  Found %d resource(s).\n\n", len(candidates))
		for _, c := range candidates {
			fmt.Printf("  %s (%s)\n  Import? [y/N]: ", c.Entry.TFAddress, c.ImportID)
			var ans string
			fmt.Scanln(&ans)
			if strings.ToLower(ans) == "y" {
				if importErr := deploy.RunImport(m.cfg, c); importErr != nil {
					fmt.Printf("  ✗ %v\n", importErr)
				} else {
					fmt.Printf("  ✓ Imported %s\n", c.Entry.TFAddress)
				}
			}
		}
		return nil
	}
	return nil
}

// Run starts the Bubble Tea TUI. Loads config automatically.
func Run() error {
	cfg, _ := config.Load()
	if cfg == nil {
		cfg = &config.Config{}
	}
	p := tea.NewProgram(model{cfg: cfg, screen: screenMain}, tea.WithAltScreen())
	_, err := p.Run()
	if err != nil && err.Error() != "program killed" {
		return fmt.Errorf("TUI error: %w", err)
	}
	return nil
}

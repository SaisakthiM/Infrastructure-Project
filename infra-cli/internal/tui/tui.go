// Package tui provides a Bubble Tea terminal user interface for the
// social-platform CLI. It presents a split-pane layout: left menu + right
// live log pane. Supports Deploy, Destroy, Status, Logs, Import State,
// Install, and Configure.
package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/checker"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/deploy"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/secrets"
)

// ─── colour palette ──────────────────────────────────────────────────────────

var (
	colCyan   = lipgloss.Color("#00CFCF")
	colGreen  = lipgloss.Color("#3FB950")
	colRed    = lipgloss.Color("#F85149")
	colYellow = lipgloss.Color("#D29922")
	colMuted  = lipgloss.Color("#6E7681")
	colText   = lipgloss.Color("#E6EDF3")
	colBg     = lipgloss.Color("#0D1117")
	colSurf   = lipgloss.Color("#161B22")
	colBorder = lipgloss.Color("#30363D")
	colSel    = lipgloss.Color("#1F3A5F")
)

// ─── styles ──────────────────────────────────────────────────────────────────

var (
	styleSidebarItem = lipgloss.NewStyle().
				Padding(0, 2).
				Foreground(colMuted)

	styleSidebarActive = lipgloss.NewStyle().
				Padding(0, 2).
				Bold(true).
				Foreground(colCyan).
				Background(colSel).
				BorderLeft(true).
				BorderStyle(lipgloss.ThickBorder()).
				BorderForeground(colCyan)

	styleSidebarSection = lipgloss.NewStyle().
				Padding(0, 2).
				Foreground(colMuted).
				Bold(true)

	styleTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colCyan)

	styleHelp = lipgloss.NewStyle().
			Foreground(colMuted).
			Italic(true)

	styleSeparator = lipgloss.NewStyle().
			Foreground(colMuted)

	styleSuccess = lipgloss.NewStyle().
			Foreground(colGreen).
			Bold(true)

	styleError = lipgloss.NewStyle().
			Foreground(colRed).
			Bold(true)

	styleWarn = lipgloss.NewStyle().
			Foreground(colYellow)

	styleFieldLabel = lipgloss.NewStyle().
			Foreground(colMuted).
			Bold(true)

	styleFieldValue = lipgloss.NewStyle().
			Foreground(colText)

	styleFieldActive = lipgloss.NewStyle().
				Foreground(colCyan).
				Bold(true)

	styleTabActive = lipgloss.NewStyle().
			Foreground(colCyan).
			Bold(true).
			Underline(true).
			Padding(0, 1)

	styleTabInactive = lipgloss.NewStyle().
				Foreground(colMuted).
				Padding(0, 1)

	styleBadgeGreen = lipgloss.NewStyle().
			Foreground(colGreen).
			Bold(true)

	styleBadgeRed = lipgloss.NewStyle().
			Foreground(colRed).
			Bold(true)

	styleBadgeYellow = lipgloss.NewStyle().
				Foreground(colYellow)
)

// ─── menu items ──────────────────────────────────────────────────────────────

type menuItem struct {
	label   string
	icon    string
	section string // non-empty → render a section header before this item
}

var mainMenu = []menuItem{
	{section: "OPERATIONS", label: "Deploy", icon: "▶"},
	{label: "Destroy", icon: "✕"},
	{label: "Status", icon: "≋"},
	{label: "Logs", icon: "≡"},
	{section: "STATE", label: "Import State", icon: "⇣"},
	{section: "SETUP", label: "Install", icon: "⬇"},
	{label: "Configure", icon: "⚙"},
	{section: "", label: "Exit", icon: "⏻"},
}

var envItems = []string{"all", "prod-gateway", "prod-docker", "prod-social", "prod-infra", "prod-manage"}

// ─── configure form definitions ──────────────────────────────────────────────

type formField struct {
	key   string // config struct field tag
	label string
	value string // current editing value
}

type configTab struct {
	name   string
	fields []formField
}

func buildConfigTabs(cfg *config.Config) []configTab {
	return []configTab{
		{
			name: "prod-infra",
			fields: []formField{
				{key: "domain", label: "Public Domain", value: cfg.ProdInfra.Domain},
				{key: "main_server_ip", label: "Server LAN IP", value: cfg.ProdInfra.MainServerIP},
				{key: "atlantis_gh_user", label: "GitHub User (Atlantis)", value: cfg.ProdInfra.AtlantisGHUser},
				{key: "gitops_repo_url", label: "GitOps Repo SSH URL", value: orDef(cfg.ProdInfra.GitopsRepoURL, "git@github.com:SaisakthiM/Infrastruture-Project.git")},
				{key: "n8n_port", label: "n8n Port", value: orDef(cfg.ProdInfra.N8NPort, "5678")},
				{key: "n8n_host", label: "n8n Host Bind", value: orDef(cfg.ProdInfra.N8NHost, "0.0.0.0")},
				{key: "n8n_protocol", label: "n8n Protocol", value: orDef(cfg.ProdInfra.N8NProtocol, "https")},
				{key: "n8n_user", label: "n8n Basic Auth User", value: orDef(cfg.ProdInfra.N8NUser, "admin")},
			},
		},
		{
			name: "prod-social",
			fields: []formField{
				{key: "gitops_repo_url", label: "GitOps Repo URL", value: cfg.ProdSocial.GitopsRepoURL},
				{key: "social_minio", label: "Social MinIO User", value: orDef(cfg.ProdSocial.SocialMinio, "minio")},
				{key: "load_images", label: "Load Images into kind (true/false)", value: boolStr(cfg.ProdSocial.LoadImages)},
			},
		},
		{
			name: "prod-docker",
			fields: []formField{
				{key: "blog_db_name", label: "Blog DB Name", value: orDef(cfg.ProdDocker.BlogDBName, "blog_db")},
				{key: "blog_minio_user", label: "Blog MinIO User", value: orDef(cfg.ProdDocker.BlogMinioUser, "admin")},
				{key: "blog_allowed_hosts", label: "Blog Allowed Hosts", value: orDef(cfg.ProdDocker.BlogAllowedHosts, "['localhost','127.0.0.1']")},
				{key: "notes_db_name", label: "Notes DB Name", value: orDef(cfg.ProdDocker.NotesDBName, "notes_app")},
				{key: "notes_db_user", label: "Notes DB User", value: orDef(cfg.ProdDocker.NotesDBUser, "saisakthi")},
				{key: "bank_db_user", label: "Bank DB User", value: orDef(cfg.ProdDocker.BankDBUser, "bankmanagement")},
				{key: "bank_db_name", label: "Bank DB Name", value: orDef(cfg.ProdDocker.BankDBName, "bank")},
				{key: "doc_db_name", label: "Document Platform DB Name", value: orDef(cfg.ProdDocker.DocDBName, "book_db")},
				{key: "doc_minio_user", label: "Document Platform MinIO User", value: orDef(cfg.ProdDocker.DocMinioUser, "admin")},
				{key: "whisper_db_user", label: "Whisper DB User", value: orDef(cfg.ProdDocker.WhisperDBUser, "admin")},
				{key: "whisper_db_name", label: "Whisper DB Name", value: orDef(cfg.ProdDocker.WhisperDBName, "chat")},
				{key: "whisper_test_db", label: "Whisper Test DB Name", value: orDef(cfg.ProdDocker.WhisperDBTestDB, "chat_test")},
				{key: "whisper_minio_user", label: "Whisper MinIO User", value: orDef(cfg.ProdDocker.WhisperMinioUser, "minioadmin")},
			},
		},
		{
			name: "prod-gateway",
			fields: []formField{
				{key: "letsencrypt_path", label: "Let's Encrypt Certs Path", value: orDef(cfg.ProdGateway.LetsEncryptPath, "/home/saisakthi/letsencrypt/")},
			},
		},
	}
}

// ─── screen type ─────────────────────────────────────────────────────────────

type screen int

const (
	screenMain screen = iota
	screenEnv
	screenConfigure
	screenInstall
)

// ─── model ───────────────────────────────────────────────────────────────────

type model struct {
	cfg    *config.Config
	screen screen
	width  int
	height int

	// main menu
	mainCursor int

	// env picker
	envCursor  int
	selectedOp int

	// log pane — appends across runs, separated by headers
	logLines []string

	// status bar
	statusMsg   string
	statusIsErr bool

	// configure screen
	configTabs    []configTab
	configTabIdx  int
	configField   int // cursor within the current tab's fields
	configEditing bool
	configEditBuf string

	// install screen — display only (actual run drops alt-screen)
	installStep int // 0-3 (steps 1-4)
}

type commandDoneMsg struct {
	label string
	err   error
}

type logLineMsg string

func (m model) Init() tea.Cmd { return nil }

// ─── Update ──────────────────────────────────────────────────────────────────

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case logLineMsg:
		m.logLines = append(m.logLines, string(msg))

	case commandDoneMsg:
		m.screen = screenMain
		sep := styleSeparator.Render("─── " + msg.label + " done ───")
		m.logLines = append(m.logLines, sep)
		if msg.err != nil {
			m.statusMsg = "Error: " + msg.err.Error()
			m.statusIsErr = true
		} else {
			m.statusMsg = "✓ " + msg.label + " completed"
			m.statusIsErr = false
		}

	case tea.KeyMsg:
		switch m.screen {
		case screenMain:
			return m.updateMain(msg)
		case screenEnv:
			return m.updateEnv(msg)
		case screenConfigure:
			return m.updateConfigure(msg)
		case screenInstall:
			return m.updateInstall(msg)
		}
	}
	return m, nil
}

func (m model) updateMain(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "q":
		return m, tea.Quit
	case "up", "k":
		if m.mainCursor > 0 {
			m.mainCursor--
		}
	case "down", "j":
		if m.mainCursor < len(mainMenu)-1 {
			m.mainCursor++
		}
	case "enter", " ":
		op := mainMenu[m.mainCursor].label
		switch op {
		case "Exit":
			return m, tea.Quit
		case "Install":
			m.screen = screenInstall
			m.installStep = 0
		case "Configure":
			m.screen = screenConfigure
			m.configTabs = buildConfigTabs(m.cfg)
			m.configTabIdx = 0
			m.configField = 0
			m.configEditing = false
		case "Import State":
			// Import doesn't need env selection — run directly.
			m.selectedOp = m.mainCursor
			return m, m.execCmd(m.mainCursor, "")
		default:
			m.selectedOp = m.mainCursor
			m.screen = screenEnv
			m.envCursor = 0
			m.statusMsg = ""
		}
	}
	return m, nil
}

func (m model) updateEnv(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
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
	return m, nil
}

func (m model) updateConfigure(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if m.configEditing {
		switch msg.String() {
		case "enter":
			// Commit edit.
			m.configTabs[m.configTabIdx].fields[m.configField].value = m.configEditBuf
			m.configEditing = false
		case "esc":
			m.configEditing = false
		case "backspace":
			if len(m.configEditBuf) > 0 {
				m.configEditBuf = m.configEditBuf[:len(m.configEditBuf)-1]
			}
		default:
			if len(msg.Runes) > 0 {
				m.configEditBuf += string(msg.Runes)
			}
		}
		return m, nil
	}

	switch msg.String() {
	case "ctrl+c", "esc":
		m.screen = screenMain
	case "tab", "right", "l":
		m.configTabIdx = (m.configTabIdx + 1) % len(m.configTabs)
		m.configField = 0
	case "shift+tab", "left", "h":
		m.configTabIdx = (m.configTabIdx - 1 + len(m.configTabs)) % len(m.configTabs)
		m.configField = 0
	case "up", "k":
		if m.configField > 0 {
			m.configField--
		}
	case "down", "j":
		if m.configField < len(m.configTabs[m.configTabIdx].fields)-1 {
			m.configField++
		}
	case "enter", " ":
		// Start editing the current field.
		m.configEditBuf = m.configTabs[m.configTabIdx].fields[m.configField].value
		m.configEditing = true
	case "s", "ctrl+s":
		// Save all tabs to config and generate tfvars.
		return m, m.saveConfig()
	}
	return m, nil
}

func (m model) updateInstall(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "ctrl+c", "esc":
		m.screen = screenMain
	case "enter":
		// Drop alt-screen and run install interactively.
		return m, m.execInstall()
	}
	return m, nil
}

// ─── View ────────────────────────────────────────────────────────────────────

func (m model) View() string {
	if m.width == 0 {
		return ""
	}

	sidebarW := 26
	logW := m.width - sidebarW - 1
	if logW < 20 {
		logW = 20
	}
	contentH := m.height - 4 // header(2) + footer(2)

	header := m.renderHeader()
	footer := m.renderFooter()
	sidebar := m.renderSidebar(sidebarW, contentH)

	var content string
	switch m.screen {
	case screenEnv:
		content = m.renderEnvPicker(logW, contentH)
	case screenConfigure:
		content = m.renderConfigure(logW, contentH)
	case screenInstall:
		content = m.renderInstall(logW, contentH)
	default:
		content = m.renderLog(logW, contentH)
	}

	row := lipgloss.JoinHorizontal(
		lipgloss.Top,
		lipgloss.NewStyle().
			Width(sidebarW).
			Height(contentH).
			Background(colSurf).
			BorderRight(true).
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(colBorder).
			Render(sidebar),
		lipgloss.NewStyle().
			Width(logW).
			Height(contentH).
			Render(content),
	)

	return lipgloss.JoinVertical(lipgloss.Left, header, row, footer)
}

func (m model) renderHeader() string {
	title := styleTitle.Render("⬡ social-platform")
	infra := ""
	if m.cfg != nil && m.cfg.InfraDir != "" {
		tag := m.cfg.ReleaseTag
		if tag == "" {
			tag = "local"
		}
		infra = styleHelp.Render("  " + tag + "  " + m.cfg.InfraDir)
	}
	right := lipgloss.NewStyle().Foreground(colMuted).Render(
		time.Now().Format("15:04:05"),
	)
	gap := m.width - lipgloss.Width(title) - lipgloss.Width(infra) - lipgloss.Width(right) - 4
	if gap < 1 {
		gap = 1
	}
	line := title + infra + strings.Repeat(" ", gap) + right
	return lipgloss.NewStyle().
		Width(m.width).
		Background(colSurf).
		BorderBottom(true).
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(colBorder).
		Padding(0, 1).
		Render(line)
}

func (m model) renderFooter() string {
	var hint string
	switch m.screen {
	case screenEnv:
		hint = "↑/↓  navigate    enter  select    esc  back"
	case screenConfigure:
		if m.configEditing {
			hint = "type  edit field    enter  commit    esc  cancel"
		} else {
			hint = "tab/←/→  switch env    ↑/↓  field    enter  edit    s  save    esc  back"
		}
	case screenInstall:
		hint = "enter  run install    esc  back"
	default:
		hint = "↑/↓  k/j  navigate    enter  select    q  quit"
	}

	statusPart := ""
	if m.statusMsg != "" {
		s := styleSuccess
		if m.statusIsErr {
			s = styleError
		}
		statusPart = s.Render("  " + m.statusMsg + "  ")
	}

	hintRendered := styleHelp.Render("  " + hint)
	gap := m.width - lipgloss.Width(hintRendered) - lipgloss.Width(statusPart) - 2
	if gap < 1 {
		gap = 1
	}
	line := hintRendered + strings.Repeat(" ", gap) + statusPart
	return lipgloss.NewStyle().
		Width(m.width).
		Background(colSurf).
		BorderTop(true).
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(colBorder).
		Padding(0, 0).
		Render(line)
}

func (m model) renderSidebar(w, h int) string {
	var sb strings.Builder
	sb.WriteString("\n")
	for i, item := range mainMenu {
		if item.section != "" {
			sb.WriteString(
				styleSidebarSection.Render(item.section) + "\n",
			)
		}
		label := item.icon + "  " + item.label
		if i == m.mainCursor {
			sb.WriteString(styleSidebarActive.Width(w - 4).Render(label) + "\n")
		} else {
			sb.WriteString(styleSidebarItem.Width(w - 2).Render(label) + "\n")
		}
	}
	return sb.String()
}

func (m model) renderLog(w, h int) string {
	var sb strings.Builder
	sb.WriteString("\n")

	op := mainMenu[m.mainCursor]
	heading := styleTitle.Render("  " + op.icon + "  " + op.label)
	sb.WriteString(heading + "\n")
	sb.WriteString(styleHelp.Render(strings.Repeat("─", w-2)) + "\n\n")

	// Show last N lines of the log that fit in the pane.
	available := h - 6
	if available < 1 {
		available = 1
	}
	start := 0
	if len(m.logLines) > available {
		start = len(m.logLines) - available
	}
	for _, l := range m.logLines[start:] {
		sb.WriteString("  " + l + "\n")
	}

	return sb.String()
}

func (m model) renderEnvPicker(w, h int) string {
	op := mainMenu[m.selectedOp]
	var sb strings.Builder
	sb.WriteString("\n")
	sb.WriteString(styleTitle.Render(fmt.Sprintf("  %s %s — Select Environment", op.icon, op.label)) + "\n")
	sb.WriteString(styleHelp.Render(strings.Repeat("─", w-2)) + "\n\n")

	for i, env := range envItems {
		var badge string
		if env == "prod-social" {
			badge = styleWarn.Render(" ★ kind cluster")
		}
		if i == m.envCursor {
			sb.WriteString(lipgloss.NewStyle().
				Foreground(colCyan).Bold(true).
				Render(fmt.Sprintf("  ▶  %-16s", env)) + badge + "\n")
		} else {
			sb.WriteString(lipgloss.NewStyle().
				Foreground(colMuted).
				Render(fmt.Sprintf("     %-16s", env)) + "\n")
		}
	}
	return sb.String()
}

func (m model) renderConfigure(w, h int) string {
	var sb strings.Builder
	sb.WriteString("\n")
	sb.WriteString(styleTitle.Render("  ⚙  Configure") + "\n")
	sb.WriteString(styleHelp.Render(strings.Repeat("─", w-2)) + "\n\n")

	// Tab bar
	for i, tab := range m.configTabs {
		if i == m.configTabIdx {
			sb.WriteString(styleTabActive.Render(tab.name))
		} else {
			sb.WriteString(styleTabInactive.Render(tab.name))
		}
		if i < len(m.configTabs)-1 {
			sb.WriteString(styleHelp.Render("  "))
		}
	}
	sb.WriteString("\n")
	sb.WriteString(styleHelp.Render(strings.Repeat("─", w-2)) + "\n\n")

	// Fields for current tab
	tab := m.configTabs[m.configTabIdx]
	maxLabel := 0
	for _, f := range tab.fields {
		if len(f.label) > maxLabel {
			maxLabel = len(f.label)
		}
	}

	for i, f := range tab.fields {
		padding := strings.Repeat(" ", maxLabel-len(f.label))
		labelStr := padding + f.label + " : "

		val := f.value
		isActive := i == m.configField

		if isActive && m.configEditing {
			// Show cursor in edit mode
			sb.WriteString(
				styleFieldActive.Render("  › "+labelStr) +
					styleFieldValue.Render(m.configEditBuf) +
					styleFieldActive.Render("█") + "\n",
			)
		} else if isActive {
			sb.WriteString(
				styleFieldActive.Render("  › "+labelStr) +
					styleFieldValue.Render(val) + "\n",
			)
		} else {
			sb.WriteString(
				styleFieldLabel.Render("    "+labelStr) +
					styleFieldValue.Render(val) + "\n",
			)
		}
	}

	sb.WriteString("\n")
	sb.WriteString(styleHelp.Render("  Press  s  to save and write terraform.tfvars") + "\n")
	return sb.String()
}

func (m model) renderInstall(w, h int) string {
	var sb strings.Builder
	sb.WriteString("\n")
	sb.WriteString(styleTitle.Render("  ⬇  Install") + "\n")
	sb.WriteString(styleHelp.Render(strings.Repeat("─", w-2)) + "\n\n")

	steps := []struct {
		n    int
		icon string
		desc string
	}{
		{1, "🔍", "Check prerequisites (docker, kind, kubectl, helm, terraform, terragrunt, argocd)"},
		{2, "📦", "Select infrastructure release from GitHub"},
		{3, "⬇ ", "Download & extract infra files to ~/.social-platform/infra/"},
		{4, "💾", "Save configuration"},
	}

	for _, s := range steps {
		num := styleTitle.Render(fmt.Sprintf("  Step %d", s.n))
		desc := styleHelp.Render("  " + s.icon + "  " + s.desc)
		sb.WriteString(num + "\n" + desc + "\n\n")
	}

	sb.WriteString("\n")
	sb.WriteString(styleBadgeYellow.Render("  Press Enter to begin interactive install  ") + "\n")
	sb.WriteString(styleHelp.Render("  (The TUI will suspend while the installer runs in your terminal)") + "\n")
	return sb.String()
}

// ─── Commands ─────────────────────────────────────────────────────────────────

// execCmd drops alt-screen, runs the operation, waits for Enter, then re-enters.
func (m model) execCmd(opIdx int, env string) tea.Cmd {
	label := mainMenu[opIdx].label
	if env != "" {
		label = label + " " + env
	}
	sep := styleSeparator.Render("─── " + label + " ───")

	return tea.Sequence(
		tea.ExitAltScreen,
		func() tea.Msg {
			fmt.Println()
			err := m.runOperation(opIdx, env)
			fmt.Println()
			fmt.Print("  Press Enter to return to the menu... ")
			fmt.Scanln()
			return commandDoneMsg{label: label, err: err}
		},
		func() tea.Msg {
			return logLineMsg(sep)
		},
		tea.EnterAltScreen,
	)
}

func (m model) execInstall() tea.Cmd {
	return tea.Sequence(
		tea.ExitAltScreen,
		func() tea.Msg {
			fmt.Println()
			// Re-use the CLI install flow by shelling out to the same binary.
			// We call it via os/exec so we inherit the current stdin/stdout/stderr.
			runInstallInteractive()
			fmt.Println()
			fmt.Print("  Press Enter to return to the menu... ")
			fmt.Scanln()
			return commandDoneMsg{label: "Install", err: nil}
		},
		tea.EnterAltScreen,
	)
}

func (m model) saveConfig() tea.Cmd {
	return func() tea.Msg {
		// Apply all tab field values back to cfg.
		cfg := m.cfg
		if cfg == nil {
			cfg = &config.Config{}
		}

		for _, tab := range m.configTabs {
			for _, f := range tab.fields {
				applyField(cfg, tab.name, f.key, f.value)
			}
		}

		if err := config.Save(cfg); err != nil {
			return commandDoneMsg{label: "Configure save", err: err}
		}
		if err := secrets.GenerateAll(cfg); err != nil {
			return commandDoneMsg{label: "Configure tfvars", err: err}
		}
		return commandDoneMsg{label: "Configure saved + tfvars written", err: nil}
	}
}

// applyField writes a single form value back to the right config field.
func applyField(cfg *config.Config, tab, key, value string) {
	switch tab {
	case "prod-infra":
		switch key {
		case "domain":
			cfg.ProdInfra.Domain = value
		case "main_server_ip":
			cfg.ProdInfra.MainServerIP = value
		case "atlantis_gh_user":
			cfg.ProdInfra.AtlantisGHUser = value
		case "gitops_repo_url":
			cfg.ProdInfra.GitopsRepoURL = value
		case "n8n_port":
			cfg.ProdInfra.N8NPort = value
		case "n8n_host":
			cfg.ProdInfra.N8NHost = value
		case "n8n_protocol":
			cfg.ProdInfra.N8NProtocol = value
		case "n8n_user":
			cfg.ProdInfra.N8NUser = value
		}
	case "prod-social":
		switch key {
		case "gitops_repo_url":
			cfg.ProdSocial.GitopsRepoURL = value
		case "social_minio":
			cfg.ProdSocial.SocialMinio = value
		case "load_images":
			cfg.ProdSocial.LoadImages = value == "true"
		}
	case "prod-docker":
		switch key {
		case "blog_db_name":
			cfg.ProdDocker.BlogDBName = value
		case "blog_minio_user":
			cfg.ProdDocker.BlogMinioUser = value
		case "blog_allowed_hosts":
			cfg.ProdDocker.BlogAllowedHosts = value
		case "notes_db_name":
			cfg.ProdDocker.NotesDBName = value
		case "notes_db_user":
			cfg.ProdDocker.NotesDBUser = value
		case "bank_db_user":
			cfg.ProdDocker.BankDBUser = value
		case "bank_db_name":
			cfg.ProdDocker.BankDBName = value
		case "doc_db_name":
			cfg.ProdDocker.DocDBName = value
		case "doc_minio_user":
			cfg.ProdDocker.DocMinioUser = value
		case "whisper_db_user":
			cfg.ProdDocker.WhisperDBUser = value
		case "whisper_db_name":
			cfg.ProdDocker.WhisperDBName = value
		case "whisper_test_db":
			cfg.ProdDocker.WhisperDBTestDB = value
		case "whisper_minio_user":
			cfg.ProdDocker.WhisperMinioUser = value
		}
	case "prod-gateway":
		switch key {
		case "letsencrypt_path":
			cfg.ProdGateway.LetsEncryptPath = value
		}
	}
}

func (m model) runOperation(opIdx int, env string) error {
	e := deploy.Environment(env)
	fmt.Println()

	switch mainMenu[opIdx].label {
	case "Deploy":
		fmt.Printf("  Deploying %s…\n\n", env)
		return deploy.Apply(m.cfg, e, false, "", "")

	case "Destroy":
		fmt.Printf("  ⚠  Destroying %s — are you sure? [y/N]: ", env)
		var ans string
		fmt.Scanln(&ans)
		if strings.ToLower(ans) != "y" {
			fmt.Println("  Aborted.")
			return nil
		}
		return deploy.Destroy(m.cfg, e, false)

	case "Status":
		fmt.Printf("  Running plan for %s…\n\n", env)
		return deploy.Status(m.cfg, e)

	case "Logs":
		fmt.Printf("  Streaming logs for %s…\n\n", env)
		return deploy.Logs(m.cfg, e)

	case "Import State":
		fmt.Println("  Scanning Docker for importable resources…")
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

// runInstallInteractive runs the full prerequisite check + install flow
// interactively in the caller's terminal (alt-screen is already suspended).
func runInstallInteractive() {
	fmt.Println()
	fmt.Println("  ╔══════════════════════════════════════════════╗")
	fmt.Println("  ║       social-platform  CLI  v1.0.0           ║")
	fmt.Println("  ║   Terraform · Terragrunt · Kind · ArgoCD     ║")
	fmt.Println("  ╚══════════════════════════════════════════════╝")
	fmt.Println()
	fmt.Println("  Step 1 — Checking prerequisites")
	fmt.Println()

	results := checker.CheckAll()
	for _, r := range results {
		if r.Installed {
			fmt.Printf("  ✓  %-14s  %s\n", r.Tool.Name, r.Version)
		} else {
			fmt.Printf("  ✗  %-14s  not found\n", r.Tool.Name)
		}
	}
	fmt.Println()

	missing := 0
	for _, r := range results {
		if !r.Installed {
			missing++
		}
	}
	if missing > 0 {
		fmt.Printf("  Install %d missing tool(s) automatically? [y/N]: ", missing)
		var ans string
		fmt.Scanln(&ans)
		if strings.ToLower(ans) == "y" {
			_ = checker.InstallMissing(results)
		}
	}

	fmt.Println()
	fmt.Println("  Install complete. Run 'social-platform configure' or use Configure in this TUI.")
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func orDef(v, def string) string {
	if v != "" {
		return v
	}
	return def
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// Run starts the Bubble Tea TUI.
func Run() error {
	cfg, _ := config.Load()
	if cfg == nil {
		cfg = &config.Config{}
	}
	p := tea.NewProgram(
		model{cfg: cfg, screen: screenMain},
		tea.WithAltScreen(),
	)
	_, err := p.Run()
	if err != nil && err.Error() != "program killed" {
		return fmt.Errorf("TUI error: %w", err)
	}
	return nil
}

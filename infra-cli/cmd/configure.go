package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var (
	regenOnly     bool
	importantOnly bool
)

var configureCmd = &cobra.Command{
	Use:   "configure",
	Short: "Set GitHub links + secrets, auto-fill everything else, write terraform.tfvars",
	Long: `Two-section wizard:

  Section 1 — GitHub & URLs
    Only the values that are unique to your setup: your public domain,
    server IP, GitHub username, and repo SSH URL. Everything else
    (DB names, MinIO users, ports, paths) is filled in with sensible
    defaults automatically.

  Section 2 — Secrets & Keys
    API keys, tokens, and the ArgoCD SSH deploy key. All stored in the
    OS keychain — never written to disk as plaintext.

Flags:
  --important   Only ask Section 1 (GitHub/URLs) + Section 2 (secrets).
                Skip all advanced fields — identical to the default wizard
                but makes the intent explicit. Good for CI/first-run.
  --regen       Skip all prompts entirely and just re-write tfvars from
                whatever is already saved. Use after 'clean' or when
                tfvars files are missing but config is already set.`,
	RunE: runConfigure,
}

func init() {
	configureCmd.Flags().BoolVar(&regenOnly, "regen", false,
		"Regenerate tfvars from saved values without prompting")
	configureCmd.Flags().BoolVar(&importantOnly, "important", false,
		"Only prompt for Section 1 (GitHub/URLs) + Section 2 (secrets), skip advanced fields")
}

func runConfigure(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil {
		cfg = &config.Config{}
	}

	if !cfg.InfraExists() {
		ui.Warn("Infrastructure files not found at '%s'.", cfg.InfraDir)
		ui.Info("Run 'social-platform install' first, or set InfraDir in %s", config.Path())
	}

	// --important is the same as the default wizard (Section 1 + 2 only).
	// We keep it as an explicit flag so scripts/docs can state intent clearly.
	// --regen skips everything and just regenerates tfvars from saved values.
	runWizard := !regenOnly

	if runWizard {
		// ── Section 1: GitHub & URLs ───────────────────────────────────────
		fmt.Println()
		ui.Bold.Println("  ┌─────────────────────────────────────────┐")
		ui.Bold.Println("  │  Section 1 — GitHub & Deployment URLs   │")
		ui.Bold.Println("  └─────────────────────────────────────────┘")
		if importantOnly {
			ui.Dim.Println("  (--important: only essential fields — all others use defaults)")
		}
		ui.Dim.Println("  Press Enter to keep the shown default.")
		fmt.Println()

		cfg.ProdInfra.Domain = ui.Prompt(
			"  Public domain (e.g. example.qzz.io)",
			cfg.ProdInfra.Domain)

		cfg.ProdInfra.MainServerIP = ui.Prompt(
			"  Server LAN IP",
			cfg.ProdInfra.MainServerIP)

		cfg.ProdInfra.AtlantisGHUser = ui.Prompt(
			"  GitHub username (Atlantis / ArgoCD)",
			orDefault(cfg.ProdInfra.AtlantisGHUser, "SaisakthiM"))

		repoURL := ui.Prompt(
			"  GitOps repo SSH URL",
			orDefault(cfg.ProdInfra.GitopsRepoURL,
				"git@github.com:SaisakthiM/Infrastruture-Project.git"))
		cfg.ProdInfra.GitopsRepoURL = repoURL
		if cfg.ProdSocial.GitopsRepoURL == "" {
			cfg.ProdSocial.GitopsRepoURL = repoURL
		} else {
			cfg.ProdSocial.GitopsRepoURL = ui.Prompt(
				"  GitOps repo URL for prod-social (Enter = same as above)",
				cfg.ProdSocial.GitopsRepoURL)
		}

		// Auto-fill all remaining non-secret config with defaults.
		applyDefaults(cfg)

		fmt.Println()
		ui.Success("Section 1 complete — all other config values set to defaults.")

		// ── Section 2: Secrets & Keys ──────────────────────────────────────
		fmt.Println()
		ui.Bold.Println("  ┌─────────────────────────────────────────┐")
		ui.Bold.Println("  │  Section 2 — Secrets & API Keys         │")
		ui.Bold.Println("  └─────────────────────────────────────────┘")
		ui.Dim.Println("  These are stored in the OS keychain — never written to disk.")
		ui.Dim.Println("  Press Enter to keep any existing saved value.")
		fmt.Println()

		if err := secrets.PromptAll(importantOnly); err != nil {
			return fmt.Errorf("collecting secrets: %w", err)
		}

		if !importantOnly {
			// ── Advanced section: only shown without --important ───────────
			fmt.Println()
			ui.Bold.Println("  ┌─────────────────────────────────────────┐")
			ui.Bold.Println("  │  Advanced — DB names, ports, paths      │")
			ui.Bold.Println("  │  (defaults already applied — skip with  │")
			ui.Bold.Println("  │   Enter on any field you don't need)    │")
			ui.Bold.Println("  └─────────────────────────────────────────┘")
			fmt.Println()
			if err := promptAdvanced(cfg); err != nil {
				return err
			}
		}

		if err := config.Save(cfg); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}
		ui.Success("Configuration saved to %s", config.Path())
	}

	// ── Generate tfvars ───────────────────────────────────────────────────
	fmt.Println()
	stepNum := 3
	if importantOnly {
		stepNum = 2
	}
	ui.Step(stepNum, "Generating terraform.tfvars files")

	if cfg.InfraDir == "" {
		cfg.InfraDir = config.DefaultInfraDir()
	}

	spin := ui.NewSpinner("Writing terraform.tfvars for all environments")
	err = secrets.GenerateAll(cfg)
	spin.Stop(err == nil)
	if err != nil {
		return fmt.Errorf("generating tfvars: %w", err)
	}

	ui.Success("prod-docker/terraform.tfvars  written")
	ui.Success("prod-social/terraform.tfvars  written")
	ui.Success("prod-infra/terraform.tfvars   written")

	fmt.Println()
	ui.Green.Println("  Configuration complete!")
	ui.Info("Next step: run 'social-platform deploy' to apply your infrastructure.")
	fmt.Println()
	return nil
}

// applyDefaults silently sets every non-secret config field that hasn't been
// set yet, so the user never has to answer the tedious DB-name questions.
func applyDefaults(cfg *config.Config) {
	// prod-infra
	setDef(&cfg.ProdInfra.N8NPort,     "5678")
	setDef(&cfg.ProdInfra.N8NHost,     "0.0.0.0")
	setDef(&cfg.ProdInfra.N8NProtocol, "https")
	setDef(&cfg.ProdInfra.N8NUser,     "admin")

	// prod-social
	setDef(&cfg.ProdSocial.SocialMinio, "minio")
	// LoadImages stays false unless user previously set it — that's fine.

	// prod-docker
	setDef(&cfg.ProdDocker.BlogDBName,       "blog_db")
	setDef(&cfg.ProdDocker.BlogMinioUser,    "admin")
	setDef(&cfg.ProdDocker.BlogAllowedHosts, "['localhost', '127.0.0.1']")
	setDef(&cfg.ProdDocker.NotesDBName,      "notes_app")
	setDef(&cfg.ProdDocker.NotesDBUser,      "saisakthi")
	setDef(&cfg.ProdDocker.BankDBUser,       "bankmanagement")
	setDef(&cfg.ProdDocker.BankDBName,       "bank")
	setDef(&cfg.ProdDocker.DocDBName,        "book_db")
	setDef(&cfg.ProdDocker.DocMinioUser,     "admin")
	setDef(&cfg.ProdDocker.WhisperDBUser,    "admin")
	setDef(&cfg.ProdDocker.WhisperDBName,    "chat")
	setDef(&cfg.ProdDocker.WhisperDBTestDB,  "chat_test")
	setDef(&cfg.ProdDocker.WhisperMinioUser, "minioadmin")

	// prod-gateway
	setDef(&cfg.ProdGateway.LetsEncryptPath, "/home/saisakthi/letsencrypt/")
}

func setDef(field *string, def string) {
	if strings.TrimSpace(*field) == "" {
		*field = def
	}
}

func orDefault(val, def string) string {
	if strings.TrimSpace(val) != "" {
		return val
	}
	return def
}

// promptAdvanced asks for all the non-secret fields that applyDefaults() fills
// in automatically. Shown only when --important is NOT set. Every field has
// its current/default value pre-filled so the user can just hit Enter through
// any they don't want to change.
func promptAdvanced(cfg *config.Config) error {
	p := func(label string, field *string, def string) {
		setDef(field, def) // ensure default is applied first
		*field = ui.Prompt("  "+label, *field)
	}

	fmt.Println("  — prod-infra —")
	p("n8n Port",              &cfg.ProdInfra.N8NPort,     "5678")
	p("n8n Host bind",         &cfg.ProdInfra.N8NHost,     "0.0.0.0")
	p("n8n Protocol",          &cfg.ProdInfra.N8NProtocol, "https")
	p("n8n Basic Auth User",   &cfg.ProdInfra.N8NUser,     "admin")

	fmt.Println()
	fmt.Println("  — prod-social —")
	p("Social MinIO User",     &cfg.ProdSocial.SocialMinio, "minio")
	loadImages := ui.Prompt("  Load images into kind? (true/false)", boolStr(cfg.ProdSocial.LoadImages))
	cfg.ProdSocial.LoadImages = strings.TrimSpace(loadImages) == "true"

	fmt.Println()
	fmt.Println("  — prod-docker —")
	p("Blog DB Name",           &cfg.ProdDocker.BlogDBName,       "blog_db")
	p("Blog MinIO User",        &cfg.ProdDocker.BlogMinioUser,    "admin")
	p("Blog Allowed Hosts",     &cfg.ProdDocker.BlogAllowedHosts, "['localhost', '127.0.0.1']")
	p("Notes DB Name",          &cfg.ProdDocker.NotesDBName,      "notes_app")
	p("Notes DB User",          &cfg.ProdDocker.NotesDBUser,      "saisakthi")
	p("Bank DB User",           &cfg.ProdDocker.BankDBUser,       "bankmanagement")
	p("Bank DB Name",           &cfg.ProdDocker.BankDBName,       "bank")
	p("Document Platform DB",   &cfg.ProdDocker.DocDBName,        "book_db")
	p("Document Platform MinIO",&cfg.ProdDocker.DocMinioUser,     "admin")
	p("Whisper DB User",        &cfg.ProdDocker.WhisperDBUser,    "admin")
	p("Whisper DB Name",        &cfg.ProdDocker.WhisperDBName,    "chat")
	p("Whisper Test DB",        &cfg.ProdDocker.WhisperDBTestDB,  "chat_test")
	p("Whisper MinIO User",     &cfg.ProdDocker.WhisperMinioUser, "minioadmin")

	fmt.Println()
	fmt.Println("  — prod-gateway —")
	p("Let's Encrypt Path",    &cfg.ProdGateway.LetsEncryptPath, "/home/saisakthi/letsencrypt/")

	return nil
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

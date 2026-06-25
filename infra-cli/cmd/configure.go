package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var (
	regenOnly bool
)

var configureCmd = &cobra.Command{
	Use:   "configure",
	Short: "Set secrets and configuration, then regenerate terraform.tfvars",
	Long: `Prompts for all required secrets (stored in OS keychain) and non-secret
configuration values (stored in ~/.social-platform/config.yaml), then
writes terraform.tfvars files into each environment directory.

Use --regen to skip prompts and just re-write tfvars from saved values.`,
	RunE: runConfigure,
}

func init() {
	configureCmd.Flags().BoolVar(&regenOnly, "regen", false,
		"Regenerate tfvars from saved values without prompting")
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

	if !regenOnly {
		// ── Step 1: Non-secret configuration ──────────────────────────────────
		ui.Step(1, "General configuration")
		cfg = promptGeneralConfig(cfg)

		// ── Step 2: Secrets (keychain) ─────────────────────────────────────────
		ui.Step(2, "Secrets (stored in OS keychain — never written to disk as plaintext)")
		ui.Dim.Println("  Press Enter to keep any existing value.")
		fmt.Println()
		if err := secrets.PromptAll(); err != nil {
			return fmt.Errorf("collecting secrets: %w", err)
		}

		// Persist non-secret config.
		if err := config.Save(cfg); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}
		ui.Success("Configuration saved to %s", config.Path())
	}

	// ── Step 3: Generate tfvars ────────────────────────────────────────────
	ui.Step(3, "Generating terraform.tfvars files")

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

// promptGeneralConfig walks the user through all non-secret config fields.
func promptGeneralConfig(cfg *config.Config) *config.Config {
	ui.Info("Enter values for non-secret settings (press Enter to keep existing).")
	fmt.Println()

	// ── prod-infra ─────────────────────────────────────────────────────────
	ui.Bold.Println("  prod-infra")
	cfg.ProdInfra.Domain = ui.Prompt("    Public domain (e.g. example.qzz.io)", cfg.ProdInfra.Domain)
	cfg.ProdInfra.MainServerIP = ui.Prompt("    Server LAN IP", cfg.ProdInfra.MainServerIP)
	cfg.ProdInfra.AtlantisGHUser = ui.Prompt("    GitHub username (for Atlantis)", cfg.ProdInfra.AtlantisGHUser)
	cfg.ProdInfra.GitopsRepoURL = ui.Prompt("    GitOps repo SSH URL (ArgoCD / Atlantis)",
		orDefault(cfg.ProdInfra.GitopsRepoURL, "git@github.com:SaisakthiM/Infrastruture-Project.git"))
	cfg.ProdInfra.N8NPort = ui.Prompt("    n8n port", orDefault(cfg.ProdInfra.N8NPort, "5678"))
	cfg.ProdInfra.N8NHost = ui.Prompt("    n8n host bind", orDefault(cfg.ProdInfra.N8NHost, "0.0.0.0"))
	cfg.ProdInfra.N8NProtocol = ui.Prompt("    n8n protocol (http/https)", orDefault(cfg.ProdInfra.N8NProtocol, "https"))
	cfg.ProdInfra.N8NUser = ui.Prompt("    n8n basic auth user", orDefault(cfg.ProdInfra.N8NUser, "admin"))
	fmt.Println()

	// ── prod-social ────────────────────────────────────────────────────────
	ui.Bold.Println("  prod-social")
	cfg.ProdSocial.GitopsRepoURL = ui.Prompt("    GitOps repo URL",
		orDefault(cfg.ProdSocial.GitopsRepoURL, cfg.ProdInfra.GitopsRepoURL))
	cfg.ProdSocial.SocialMinio = ui.Prompt("    Social MinIO user",
		orDefault(cfg.ProdSocial.SocialMinio, "minio"))
	loadImagesStr := "false"
	if cfg.ProdSocial.LoadImages {
		loadImagesStr = "true"
	}
	li := ui.Prompt("    Load Docker images into kind cluster? (true/false)", loadImagesStr)
	cfg.ProdSocial.LoadImages = li == "true"
	fmt.Println()

	// ── prod-docker ────────────────────────────────────────────────────────
	ui.Bold.Println("  prod-docker")
	cfg.ProdDocker.BlogDBName = ui.Prompt("    Blog DB name", orDefault(cfg.ProdDocker.BlogDBName, "blog_db"))
	cfg.ProdDocker.BlogMinioUser = ui.Prompt("    Blog MinIO user", orDefault(cfg.ProdDocker.BlogMinioUser, "admin"))
	cfg.ProdDocker.BlogAllowedHosts = ui.Prompt("    Blog allowed hosts",
		orDefault(cfg.ProdDocker.BlogAllowedHosts, "['localhost', '127.0.0.1']"))
	cfg.ProdDocker.NotesDBName = ui.Prompt("    Notes DB name", orDefault(cfg.ProdDocker.NotesDBName, "notes_app"))
	cfg.ProdDocker.NotesDBUser = ui.Prompt("    Notes DB user", orDefault(cfg.ProdDocker.NotesDBUser, "saisakthi"))
	cfg.ProdDocker.BankDBUser = ui.Prompt("    Bank DB user", orDefault(cfg.ProdDocker.BankDBUser, "bankmanagement"))
	cfg.ProdDocker.BankDBName = ui.Prompt("    Bank DB name", orDefault(cfg.ProdDocker.BankDBName, "bank"))
	cfg.ProdDocker.DocDBName = ui.Prompt("    Document Platform DB name", orDefault(cfg.ProdDocker.DocDBName, "book_db"))
	cfg.ProdDocker.DocMinioUser = ui.Prompt("    Document Platform MinIO user", orDefault(cfg.ProdDocker.DocMinioUser, "admin"))
	cfg.ProdDocker.WhisperDBUser = ui.Prompt("    Whisper DB user", orDefault(cfg.ProdDocker.WhisperDBUser, "admin"))
	cfg.ProdDocker.WhisperDBName = ui.Prompt("    Whisper DB name", orDefault(cfg.ProdDocker.WhisperDBName, "chat"))
	cfg.ProdDocker.WhisperDBTestDB = ui.Prompt("    Whisper test DB name", orDefault(cfg.ProdDocker.WhisperDBTestDB, "chat_test"))
	cfg.ProdDocker.WhisperMinioUser = ui.Prompt("    Whisper MinIO user", orDefault(cfg.ProdDocker.WhisperMinioUser, "minioadmin"))
	fmt.Println()

	// ── prod-gateway ───────────────────────────────────────────────────────
	ui.Bold.Println("  prod-gateway")
	cfg.ProdGateway.LetsEncryptPath = ui.Prompt("    Let's Encrypt certs path on host",
		orDefault(cfg.ProdGateway.LetsEncryptPath, "/home/saisakthi/letsencrypt/"))
	fmt.Println()

	return cfg
}

func orDefault(val, def string) string {
	if val != "" {
		return val
	}
	return def
}

package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/deploy"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

// ─── destroy ─────────────────────────────────────────────────────────────────

var (
	destroyEnv         string
	destroyAutoApprove bool
)

var destroyCmd = &cobra.Command{
	Use:   "destroy",
	Short: "Destroy Terraform/Terragrunt infrastructure",
	Long: `Runs terragrunt destroy (or run --all destroy).

WARNING: This is destructive. Terragrunt destroys environments in reverse
dependency order (prod-manage → prod-infra → prod-social → prod-docker →
prod-gateway) to avoid broken references.`,
	Example: `  social-platform destroy                    # destroy all (with confirmation)
  social-platform destroy --env prod-docker  # single environment`,
	RunE: runDestroy,
}

func init() {
	destroyCmd.Flags().StringVar(&destroyEnv, "env", "all",
		fmt.Sprintf("Environment to destroy (%s)", strings.Join(deploy.Environments(), " | ")))
	destroyCmd.Flags().BoolVar(&destroyAutoApprove, "auto-approve", false,
		"Skip confirmation prompt")
}

func runDestroy(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		return fmt.Errorf("infrastructure not found — run 'social-platform install' first")
	}

	env := deploy.Environment(destroyEnv)
	if !isValidEnv(env) {
		return fmt.Errorf("unknown environment %q", destroyEnv)
	}

	ui.Red.Printf("\n  ⚠  DESTRUCTIVE OPERATION\n")
	if env == deploy.EnvAll {
		ui.Warn("This will DESTROY ALL infrastructure environments.")
	} else {
		ui.Warn("This will DESTROY the '%s' environment.", env)
	}
	fmt.Println()

	if !destroyAutoApprove {
		if !ui.Confirm("Are you absolutely sure?") {
			ui.Info("Aborted.")
			return nil
		}
		// Double-confirm for all.
		if env == deploy.EnvAll {
			if !ui.Confirm("This destroys everything. Type 'y' again to confirm.") {
				ui.Info("Aborted.")
				return nil
			}
		}
	}

	if err := deploy.Destroy(cfg, env, destroyAutoApprove); err != nil {
		return err
	}

	ui.Success("Destroy complete for %s", env)
	return nil
}

// ─── status ──────────────────────────────────────────────────────────────────

var statusEnv string

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show Terragrunt plan diff (what would change)",
	Long: `Runs terragrunt plan to display pending changes.
No infrastructure is modified. Shows what would be created, updated, or
destroyed if you were to run 'deploy'.`,
	Example: `  social-platform status                    # all environments
  social-platform status --env prod-social  # single environment`,
	RunE: runStatus,
}

func init() {
	statusCmd.Flags().StringVar(&statusEnv, "env", "all",
		fmt.Sprintf("Environment to check (%s)", strings.Join(deploy.Environments(), " | ")))
}

func runStatus(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		return fmt.Errorf("infrastructure not found — run 'social-platform install' first")
	}

	env := deploy.Environment(statusEnv)
	if !isValidEnv(env) {
		return fmt.Errorf("unknown environment %q", statusEnv)
	}

	ui.Info("Running terragrunt plan for %s...", env)
	fmt.Println()
	return deploy.Status(cfg, env)
}

// ─── logs ─────────────────────────────────────────────────────────────────────

var logsEnv string

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Stream Terragrunt debug logs",
	Long: `Runs terragrunt plan with --log-level debug and streams
all output live. Useful for diagnosing provider errors, state lock issues,
or slow apply runs.`,
	Example: `  social-platform logs                    # all environments
  social-platform logs --env prod-infra   # single environment`,
	RunE: runLogs,
}

func init() {
	logsCmd.Flags().StringVar(&logsEnv, "env", "all",
		fmt.Sprintf("Environment to tail (%s)", strings.Join(deploy.Environments(), " | ")))
}

func runLogs(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		return fmt.Errorf("infrastructure not found — run 'social-platform install' first")
	}

	env := deploy.Environment(logsEnv)
	if !isValidEnv(env) {
		return fmt.Errorf("unknown environment %q", logsEnv)
	}

	return deploy.Logs(cfg, env)
}

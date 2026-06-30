package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var (
	cleanAll      bool
	cleanDryRun   bool
	cleanEnv      string
)

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: "Remove Terraform/Terragrunt cache, state, and tfvars files",
	Long: `Deletes files that can interfere with a fresh deploy:

  • .terragrunt-cache/   — Terragrunt's downloaded module cache
  • .terraform/          — Terraform provider/plugin cache
  • terraform.tfvars     — Generated secrets file (re-created by 'configure')
  • terraform.tfstate*   — Local state files
  • *.tfstate.backup     — State backups
  • .terraform.lock.hcl  — Provider lock file (optional, with --all)

By default only caches and tfvars are removed. Pass --state to also wipe
local state files (dangerous if you have no remote backend).`,
	RunE: runClean,
}

func init() {
	cleanCmd.Flags().BoolVar(&cleanAll,    "all",      false, "Also remove terraform.tfstate files (dangerous — only use with remote backend)")
	cleanCmd.Flags().BoolVar(&cleanDryRun, "dry-run",  false, "Print what would be deleted without deleting anything")
	cleanCmd.Flags().StringVar(&cleanEnv,  "env",      "",    "Only clean a specific environment (e.g. prod-social). Default: all environments")
}

// targets defines what we remove in each environment directory.
type cleanTarget struct {
	glob    string // filepath.Glob pattern relative to envDir
	desc    string
	danger  bool // only removed when --all is passed
}

var cleanTargets = []cleanTarget{
	{glob: "**/.terragrunt-cache",  desc: "Terragrunt module cache",       danger: false},
	{glob: ".terragrunt-cache",     desc: "Terragrunt module cache",       danger: false},
	{glob: "**/.terraform",         desc: "Terraform provider cache",      danger: false},
	{glob: ".terraform",            desc: "Terraform provider cache",      danger: false},
	{glob: "terraform.tfvars",      desc: "Generated tfvars",              danger: false},
	{glob: "*.tfvars",              desc: "Generated tfvars",              danger: false},
	{glob: ".terraform.lock.hcl",   desc: "Provider lock file",            danger: false},
	{glob: "terraform.tfstate",     desc: "Local state file",              danger: true},
	{glob: "terraform.tfstate.*",   desc: "Local state backup",            danger: true},
	{glob: "*.tfstate",             desc: "Local state file",              danger: true},
	{glob: "*.tfstate.backup",      desc: "State backup",                  danger: true},
}

func runClean(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		ui.Warn("Infra directory not found — run 'social-platform install' first.")
		return nil
	}

	envsDir := filepath.Join(cfg.InfraDir, "environments")

	// Build list of environment dirs to clean.
	var envDirs []string
	if cleanEnv != "" {
		d := filepath.Join(envsDir, cleanEnv)
		if _, err := os.Stat(d); err != nil {
			return fmt.Errorf("environment %q not found at %s", cleanEnv, d)
		}
		envDirs = []string{d}
	} else {
		entries, err := os.ReadDir(envsDir)
		if err != nil {
			return fmt.Errorf("reading environments dir: %w", err)
		}
		for _, e := range entries {
			if e.IsDir() {
				envDirs = append(envDirs, filepath.Join(envsDir, e.Name()))
			}
		}
	}

	if len(envDirs) == 0 {
		ui.Warn("No environment directories found under %s", envsDir)
		return nil
	}

	if cleanDryRun {
		ui.Warn("DRY RUN — nothing will be deleted")
		fmt.Println()
	}

	totalRemoved := 0
	totalSize    := int64(0)

	for _, envDir := range envDirs {
		envName := filepath.Base(envDir)
		removed, size := cleanEnvDir(envDir, envName, cleanAll, cleanDryRun)
		totalRemoved += removed
		totalSize    += size
	}

	fmt.Println()
	if cleanDryRun {
		ui.Info("Would remove %d path(s)", totalRemoved)
	} else if totalRemoved == 0 {
		ui.Success("Nothing to clean — all environments are already tidy.")
	} else {
		ui.Success("Removed %d path(s), freed ~%s", totalRemoved, humanSize(totalSize))
		fmt.Println()
		ui.Info("Run 'social-platform configure --regen' to re-generate terraform.tfvars before deploying.")
	}
	return nil
}

func cleanEnvDir(envDir, envName string, inclState, dryRun bool) (count int, size int64) {
	ui.Bold.Printf("  %s\n", envName)

	// Walk the env dir to find cache dirs (they can be nested inside
	// .terragrunt-cache/<hash>/<hash>/…).
	err := filepath.Walk(envDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		base := filepath.Base(path)

		// Directories to nuke entirely (skip walking into them).
		if info.IsDir() {
			if base == ".terragrunt-cache" || base == ".terraform" {
				n, s := removeEntry(path, dryRun)
				count += n; size += s
				return filepath.SkipDir
			}
			return nil
		}

		// Files to remove.
		switch {
		case base == "terraform.tfvars",
			base == ".terraform.lock.hcl",
			strings.HasSuffix(base, ".tfvars"):
			n, s := removeEntry(path, dryRun)
			count += n; size += s

		case inclState && (base == "terraform.tfstate" ||
			strings.HasPrefix(base, "terraform.tfstate.") ||
			strings.HasSuffix(base, ".tfstate") ||
			strings.HasSuffix(base, ".tfstate.backup")):
			n, s := removeEntry(path, dryRun)
			count += n; size += s
		}
		return nil
	})
	if err != nil {
		ui.Warn("    walk error: %v", err)
	}
	if count == 0 {
		ui.Dim.Println("    (nothing to clean)")
	}
	return
}

func removeEntry(path string, dryRun bool) (count int, size int64) {
	// Measure size before removal.
	size = dirSize(path)
	rel := "  " + path

	if dryRun {
		ui.Dim.Printf("    would remove: %s\n", rel)
		return 1, size
	}

	if err := os.RemoveAll(path); err != nil {
		ui.Red.Printf("    ✗ %s: %v\n", rel, err)
		return 0, 0
	}
	ui.Green.Printf("    ✓ removed: %s\n", path)
	return 1, size
}

func dirSize(path string) int64 {
	var total int64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total
}

func humanSize(b int64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(b)/(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(b)/(1<<20))
	case b >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(b)/(1<<10))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

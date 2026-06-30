package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/release"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var (
	updateForce   bool
	updateSkipClean bool
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Fetch the latest release and update infrastructure files",
	Long: `Compares the currently installed release tag against the latest
GitHub release. If a newer version is available it:

  1. Downloads and extracts the new release to ~/.social-platform/infra/
  2. Wipes all .terragrunt-cache/ and .terraform/ directories so the new
     module versions are picked up cleanly on the next deploy (stale caches
     from the old release cause provider version mismatches and ghost diffs).
  3. Preserves all terraform.tfvars files — your secrets stay intact.
  4. Updates the saved release tag in config.

Flags:
  --force       Update even if the installed version is already the latest.
  --skip-clean  Skip cache wipe after update (useful if you know caches are
                still valid, e.g. only non-Terraform files changed).`,
	RunE: runUpdate,
}

func init() {
	updateCmd.Flags().BoolVar(&updateForce, "force", false,
		"Download and apply the latest release even if already up to date")
	updateCmd.Flags().BoolVar(&updateSkipClean, "skip-clean", false,
		"Skip .terragrunt-cache/.terraform wipe after updating")
}

func runUpdate(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil || cfg == nil {
		cfg = &config.Config{}
	}

	// ── Step 1: Fetch latest release from GitHub ───────────────────────────
	ui.Step(1, "Checking latest release on GitHub")

	spin := ui.NewSpinner("Contacting GitHub API…")
	latest, err := release.LatestRelease()
	spin.Stop(err == nil)
	if err != nil {
		return fmt.Errorf("could not reach GitHub: %w\n  Check your internet connection or visit https://github.com/SaisakthiM/Infrastruture-Project/releases", err)
	}

	ui.Info("Latest release : %s", latest.TagName)

	// ── Step 2: Compare with installed version ─────────────────────────────
	ui.Step(2, "Comparing with installed version")

	installed := cfg.ReleaseTag
	if installed == "" {
		installed = "(none)"
	}
	ui.Info("Installed      : %s", installed)

	if installed == latest.TagName && !updateForce {
		fmt.Println()
		ui.Success("Already up to date — %s is the latest release.", latest.TagName)
		ui.Info("Use --force to re-download and re-apply anyway.")
		fmt.Println()
		return nil
	}

	if installed == latest.TagName && updateForce {
		ui.Warn("Forcing re-download of %s (--force)", latest.TagName)
	} else {
		ui.Info("Update available: %s → %s", installed, latest.TagName)
	}

	if !ui.Confirm(fmt.Sprintf("Update to %s?", latest.TagName)) {
		ui.Info("Aborted.")
		return nil
	}

	// ── Step 3: Download & extract new release ─────────────────────────────
	ui.Step(3, fmt.Sprintf("Downloading %s", latest.TagName))

	destDir := config.DefaultInfraDir()
	if cfg.InfraDir != "" {
		destDir = cfg.InfraDir
	}

	dlSpin := ui.NewSpinner(fmt.Sprintf("Downloading %s…", latest.TagName))
	infraDir, err := release.DownloadAndExtract(latest, destDir)
	dlSpin.Stop(err == nil)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	ui.Success("Extracted to %s", infraDir)

	// ── Step 4: Wipe Terragrunt/Terraform caches ───────────────────────────
	if !updateSkipClean {
		ui.Step(4, "Wiping stale caches (preserving tfvars)")
		ui.Dim.Println("  Stale .terragrunt-cache/ dirs from the old release cause provider")
		ui.Dim.Println("  version mismatches — removing them so the next deploy starts clean.")
		fmt.Println()

		envsDir := filepath.Join(infraDir, "environments")
		count, freed := wipeCaches(envsDir)

		if count == 0 {
			ui.Info("No caches found — already clean.")
		} else {
			ui.Success("Removed %d cache director%s, freed ~%s",
				count, pluralY(count), humanSize(freed))
		}
		ui.Info("terraform.tfvars files preserved — run 'social-platform configure --regen'")
		ui.Info("if you need to regenerate them after a config schema change.")
	} else {
		ui.Warn("Skipping cache wipe (--skip-clean). Run 'social-platform clean' manually if needed.")
	}

	// ── Step 5: Save updated config ────────────────────────────────────────
	ui.Step(5, "Saving updated configuration")
	cfg.InfraDir = infraDir
	cfg.ReleaseTag = latest.TagName
	if err := config.Save(cfg); err != nil {
		return fmt.Errorf("saving config: %w", err)
	}
	ui.Success("Release tag updated to %s in %s", latest.TagName, config.Path())

	// ── Done ───────────────────────────────────────────────────────────────
	fmt.Println()
	ui.Green.Println("  Update complete!")
	fmt.Println()
	ui.Info("Caches wiped — Terragrunt will re-download providers on next deploy.")
	ui.Info("Next step: run 'social-platform deploy' to apply any infra changes.")
	fmt.Println()
	return nil
}

// wipeCaches removes every .terragrunt-cache/ and .terraform/ directory
// under envsDir. It intentionally leaves terraform.tfvars files alone.
// Returns (count of dirs removed, total bytes freed).
func wipeCaches(envsDir string) (count int, freed int64) {
	if _, err := os.Stat(envsDir); err != nil {
		return 0, 0
	}

	_ = filepath.Walk(envsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			return nil
		}
		base := filepath.Base(path)
		if base != ".terragrunt-cache" && base != ".terraform" {
			return nil
		}

		sz := dirSize(path)
		rel, _ := filepath.Rel(envsDir, path)

		if removeErr := os.RemoveAll(path); removeErr != nil {
			ui.Warn("  Could not remove %s: %v", rel, removeErr)
			return filepath.SkipDir
		}

		ui.Green.Printf("  ✓ removed %s (%s)\n", rel, humanSize(sz))
		count++
		freed += sz
		return filepath.SkipDir
	})
	return
}

func pluralY(n int) string {
	if n == 1 {
		return "y"
	}
	return "ies"
}

// versionNewer returns true if next is strictly newer than current using
// naive semver prefix comparison (handles "v1.2.3" style tags).
// Used only for display — the real gate is tag equality.
func versionNewer(current, next string) bool {
	return strings.TrimPrefix(next, "v") > strings.TrimPrefix(current, "v")
}

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/release"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
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
  2. Removes local terraform.tfstate* files so the next deploy doesn't see
     stale state from the old release (avoids "state changed" errors).
  3. Keeps .terragrunt-cache/ and .terraform/ as-is — providers don't
     re-download, deploys stay fast.
  4. Preserves all terraform.tfvars files — your secrets stay intact.
  5. Updates the saved release tag in config.

Flags:
  --force       Update even if the installed version is already the latest.
  --skip-clean  No-op on update (caches are always kept). Accepted for
                script compatibility with the clean command.`,
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
		return fmt.Errorf("could not reach GitHub: %w\n  Check your internet connection or visit https://github.com/SaisakthiM/Infrastructure-Project/releases", err)
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
	ui.Step(4, "Removing stale state files (keeping caches + tfvars)")
	ui.Dim.Println("  Local tfstate files from the old release cause 'state changed' errors")
	ui.Dim.Println("  on re-deploy. Caches and tfvars are kept as-is.")
	fmt.Println()

	envsDir := filepath.Join(infraDir, "environments")
	count, freed := wipeStateFiles(envsDir)

	if count == 0 {
		ui.Info("No local state files found — nothing to remove.")
	} else {
		ui.Success("Removed %d state file%s, freed ~%s",
			count, pluralS(count), humanSize(freed))
	}
	ui.Info("terraform.tfvars files preserved.")

	if updateSkipClean {
		ui.Info("(--skip-clean has no effect: caches are always kept on update)")
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

// wipeStateFiles removes terraform.tfstate* files under envsDir so a fresh
// deploy doesn't see stale state from the old release.
// Intentionally keeps:
//   .terragrunt-cache/  — provider+module cache (safe to reuse, avoids re-download)
//   .terraform/         — provider plugins      (safe to reuse)
//   terraform.tfvars    — generated secrets      (must survive update)
// Returns (count of files removed, total bytes freed).
func wipeStateFiles(envsDir string) (count int, freed int64) {
	if _, err := os.Stat(envsDir); err != nil {
		return 0, 0
	}

	_ = filepath.Walk(envsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		base := filepath.Base(path)
		// Only remove local state files — not caches, not tfvars.
		isState := base == "terraform.tfstate" ||
			strings.HasPrefix(base, "terraform.tfstate.") ||
			strings.HasSuffix(base, ".tfstate") ||
			strings.HasSuffix(base, ".tfstate.backup")
		if !isState {
			return nil
		}

		sz := info.Size()
		rel, _ := filepath.Rel(envsDir, path)

		if removeErr := os.Remove(path); removeErr != nil {
			ui.Warn("  Could not remove %s: %v", rel, removeErr)
			return nil
		}

		ui.Green.Printf("  ✓ removed %s (%s)\n", rel, humanSize(sz))
		count++
		freed += sz
		return nil
	})
	return
}

func pluralS(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

// versionNewer returns true if next is strictly newer than current using
// naive semver prefix comparison (handles "v1.2.3" style tags).
// Used only for display — the real gate is tag equality.
func versionNewer(current, next string) bool {
	return strings.TrimPrefix(next, "v") > strings.TrimPrefix(current, "v")
}

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/checker"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/release"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install prerequisites and download infrastructure files",
	Long: `Checks for required tools (docker, kind, kubectl, helm, terraform,
terragrunt, argocd), installs any that are missing, then downloads the
infrastructure files from a GitHub Release into ~/.social-platform/infra/.`,
	RunE: runInstall,
}

func runInstall(cmd *cobra.Command, args []string) error {
	ui.Banner()

	// ── Step 1: Prerequisite check ──────────────────────────────────────────
	ui.Step(1, "Checking prerequisites")
	results := checker.CheckAll()
	checker.PrintStatus(results)

	missing := 0
	for _, r := range results {
		if !r.Installed {
			missing++
		}
	}

	if missing > 0 {
		if !ui.Confirm(fmt.Sprintf("Install %d missing tool(s) automatically?", missing)) {
			ui.Warn("Skipping auto-install. Some deploy steps may fail.")
		} else {
			if err := checker.InstallMissing(results); err != nil {
				return err
			}
			// Re-check after install.
			fmt.Println()
			ui.Step(1, "Re-checking prerequisites")
			checker.PrintStatus(checker.CheckAll())
		}
	}

	// ── Step 2: Choose release ───────────────────────────────────────────────
	ui.Step(2, "Selecting infrastructure release")

	releases, err := release.ListReleases()
	if err != nil {
		return fmt.Errorf("could not list GitHub releases: %w\n  Check your internet connection or visit https://github.com/SaisakthiM/Infrastruture-Project/releases", err)
	}

	var chosen *release.GHRelease
	if len(releases) == 0 {
		ui.Warn("No releases published yet. Fetching latest (may be source tarball).")
		latest, err := release.LatestRelease()
		if err != nil {
			return err
		}
		chosen = latest
	} else {
		options := make([]string, len(releases))
		for i, r := range releases {
			options[i] = r.TagName
		}
		options = append([]string{"latest (" + releases[0].TagName + ")"}, options[1:]...)

		idx := ui.Select("Which release do you want to install?", options)
		rel := releases[idx]
		chosen = &rel
	}

	ui.Info("Selected: %s", chosen.TagName)

	// ── Step 3: Download & extract ───────────────────────────────────────────
	ui.Step(3, "Downloading infrastructure files")

	destDir := config.DefaultInfraDir()
	spin := ui.NewSpinner("Downloading " + chosen.TagName)
	infraDir, err := release.DownloadAndExtract(chosen, destDir)
	spin.Stop(err == nil)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	ui.Success("Extracted to %s", infraDir)

	// ── Step 4: Persist to config ────────────────────────────────────────────
	ui.Step(4, "Saving configuration")
	cfg, err := config.Load()
	if err != nil {
		cfg = &config.Config{}
	}
	cfg.InfraDir = infraDir
	cfg.ReleaseTag = chosen.TagName
	if err := config.Save(cfg); err != nil {
		return fmt.Errorf("saving config: %w", err)
	}
	ui.Success("Config saved to %s", config.Path())

	// ── Done ─────────────────────────────────────────────────────────────────
	fmt.Println()
	ui.Green.Println("  Installation complete!")
	ui.Info("Next step: run 'social-platform configure' to set up your secrets.")
	fmt.Println()
	return nil
}

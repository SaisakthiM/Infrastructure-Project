package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/source"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/sourceops"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
	"github.com/spf13/cobra"
)

var (
	useShow    bool
	useNoState bool
)

var useCmd = &cobra.Command{
	Use:   "use [folder]",
	Short: "Choose the folder to deploy from (e.g. your own ~/Infrastructure-Project checkout)",
	Long: `Deploy straight from a folder you pick instead of the CLI's private downloaded
copy, so the edits you make in your own checkout are the ones that get applied.

  social-platform use ~/Infrastructure-Project     select that folder
  social-platform use                              pick from a list
  social-platform use --show                       show the current folder + git status

The folder must contain environments/ (and normally projects/). When you switch
from another folder, the existing Terraform state is copied over (never
overwriting state already there) so Terraform does not try to re-create
containers that already exist. Keep the folder current with 'social-platform sync'.

To use a folder for a single command without saving it, pass --dir:
  social-platform --dir ~/Infrastructure-Project deploy --env prod-docker`,
	Args: cobra.MaximumNArgs(1),
	RunE: runUse,
}

func init() {
	useCmd.Flags().BoolVar(&useShow, "show", false, "Show the selected folder and its git status, then exit")
	useCmd.Flags().BoolVar(&useNoState, "no-state", false, "Do not copy Terraform state from the previous folder")
}

func runUse(cmd *cobra.Command, args []string) error {
	cfg, err := config.Load()
	if err != nil {
		cfg = &config.Config{}
	}

	if useShow {
		printSource(cfg)
		return nil
	}

	var dir string
	if len(args) == 1 {
		dir = args[0]
	} else {
		dir = chooseFolder(cfg)
		if dir == "" {
			ui.Info("Nothing selected.")
			return nil
		}
	}
	dir = source.ExpandHome(dir)

	carry := false
	if !useNoState {
		candidates, err := sourceops.PlanUse(cfg, dir)
		if err != nil {
			return err
		}
		if len(candidates) > 0 {
			ui.Info("Terraform state found in %s for: %s", cfg.InfraDir, strings.Join(candidates, ", "))
			carry = ui.Confirm("Copy it into the new folder? (recommended — otherwise Terraform will try to re-create existing containers)")
		}
	}

	res, err := sourceops.Use(cfg, dir, carry)
	if err != nil {
		return err
	}

	ui.Success("Deploying from %s", res.Dir)
	if len(res.Carried) > 0 {
		ui.Success("Copied Terraform state: %s", strings.Join(res.Carried, ", "))
	}
	if res.ProjectsDir != "" {
		ui.Info("projects/ directory: %s", res.ProjectsDir)
	}
	printGit(res.Info)
	ui.Info("Next: 'social-platform sync' to pull the latest changes, 'social-platform deploy' to apply.")
	return nil
}

func chooseFolder(cfg *config.Config) string {
	home, _ := os.UserHomeDir()
	cwd, _ := os.Getwd()
	cands := source.Candidates(home, cwd, cfg.InfraDir)

	opts := make([]string, 0, len(cands)+1)
	for _, c := range cands {
		label := c
		if c == cfg.InfraDir {
			label += "   (current)"
		}
		opts = append(opts, label)
	}
	opts = append(opts, "Enter another path…")

	i := ui.Select("Which folder should deployments use?", opts)
	if i < len(cands) {
		return cands[i]
	}
	return ui.Prompt("  Folder (must contain environments/)", "")
}

func printSource(cfg *config.Config) {
	if cfg.InfraDir == "" {
		ui.Warn("No infrastructure folder yet — run 'social-platform install' or 'social-platform use <folder>'.")
		return
	}
	mode := "downloaded release copy"
	if cfg.IsLocal() {
		mode = "your own folder"
	}
	if config.InfraDirOverride() != "" {
		mode = "your own folder (--dir, this run only)"
	}
	fmt.Println()
	ui.Info("Source: %s", mode)
	ui.Info("Folder: %s", cfg.InfraDir)
	if !cfg.InfraExists() {
		ui.Warn("  that folder has no environments/ directory")
		return
	}
	info, _ := source.Inspect(cfg.InfraDir)
	printGit(info)
}

func printGit(info *source.Info) {
	if info == nil || !info.IsGit {
		ui.Dim.Println("  (not a git repository — 'sync' is unavailable here)")
		return
	}
	ui.Info("git: %s @ %s  (remote %s)", info.Branch, info.Head, info.Remote)
	switch {
	case info.Upstream == "":
		ui.Dim.Printf("  no remote-tracking branch %s/%s fetched yet — run 'social-platform sync'\n", info.Remote, info.Branch)
	case info.Behind > 0 && info.Ahead > 0:
		ui.Warn("  diverged from %s: %d local commit(s), %d incoming", info.Upstream, info.Ahead, info.Behind)
	case info.Behind > 0:
		ui.Warn("  %d commit(s) behind %s — run 'social-platform sync'", info.Behind, info.Upstream)
	case info.Ahead > 0:
		ui.Info("  %d commit(s) ahead of %s", info.Ahead, info.Upstream)
	default:
		ui.Success("  up to date with %s (as of the last fetch)", info.Upstream)
	}
	if info.Dirty {
		ui.Warn("  %d uncommitted change(s) to tracked files", len(info.DirtyFiles))
	}
}

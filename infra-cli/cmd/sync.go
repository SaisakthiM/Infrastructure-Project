package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/deploy"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/source"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/sourceops"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
	"github.com/spf13/cobra"
)

var (
	syncRemote    string
	syncBranch    string
	syncAutoStash bool
	syncRebase    bool
	syncNoFetch   bool
	syncDryRun    bool
	syncDeploy    bool
	syncYes       bool
)

var syncCmd = &cobra.Command{
	Use:     "sync",
	Aliases: []string{"pull"},
	Short:   "git fetch + fast-forward the selected folder, keeping state and caches",
	Long: `Brings the selected folder (see 'social-platform use') up to date with its git
remote: 'git fetch', then a fast-forward of the checked-out branch.

Only git-tracked files change. Terraform state, provider/Terragrunt caches and
generated terraform.tfvars are never touched, so the next deploy is incremental.

It tells you which environments the incoming changes affect, asks for any new
Terraform variables they introduce, and (with --deploy) applies those
environments for you.

  social-platform sync                 fetch and update
  social-platform sync --dry-run       show what would change
  social-platform sync --autostash     stash your uncommitted edits around the update
  social-platform sync --rebase        rebase local commits instead of requiring a fast-forward
  social-platform sync --deploy        then apply the affected environments`,
	RunE: runSync,
}

func init() {
	f := syncCmd.Flags()
	f.StringVar(&syncRemote, "remote", "", "Remote to fetch (default: the branch's remote, else origin)")
	f.StringVar(&syncBranch, "branch", "", "Branch to update from (default: the checked-out branch)")
	f.BoolVar(&syncAutoStash, "autostash", false, "Stash uncommitted changes to tracked files around the update")
	f.BoolVar(&syncRebase, "rebase", false, "Rebase local commits onto the remote branch")
	f.BoolVar(&syncNoFetch, "no-fetch", false, "Skip 'git fetch' and use what is already fetched")
	f.BoolVar(&syncDryRun, "dry-run", false, "Show incoming changes without applying them")
	f.BoolVar(&syncDeploy, "deploy", false, "Apply the affected environments after syncing")
	f.BoolVar(&syncYes, "yes", false, "Do not ask for confirmation (with --deploy)")
}

func runSync(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	res, err := sourceops.Sync(cfg, source.SyncOptions{
		Remote:    syncRemote,
		Branch:    syncBranch,
		AutoStash: syncAutoStash,
		Rebase:    syncRebase,
		NoFetch:   syncNoFetch,
		DryRun:    syncDryRun,
	}, os.Stdout)
	if err != nil {
		return err
	}
	if syncDryRun || !res.Updated {
		if syncDryRun && len(res.AffectedEnvs) > 0 {
			ui.Info("Would affect: %s", strings.Join(res.AffectedEnvs, ", "))
		}
		return nil
	}

	fmt.Println()
	if res.VariablesTF {
		ui.Info("A variable.tf changed — checking for new Terraform variables…")
		if left, err := secrets.Preflight(cfg, nil, isInteractive()); err != nil {
			return err
		} else if len(left) > 0 {
			ui.Warn("%d variable(s) still have no value (run 'social-platform configure --missing')", len(left))
		}
	}

	if len(res.AffectedEnvs) == 0 {
		ui.Success("Synced. No environment is affected by these changes.")
		return nil
	}
	ui.Success("Synced. Affected environments: %s", strings.Join(res.AffectedEnvs, ", "))

	if !syncDeploy {
		for _, e := range res.AffectedEnvs {
			ui.Dim.Printf("    social-platform deploy --env %s\n", e)
		}
		ui.Info("Or re-run with --deploy to apply them now.")
		return nil
	}

	if !syncYes && !ui.Confirm(fmt.Sprintf("Apply %s now?", strings.Join(res.AffectedEnvs, ", "))) {
		ui.Info("Skipped. Deploy later with 'social-platform deploy --env <name>'.")
		return nil
	}
	for _, e := range res.AffectedEnvs {
		if left, err := secrets.Preflight(cfg, []string{e}, isInteractive()); err != nil {
			return err
		} else if len(left) > 0 {
			return fmt.Errorf("%s: %d required variable(s) still have no value — run 'social-platform configure --missing'", e, len(left))
		}
		ui.Info("Deploying %s", e)
		if err := deploy.Apply(cfg, deploy.Environment(e), syncYes, "", ""); err != nil {
			return fmt.Errorf("deploying %s: %w", e, err)
		}
		ui.Success("Deployed %s", e)
	}
	return nil
}

// isInteractive reports whether stdin is a terminal we can prompt on.
func isInteractive() bool {
	fi, err := os.Stdin.Stat()
	return err == nil && fi.Mode()&os.ModeCharDevice != 0
}

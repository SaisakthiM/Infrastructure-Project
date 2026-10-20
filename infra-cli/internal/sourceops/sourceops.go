// Package sourceops ties internal/source (folders + git) to the saved config
// and the generated tfvars. The CLI commands and the web UI both call these.
package sourceops

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/source"
)

// UseResult describes what selecting a folder did.
type UseResult struct {
	Dir         string       `json:"dir"`
	Previous    string       `json:"previous"`
	Info        *source.Info `json:"info"`
	Carried     []string     `json:"carried_state"`
	ProjectsDir string       `json:"projects_dir"`
}

// PlanUse returns the environments whose Terraform state could be carried from
// the currently selected folder into dir (empty when there is nothing to carry).
func PlanUse(cfg *config.Config, dir string) ([]string, error) {
	dir = source.ExpandHome(dir)
	if err := source.Validate(dir); err != nil {
		return nil, err
	}
	if cfg.InfraDir == "" || filepath.Clean(cfg.InfraDir) == filepath.Clean(dir) || source.Validate(cfg.InfraDir) != nil {
		return nil, nil
	}
	return source.StateCandidates(cfg.InfraDir, dir), nil
}

// Use makes dir the folder deployments run from and saves that choice.
// With carryState, existing Terraform state is copied over first (never
// overwriting state that is already there). tfvars are generated only where
// they are missing; hand-written ones are left alone.
func Use(cfg *config.Config, dir string, carryState bool) (*UseResult, error) {
	dir = source.ExpandHome(dir)
	if err := source.Validate(dir); err != nil {
		return nil, err
	}
	res := &UseResult{Dir: dir, Previous: cfg.InfraDir}

	if carryState && cfg.InfraDir != "" && filepath.Clean(cfg.InfraDir) != filepath.Clean(dir) && source.Validate(cfg.InfraDir) == nil {
		copied, err := source.CarryOverState(cfg.InfraDir, dir)
		if err != nil {
			return nil, fmt.Errorf("copying Terraform state: %w", err)
		}
		res.Carried = copied
	}

	cfg.InfraDir = dir
	cfg.Source = config.SourceLocal
	if p := filepath.Join(dir, "projects"); isDir(p) {
		cfg.Paths.ProjectsDir = p
	}
	res.ProjectsDir = cfg.Paths.ProjectsDir

	if err := config.Save(cfg); err != nil {
		return nil, fmt.Errorf("saving config: %w", err)
	}
	if err := secrets.SyncTfvars(cfg); err != nil {
		return nil, fmt.Errorf("preparing terraform.tfvars: %w", err)
	}
	res.Info, _ = source.Inspect(dir)
	return res, nil
}

// Sync runs `git fetch` + fast-forward in the selected folder. It requires a
// user-selected (local) folder: the downloaded release copy is updated with
// `update` instead.
func Sync(cfg *config.Config, opt source.SyncOptions, out io.Writer) (*source.SyncResult, error) {
	if !cfg.InfraExists() {
		return nil, fmt.Errorf("no infrastructure folder selected — run 'social-platform use <folder>' first")
	}
	if !cfg.IsLocal() {
		return nil, fmt.Errorf("deploying from the downloaded release copy (%s)\n"+
			"  pick your own checkout with 'social-platform use <folder>' to use git sync,\n"+
			"  or run 'social-platform update' to fetch the latest release", cfg.InfraDir)
	}
	res, err := source.Sync(cfg.InfraDir, opt, out)
	if err != nil {
		return res, err
	}
	if res != nil && res.Updated {
		// new variables may have appeared: apply saved values to the tfvars files
		if err := secrets.SyncTfvars(cfg); err != nil {
			return res, fmt.Errorf("updating terraform.tfvars: %w", err)
		}
	}
	return res, nil
}

func isDir(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

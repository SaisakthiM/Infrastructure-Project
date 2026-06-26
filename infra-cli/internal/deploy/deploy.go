package deploy

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

type Environment string

const (
	EnvAll     Environment = "all"
	EnvGateway Environment = "prod-gateway"
	EnvDocker  Environment = "prod-docker"
	EnvSocial  Environment = "prod-social"
	EnvInfra   Environment = "prod-infra"
	EnvManage  Environment = "prod-manage"
)

func Environments() []string {
	return []string{
		string(EnvAll),
		string(EnvGateway),
		string(EnvDocker),
		string(EnvSocial),
		string(EnvInfra),
		string(EnvManage),
	}
}

// Apply runs terragrunt apply.
// For env == "all": terragrunt run --all apply
// For a single env: terragrunt apply [--target=<resource>]
// NOTE: --target is silently ignored when env == "all" (not supported by run --all).
func Apply(cfg *config.Config, env Environment, autoApprove bool, target string) error {
	return runTerragrunt(cfg, env, "apply", autoApprove, target)
}

func Destroy(cfg *config.Config, env Environment, autoApprove bool) error {
	return runTerragrunt(cfg, env, "destroy", autoApprove, "")
}

func Status(cfg *config.Config, env Environment) error {
	return runTerragrunt(cfg, env, "plan", false, "")
}

func Logs(cfg *config.Config, env Environment) error {
	ui.Info("Streaming terragrunt debug output for %s", env)
	ui.Dim.Println("  (Press Ctrl+C to stop)")
	fmt.Println()

	var args []string
	if env == EnvAll {
		args = []string{"run", "--all", "plan", "--non-interactive", "--log-level", "debug"}
	} else {
		args = []string{"plan", "--log-level", "debug"}
	}
	return runInDir(cfg, env, "terragrunt", args...)
}

func runTerragrunt(cfg *config.Config, env Environment, command string, autoApprove bool, target string) error {
	var args []string

	if env == EnvAll {
		// New Terragrunt CLI (run command + --all flag replaces run-all).
		// --non-interactive suppresses run --all's own "are you sure you
		// want to run X in each unit" prompt -- the CLI already asked for
		// confirmation once before getting here, no need for terragrunt to
		// ask again (and that prompt was the literal cause of the EOF
		// crash, since it was reading from stdin that was never wired up).
		args = []string{"run", "--all", command, "--non-interactive"}
		if autoApprove {
			args = append(args, "--auto-approve")
		}
	} else {
		args = []string{command}
		if autoApprove {
			args = append(args, "-auto-approve")
		}
		if target != "" {
			args = append(args, "--target="+target)
		}
	}

	return runInDir(cfg, env, "terragrunt", args...)
}

func workDir(cfg *config.Config, env Environment) string {
	envPath := filepath.Join(cfg.InfraDir, "environments")
	if env == EnvAll {
		return envPath
	}
	return filepath.Join(envPath, string(env))
}

func runInDir(cfg *config.Config, env Environment, binary string, args ...string) error {
	dir := workDir(cfg, env)
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("environment directory not found: %s\n  Run 'social-platform install' first", dir)
	}

	if _, err := exec.LookPath(binary); err != nil {
		return fmt.Errorf("%s not found — run 'social-platform install' to install prerequisites", binary)
	}

	RefreshHelmRepos()

	cmd := exec.Command(binary, args...)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	pr, pw, _ := os.Pipe()
	cmd.Stdout = io.MultiWriter(os.Stdout, pw)
	_ = pr

	ui.Cyan.Printf("\n  $ terragrunt %v\n", args)
	ui.Dim.Printf("  working dir: %s\n\n", dir)

	if err := cmd.Start(); err != nil {
		pw.Close()
		return fmt.Errorf("starting %s: %w", binary, err)
	}

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigs
		if cmd.Process != nil {
			_ = cmd.Process.Signal(sig)
		}
	}()

	err := cmd.Wait()
	pw.Close()
	signal.Stop(sigs)

	if err != nil {
		return fmt.Errorf("terragrunt exited with error: %w", err)
	}
	return nil
}

func RunInDirRaw(cfg *config.Config, env Environment, binary string, args ...string) error {
	return runInDir(cfg, env, binary, args...)
}

// RefreshHelmRepos runs `helm repo update` before terragrunt so a stale or
// never-fetched local repo index cache (the "no cached repo found" error
// from helm_release.argocd) doesn't break apply. Best-effort: if helm isn't
// on PATH, or the update itself fails, just warn and let terragrunt run
// anyway -- a real chart problem will surface from terraform directly.
func RefreshHelmRepos() {
	if _, err := exec.LookPath("helm"); err != nil {
		return
	}
	ui.Cyan.Println("\n  $ helm repo update")
	out, err := exec.Command("helm", "repo", "update").CombinedOutput()
	if len(out) > 0 {
		fmt.Print(string(out))
	}
	if err != nil {
		ui.Warn("helm repo update failed (continuing anyway): %v", err)
	}
}

func WorkDir(cfg *config.Config, env Environment) string {
	return workDir(cfg, env)
}

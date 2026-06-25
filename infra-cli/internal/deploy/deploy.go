// Package deploy wraps terragrunt run-all apply/destroy/output with live
// streaming output and per-environment targeting support.
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

// Environment is one of the five terragrunt environments.
type Environment string

const (
	EnvAll     Environment = "all"
	EnvGateway Environment = "prod-gateway"
	EnvDocker  Environment = "prod-docker"
	EnvSocial  Environment = "prod-social"
	EnvInfra   Environment = "prod-infra"
	EnvManage  Environment = "prod-manage"
)

// Environments returns all valid environment names for validation.
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

// Apply runs terragrunt apply for the given environment.
// env == "all" triggers run-all apply from environments/.
func Apply(cfg *config.Config, env Environment, autoApprove bool) error {
	return runTerragrunt(cfg, env, "apply", autoApprove)
}

// Destroy runs terragrunt destroy for the given environment.
func Destroy(cfg *config.Config, env Environment, autoApprove bool) error {
	return runTerragrunt(cfg, env, "destroy", autoApprove)
}

// Status runs terragrunt plan (no changes) to show current state diff.
func Status(cfg *config.Config, env Environment) error {
	return runTerragrunt(cfg, env, "plan", false)
}

// Logs tails the terragrunt log for the most recent run (debug level).
func Logs(cfg *config.Config, env Environment) error {
	ui.Info("Streaming terragrunt debug output for %s", env)
	ui.Dim.Println("  (Press Ctrl+C to stop)")
	fmt.Println()

	args := []string{"--terragrunt-log-level", "debug"}
	if env == EnvAll {
		args = append([]string{"run-all", "plan"}, args...)
	} else {
		args = append([]string{"plan"}, args...)
	}
	return runInDir(cfg, env, "terragrunt", args...)
}

// ─── internal ────────────────────────────────────────────────────────────────

func runTerragrunt(cfg *config.Config, env Environment, command string, autoApprove bool) error {
	var args []string

	if env == EnvAll {
		args = []string{"run-all", command}
		if autoApprove {
			args = append(args, "--auto-approve")
		}
		// run-all needs explicit non-interactive flag to avoid prompts.
		args = append(args, "--terragrunt-non-interactive")
	} else {
		args = []string{command}
		if autoApprove {
			args = append(args, "-auto-approve")
		}
	}

	return runInDir(cfg, env, "terragrunt", args...)
}

// workDir resolves the working directory for the given environment.
func workDir(cfg *config.Config, env Environment) string {
	envPath := filepath.Join(cfg.InfraDir, "environments")
	if env == EnvAll {
		return envPath
	}
	return filepath.Join(envPath, string(env))
}

// runInDir executes a command in the appropriate directory, streaming all
// output live. Handles Ctrl+C gracefully.
func runInDir(cfg *config.Config, env Environment, binary string, args ...string) error {
	dir := workDir(cfg, env)
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("environment directory not found: %s\n  Run 'social-platform install' first", dir)
	}

	// Check binary exists.
	if _, err := exec.LookPath(binary); err != nil {
		return fmt.Errorf("%s not found — run 'social-platform install' to install prerequisites", binary)
	}

	cmd := exec.Command(binary, args...)
	cmd.Dir = dir
	cmd.Env = os.Environ()

	// Wire stdout/stderr directly to the terminal for live streaming.
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Also capture a copy of stdout for the status display.
	pr, pw, _ := os.Pipe()
	cmd.Stdout = io.MultiWriter(os.Stdout, pw)
	_ = pr // We don't parse output, just stream.

	ui.Cyan.Printf("\n  $ terragrunt %v\n", args)
	ui.Dim.Printf("  working dir: %s\n\n", dir)

	if err := cmd.Start(); err != nil {
		pw.Close()
		return fmt.Errorf("starting %s: %w", binary, err)
	}

	// Handle Ctrl+C — forward signal to the child process group.
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

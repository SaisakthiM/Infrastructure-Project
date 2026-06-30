package deploy

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
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
// For a single env: terragrunt apply [--target=<resource>] [--replace=<resource>]
// NOTE: --target/--replace are silently ignored when env == "all" (not
// supported by run --all -- terragrunt has no concept of targeting a single
// resource across multiple independent units).
//
// extraOut is optional: any writers passed in also receive a copy of the
// command's combined stdout/stderr, in addition to the CLI's own os.Stdout.
// The web UI uses this to stream output into a browser job log.
func Apply(cfg *config.Config, env Environment, autoApprove bool, target string, replace string, extraOut ...io.Writer) error {
	if err := ensureKindCluster(cfg, env, extraOut...); err != nil {
		return err
	}
	return runTerragrunt(cfg, env, "apply", autoApprove, target, replace, extraOut...)
}

func Destroy(cfg *config.Config, env Environment, autoApprove bool, extraOut ...io.Writer) error {
	return runTerragrunt(cfg, env, "destroy", autoApprove, "", "", extraOut...)
}

func Status(cfg *config.Config, env Environment, extraOut ...io.Writer) error {
	return runTerragrunt(cfg, env, "plan", false, "", "", extraOut...)
}

func Logs(cfg *config.Config, env Environment, extraOut ...io.Writer) error {
	ui.Info("Streaming terragrunt debug output for %s", env)
	ui.Dim.Println("  (Press Ctrl+C to stop)")
	fmt.Println()

	var args []string
	if env == EnvAll {
		args = []string{"run", "--all", "plan", "--non-interactive", "--log-level", "debug"}
	} else {
		args = []string{"plan", "--log-level", "debug"}
	}
	return runInDir(cfg, env, "terragrunt", args, extraOut...)
}

// ensureKindCluster bootstraps the prod-social kind cluster before any
// operation that touches prod-social (env == "all" or env == "prod-social").
//
// Why this is needed: Terraform refreshes every resource already tracked in
// state during *both* plan and apply, regardless of depends_on ordering.
// If the kind cluster's API server isn't reachable yet -- first run, or the
// cluster was deleted/recreated outside Terraform -- refreshing the
// kubernetes_*/kubectl_manifest resources that live inside it fails with
// "dial tcp ...: connect: connection refused" before the real apply graph
// ever gets a chance to (re)create the cluster.
//
// Strategy: first check whether the cluster is already reachable via
// `kubectl cluster-info --context kind-kind`. If it responds, a plain
// -target apply is enough (no state changes needed). If it is unreachable
// (first run, cluster was deleted, API server down), pass -replace so
// Terraform actually destroys-and-recreates the null_resource even though
// its id is already in state -- this is exactly what manual
// `terragrunt apply -replace=null_resource.kind_cluster` does.
func ensureKindCluster(cfg *config.Config, env Environment, extraOut ...io.Writer) error {
	if env != EnvAll && env != EnvSocial {
		return nil
	}

	dir := workDir(cfg, EnvSocial)
	if _, err := os.Stat(dir); err != nil {
		// prod-social isn't installed yet -- let the normal flow surface
		// the real "environment directory not found" error instead.
		return nil
	}

	ui.Info("Bootstrapping kind cluster (prod-social) before continuing...")

	// Probe the cluster. A zero exit code means the API server is up.
	clusterReachable := kindClusterReachable()

	var args []string
	if clusterReachable {
		// Cluster exists and responds -- plain -target is sufficient to
		// ensure the null_resource stays in sync without forcing recreation.
		args = []string{"apply", "-target=null_resource.kind_cluster", "-auto-approve"}
		ui.Dim.Println("  kind cluster reachable — verifying state only")
	} else {
		// Cluster is gone or unreachable -- force Terraform to recreate it
		// even though the resource id is already in state.
		args = []string{"apply", "-target=null_resource.kind_cluster", "-replace=null_resource.kind_cluster", "-auto-approve"}
		ui.Dim.Println("  kind cluster unreachable — forcing recreation")
	}

	if err := runInDir(cfg, EnvSocial, "terragrunt", args, extraOut...); err != nil {
		return fmt.Errorf("bootstrapping kind cluster: %w", err)
	}
	fmt.Println()
	return nil
}

// kindClusterReachable performs a two-step check:
//  1. `kind get clusters` — verifies "social-media" appears in kind's registry.
//     If kind isn't installed or the cluster isn't listed we skip to step 2.
//     If kind IS installed and the cluster is NOT listed → return false immediately
//     (no point probing kubectl; the cluster must be recreated from scratch).
//  2. `kubectl cluster-info --context kind-social-media` — probes the API server.
//     The cluster can be listed by kind while its Docker containers are stopped,
//     so we confirm the API server actually responds before treating it as healthy.
func kindClusterReachable() bool {
	kindInstalled := false
	if _, err := exec.LookPath("kind"); err == nil {
		kindInstalled = true
	}

	if kindInstalled {
		out, err := exec.Command("kind", "get", "clusters").Output()
		if err == nil {
			// kind ran successfully — check if "social-media" is in the list.
			clusterFound := false
			for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
				if strings.TrimSpace(line) == "social-media" {
					clusterFound = true
					break
				}
			}
			if !clusterFound {
				// kind is working but the cluster doesn't exist — must recreate.
				return false
			}
			// Cluster is listed — fall through to API server probe.
		}
		// If kind get clusters errored (e.g. Docker not running), fall through
		// to kubectl check so we don't block on a transient kind error.
	}

	// Probe the API server regardless (handles case where kind isn't installed
	// but kubectl context already exists from a previous setup).
	if _, err := exec.LookPath("kubectl"); err != nil {
		return false
	}
	cmd := exec.Command("kubectl", "cluster-info", "--context", "kind-social-media")
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run() == nil
}

func runTerragrunt(cfg *config.Config, env Environment, command string, autoApprove bool, target string, replace string, extraOut ...io.Writer) error {
	var args []string

	if env == EnvAll {
		// New Terragrunt CLI: `terragrunt run --all <command> --non-interactive`
		// Terraform flags (--auto-approve etc.) must come after `--`
		// otherwise Terragrunt rejects them with "not a Terragrunt flag".
		args = []string{"run", "--all", command, "--non-interactive"}
		if autoApprove {
			// `--` tells Terragrunt to forward everything after it to terraform.
			args = append(args, "--", "-auto-approve")
		}
	} else {
		args = []string{command}
		if autoApprove {
			args = append(args, "-auto-approve")
		}
		if target != "" {
			args = append(args, "--target="+target)
		}
		if replace != "" {
			args = append(args, "--replace="+replace)
		}
	}

	return runInDir(cfg, env, "terragrunt", args, extraOut...)
}

func workDir(cfg *config.Config, env Environment) string {
	envPath := filepath.Join(cfg.InfraDir, "environments")
	if env == EnvAll {
		return envPath
	}
	return filepath.Join(envPath, string(env))
}

// runInDir runs binary with args inside env's working directory. Output is
// always mirrored to os.Stdout (so the CLI/TUI behave exactly as before);
// any writers in extraOut get a copy too (used by the web UI to capture
// output into a per-job buffer without an unread, eventually-blocking pipe).
func runInDir(cfg *config.Config, env Environment, binary string, args []string, extraOut ...io.Writer) error {
	dir := workDir(cfg, env)
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("environment directory not found: %s\n  Run 'social-platform install' first", dir)
	}

	if _, err := exec.LookPath(binary); err != nil {
		return fmt.Errorf("%s not found — run 'social-platform install' to install prerequisites", binary)
	}

	RefreshHelmRepos(extraOut...)

	cmd := exec.Command(binary, args...)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.Stdin = os.Stdin

	writers := append([]io.Writer{os.Stdout}, extraOut...)
	mw := io.MultiWriter(writers...)
	cmd.Stdout = mw
	cmd.Stderr = mw

	ui.Cyan.Printf("\n  $ terragrunt %v\n", args)
	ui.Dim.Printf("  working dir: %s\n\n", dir)

	if err := cmd.Start(); err != nil {
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
	signal.Stop(sigs)

	if err != nil {
		return fmt.Errorf("terragrunt exited with error: %w", err)
	}
	return nil
}

// RefreshHelmRepos runs `helm repo update` before terragrunt so a stale or
// never-fetched local repo index cache (the "no cached repo found" error
// from helm_release.argocd) doesn't break apply. Best-effort: if helm isn't
// on PATH, or the update itself fails, just warn and let terragrunt run
// anyway -- a real chart problem will surface from terraform directly.
func RefreshHelmRepos(extraOut ...io.Writer) {
	if _, err := exec.LookPath("helm"); err != nil {
		return
	}
	ui.Cyan.Println("\n  $ helm repo update")
	out, err := exec.Command("helm", "repo", "update").CombinedOutput()
	if len(out) > 0 {
		fmt.Print(string(out))
		for _, w := range extraOut {
			_, _ = w.Write(out)
		}
	}
	if err != nil {
		ui.Warn("helm repo update failed (continuing anyway): %v", err)
	}
}

func WorkDir(cfg *config.Config, env Environment) string {
	return workDir(cfg, env)
}

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
	"time"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
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

// kindContext is the kubeconfig context prod-social's cluster installs and the
// context every kubectl/helm/kubernetes provider in prod-social and
// prod-infra pins itself to.
const kindContext = "kind-social-media"

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
	// prod-infra is the only environment that uses ArgoCD without owning it:
	// its kubectl_manifest.app_of_apps_observability is an argoproj.io
	// Application written into namespace argocd. `deploy all` gets the ordering
	// from terragrunt's dependencies block; a standalone prod-infra deploy gets
	// it from here.
	if env == EnvInfra {
		waitForArgoCD(extraOut...)
	}
	return runTerragrunt(cfg, env, "apply", autoApprove, target, replace, extraOut...)
}

func Destroy(cfg *config.Config, env Environment, autoApprove bool, extraOut ...io.Writer) error {
	return runTerragrunt(cfg, env, "destroy", autoApprove, "", "", extraOut...)
}

// Status runs terragrunt plan. Planning prod-infra refreshes
// kubectl_manifest.app_of_apps_observability, which fails with
// "no kind is registered for the type v1alpha1 Application" while ArgoCD's
// CRDs are absent — and a plan never runs the apply-time gate that would
// have said "apply prod-social first". Warn up front instead of blocking on
// a read-only command.
func Status(cfg *config.Config, env Environment, extraOut ...io.Writer) error {
	if (env == EnvInfra || env == EnvAll) && kindClusterReachable() &&
		runHidden("kubectl", "--context", kindContext, "get", "crd", "applications.argoproj.io") != nil {
		ui.Warn("ArgoCD is not installed in %s — planning prod-infra will report \"no kind is registered for the type v1alpha1 Application\". Apply prod-social first: social-platform deploy prod-social", kindContext)
	}
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

// needsKind reports whether an environment's Terraform touches the
// kind-social-media cluster -- directly or through ArgoCD.
//
//	prod-social  owns null_resource.kind_cluster itself.
//	prod-infra   joins the "kind" docker network from docker_container.otel_gateway
//	             and writes an argoproj.io Application into namespace argocd.
//	prod-manage  runs `docker network connect kind gateway`.
//
// All three fail with a version of "not found" when the cluster is down:
// Terraform refreshes every kubernetes_*/kubectl_manifest in state before the
// apply graph runs, so an unreachable API server kills the plan no matter what
// depends_on says.
func needsKind(env Environment) bool {
	return env == EnvAll || env == EnvSocial || env == EnvInfra || env == EnvManage
}

// ensureKindCluster bootstraps the prod-social kind cluster before any
// operation that touches it (see needsKind).
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
// `kubectl cluster-info --context kind-social-media`. If it responds, a plain
// -target apply is enough (no state changes needed). If it is unreachable
// (first run, cluster was deleted, API server down), pass -replace so
// Terraform actually destroys-and-recreates the null_resource even though
// its id is already in state -- this is exactly what manual
// `terragrunt apply -replace=null_resource.kind_cluster` does.
func ensureKindCluster(cfg *config.Config, env Environment, extraOut ...io.Writer) error {
	if !needsKind(env) {
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
	cmd := exec.Command("kubectl", "cluster-info", "--context", kindContext)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run() == nil
}

// waitForArgoCD blocks until prod-social's ArgoCD can actually take an
// Application, because helm_release.argocd reporting success and ArgoCD being
// able to reconcile are two different moments. It never fails the deploy: the
// prod-infra Terraform gate (null_resource.prod_social_ready) is what refuses
// with the "apply prod-social first" message, and it re-runs whenever this
// environment's state is fresh. This only removes the pointless wait when
// ArgoCD genuinely is not installed, and rides out the ordinary
// "pods still starting" case that produced the intermittent
// "argocd not found" / "no kind is registered for the type v1alpha1
// Application" errors.
func waitForArgoCD(extraOut ...io.Writer) {
	// Mirrored to extraOut as well as the console: the dashboard's job log is
	// built from those writers, and a silent 3-minute wait looks like a hung
	// deploy from the browser.
	w := io.MultiWriter(append([]io.Writer{os.Stdout}, extraOut...)...)
	say := func(format string, args ...any) {
		fmt.Fprintf(w, "  "+format+"\n", args...)
	}

	if !kindClusterReachable() {
		say("! kind-social-media is not reachable -- prod-infra needs the cluster (the kind network and ArgoCD both live there).")
		return
	}
	if _, err := exec.LookPath("kubectl"); err != nil {
		return
	}

	if runHidden("kubectl", "--context", kindContext, "get", "crd", "applications.argoproj.io") != nil {
		say("! ArgoCD is not installed in %s -- apply prod-social first: social-platform deploy prod-social", kindContext)
		return
	}

	const (
		poll  = 5 * time.Second
		limit = 36 // 3 minutes: a cold argocd-repo-server can take a while to pull its first image
	)
	for i := 0; i < limit; i++ {
		if argocdReady() {
			if i == 0 {
				say("ArgoCD is ready.")
			} else {
				say("✓ ArgoCD is ready after %s.", (time.Duration(i) * poll).String())
			}
			return
		}
		if i == 0 {
			say("waiting for ArgoCD (prod-social) to finish rolling out before applying prod-infra...")
		}
		time.Sleep(poll)
	}
	say("! ArgoCD still not ready after 3 minutes -- prod-infra may report ArgoCD resources as missing. Run 'social-platform deploy prod-social' and retry.")
}

// argocdReady is true when the Application CRD is registered and both
// deployments that a sync depends on have finished rolling out: the
// application-controller (reconciles Applications) and the repo-server (reads
// gitops/ from var.gitops_repo_url).
func argocdReady() bool {
	if runHidden("kubectl", "--context", kindContext, "get", "crd", "applications.argoproj.io") != nil {
		return false
	}
	for _, dep := range []string{"argocd-application-controller", "argocd-repo-server"} {
		if runHidden("kubectl", "--context", kindContext, "-n", "argocd",
			"rollout", "status", "deploy/"+dep, "--timeout=10s") != nil {
			return false
		}
	}
	return true
}

// runHidden runs a command with both streams discarded and reports whether it
// exited zero. Used for the kubectl probes above, which are polled.
func runHidden(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	return cmd.Run()
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

// workDir resolves the terragrunt working directory for a given environment.
//
// IMPORTANT: env must never be the zero value (""). filepath.Join silently
// drops empty path components, so workDir(cfg, "") would quietly resolve to
// the parent "environments" directory instead of failing loudly — which is
// exactly the bug that caused terragrunt import to run in the wrong
// directory (see web UI import handler history). Any caller that builds an
// Environment from external input (JSON, form data, CLI flags) MUST
// validate it against Environments() before calling into this package.
func workDir(cfg *config.Config, env Environment) string {
	if env == "" {
		panic("deploy: workDir called with empty Environment — this indicates a caller bug (e.g. an Env field lost in a JSON round-trip). Refusing to silently fall back to the parent environments directory.")
	}

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
	cmd.Env = withProviderCache(os.Environ())
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

// withProviderCache points Terraform at one shared provider cache so providers
// are downloaded once and reused across folders, syncs and re-installs (a
// Terragrunt cache directory is keyed by path, so a new source folder would
// otherwise download every provider again). An existing TF_PLUGIN_CACHE_DIR
// is respected.
func withProviderCache(env []string) []string {
	for _, e := range env {
		if strings.HasPrefix(e, "TF_PLUGIN_CACHE_DIR=") {
			return env
		}
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return env
	}
	dir := filepath.Join(home, ".terraform.d", "plugin-cache")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return env
	}
	return append(env,
		"TF_PLUGIN_CACHE_DIR="+dir,
		"TF_PLUGIN_CACHE_MAY_BREAK_DEPENDENCY_LOCK_FILE=true",
	)
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

// WorkDir is the exported form of workDir, used by import.go and other
// package-external callers.
//
// It carries the same "env must not be empty" contract as workDir above —
// see that function's doc comment.
func WorkDir(cfg *config.Config, env Environment) string {
	return workDir(cfg, env)
}
// Package checker detects and installs prerequisite tools:
// docker, kind, kubectl, helm, terraform, terragrunt, argocd.
package checker

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

// Tool describes a required CLI tool.
type Tool struct {
	Name        string
	Binary      string
	VersionFlag string
	InstallFn   func() error
	ManualURL   string
}

// All returns the full list of required tools.
func All() []Tool {
	return []Tool{
		{
			Name:        "Docker",
			Binary:      "docker",
			VersionFlag: "version",
			InstallFn:   installDocker,
			ManualURL:   "https://docs.docker.com/engine/install/",
		},
		{
			Name:        "Kind",
			Binary:      "kind",
			VersionFlag: "version",
			InstallFn:   installKind,
			ManualURL:   "https://kind.sigs.k8s.io/docs/user/quick-start/#installation",
		},
		{
			Name:        "kubectl",
			Binary:      "kubectl",
			VersionFlag: "version --client --short",
			InstallFn:   installKubectl,
			ManualURL:   "https://kubernetes.io/docs/tasks/tools/",
		},
		{
			Name:        "Helm",
			Binary:      "helm",
			VersionFlag: "version --short",
			InstallFn:   installHelm,
			ManualURL:   "https://helm.sh/docs/intro/install/",
		},
		{
			Name:        "Terraform",
			Binary:      "terraform",
			VersionFlag: "version",
			InstallFn:   installTerraform,
			ManualURL:   "https://developer.hashicorp.com/terraform/downloads",
		},
		{
			Name:        "Terragrunt",
			Binary:      "terragrunt",
			VersionFlag: "--version",
			InstallFn:   installTerragrunt,
			ManualURL:   "https://terragrunt.gruntwork.io/docs/getting-started/install/",
		},
		{
			Name:        "ArgoCD CLI",
			Binary:      "argocd",
			VersionFlag: "version --client",
			InstallFn:   installArgoCD,
			ManualURL:   "https://argo-cd.readthedocs.io/en/stable/cli_installation/",
		},
	}
}

// CheckResult holds the result for a single tool check.
type CheckResult struct {
	Tool      Tool
	Installed bool
	Version   string
}

// CheckAll checks whether all tools are installed and returns results.
func CheckAll() []CheckResult {
	results := make([]CheckResult, 0)
	for _, t := range All() {
		installed, version := check(t)
		results = append(results, CheckResult{Tool: t, Installed: installed, Version: version})
	}
	return results
}

func check(t Tool) (bool, string) {
	args := strings.Fields(t.VersionFlag)
	out, err := exec.Command(t.Binary, args...).CombinedOutput()
	if err != nil {
		// Check if the binary exists but returned a non-zero exit (still "installed").
		if _, e2 := exec.LookPath(t.Binary); e2 == nil {
			return true, strings.TrimSpace(strings.Split(string(out), "\n")[0])
		}
		return false, ""
	}
	version := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	return true, version
}

// PrintStatus prints a table of tool statuses.
func PrintStatus(results []CheckResult) {
	fmt.Println()
	ui.Bold.Println("  Prerequisite Check")
	fmt.Println("  " + strings.Repeat("─", 52))
	allOK := true
	for _, r := range results {
		if r.Installed {
			ui.Green.Printf("  ✓  %-14s  %s\n", r.Tool.Name, r.Version)
		} else {
			ui.Red.Printf("  ✗  %-14s  not found\n", r.Tool.Name)
			allOK = false
		}
	}
	fmt.Println("  " + strings.Repeat("─", 52))
	if allOK {
		ui.Success("All prerequisites satisfied")
	} else {
		ui.Warn("Some tools are missing — run 'social-platform install' to install them")
	}
	fmt.Println()
}

// InstallMissing prompts for each missing tool and installs it.
func InstallMissing(results []CheckResult) error {
	missing := []CheckResult{}
	for _, r := range results {
		if !r.Installed {
			missing = append(missing, r)
		}
	}
	if len(missing) == 0 {
		ui.Success("All tools already installed")
		return nil
	}

	ui.Info("Missing tools: %s", func() string {
		names := []string{}
		for _, r := range missing {
			names = append(names, r.Tool.Name)
		}
		return strings.Join(names, ", ")
	}())
	fmt.Println()

	for _, r := range missing {
		ui.Info("Installing %s...", r.Tool.Name)
		if r.Tool.InstallFn == nil {
			ui.Warn("No auto-installer for %s. Install manually: %s", r.Tool.Name, r.Tool.ManualURL)
			continue
		}
		spin := ui.NewSpinner(fmt.Sprintf("Installing %s", r.Tool.Name))
		err := r.Tool.InstallFn()
		spin.Stop(err == nil)
		if err != nil {
			ui.Warn("Auto-install failed for %s: %v", r.Tool.Name, err)
			ui.Info("Install manually: %s", r.Tool.ManualURL)
		}
	}
	return nil
}

// ─── OS detection ────────────────────────────────────────────────────────────

func isLinux() bool  { return runtime.GOOS == "linux" }
func isMacOS() bool  { return runtime.GOOS == "darwin" }
func isAMD64() bool  { return runtime.GOARCH == "amd64" }
func isARM64() bool  { return runtime.GOARCH == "arm64" }

func arch() string {
	if isARM64() {
		return "arm64"
	}
	return "amd64"
}

func runSh(script string) error {
	cmd := exec.Command("sh", "-c", script)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ─── Installers ──────────────────────────────────────────────────────────────

func installDocker() error {
	if isLinux() {
		return runSh("curl -fsSL https://get.docker.com | sh")
	}
	if isMacOS() {
		return runSh("brew install --cask docker")
	}
	return fmt.Errorf("unsupported OS for auto-install")
}

func installKind() error {
	url := fmt.Sprintf(
		"https://kind.sigs.k8s.io/dl/latest/kind-linux-%s", arch())
	if isMacOS() {
		url = fmt.Sprintf("https://kind.sigs.k8s.io/dl/latest/kind-darwin-%s", arch())
	}
	return runSh(fmt.Sprintf(
		`curl -Lo /usr/local/bin/kind %s && chmod +x /usr/local/bin/kind`, url))
}

func installKubectl() error {
	if isMacOS() {
		return runSh("brew install kubectl")
	}
	return runSh(`curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/` + arch() + `/kubectl" \
  && chmod +x kubectl && mv kubectl /usr/local/bin/kubectl`)
}

func installHelm() error {
	return runSh("curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash")
}

func installTerraform() error {
	if isMacOS() {
		return runSh("brew tap hashicorp/tap && brew install hashicorp/tap/terraform")
	}
	return runSh(`sudo apt-get update -y && sudo apt-get install -y gnupg software-properties-common && \
  wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg && \
  echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/hashicorp.list && \
  sudo apt-get update && sudo apt-get install -y terraform`)
}

func installTerragrunt() error {
	url := fmt.Sprintf(
		"https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_linux_%s", arch())
	if isMacOS() {
		url = fmt.Sprintf(
			"https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_darwin_%s", arch())
	}
	return runSh(fmt.Sprintf(
		`curl -Lo /usr/local/bin/terragrunt %s && chmod +x /usr/local/bin/terragrunt`, url))
}

func installArgoCD() error {
	url := fmt.Sprintf(
		"https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-%s", arch())
	if isMacOS() {
		url = fmt.Sprintf(
			"https://github.com/argoproj/argo-cd/releases/latest/download/argocd-darwin-%s", arch())
	}
	return runSh(fmt.Sprintf(
		`curl -Lo /usr/local/bin/argocd %s && chmod +x /usr/local/bin/argocd`, url))
}

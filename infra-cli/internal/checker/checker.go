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
			// kubectl >=1.28 dropped --short, so this used to fail with
			// "unknown flag: --short" and that error text got printed as
			// the version. --client alone still prints just the client
			// version without an apiserver round-trip.
			VersionFlag: "version --client",
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
		// The version-check command itself failed (e.g. a removed flag),
		// but the binary is genuinely on PATH -- don't print its stderr as
		// if it were a version string, just say it's there.
		if _, e2 := exec.LookPath(t.Binary); e2 == nil {
			return true, "installed (version check failed)"
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

// ─── OS / distro detection ───────────────────────────────────────────────────

func isLinux() bool { return runtime.GOOS == "linux" }
func isMacOS() bool { return runtime.GOOS == "darwin" }

func arch() string {
	if runtime.GOARCH == "arm64" {
		return "arm64"
	}
	return "amd64"
}

// distro identifies the Linux package manager available on this machine.
type distro int

const (
	distroUnknown distro = iota
	distroArch           // pacman  (Arch, Manjaro, EndeavourOS …)
	distroDebian         // apt-get (Debian, Ubuntu, Pop!_OS, Mint …)
	distroFedora         // dnf     (Fedora, RHEL, CentOS Stream …)
	distroOpenSUSE       // zypper  (openSUSE)
	distroAlpine         // apk     (Alpine)
)

// detectDistro reads /etc/os-release and falls back to binary probing.
func detectDistro() distro {
	// First try /etc/os-release which is present on all modern distros.
	data, err := os.ReadFile("/etc/os-release")
	if err == nil {
		content := strings.ToLower(string(data))
		switch {
		case strings.Contains(content, "arch") ||
			strings.Contains(content, "manjaro") ||
			strings.Contains(content, "endeavouros") ||
			strings.Contains(content, "garuda"):
			return distroArch
		case strings.Contains(content, "ubuntu") ||
			strings.Contains(content, "debian") ||
			strings.Contains(content, "pop!_os") ||
			strings.Contains(content, "linuxmint") ||
			strings.Contains(content, "elementary"):
			return distroDebian
		case strings.Contains(content, "fedora") ||
			strings.Contains(content, "rhel") ||
			strings.Contains(content, "centos") ||
			strings.Contains(content, "rocky") ||
			strings.Contains(content, "almalinux"):
			return distroFedora
		case strings.Contains(content, "opensuse") ||
			strings.Contains(content, "sles"):
			return distroOpenSUSE
		case strings.Contains(content, "alpine"):
			return distroAlpine
		}
	}
	// Fallback: probe for the package manager binary directly.
	for _, pm := range []struct {
		bin string
		d   distro
	}{
		{"pacman", distroArch},
		{"apt-get", distroDebian},
		{"dnf", distroFedora},
		{"yum", distroFedora},
		{"zypper", distroOpenSUSE},
		{"apk", distroAlpine},
	} {
		if _, err := exec.LookPath(pm.bin); err == nil {
			return pm.d
		}
	}
	return distroUnknown
}

// pm returns the right install command prefix for the detected distro.
// e.g.  pm("docker") → "sudo pacman -S --noconfirm docker"
func pm(pkg string) (string, error) {
	switch detectDistro() {
	case distroArch:
		// Prefer yay for AUR packages if available, fall back to pacman.
		if _, err := exec.LookPath("yay"); err == nil {
			return fmt.Sprintf("yay -S --noconfirm %s", pkg), nil
		}
		return fmt.Sprintf("sudo pacman -S --noconfirm %s", pkg), nil
	case distroDebian:
		return fmt.Sprintf("sudo apt-get install -y %s", pkg), nil
	case distroFedora:
		return fmt.Sprintf("sudo dnf install -y %s", pkg), nil
	case distroOpenSUSE:
		return fmt.Sprintf("sudo zypper install -y %s", pkg), nil
	case distroAlpine:
		return fmt.Sprintf("sudo apk add --no-cache %s", pkg), nil
	default:
		return "", fmt.Errorf("unknown Linux distro — install %s manually", pkg)
	}
}

// pmUpdate returns the right sync/update command for the detected distro.
func pmUpdate() string {
	switch detectDistro() {
	case distroArch:
		return "sudo pacman -Sy"
	case distroDebian:
		return "sudo apt-get update -y"
	case distroFedora:
		return "sudo dnf check-update -y || true"
	case distroOpenSUSE:
		return "sudo zypper refresh"
	case distroAlpine:
		return "sudo apk update"
	default:
		return "true"
	}
}

func runSh(script string) error {
	cmd := exec.Command("sh", "-c", script)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// binInstall downloads a single static binary directly to /usr/local/bin.
// Used for tools that don't have distro packages (kind, terragrunt, argocd).
func binInstall(name, url string) error {
	return runSh(fmt.Sprintf(
		`curl -fsSL -o /tmp/%s %s && chmod +x /tmp/%s && sudo mv /tmp/%s /usr/local/bin/%s`,
		name, url, name, name, name,
	))
}

// ─── Installers ──────────────────────────────────────────────────────────────

func installDocker() error {
	if isMacOS() {
		return runSh("brew install --cask docker")
	}
	// Arch: docker is in the official repos; enable and start the service too.
	if detectDistro() == distroArch {
		install, err := pm("docker")
		if err != nil {
			return err
		}
		return runSh(install + " && sudo systemctl enable --now docker && sudo usermod -aG docker $USER")
	}
	// Every other Linux distro: use Docker's universal install script.
	return runSh("curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER")
}

func installKind() error {
	if isMacOS() {
		return runSh("brew install kind")
	}
	// kind ships as a single static binary — no distro package needed.
	url := fmt.Sprintf("https://kind.sigs.k8s.io/dl/latest/kind-linux-%s", arch())
	return binInstall("kind", url)
}

func installKubectl() error {
	if isMacOS() {
		return runSh("brew install kubectl")
	}
	// Arch has kubectl in the community/extra repo.
	if detectDistro() == distroArch {
		install, err := pm("kubectl")
		if err != nil {
			return err
		}
		return runSh(install)
	}
	// Other Linux: download the official static binary.
	return runSh(fmt.Sprintf(
		`curl -fsSLo /tmp/kubectl "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/%s/kubectl" \
  && chmod +x /tmp/kubectl && sudo mv /tmp/kubectl /usr/local/bin/kubectl`, arch()))
}

func installHelm() error {
	if isMacOS() {
		return runSh("brew install helm")
	}
	if detectDistro() == distroArch {
		install, err := pm("helm")
		if err != nil {
			return err
		}
		return runSh(install)
	}
	// Universal script works on all Linux distros.
	return runSh("curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash")
}

func installTerraform() error {
	if isMacOS() {
		return runSh("brew tap hashicorp/tap && brew install hashicorp/tap/terraform")
	}
	switch detectDistro() {
	case distroArch:
		// terraform is in the AUR; yay handles it, pacman falls back to binary.
		if _, err := exec.LookPath("yay"); err == nil {
			return runSh("yay -S --noconfirm terraform")
		}
		// No AUR helper — download the zip from HashiCorp directly.
		return runSh(fmt.Sprintf(
			`curl -fsSL "https://releases.hashicorp.com/terraform/$(curl -s https://checkpoint-api.hashicorp.com/v1/check/terraform | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)/terraform_$(curl -s https://checkpoint-api.hashicorp.com/v1/check/terraform | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)_linux_%s.zip" -o /tmp/tf.zip \
  && unzip -o /tmp/tf.zip -d /tmp && sudo mv /tmp/terraform /usr/local/bin/terraform && rm /tmp/tf.zip`, arch()))
	case distroDebian:
		return runSh(`sudo apt-get update -y && sudo apt-get install -y gnupg software-properties-common curl && \
  curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp.gpg && \
  echo "deb [signed-by=/usr/share/keyrings/hashicorp.gpg] https://apt.releases.hashicorp.com $(. /etc/os-release && echo $VERSION_CODENAME) main" \
    | sudo tee /etc/apt/sources.list.d/hashicorp.list && \
  sudo apt-get update && sudo apt-get install -y terraform`)
	case distroFedora:
		return runSh(`sudo dnf install -y dnf-plugins-core && \
  sudo dnf config-manager --add-repo https://rpm.releases.hashicorp.com/fedora/hashicorp.repo && \
  sudo dnf install -y terraform`)
	case distroOpenSUSE:
		return runSh(`sudo zypper addrepo https://rpm.releases.hashicorp.com/SLES/hashicorp.repo && \
  sudo zypper install -y terraform`)
	default:
		return runSh(fmt.Sprintf(
			`curl -fsSL "https://releases.hashicorp.com/terraform/$(curl -s https://checkpoint-api.hashicorp.com/v1/check/terraform | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)/terraform_$(curl -s https://checkpoint-api.hashicorp.com/v1/check/terraform | grep -o '"current_version":"[^"]*"' | cut -d'"' -f4)_linux_%s.zip" -o /tmp/tf.zip \
  && unzip -o /tmp/tf.zip -d /tmp && sudo mv /tmp/terraform /usr/local/bin/terraform && rm /tmp/tf.zip`, arch()))
	}
}

func installTerragrunt() error {
	if isMacOS() {
		return runSh("brew install terragrunt")
	}
	if detectDistro() == distroArch {
		if _, err := exec.LookPath("yay"); err == nil {
			return runSh("yay -S --noconfirm terragrunt")
		}
	}
	// All Linux: single static binary from GitHub Releases.
	url := fmt.Sprintf(
		"https://github.com/gruntwork-io/terragrunt/releases/latest/download/terragrunt_linux_%s", arch())
	return binInstall("terragrunt", url)
}

func installArgoCD() error {
	if isMacOS() {
		return runSh("brew install argocd")
	}
	if detectDistro() == distroArch {
		if _, err := exec.LookPath("yay"); err == nil {
			return runSh("yay -S --noconfirm argocd")
		}
	}
	// All Linux: single static binary from GitHub Releases.
	url := fmt.Sprintf(
		"https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-%s", arch())
	return binInstall("argocd", url)
}

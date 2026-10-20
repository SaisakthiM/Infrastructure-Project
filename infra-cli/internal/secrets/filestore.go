package secrets

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
)

// The OS keychain is unavailable on WSL and on most headless servers (there is
// no Secret Service / D-Bus session), and go-keyring then fails every call.
// Rather than abort `configure`, secrets fall back to a private JSON file.
// The file is plain text protected only by file permissions (0600, in a 0700
// folder) — the same trust level as the terraform.tfvars files the CLI writes
// next to the Terraform sources.

var (
	fileMu         sync.Mutex
	fallbackWarned bool
)

func fileStorePath() string {
	return filepath.Join(config.Dir(), "secrets.json")
}

func readFileStore() map[string]string {
	m := map[string]string{}
	b, err := os.ReadFile(fileStorePath())
	if err != nil {
		return m
	}
	_ = json.Unmarshal(b, &m)
	return m
}

func fileGet(k string) (string, bool) {
	fileMu.Lock()
	defer fileMu.Unlock()
	v, ok := readFileStore()[k]
	return v, ok && v != ""
}

func fileSet(k, v string) error {
	fileMu.Lock()
	defer fileMu.Unlock()
	m := readFileStore()
	m[k] = v
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(config.Dir(), 0700); err != nil {
		return err
	}
	tmp := fileStorePath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, fileStorePath())
}

func warnFallbackOnce(cause error) {
	if fallbackWarned {
		return
	}
	fallbackWarned = true
	ui.Warn("No OS keychain available (%v).", cause)
	ui.Dim.Printf("  Secrets are stored in %s instead (owner-only permissions).\n", fileStorePath())
}

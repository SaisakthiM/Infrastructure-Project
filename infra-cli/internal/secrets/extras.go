package secrets

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/vars"
)

// The generators in secrets.go only know the variables that existed when they
// were written. Everything else an environment declares in variable.tf —
// smtp_user, smtp_password, a new api key you just added — is handled here:
//
//   - the CLI reads variable.tf to learn what an environment needs,
//   - asks for the values that are still missing (PromptMissing / SaveAnswers),
//   - stores each answer as a ready-to-write `name = value` line (in the same
//     keychain / fallback file as every other secret), and
//   - re-appends those lines whenever terraform.tfvars is regenerated.
//
// Values you typed into a tfvars file by hand are adopted the first time the
// file is regenerated instead of being silently overwritten.

// Environments that have Terraform variables.
var tfvarsEnvs = []string{"prod-gateway", "prod-docker", "prod-social", "prod-infra", "prod-manage"}

const extraPrefix = "var."

// SetExtra stores the rendered `name = value` line for an extra variable.
func SetExtra(env, name, assignment string) error { return Set(env, extraPrefix+name, assignment) }

// GetExtra returns the stored `name = value` line ("" if none).
func GetExtra(env, name string) string { return Get(env, extraPrefix+name) }

func ensureNL(s string) string {
	if strings.HasSuffix(s, "\n") {
		return s
	}
	return s + "\n"
}

// reconcileExtras runs right after an environment's terraform.tfvars was
// regenerated. For every declared variable the generator did not provide a
// value for, it appends the stored value (adopting a hand-written one from the
// previous file if nothing is stored yet).
func reconcileExtras(env, dir string, old map[string]string) error {
	declared, err := vars.ParseDir(dir)
	if err != nil || len(declared) == 0 {
		return nil // an environment without .tf files has nothing to reconcile
	}
	path := filepath.Join(dir, "terraform.tfvars")
	cur, _ := vars.ReadTfvars(path)

	var add, drop []string
	for _, v := range declared {
		raw, has := cur[v.Name]
		if has && !vars.IsEmptyValue(raw) {
			continue // the generator wrote a real value
		}
		stored := GetExtra(env, v.Name)
		if stored == "" && !has {
			if o, ok := old[v.Name]; ok && !vars.IsEmptyValue(o) {
				stored = v.Name + " = " + o + "\n"
				_ = SetExtra(env, v.Name, stored) // adopt what was typed by hand
			}
		}
		if stored == "" {
			continue
		}
		if has {
			drop = append(drop, v.Name) // a blank generated line is replaced, never duplicated
		}
		add = append(add, ensureNL(stored))
	}
	if len(drop) > 0 {
		if b, err := os.ReadFile(path); err == nil {
			if err := os.WriteFile(path, []byte(vars.RemoveKeys(string(b), drop...)), 0600); err != nil {
				return err
			}
		}
	}
	return vars.AppendAssignments(path, add)
}

// MissingVar is a declared variable that still has no value.
type MissingVar struct {
	Env         string `json:"env"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Sensitive   bool   `json:"sensitive"`
	Multiline   bool   `json:"multiline"`
	CanGenerate bool   `json:"can_generate"`
	ReuseFrom   string `json:"reuse_from,omitempty"` // another environment that already has a value
	v           vars.Var
}

func envDirOf(cfg *config.Config, env string) string {
	return filepath.Join(cfg.InfraDir, "environments", env)
}

func canGenerate(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "secret_key") || strings.HasSuffix(n, "_secret") ||
		strings.Contains(n, "webhook_secret") || strings.HasSuffix(n, "jwt_secret")
}

func isMultiline(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "ssh_key") || strings.Contains(n, "private_key") || strings.HasSuffix(n, "_pem")
}

// CollectMissing lists the variables of the given environments (all when none
// are named) that terraform would still ask for. Call GenerateAll first so the
// tfvars files reflect what the CLI can already fill in.
func CollectMissing(cfg *config.Config, envs ...string) ([]MissingVar, error) {
	if len(envs) == 0 {
		envs = tfvarsEnvs
	}
	var out []MissingVar
	for _, env := range envs {
		dir := envDirOf(cfg, env)
		if st, err := os.Stat(dir); err != nil || !st.IsDir() {
			continue
		}
		miss, err := vars.Missing(dir)
		if err != nil {
			return nil, fmt.Errorf("reading variables of %s: %w", env, err)
		}
		for _, v := range miss {
			m := MissingVar{
				Env: env, Name: v.Name, Description: v.Description, Type: v.Type,
				Sensitive: v.Sensitive, Multiline: isMultiline(v.Name),
				CanGenerate: v.Sensitive && v.IsString() && canGenerate(v.Name), v: v,
			}
			for _, other := range tfvarsEnvs {
				if other != env && GetExtra(other, v.Name) != "" {
					m.ReuseFrom = other
					break
				}
			}
			out = append(out, m)
		}
	}
	return out, nil
}

// PromptMissing asks, in the terminal, for every variable that has no value
// yet, stores the answers and regenerates the tfvars files. It returns how many
// variables were filled in.
func PromptMissing(cfg *config.Config, envs ...string) (int, error) {
	missing, err := CollectMissing(cfg, envs...)
	if err != nil || len(missing) == 0 {
		return 0, err
	}

	fmt.Println()
	ui.Warn("%d variable(s) declared in your environments have no value yet:", len(missing))
	for _, m := range missing {
		ui.Dim.Printf("    %s / %s\n", m.Env, m.Name)
	}
	fmt.Println()

	filled := 0
	for _, m := range missing {
		label := fmt.Sprintf("  %s → %s", m.Env, m.Name)
		if m.Description != "" {
			ui.Dim.Printf("  %s\n", m.Description)
		}

		if m.ReuseFrom != "" && ui.Confirm(fmt.Sprintf("  Reuse the value you gave for %s in %s?", m.Name, m.ReuseFrom)) {
			if err := SetExtra(m.Env, m.Name, GetExtra(m.ReuseFrom, m.Name)); err != nil {
				return filled, err
			}
			filled++
			continue
		}

		var val string
		switch {
		case m.CanGenerate:
			val = ui.Prompt(label+" (Enter = generate a random one)", "")
			if val == "" {
				val = randomSecret()
				ui.Dim.Printf("  %s [auto-generated]\n", m.Name)
			}
		case m.Multiline:
			val = ui.PromptMultiline(label)
		case m.Sensitive:
			val = ui.PromptSecret(label, false)
		default:
			val = ui.Prompt(label, "")
		}
		if strings.TrimSpace(val) == "" {
			ui.Warn("  Skipping %s (empty) — terraform will prompt for it at deploy time", m.Name)
			continue
		}
		line, err := vars.FormatAssignment(m.v, val)
		if err != nil {
			ui.Warn("  %v — skipped", err)
			continue
		}
		if err := SetExtra(m.Env, m.Name, line); err != nil {
			return filled, fmt.Errorf("storing %s/%s: %w", m.Env, m.Name, err)
		}
		filled++
	}

	if filled > 0 {
		if err := SyncTfvars(cfg); err != nil {
			return filled, err
		}
	}
	return filled, nil
}

// Answer is one value supplied through the web UI.
type Answer struct {
	Env   string `json:"env"`
	Name  string `json:"name"`
	Value string `json:"value"`
}

// SaveAnswers stores values for declared variables (non-interactive) and
// regenerates the tfvars files.
func SaveAnswers(cfg *config.Config, answers []Answer) (int, error) {
	saved := 0
	for _, a := range answers {
		if strings.TrimSpace(a.Value) == "" {
			continue
		}
		dir := envDirOf(cfg, a.Env)
		declared, err := vars.ParseDir(dir)
		if err != nil {
			return saved, err
		}
		var found *vars.Var
		for i := range declared {
			if declared[i].Name == a.Name {
				found = &declared[i]
				break
			}
		}
		if found == nil {
			return saved, fmt.Errorf("%s does not declare a variable named %q", a.Env, a.Name)
		}
		line, err := vars.FormatAssignment(*found, a.Value)
		if err != nil {
			return saved, err
		}
		if err := SetExtra(a.Env, a.Name, line); err != nil {
			return saved, err
		}
		saved++
	}
	if saved > 0 {
		if err := SyncTfvars(cfg); err != nil {
			return saved, err
		}
	}
	return saved, nil
}

// GenerateValue returns a fresh random value for variables that can be generated.
func GenerateValue() string { return randomSecret() }

// Preflight makes sure the given environments (all when none are named) have a
// value for every variable Terraform requires. Saved secrets are applied first;
// whatever is still missing is asked for when interactive is true, otherwise it
// is returned so the caller (web UI, CI) can report it.
func Preflight(cfg *config.Config, envs []string, interactive bool) ([]MissingVar, error) {
	if err := SyncTfvars(cfg); err != nil {
		return nil, err
	}
	missing, err := CollectMissing(cfg, envs...)
	if err != nil || len(missing) == 0 {
		return nil, err
	}
	if !interactive {
		return missing, nil
	}
	if _, err := PromptMissing(cfg, envs...); err != nil {
		return nil, err
	}
	return CollectMissing(cfg, envs...)
}

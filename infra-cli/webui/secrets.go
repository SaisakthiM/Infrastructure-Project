package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/vars"
)

// registerSecretRoutes wires the Secrets panel: the named keychain entries the
// terminal `configure` step owns, plus every declared variable still without a
// value. Values are never read back by the browser — it only learns whether an
// entry has a value, and sends new ones.
func registerSecretRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/secrets", handleSecretsList)
	mux.HandleFunc("/api/secrets/save", guardDashboard(handleSecretsSave))
	mux.HandleFunc("/api/secrets/clear", guardDashboard(handleSecretsClear))
}

// entryJSON is one row of the secrets table.
type entryJSON struct {
	Env         string `json:"env"`
	Key         string `json:"key"`
	Label       string `json:"label"`
	Kind        string `json:"kind"`  // keychain | variable
	Class       string `json:"class"` // credential | api_key | ssh_key
	App         string `json:"app"`   // the ward this value belongs to
	Hint        string `json:"hint,omitempty"`
	Set         bool   `json:"set"`
	Written     bool   `json:"written"` // present and non-blank in terraform.tfvars
	Multiline   bool   `json:"multiline"`
	Sensitive   bool   `json:"sensitive"`
	Internal    bool   `json:"internal"`
	CanGenerate bool   `json:"can_generate"`
	Source      string `json:"source,omitempty"` // where an already-set value comes from
	Description string `json:"description,omitempty"`
	Type        string `json:"type,omitempty"`
	ReuseFrom   string `json:"reuse_from,omitempty"`
}

// environments with a directory on disk, in registry order.
func secretEnvs(cfg *config.Config) []string {
	var out []string
	for _, env := range []string{"prod-gateway", "prod-docker", "prod-social", "prod-infra", "prod-manage"} {
		if st, err := os.Stat(filepath.Join(cfg.InfraDir, "environments", env)); err == nil && st.IsDir() {
			out = append(out, env)
		}
	}
	if len(out) == 0 {
		return []string{"prod-docker", "prod-social", "prod-infra", "prod-gateway"}
	}
	return out
}

func envDir(cfg *config.Config, env string) string {
	return filepath.Join(cfg.InfraDir, "environments", env)
}

// varValues returns name -> raw tfvars expression for one environment.
func varValues(cfg *config.Config, env string) map[string]string {
	m, _ := vars.ReadTfvars(filepath.Join(envDir(cfg, env), "terraform.tfvars"))
	if m == nil {
		m = map[string]string{}
	}
	return m
}

func hasValue(m map[string]string, name string) bool {
	raw, ok := m[name]
	return ok && !vars.IsEmptyValue(raw)
}

func isCatalogued(env, name string) bool {
	for _, d := range secrets.AllSecrets {
		if d.Env == env && d.Key == name {
			return true
		}
	}
	return false
}

// collectEntries builds the whole panel: the keychain catalogue first (whether
// or not it has a value), then the declared variables terraform would still
// prompt for. Variables the generators fill from config are left out — those
// belong to the Configure panel.
func collectEntries(cfg *config.Config) []entryJSON {
	var out []entryJSON
	byEnv := map[string][]secrets.SecretDef{}
	for _, d := range secrets.AllSecrets {
		byEnv[d.Env] = append(byEnv[d.Env], d)
	}

	for _, env := range secretEnvs(cfg) {
		values := varValues(cfg, env)
		for _, d := range byEnv[env] {
			class, app, hint := d.Class, d.App, d.Hint
			if class == "" {
				class = secrets.ClassOf(d.Key)
			}
			if app == "" {
				app = secrets.AppOf(d.Key)
			}
			if hint == "" {
				hint = secrets.HintFor(d.Key)
			}
			e := entryJSON{
				Env: env, Key: d.Key, Label: d.Label, Kind: "keychain",
				Class: class, App: app, Hint: hint,
				Set: secrets.Has(env, d.Key), Written: hasValue(values, d.Key),
				Multiline: d.Multiline, Sensitive: true, Internal: d.Internal,
				CanGenerate: d.Generate,
			}
			if e.Set && !e.Written {
				e.Source = "stored, not yet written to tfvars"
			}
			out = append(out, e)
		}

		for _, m := range missingVariables(cfg, env) {
			if isCatalogued(env, m.Name) {
				continue // the keychain row above already covers it
			}
			out = append(out, entryJSON{
				Env: env, Key: m.Name, Label: m.Name, Kind: "variable",
				Class: secrets.ClassOf(m.Name), App: secrets.AppOf(m.Name),
				Hint:  secrets.HintFor(m.Name),
				Multiline: m.Multiline, Sensitive: m.Sensitive,
				CanGenerate: m.CanGenerate, Description: m.Description,
				Type: m.Type, ReuseFrom: m.ReuseFrom,
			})
		}
	}
	return out
}

// missingVariables lists what terraform would still ask for in one environment,
// without writing anything: an environment that has no .tf files returns none.
func missingVariables(cfg *config.Config, env string) []secrets.MissingVar {
	if st, err := os.Stat(envDir(cfg, env)); err != nil || !st.IsDir() {
		return nil
	}
	miss, err := secrets.CollectMissing(cfg, env)
	if err != nil {
		return nil
	}
	return miss
}

// GET /api/secrets
func handleSecretsList(w http.ResponseWriter, r *http.Request) {
	cfg := loadCfg()
	if !cfg.InfraExists() {
		jsonError(w, http.StatusPreconditionFailed, "no infrastructure folder selected")
		return
	}
	entries := collectEntries(cfg)
	if entries == nil {
		entries = []entryJSON{}
	}
	writeJSON(w, map[string]interface{}{
		"entries":    entries,
		"envs":       secretEnvs(cfg),
		"keychain":   secrets.KeychainAvailable(),
		"store_file": config.Dir(),
	})
}

// saveRequest carries new values only. An empty Value means "leave as is" for
// both kinds of entry — clearing is an explicit call to /api/secrets/clear.
type saveRequest struct {
	Answers []secrets.Answer `json:"answers"`
}

// POST /api/secrets/save {answers:[{env,name,value}]}
func handleSecretsSave(w http.ResponseWriter, r *http.Request) {
	cfg := loadCfg()
	if !cfg.InfraExists() {
		jsonError(w, http.StatusPreconditionFailed, "no infrastructure folder selected")
		return
	}
	var req saveRequest
	if err := decode(r, &req); err != nil {
		jsonError(w, http.StatusBadRequest, "bad request")
		return
	}

	var asked []secrets.Answer // declared variables, stored as tfvars lines
	saved := 0
	for _, a := range req.Answers {
		if strings.TrimSpace(a.Value) == "" {
			continue
		}
		if isCatalogued(a.Env, a.Name) {
			if err := secrets.Set(a.Env, a.Name, a.Value); err != nil {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			saved++
			continue
		}
		asked = append(asked, a)
	}

	if len(asked) > 0 {
		n, err := secrets.SaveAnswers(cfg, asked)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		saved += n
	}
	if saved > 0 {
		if err := secrets.SyncTfvars(cfg); err != nil {
			writeJSON(w, map[string]interface{}{
				"saved":   saved,
				"warning": "stored, but the tfvars files could not be refreshed: " + err.Error(),
			})
			return
		}
	}
	// A stored catalogue value can also make a variable that was already
	// "present" complete, so re-list rather than report counts alone.
	writeJSON(w, map[string]interface{}{"saved": saved, "entries": collectEntries(cfg)})
}

// guardDashboard wraps a state-changing secrets endpoint. The dashboard binds a
// port with no login, so these POSTs refuse anything that did not come from the
// page itself: a custom header (a cross-origin page cannot set one without a
// CORS preflight, and this server sends no CORS headers) plus an Origin or
// Referer that matches the host being talked to.
func guardDashboard(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "POST only", http.StatusMethodNotAllowed)
			return
		}
		if r.Header.Get("X-Infra-Dashboard") != "1" {
			jsonError(w, http.StatusForbidden, "this endpoint only accepts the dashboard page")
			return
		}
		from := r.Header.Get("Origin")
		if from == "" {
			from = r.Header.Get("Referer")
		}
		if from != "" && !sameHost(from, r.Host) {
			jsonError(w, http.StatusForbidden, "cross-origin request refused")
			return
		}
		next(w, r)
	}
}

func sameHost(raw, host string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return false
	}
	return strings.EqualFold(u.Host, host)
}

func decode(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// POST /api/secrets/clear {env, name}
func handleSecretsClear(w http.ResponseWriter, r *http.Request) {
	cfg := loadCfg()
	if !cfg.InfraExists() {
		jsonError(w, http.StatusPreconditionFailed, "no infrastructure folder selected")
		return
	}
	var req struct {
		Env  string `json:"env"`
		Name string `json:"name"`
	}
	if err := decode(r, &req); err != nil || req.Env == "" || req.Name == "" {
		jsonError(w, http.StatusBadRequest, "bad request")
		return
	}

	if isCatalogued(req.Env, req.Name) {
		if err := secrets.Delete(req.Env, req.Name); err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
	} else if err := secrets.ClearExtra(req.Env, req.Name); err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Drop the generated line so terraform asks again instead of deploying with
	// the old value. A hand-written tfvars is only touched for blank/absent keys.
	if err := secrets.SyncTfvars(cfg); err != nil {
		writeJSON(w, map[string]interface{}{
			"cleared": fmt.Sprintf("%s/%s", req.Env, req.Name),
			"warning": "cleared, but the tfvars files could not be refreshed: " + err.Error(),
			"entries": collectEntries(cfg),
		})
		return
	}
	writeJSON(w, map[string]interface{}{
		"cleared": fmt.Sprintf("%s/%s", req.Env, req.Name),
		"entries": collectEntries(cfg),
	})
}

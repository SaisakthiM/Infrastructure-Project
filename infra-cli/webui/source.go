package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/source"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/sourceops"
)

// registerSourceRoutes wires the "Source & Sync" and "Variables" panels.
func registerSourceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/source", handleSourceInfo)
	mux.HandleFunc("/api/source/plan", handleSourcePlan)
	mux.HandleFunc("/api/source/use", handleSourceUse)
	mux.HandleFunc("/api/source/sync", handleSourceSync)
	mux.HandleFunc("/api/variables/missing", handleVarsMissing)
	mux.HandleFunc("/api/variables/save", handleVarsSave)
	mux.HandleFunc("/api/variables/generate", handleVarsGenerate)
}

func loadCfg() *config.Config {
	cfg, err := config.Load()
	if err != nil || cfg == nil {
		return &config.Config{}
	}
	return cfg
}

func jsonError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// GET /api/source
func handleSourceInfo(w http.ResponseWriter, r *http.Request) {
	cfg := loadCfg()
	home, _ := os.UserHomeDir()
	cwd, _ := os.Getwd()

	out := map[string]interface{}{
		"infra_dir":  cfg.InfraDir,
		"is_local":   cfg.IsLocal(),
		"exists":     cfg.InfraExists(),
		"candidates": source.Candidates(home, cwd, cfg.InfraDir),
	}
	if cfg.InfraExists() {
		info, _ := source.Inspect(cfg.InfraDir)
		out["info"] = info
	}
	writeJSON(w, out)
}

// POST /api/source/plan {path} -> environments whose state could be carried over
func handleSourcePlan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "bad request")
		return
	}
	envs, err := sourceops.PlanUse(loadCfg(), req.Path)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, map[string]interface{}{"state_envs": envs})
}

// POST /api/source/use {path, carry_state}
func handleSourceUse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Path       string `json:"path"`
		CarryState bool   `json:"carry_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "bad request")
		return
	}
	res, err := sourceops.Use(loadCfg(), req.Path, req.CarryState)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, res)
}

// POST /api/source/sync {remote, branch, autostash, rebase, no_fetch, dry_run}
// Streams like every other job; the result summary is the last lines of output.
func handleSourceSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Remote    string `json:"remote"`
		Branch    string `json:"branch"`
		AutoStash bool   `json:"autostash"`
		Rebase    bool   `json:"rebase"`
		NoFetch   bool   `json:"no_fetch"`
		DryRun    bool   `json:"dry_run"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	cfg := loadCfg()
	job := newJob("sync", "source")
	writeJSON(w, map[string]string{"job_id": job.ID})

	go func() {
		jw := jobWriter{job: job}
		res, err := sourceops.Sync(cfg, source.SyncOptions{
			Remote: req.Remote, Branch: req.Branch, AutoStash: req.AutoStash,
			Rebase: req.Rebase, NoFetch: req.NoFetch, DryRun: req.DryRun,
		}, jw)
		if err != nil {
			fmt.Fprintf(jw, "error: %v\n", err)
			job.finish(err)
			return
		}
		fmt.Fprintln(jw)
		switch {
		case res.Updated && len(res.AffectedEnvs) > 0:
			fmt.Fprintf(jw, "Synced. Affected environments: %s\n", strings.Join(res.AffectedEnvs, ", "))
			fmt.Fprintln(jw, "Open Deploy and apply them (state and caches were kept).")
		case res.Updated:
			fmt.Fprintln(jw, "Synced. No environment is affected by these changes.")
		case len(res.AffectedEnvs) > 0:
			fmt.Fprintf(jw, "Would affect: %s\n", strings.Join(res.AffectedEnvs, ", "))
		}
		if res.VariablesTF {
			fmt.Fprintln(jw, "A variable.tf changed — check the Variables section for new values to enter.")
		}
		job.finish(nil)
	}()
}

// missingForEnv returns the variables still without a value for env ("all" = every environment).
func missingForEnv(cfg *config.Config, env string) []secrets.MissingVar {
	var targets []string
	if env != "" && env != "all" {
		targets = []string{env}
	}
	missing, err := secrets.Preflight(cfg, targets, false)
	if err != nil {
		return nil
	}
	return missing
}

// GET /api/variables/missing[?env=prod-docker]
func handleVarsMissing(w http.ResponseWriter, r *http.Request) {
	cfg := loadCfg()
	if !cfg.InfraExists() {
		jsonError(w, http.StatusPreconditionFailed, "no infrastructure folder selected")
		return
	}
	missing := missingForEnv(cfg, r.URL.Query().Get("env"))
	if missing == nil {
		missing = []secrets.MissingVar{}
	}
	writeJSON(w, map[string]interface{}{"missing": missing})
}

// POST /api/variables/save {answers:[{env,name,value}]}
func handleVarsSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Answers []secrets.Answer `json:"answers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "bad request")
		return
	}
	cfg := loadCfg()
	n, err := secrets.SaveAnswers(cfg, req.Answers)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}
	left := missingForEnv(cfg, "all")
	if left == nil {
		left = []secrets.MissingVar{}
	}
	writeJSON(w, map[string]interface{}{"saved": n, "missing": left})
}

// POST /api/variables/generate -> a fresh random value (for *_secret_key style variables)
func handleVarsGenerate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]string{"value": secrets.GenerateValue()})
}

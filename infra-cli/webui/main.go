// social-platform-webui is a companion web UI that provides a browser-based
// interface for all social-platform CLI operations. It communicates with the
// same infrastructure and config as the CLI binary.
//
// Usage:
//
//	social-platform-webui              # starts on http://localhost:8080
//	social-platform-webui --port 9090  # custom port
package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/checker"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/deploy"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/release"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/secrets"
)

//go:embed static
var staticFiles embed.FS

// ─── job store ───────────────────────────────────────────────────────────────

type JobStatus string

const (
	JobRunning JobStatus = "running"
	JobDone    JobStatus = "done"
	JobFailed  JobStatus = "failed"
)

type Job struct {
	ID      string    `json:"id"`
	Status  JobStatus `json:"status"`
	Command string    `json:"command"`
	Env     string    `json:"env"`
	StartAt time.Time `json:"started_at"`
	EndAt   time.Time `json:"ended_at,omitempty"`
	Error   string    `json:"error,omitempty"`

	mu  sync.Mutex
	out strings.Builder
}

var (
	jobsMu sync.Mutex
	jobs   = map[string]*Job{}
	jobSeq int
)

func newJob(command, env string) *Job {
	jobsMu.Lock()
	defer jobsMu.Unlock()
	jobSeq++
	j := &Job{
		ID:      fmt.Sprintf("job-%d", jobSeq),
		Status:  JobRunning,
		Command: command,
		Env:     env,
		StartAt: time.Now(),
	}
	jobs[j.ID] = j
	return j
}

func getJob(id string) *Job {
	jobsMu.Lock()
	defer jobsMu.Unlock()
	return jobs[id]
}

func (j *Job) write(p []byte) {
	j.mu.Lock()
	j.out.Write(p)
	j.mu.Unlock()
}

func (j *Job) output() string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.out.String()
}

func (j *Job) finish(err error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.EndAt = time.Now()
	if err != nil {
		j.Status = JobFailed
		j.Error = err.Error()
	} else {
		j.Status = JobDone
	}
}

// ─── main ────────────────────────────────────────────────────────────────────

func main() {
	port := flag.String("port", "9000", "Port to listen on")
	flag.Parse()

	mux := http.NewServeMux()

	// Static files.
	stripped, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(stripped)))

	// Core API routes.
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/envs", handleEnvs)
	mux.HandleFunc("/api/run", handleRun)
	mux.HandleFunc("/api/job/", handleJobStream)
	mux.HandleFunc("/api/import/scan", handleImportScan)
	mux.HandleFunc("/api/import/run", handleImportRun)

	// Install routes.
	mux.HandleFunc("/api/install/check", handleInstallCheck)
	mux.HandleFunc("/api/install/releases", handleInstallReleases)
	mux.HandleFunc("/api/install/run", handleInstallRun)

	// Configure routes.
	mux.HandleFunc("/api/configure/load", handleConfigureLoad)
	mux.HandleFunc("/api/configure/save", handleConfigureSave)

	addr := ":" + *port
	fmt.Printf("\n  social-platform Web UI\n")
	fmt.Printf("  Open: http://localhost%s\n\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// ─── core handlers ────────────────────────────────────────────────────────────

func handleStatus(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	type response struct {
		InfraDir   string `json:"infra_dir"`
		ReleaseTag string `json:"release_tag"`
		Ready      bool   `json:"ready"`
		Error      string `json:"error,omitempty"`
	}
	if err != nil {
		writeJSON(w, response{Error: err.Error()})
		return
	}
	writeJSON(w, response{
		InfraDir:   cfg.InfraDir,
		ReleaseTag: cfg.ReleaseTag,
		Ready:      cfg.InfraExists(),
	})
}

func handleEnvs(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, deploy.Environments())
}

type runRequest struct {
	Command     string `json:"command"`
	Env         string `json:"env"`
	Target      string `json:"target"`
	Replace     string `json:"replace"`
	AutoApprove bool   `json:"auto_approve"`
}

func handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req runRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		http.Error(w, "infra not found — run install first", http.StatusPreconditionFailed)
		return
	}

	job := newJob(req.Command, req.Env)
	writeJSON(w, map[string]string{"job_id": job.ID})

	go func() {
		err := executeCommand(cfg, req, job)
		job.finish(err)
	}()
}

type jobWriter struct{ job *Job }

func (w jobWriter) Write(p []byte) (int, error) {
	w.job.write(p)
	return len(p), nil
}

func executeCommand(cfg *config.Config, req runRequest, job *Job) error {
	env := deploy.Environment(req.Env)
	out := jobWriter{job: job}

	switch req.Command {
	case "deploy":
		return deploy.Apply(cfg, env, req.AutoApprove, req.Target, req.Replace, out)
	case "destroy":
		return deploy.Destroy(cfg, env, req.AutoApprove, out)
	case "plan":
		return deploy.Status(cfg, env, out)
	case "logs":
		return deploy.Logs(cfg, env, out)
	default:
		return fmt.Errorf("unknown command: %s", req.Command)
	}
}

func handleJobStream(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/job/"), "/")
	jobID := parts[0]

	job := getJob(jobID)
	if job == nil {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}

	if len(parts) >= 2 && parts[1] == "stream" {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		sent := 0
		for {
			out := job.output()
			if len(out) > sent {
				chunk := out[sent:]
				for _, line := range strings.Split(chunk, "\n") {
					fmt.Fprintf(w, "data: %s\n\n", line)
				}
				sent = len(out)
				flusher.Flush()
			}

			if job.Status != JobRunning {
				fmt.Fprintf(w, "event: done\ndata: %s\n\n", job.Status)
				flusher.Flush()
				return
			}

			select {
			case <-r.Context().Done():
				return
			case <-time.After(200 * time.Millisecond):
			}
		}
	}

	writeJSON(w, map[string]interface{}{
		"id":      job.ID,
		"status":  job.Status,
		"command": job.Command,
		"env":     job.Env,
		"output":  job.output(),
		"error":   job.Error,
	})
}

func handleImportScan(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		http.Error(w, "infra not found — run install first", http.StatusPreconditionFailed)
		return
	}
	candidates, err := deploy.DetectImportCandidates(cfg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	type candidateJSON struct {
		TFAddress  string `json:"tf_address"`
		Kind       string `json:"kind"`
		DockerName string `json:"docker_name"`
		ImportID   string `json:"import_id"`
	}
	var out []candidateJSON
	for _, c := range candidates {
		out = append(out, candidateJSON{
			TFAddress:  c.Entry.TFAddress,
			Kind:       string(c.Entry.Kind),
			DockerName: c.Entry.DockerName,
			ImportID:   c.ImportID,
		})
	}
	if out == nil {
		out = []candidateJSON{}
	}
	writeJSON(w, out)
}

type importRunRequest struct {
	TFAddress  string `json:"tf_address"`
	ImportID   string `json:"import_id"`
	DockerName string `json:"docker_name"`
	Kind       string `json:"kind"`
}

func handleImportRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req importRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		http.Error(w, "infra not found", http.StatusPreconditionFailed)
		return
	}
	candidate := deploy.ImportCandidate{
		Entry: deploy.ImportEntry{
			TFAddress:  req.TFAddress,
			Kind:       deploy.ResourceKind(req.Kind),
			DockerName: req.DockerName,
		},
		ImportID: req.ImportID,
	}
	if importErr := deploy.RunImport(cfg, candidate); importErr != nil {
		writeJSON(w, map[string]string{"error": importErr.Error()})
		return
	}
	writeJSON(w, map[string]string{"status": "imported"})
}

// ─── install handlers ─────────────────────────────────────────────────────────

// GET /api/install/check — returns prerequisite check results.
func handleInstallCheck(w http.ResponseWriter, r *http.Request) {
	results := checker.CheckAll()
	type toolResult struct {
		Name      string `json:"name"`
		Installed bool   `json:"installed"`
		Version   string `json:"version"`
		ManualURL string `json:"manual_url"`
	}
	out := make([]toolResult, len(results))
	for i, res := range results {
		out[i] = toolResult{
			Name:      res.Tool.Name,
			Installed: res.Installed,
			Version:   res.Version,
			ManualURL: res.Tool.ManualURL,
		}
	}
	writeJSON(w, out)
}

// GET /api/install/releases — returns list of GitHub releases.
func handleInstallReleases(w http.ResponseWriter, r *http.Request) {
	releases, err := release.ListReleases()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	type relJSON struct {
		Tag string `json:"tag"`
	}
	out := make([]relJSON, len(releases))
	for i, rel := range releases {
		out[i] = relJSON{Tag: rel.TagName}
	}
	writeJSON(w, out)
}

// POST /api/install/run — downloads + extracts the chosen release tag.
// Body: { "tag": "v1.2.3" }  (empty or "latest" picks the newest release)
func handleInstallRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Tag string `json:"tag"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	job := newJob("install", req.Tag)
	writeJSON(w, map[string]string{"job_id": job.ID})

	go func() {
		jw := jobWriter{job: job}

		releases, err := release.ListReleases()
		if err != nil {
			fmt.Fprintf(jw, "error listing releases: %v\n", err)
			job.finish(err)
			return
		}

		var chosen *release.GHRelease
		if req.Tag == "" || req.Tag == "latest" {
			if len(releases) == 0 {
				r, e := release.LatestRelease()
				if e != nil {
					fmt.Fprintf(jw, "error: %v\n", e)
					job.finish(e)
					return
				}
				chosen = r
			} else {
				chosen = &releases[0]
			}
		} else {
			for i := range releases {
				if releases[i].TagName == req.Tag {
					chosen = &releases[i]
					break
				}
			}
			if chosen == nil {
				e := fmt.Errorf("release tag %q not found", req.Tag)
				fmt.Fprintf(jw, "error: %v\n", e)
				job.finish(e)
				return
			}
		}

		fmt.Fprintf(jw, "Selected release: %s\n", chosen.TagName)
		fmt.Fprintf(jw, "Downloading infrastructure files…\n")

		destDir := config.DefaultInfraDir()
		infraDir, err := release.DownloadAndExtract(chosen, destDir)
		if err != nil {
			fmt.Fprintf(jw, "error: %v\n", err)
			job.finish(err)
			return
		}
		fmt.Fprintf(jw, "Extracted to %s\n", infraDir)

		cfg, loadErr := config.Load()
		if loadErr != nil {
			cfg = &config.Config{}
		}
		cfg.InfraDir = infraDir
		cfg.ReleaseTag = chosen.TagName
		if saveErr := config.Save(cfg); saveErr != nil {
			fmt.Fprintf(jw, "error saving config: %v\n", saveErr)
			job.finish(saveErr)
			return
		}
		fmt.Fprintf(jw, "Configuration saved.\n")
		fmt.Fprintf(jw, "✓ Install complete — run Configure next to set your secrets.\n")
		job.finish(nil)
	}()
}

// ─── configure handlers ───────────────────────────────────────────────────────

// GET /api/configure/load — returns current non-secret config values.
func handleConfigureLoad(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil {
		cfg = &config.Config{}
	}

	type configResponse struct {
		InfraDir   string `json:"infra_dir"`
		ReleaseTag string `json:"release_tag"`

		// prod-infra
		Domain         string `json:"domain"`
		MainServerIP   string `json:"main_server_ip"`
		AtlantisGHUser string `json:"atlantis_gh_user"`
		GitopsRepoURL  string `json:"gitops_repo_url"`
		N8NPort        string `json:"n8n_port"`
		N8NHost        string `json:"n8n_host"`
		N8NProtocol    string `json:"n8n_protocol"`
		N8NUser        string `json:"n8n_user"`

		// prod-social
		SocialGitopsURL string `json:"social_gitops_repo_url"`
		SocialMinio     string `json:"social_minio_user"`
		LoadImages      bool   `json:"load_images"`

		// prod-docker
		BlogDBName       string `json:"blog_db_name"`
		BlogMinioUser    string `json:"blog_minio_user"`
		BlogAllowedHosts string `json:"blog_allowed_hosts"`
		NotesDBName      string `json:"notes_db_name"`
		NotesDBUser      string `json:"notes_db_user"`
		BankDBUser       string `json:"bank_db_user"`
		BankDBName       string `json:"bank_db_name"`
		DocDBName        string `json:"doc_db_name"`
		DocMinioUser     string `json:"doc_minio_user"`
		WhisperDBUser    string `json:"whisper_db_user"`
		WhisperDBName    string `json:"whisper_db_name"`
		WhisperDBTestDB  string `json:"whisper_db_test_db"`
		WhisperMinioUser string `json:"whisper_minio_user"`

		// prod-gateway
		LetsEncryptPath string `json:"letsencrypt_path"`
	}

	writeJSON(w, configResponse{
		InfraDir:   cfg.InfraDir,
		ReleaseTag: cfg.ReleaseTag,

		Domain:         cfg.ProdInfra.Domain,
		MainServerIP:   cfg.ProdInfra.MainServerIP,
		AtlantisGHUser: cfg.ProdInfra.AtlantisGHUser,
		GitopsRepoURL:  cfg.ProdInfra.GitopsRepoURL,
		N8NPort:        orDefault(cfg.ProdInfra.N8NPort, "5678"),
		N8NHost:        orDefault(cfg.ProdInfra.N8NHost, "0.0.0.0"),
		N8NProtocol:    orDefault(cfg.ProdInfra.N8NProtocol, "https"),
		N8NUser:        orDefault(cfg.ProdInfra.N8NUser, "admin"),

		SocialGitopsURL: cfg.ProdSocial.GitopsRepoURL,
		SocialMinio:     orDefault(cfg.ProdSocial.SocialMinio, "minio"),
		LoadImages:      cfg.ProdSocial.LoadImages,

		BlogDBName:       orDefault(cfg.ProdDocker.BlogDBName, "blog_db"),
		BlogMinioUser:    orDefault(cfg.ProdDocker.BlogMinioUser, "admin"),
		BlogAllowedHosts: orDefault(cfg.ProdDocker.BlogAllowedHosts, "['localhost','127.0.0.1']"),
		NotesDBName:      orDefault(cfg.ProdDocker.NotesDBName, "notes_app"),
		NotesDBUser:      orDefault(cfg.ProdDocker.NotesDBUser, "saisakthi"),
		BankDBUser:       orDefault(cfg.ProdDocker.BankDBUser, "bankmanagement"),
		BankDBName:       orDefault(cfg.ProdDocker.BankDBName, "bank"),
		DocDBName:        orDefault(cfg.ProdDocker.DocDBName, "book_db"),
		DocMinioUser:     orDefault(cfg.ProdDocker.DocMinioUser, "admin"),
		WhisperDBUser:    orDefault(cfg.ProdDocker.WhisperDBUser, "admin"),
		WhisperDBName:    orDefault(cfg.ProdDocker.WhisperDBName, "chat"),
		WhisperDBTestDB:  orDefault(cfg.ProdDocker.WhisperDBTestDB, "chat_test"),
		WhisperMinioUser: orDefault(cfg.ProdDocker.WhisperMinioUser, "minioadmin"),

		LetsEncryptPath: orDefault(cfg.ProdGateway.LetsEncryptPath, "/home/saisakthi/letsencrypt/"),
	})
}

// POST /api/configure/save — saves non-secret config and regenerates tfvars.
// Accepts the same flat JSON shape that /api/configure/load returns.
func handleConfigureSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Domain         string `json:"domain"`
		MainServerIP   string `json:"main_server_ip"`
		AtlantisGHUser string `json:"atlantis_gh_user"`
		GitopsRepoURL  string `json:"gitops_repo_url"`
		N8NPort        string `json:"n8n_port"`
		N8NHost        string `json:"n8n_host"`
		N8NProtocol    string `json:"n8n_protocol"`
		N8NUser        string `json:"n8n_user"`

		SocialGitopsURL string `json:"social_gitops_repo_url"`
		SocialMinio     string `json:"social_minio_user"`
		LoadImages      bool   `json:"load_images"`

		BlogDBName       string `json:"blog_db_name"`
		BlogMinioUser    string `json:"blog_minio_user"`
		BlogAllowedHosts string `json:"blog_allowed_hosts"`
		NotesDBName      string `json:"notes_db_name"`
		NotesDBUser      string `json:"notes_db_user"`
		BankDBUser       string `json:"bank_db_user"`
		BankDBName       string `json:"bank_db_name"`
		DocDBName        string `json:"doc_db_name"`
		DocMinioUser     string `json:"doc_minio_user"`
		WhisperDBUser    string `json:"whisper_db_user"`
		WhisperDBName    string `json:"whisper_db_name"`
		WhisperDBTestDB  string `json:"whisper_db_test_db"`
		WhisperMinioUser string `json:"whisper_minio_user"`

		LetsEncryptPath string `json:"letsencrypt_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request: "+err.Error(), http.StatusBadRequest)
		return
	}

	cfg, loadErr := config.Load()
	if loadErr != nil {
		cfg = &config.Config{}
	}

	cfg.ProdInfra.Domain = req.Domain
	cfg.ProdInfra.MainServerIP = req.MainServerIP
	cfg.ProdInfra.AtlantisGHUser = req.AtlantisGHUser
	cfg.ProdInfra.GitopsRepoURL = req.GitopsRepoURL
	cfg.ProdInfra.N8NPort = req.N8NPort
	cfg.ProdInfra.N8NHost = req.N8NHost
	cfg.ProdInfra.N8NProtocol = req.N8NProtocol
	cfg.ProdInfra.N8NUser = req.N8NUser

	cfg.ProdSocial.GitopsRepoURL = req.SocialGitopsURL
	cfg.ProdSocial.SocialMinio = req.SocialMinio
	cfg.ProdSocial.LoadImages = req.LoadImages

	cfg.ProdDocker.BlogDBName = req.BlogDBName
	cfg.ProdDocker.BlogMinioUser = req.BlogMinioUser
	cfg.ProdDocker.BlogAllowedHosts = req.BlogAllowedHosts
	cfg.ProdDocker.NotesDBName = req.NotesDBName
	cfg.ProdDocker.NotesDBUser = req.NotesDBUser
	cfg.ProdDocker.BankDBUser = req.BankDBUser
	cfg.ProdDocker.BankDBName = req.BankDBName
	cfg.ProdDocker.DocDBName = req.DocDBName
	cfg.ProdDocker.DocMinioUser = req.DocMinioUser
	cfg.ProdDocker.WhisperDBUser = req.WhisperDBUser
	cfg.ProdDocker.WhisperDBName = req.WhisperDBName
	cfg.ProdDocker.WhisperDBTestDB = req.WhisperDBTestDB
	cfg.ProdDocker.WhisperMinioUser = req.WhisperMinioUser

	cfg.ProdGateway.LetsEncryptPath = req.LetsEncryptPath

	if saveErr := config.Save(cfg); saveErr != nil {
		http.Error(w, "saving config: "+saveErr.Error(), http.StatusInternalServerError)
		return
	}

	if genErr := secrets.GenerateAll(cfg); genErr != nil {
		writeJSON(w, map[string]string{
			"status":  "partial",
			"warning": "config saved but tfvars generation failed: " + genErr.Error(),
		})
		return
	}

	writeJSON(w, map[string]string{"status": "ok"})
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func orDefault(v, def string) string {
	if v != "" {
		return v
	}
	return def
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

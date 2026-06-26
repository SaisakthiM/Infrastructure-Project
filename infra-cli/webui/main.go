// social-platform-webui is a companion web UI that provides a browser-based
// interface for all social-platform CLI operations. It communicates with the
// same infrastructure and config as the CLI binary.
//
// Usage:
//   social-platform-webui              # starts on http://localhost:8080
//   social-platform-webui --port 9090  # custom port
package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/deploy"
)

//go:embed static
var staticFiles embed.FS

// ─── job store ───────────────────────────────────────────────────────────────

type JobStatus string

const (
	JobRunning  JobStatus = "running"
	JobDone     JobStatus = "done"
	JobFailed   JobStatus = "failed"
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
	port := flag.String("port", "8080", "Port to listen on")
	flag.Parse()

	mux := http.NewServeMux()

	// Static files.
	stripped, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(stripped)))

	// API routes.
	mux.HandleFunc("/api/status", handleStatus)
	mux.HandleFunc("/api/envs", handleEnvs)
	mux.HandleFunc("/api/run", handleRun)
	mux.HandleFunc("/api/job/", handleJobStream) // GET /api/job/<id>/stream or /api/job/<id>
	mux.HandleFunc("/api/import/scan", handleImportScan)
	mux.HandleFunc("/api/import/run", handleImportRun)

	addr := ":" + *port
	fmt.Printf("\n  social-platform Web UI\n")
	fmt.Printf("  Open: http://localhost%s\n\n", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

// ─── handlers ────────────────────────────────────────────────────────────────

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
	Command     string `json:"command"`     // "deploy" | "destroy" | "plan" | "logs"
	Env         string `json:"env"`         // environment name
	Target      string `json:"target"`      // optional resource target
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

func executeCommand(cfg *config.Config, req runRequest, job *Job) error {
	env := deploy.Environment(req.Env)
	dir := deploy.WorkDir(cfg, env)

	if _, statErr := os.Stat(dir); statErr != nil {
		return fmt.Errorf("environment directory not found: %s", dir)
	}

	var args []string
	switch req.Command {
	case "deploy":
		if env == deploy.EnvAll {
			args = []string{"run", "--all", "apply", "--non-interactive", "--auto-approve"}
		} else {
			args = []string{"apply", "-auto-approve"}
			if req.Target != "" {
				args = append(args, "--target="+req.Target)
			}
		}
	case "destroy":
		if env == deploy.EnvAll {
			args = []string{"run", "--all", "destroy", "--non-interactive", "--auto-approve"}
		} else {
			args = []string{"destroy", "-auto-approve"}
		}
	case "plan":
		if env == deploy.EnvAll {
			args = []string{"run", "--all", "plan", "--non-interactive"}
		} else {
			args = []string{"plan"}
		}
	case "logs":
		if env == deploy.EnvAll {
			args = []string{"run", "--all", "plan", "--non-interactive", "--log-level", "debug"}
		} else {
			args = []string{"plan", "--log-level", "debug"}
		}
	default:
		return fmt.Errorf("unknown command: %s", req.Command)
	}

	cmd := exec.Command("terragrunt", args...)
	cmd.Dir = dir
	cmd.Env = os.Environ()

	pr, pw, _ := os.Pipe()
	cmd.Stdout = io.MultiWriter(pw)
	cmd.Stderr = io.MultiWriter(pw)

	if startErr := cmd.Start(); startErr != nil {
		pw.Close()
		pr.Close()
		return fmt.Errorf("starting terragrunt: %w", startErr)
	}

	// Stream output to job buffer.
	go func() {
		buf := make([]byte, 4096)
		for {
			n, readErr := pr.Read(buf)
			if n > 0 {
				job.write(buf[:n])
			}
			if readErr != nil {
				break
			}
		}
	}()

	err := cmd.Wait()
	pw.Close()
	return err
}

func handleJobStream(w http.ResponseWriter, r *http.Request) {
	// Parse job ID from path: /api/job/<id> or /api/job/<id>/stream
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/job/"), "/")
	jobID := parts[0]

	job := getJob(jobID)
	if job == nil {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}

	if len(parts) >= 2 && parts[1] == "stream" {
		// Server-Sent Events stream.
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
				// Escape for SSE format.
				for _, line := range strings.Split(chunk, "\n") {
					fmt.Fprintf(w, "data: %s\n\n", line)
				}
				sent = len(out)
				flusher.Flush()
			}

			if job.Status != JobRunning {
				status := job.Status
				fmt.Fprintf(w, "event: done\ndata: %s\n\n", status)
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

	// JSON status.
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
	TFAddress string `json:"tf_address"`
	ImportID  string `json:"import_id"`
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

// ─── helpers ─────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

// Ensure filepath is used.
var _ = filepath.Join

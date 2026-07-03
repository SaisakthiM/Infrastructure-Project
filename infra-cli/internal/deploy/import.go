// Package deploy - import.go handles terraform state import for prod-docker,
// prod-infra, and prod-gateway resources by auto-detecting running Docker
// containers, volumes, and images, then running "terragrunt import" per
// environment with a per-resource confirmation step.
package deploy

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
)

// ResourceKind classifies a resource type for import.
type ResourceKind string

const (
	KindVolume    ResourceKind = "volume"
	KindContainer ResourceKind = "container"
	// KindImage is intentionally omitted: kreuzwerker/docker v3.x does not
	// support terraform import for docker_image resources. Images are always
	// rebuilt by Terraform on the next apply.
	KindNetwork     ResourceKind = "network"      // prod-gateway
	KindHelmRelease ResourceKind = "helm_release" // prod-social
)

// ImportEntry maps a Terraform resource address to its Docker lookup name,
// scoped to a specific environment (each environment is a separate
// terragrunt working dir / state file). Env uses the existing Environment
// type from deploy.go (EnvDocker, EnvInfra, EnvGateway, ...) — NOT a
// config.Env type, which doesn't exist in this codebase.
type ImportEntry struct {
	Env        Environment
	TFAddress  string
	Kind       ResourceKind
	DockerName string
}

// ─── prod-docker catalog ──────────────────────────────────────────────────

var dockerVolumeCatalog = []ImportEntry{
	{EnvDocker, "docker_volume.notes_dist", KindVolume, "gateway_notes-dist"},
	{EnvDocker, "docker_volume.bank_dist", KindVolume, "gateway_bank-dist"},
	{EnvDocker, "docker_volume.quiz_dist", KindVolume, "gateway_quiz-dist"},
	{EnvDocker, "docker_volume.video_dist", KindVolume, "gateway_video-dist"},
	{EnvDocker, "docker_volume.api_dist", KindVolume, "gateway_api-dist"},
	{EnvDocker, "docker_volume.whisper_dist", KindVolume, "gateway_whisper-dist"},
	{EnvDocker, "docker_volume.notes_pgdata", KindVolume, "gateway_notes-pgdata"},
	{EnvDocker, "docker_volume.notes_static", KindVolume, "gateway_notes-static"},
	{EnvDocker, "docker_volume.notes_media", KindVolume, "gateway_notes-media"},
	{EnvDocker, "docker_volume.bank_pgdata", KindVolume, "gateway_bank-pgdata"},
	{EnvDocker, "docker_volume.doc_mysql", KindVolume, "gateway_doc-mysql"},
	{EnvDocker, "docker_volume.doc_minio", KindVolume, "gateway_doc-minio"},
	{EnvDocker, "docker_volume.doc_dist", KindVolume, "gateway_doc-dist"},
	{EnvDocker, "docker_volume.blog_mysql", KindVolume, "gateway_blog-mysql"},
	{EnvDocker, "docker_volume.blog_minio", KindVolume, "gateway_blog-minio"},
	{EnvDocker, "docker_volume.compiler_db_data", KindVolume, "gateway_compiler-db-data"},
	{EnvDocker, "docker_volume.compiler_server_data", KindVolume, "gateway_compiler-server-data"},
	{EnvDocker, "docker_volume.whisper_pgdata", KindVolume, "gateway_whisper-pgdata"},
	{EnvDocker, "docker_volume.whisper_minio_data", KindVolume, "whisper_minio_data"},
}

// dockerContainerCatalog: "support" containers (postgres/mysql/minio sidecars
// and *_frontend_build one-shot build containers) declared directly in
// prod-docker/main.tf, not via the docker_app module.
var dockerContainerCatalog = []ImportEntry{
	{EnvDocker, "docker_container.notes_postgres", KindContainer, "notes-postgres"},
	{EnvDocker, "docker_container.notes_frontend_build", KindContainer, "notes-frontend-build"},
	{EnvDocker, "docker_container.whisper-postgres", KindContainer, "gateway_whisper-pgdata"},
	{EnvDocker, "docker_container.whisper_minio", KindContainer, "whisper-minio"},
	{EnvDocker, "docker_container.whisper_frontend_build", KindContainer, "whisper-frontend-build"},
	{EnvDocker, "docker_container.bank_postgres", KindContainer, "bank-postgres"},
	{EnvDocker, "docker_container.bank_frontend_build", KindContainer, "bank-frontend-build"},
	{EnvDocker, "docker_container.quiz_frontend_build", KindContainer, "quiz-frontend-build"},
	{EnvDocker, "docker_container.compiler_db", KindContainer, "compiler-db"},
	{EnvDocker, "docker_container.video_frontend_build", KindContainer, "video-frontend-build"},
	{EnvDocker, "docker_container.blog_db", KindContainer, "blog-db"},
	{EnvDocker, "docker_container.blog_minio", KindContainer, "blog-minio"},
	{EnvDocker, "docker_container.blog_minio_init", KindContainer, "blog-minio-init"},
	{EnvDocker, "docker_container.api_service_frontend_build", KindContainer, "api-service-frontend-build"},
	{EnvDocker, "docker_container.doc_mysql", KindContainer, "doc-mysql"},
	{EnvDocker, "docker_container.doc_minio", KindContainer, "doc-minio"},
	{EnvDocker, "docker_container.doc_frontend_build", KindContainer, "doc-frontend-build"},
}

// dockerAppContainerCatalog: docker_container.app resource created by each
// instance of "../../modules/docker_app" inside prod-docker/main.tf.
var dockerAppContainerCatalog = []ImportEntry{
	{EnvDocker, "module.notes_backend.docker_container.app", KindContainer, "notes-backend"},
	{EnvDocker, "module.whisper_backend.docker_container.app", KindContainer, "whisper_backend"}, // underscore, not a typo
	{EnvDocker, "module.bank_backend.docker_container.app", KindContainer, "bank-backend"},
	{EnvDocker, "module.compiler_server.docker_container.app", KindContainer, "compiler-server"},
	{EnvDocker, "module.video_backend.docker_container.app", KindContainer, "video-uploader-backend"},
	{EnvDocker, "module.hospital_management.docker_container.app", KindContainer, "hospital-management"},
	{EnvDocker, "module.blog_website.docker_container.app", KindContainer, "blog-website"},
	{EnvDocker, "module.api_service_backend.docker_container.app", KindContainer, "api-service-backend"},
	{EnvDocker, "module.doc_backend.docker_container.app", KindContainer, "doc-backend"},
}

// ─── prod-infra catalog ────────────────────────────────────────────────────
// Confirmed against prod-infra/main.tf via:
//   rg "resource \"docker_(container|volume)\"" -A 6 ~/.social-platform/infra/environments/prod-infra/main.tf
//
// otel_gateway (line 54), jenkins (line 167), jenkins_agent (line 205),
// atlantis (line 311), jenkins_home volume (line 160), atlantis_data volume
// (line 266), n8n container + n8n_data volume (lines 132/136) all confirmed
// exact — including catching that n8n_data's real name is
// "gateway_n8n-data", not "n8n_data" as previously guessed.
//
// STILL UNRESOLVED: "nginx-exporter" (running per `docker ps`) did NOT
// appear anywhere in this grep, so its actual resource address is unknown —
// dropped from the catalog rather than leave a guess in. Also
// module.node_exporter.docker_container.app is confirmed only via the
// earlier apply-error log, not this grep (module-internal resources don't
// match the "resource \"docker_container\"" pattern since they live inside
// modules/docker_app/main.tf, referenced here only via `module "node_exporter" {...}`).
// To find nginx-exporter, try:
//   rg "nginx.exporter" -B 2 -A 6 ~/.social-platform/infra/environments/prod-infra/main.tf
var dockerInfraContainerCatalog = []ImportEntry{
	{EnvInfra, "docker_container.otel_gateway", KindContainer, "otel-gateway"},
	{EnvInfra, "docker_container.n8n", KindContainer, "n8n"},
	{EnvInfra, "docker_container.jenkins", KindContainer, "jenkins"},
	{EnvInfra, "docker_container.jenkins_agent", KindContainer, "jenkins-agent"},
	{EnvInfra, "docker_container.atlantis", KindContainer, "atlantis"},
	{EnvInfra, "module.node_exporter.docker_container.app", KindContainer, "node-exporter"}, // confirmed via error log only
}

var dockerInfraVolumeCatalog = []ImportEntry{
	{EnvInfra, "docker_volume.n8n_data", KindVolume, "gateway_n8n-data"}, // corrected: was "n8n_data", actually "gateway_n8n-data"
	{EnvInfra, "docker_volume.jenkins_home", KindVolume, "jenkins_home"},
	{EnvInfra, "docker_volume.atlantis_data", KindVolume, "gateway_atlantis-data"},
}

// ─── prod-gateway catalog ──────────────────────────────────────────────────
// UNRESOLVED: the rg against prod-gateway/main.tf returned no output (the
// prompt after it showed a non-zero exit). Running two rg commands pasted
// together makes the second one's actual result ambiguous — re-run just
// this one on its own:
//   rg "resource \"docker_container\"" -A 6 ~/.social-platform/infra/environments/prod-gateway/main.tf
// Left empty rather than guessing again — the last guess (n8n_data) turned
// out wrong, so a second unverified entry isn't worth risking a
// terragrunt import misfiring against the wrong container.
var dockerGatewayContainerCatalog = []ImportEntry{}

// docker_image resources are NOT in any catalog — kreuzwerker/docker v3.x
// does not support import for docker_image. Terraform rebuilds them on apply.

// ImportCandidate is a resource that was found in Docker and is ready to import.
type ImportCandidate struct {
	Entry    ImportEntry
	ImportID string // the ID that Terraform needs for import
}

// scannedEnvironments lists every environment DetectImportCandidates scans.
// prod-social (Kubernetes/Helm) and prod-manage are intentionally excluded —
// this importer only handles Docker-provider resources.
var scannedEnvironments = []Environment{EnvDocker, EnvInfra, EnvGateway}

// catalogForEnv returns every ImportEntry declared for a given environment.
func catalogForEnv(env Environment) []ImportEntry {
	var all []ImportEntry
	all = append(all, dockerVolumeCatalog...)
	all = append(all, dockerContainerCatalog...)
	all = append(all, dockerAppContainerCatalog...)
	all = append(all, dockerInfraContainerCatalog...)
	all = append(all, dockerInfraVolumeCatalog...)
	all = append(all, dockerGatewayContainerCatalog...)

	var filtered []ImportEntry
	for _, e := range all {
		if e.Env == env {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// DetectImportCandidates queries Docker once, then checks every known
// resource across all scanned environments (prod-docker, prod-infra,
// prod-gateway) against each environment's own Terraform state, returning
// those that exist in Docker but aren't yet tracked.
func DetectImportCandidates(cfg *config.Config) ([]ImportCandidate, error) {
	if _, err := exec.LookPath("docker"); err != nil {
		return nil, fmt.Errorf("docker not found in PATH — is Docker installed?")
	}

	existingVolumes, err := listDockerVolumes()
	if err != nil {
		ui.Warn("Could not list docker volumes: %v", err)
		existingVolumes = map[string]string{}
	}
	existingContainers, err := listDockerContainers()
	if err != nil {
		ui.Warn("Could not list docker containers: %v", err)
		existingContainers = map[string]string{}
	}

	var candidates []ImportCandidate

	for _, env := range scannedEnvironments {
		inState, err := existingStateAddresses(cfg, env)
		if err != nil {
			ui.Warn("Could not read terraform state for %s, assuming it's empty: %v", env, err)
			inState = map[string]bool{}
		}

		for _, entry := range catalogForEnv(env) {
			if inState[entry.TFAddress] {
				continue
			}
			switch entry.Kind {
			case KindVolume:
				if id, ok := existingVolumes[entry.DockerName]; ok {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
				}
			case KindContainer:
				if id, ok := existingContainers[entry.DockerName]; ok {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
				}
			}
		}
	}

	// docker_image resources are skipped — kreuzwerker/docker v3.x does not
	// support terraform import for docker_image. They are rebuilt on next apply.

	return candidates, nil
}

// existingStateAddresses returns the set of resource addresses Terraform
// already manages in the given environment, via `terragrunt state list`.
func existingStateAddresses(cfg *config.Config, env Environment) (map[string]bool, error) {
	dir := WorkDir(cfg, env)
	if _, err := os.Stat(dir); err != nil {
		return nil, fmt.Errorf("%s directory not found: %s", env, dir)
	}

	cmd := exec.Command("terragrunt", "state", "list")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		// A never-applied environment has no state file yet -- terragrunt
		// exits non-zero with no output in that case, which just means
		// "nothing is tracked", not a real failure.
		if len(strings.TrimSpace(string(out))) == 0 {
			return map[string]bool{}, nil
		}
		return nil, err
	}

	addrs := make(map[string]bool)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			addrs[line] = true
		}
	}
	return addrs, nil
}

// RunImport runs terragrunt import for a single candidate, in whichever
// environment's working dir that candidate belongs to.
func RunImport(cfg *config.Config, candidate ImportCandidate) error {
	dir := WorkDir(cfg, candidate.Entry.Env)
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("%s directory not found: %s", candidate.Entry.Env, dir)
	}

	ui.Cyan.Printf("\n  $ terragrunt import %s %s\n", candidate.Entry.TFAddress, candidate.ImportID)
	ui.Dim.Printf("  working dir: %s\n\n", dir)

	cmd := exec.Command("terragrunt", "import", candidate.Entry.TFAddress, candidate.ImportID)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("import of %s (%s) failed: %w", candidate.Entry.TFAddress, candidate.Entry.Env, err)
	}
	return nil
}

// ─── docker introspection helpers ────────────────────────────────────────────

// listDockerVolumes returns map[volumeName]importID (for volumes, name == importID).
func listDockerVolumes() (map[string]string, error) {
	out, err := exec.Command("docker", "volume", "ls", "--format", "{{json .}}").Output()
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		var v struct {
			Name string `json:"Name"`
		}
		if err := json.Unmarshal([]byte(line), &v); err != nil {
			continue
		}
		if v.Name != "" {
			result[v.Name] = v.Name // Terraform imports volumes by name
		}
	}
	return result, nil
}

// listDockerContainers returns map[containerName]containerID.
// Terraform's docker_container import uses the container ID (full hash).
func listDockerContainers() (map[string]string, error) {
	out, err := exec.Command("docker", "ps", "-a", "--format", "{{json .}}").Output()
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		var c struct {
			ID    string `json:"ID"`
			Names string `json:"Names"`
		}
		if err := json.Unmarshal([]byte(line), &c); err != nil {
			continue
		}
		// Names may be comma-separated; take first, strip leading slash if any.
		name := strings.TrimPrefix(strings.Split(c.Names, ",")[0], "/")
		if name != "" && c.ID != "" {
			// Get full container ID via inspect for reliable import.
			fullID := fullContainerID(name)
			if fullID == "" {
				fullID = c.ID
			}
			result[name] = fullID
		}
	}
	return result, nil
}

// fullContainerID calls docker inspect to get the full container ID.
func fullContainerID(nameOrID string) string {
	out, err := exec.Command("docker", "inspect", "--format", "{{.Id}}", nameOrID).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
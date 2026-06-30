// Package deploy - import.go handles terraform state import for prod-docker
// resources by auto-detecting running Docker containers, volumes, and images,
// then running "terragrunt import" with a per-resource confirmation step.
package deploy

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

// ResourceKind classifies a Docker resource type for import.
type ResourceKind string

const (
	KindVolume    ResourceKind = "volume"
	KindContainer ResourceKind = "container"
	KindImage     ResourceKind = "image"
)

// ImportEntry maps a Terraform resource address to its Docker lookup name.
type ImportEntry struct {
	// TFAddress is the full terraform address: "docker_volume.notes_dist"
	TFAddress string
	// Kind is the Docker resource type.
	Kind ResourceKind
	// DockerName is the volume name, container name, or image repo:tag.
	DockerName string
}

// dockerVolumeCatalog lists all docker_volume resources in prod-docker.
var dockerVolumeCatalog = []ImportEntry{
	{"docker_volume.notes_dist", KindVolume, "gateway_notes-dist"},
	{"docker_volume.bank_dist", KindVolume, "gateway_bank-dist"},
	{"docker_volume.quiz_dist", KindVolume, "gateway_quiz-dist"},
	{"docker_volume.video_dist", KindVolume, "gateway_video-dist"},
	{"docker_volume.api_dist", KindVolume, "gateway_api-dist"},
	{"docker_volume.whisper_dist", KindVolume, "gateway_whisper-dist"},
	{"docker_volume.notes_pgdata", KindVolume, "gateway_notes-pgdata"},
	{"docker_volume.notes_static", KindVolume, "gateway_notes-static"},
	{"docker_volume.notes_media", KindVolume, "gateway_notes-media"},
	{"docker_volume.bank_pgdata", KindVolume, "gateway_bank-pgdata"},
	{"docker_volume.doc_mysql", KindVolume, "gateway_doc-mysql"},
	{"docker_volume.doc_minio", KindVolume, "gateway_doc-minio"},
	{"docker_volume.doc_dist", KindVolume, "gateway_doc-dist"},
	{"docker_volume.blog_mysql", KindVolume, "gateway_blog-mysql"},
	{"docker_volume.blog_minio", KindVolume, "gateway_blog-minio"},
	{"docker_volume.compiler_db_data", KindVolume, "gateway_compiler-db-data"},
	{"docker_volume.compiler_server_data", KindVolume, "gateway_compiler-server-data"},
	{"docker_volume.whisper_pgdata", KindVolume, "gateway_whisper-pgdata"},
	{"docker_volume.whisper_minio_data", KindVolume, "whisper_minio_data"},
}

// dockerContainerCatalog lists all docker_container resources in prod-docker.
// The DockerName is the 'name' field from the Terraform resource block.
var dockerContainerCatalog = []ImportEntry{
	{"docker_container.notes_postgres", KindContainer, "notes-postgres"},
	{"docker_container.notes_frontend_build", KindContainer, "notes-frontend-build"},
	{"docker_container.whisper-postgres", KindContainer, "gateway_whisper-pgdata"},
	{"docker_container.whisper_minio", KindContainer, "whisper-minio"},
	{"docker_container.whisper_frontend_build", KindContainer, "whisper-frontend-build"},
	{"docker_container.bank_postgres", KindContainer, "bank-postgres"},
	{"docker_container.bank_frontend_build", KindContainer, "bank-frontend-build"},
	{"docker_container.quiz_frontend_build", KindContainer, "quiz-frontend-build"},
	{"docker_container.compiler_db", KindContainer, "compiler-db"},
	{"docker_container.video_frontend_build", KindContainer, "video-frontend-build"},
	{"docker_container.blog_db", KindContainer, "blog-db"},
	{"docker_container.blog_minio", KindContainer, "blog-minio"},
	{"docker_container.blog_minio_init", KindContainer, "blog-minio-init"},
	{"docker_container.api_service_frontend_build", KindContainer, "api-service-frontend-build"},
	{"docker_container.doc_mysql", KindContainer, "doc-mysql"},
	{"docker_container.doc_minio", KindContainer, "doc-minio"},
	{"docker_container.doc_frontend_build", KindContainer, "doc-frontend-build"},
}

// dockerImageCatalog lists all docker_image resources in prod-docker.
// DockerName is "repo:tag". Import ID will be resolved to sha256 via docker inspect.
var dockerImageCatalog = []ImportEntry{
	{"docker_image.bank_backend", KindImage, "bankmanager-backend:latest"},
	{"docker_image.bank_frontend_build", KindImage, "bank-frontend-build:latest"},
	{"docker_image.blog_website", KindImage, "blogsite:latest"},
	{"docker_image.hospital_management", KindImage, "hospital_management:latest"},
	{"docker_image.quiz_frontend_build", KindImage, "quiz-frontend-build:latest"},
	{"docker_image.video_backend", KindImage, "video-uploader-backend:latest"},
	{"docker_image.video_frontend_build", KindImage, "video-frontend-build:latest"},
	{"docker_image.notes_frontend_build", KindImage, "notes-frontend-build:latest"},
	{"docker_image.notes_backend", KindImage, "notesapp-backend:latest"},
	{"docker_image.api_service_backend", KindImage, "api-service-backend:latest"},
	{"docker_image.api_service_frontend_build", KindImage, "api-service-frontend:latest"},
	{"docker_image.doc_backend", KindImage, "documentintelligenceplatform-backend:latest"},
	{"docker_image.doc_frontend_build", KindImage, "documentintelligenceplatform-frontend:latest"},
	{"docker_image.whisper_backend", KindImage, "whisper_backend:latest"},
	{"docker_image.whisper_frontend", KindImage, "whisper-frontend:latest"},
	{"docker_image.compiler_db", KindImage, "online_compiler_db:latest"},
	{"docker_image.compiler_server", KindImage, "online_compiler_server:latest"},
}

// ImportCandidate is a resource that was found in Docker and is ready to import.
type ImportCandidate struct {
	Entry    ImportEntry
	ImportID string // the ID that Terraform needs for import
}

// DetectImportCandidates queries Docker for all known prod-docker resources and
// returns those that exist locally AND are not yet in Terraform state.
func DetectImportCandidates(cfg *config.Config) ([]ImportCandidate, error) {
	if _, err := exec.LookPath("docker"); err != nil {
		return nil, fmt.Errorf("docker not found in PATH — is Docker installed?")
	}

	// Resources already tracked in state must never be offered again --
	// terraform import refuses (and errors) on an address it already
	// manages. An empty/missing state (never applied yet) just means
	// everything found in Docker is a valid candidate.
	inState, err := existingStateAddresses(cfg)
	if err != nil {
		ui.Warn("Could not read terraform state, assuming it's empty: %v", err)
		inState = map[string]bool{}
	}

	var candidates []ImportCandidate

	// ── Volumes ──────────────────────────────────────────────────────────────
	existingVolumes, err := listDockerVolumes()
	if err != nil {
		ui.Warn("Could not list docker volumes: %v", err)
	} else {
		for _, entry := range dockerVolumeCatalog {
			if inState[entry.TFAddress] {
				continue
			}
			if id, ok := existingVolumes[entry.DockerName]; ok {
				candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
			}
		}
	}

	// ── Containers ───────────────────────────────────────────────────────────
	existingContainers, err := listDockerContainers()
	if err != nil {
		ui.Warn("Could not list docker containers: %v", err)
	} else {
		for _, entry := range dockerContainerCatalog {
			if inState[entry.TFAddress] {
				continue
			}
			if id, ok := existingContainers[entry.DockerName]; ok {
				candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
			}
		}
	}

	// ── Images ───────────────────────────────────────────────────────────────
	existingImages, err := listDockerImages()
	if err != nil {
		ui.Warn("Could not list docker images: %v", err)
	} else {
		for _, entry := range dockerImageCatalog {
			if inState[entry.TFAddress] {
				continue
			}
			if id, ok := existingImages[entry.DockerName]; ok {
				candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
			}
		}
	}

	return candidates, nil
}

// existingStateAddresses returns the set of resource addresses Terraform
// already manages in prod-docker, via `terragrunt state list`.
func existingStateAddresses(cfg *config.Config) (map[string]bool, error) {
	dir := WorkDir(cfg, EnvDocker)
	if _, err := os.Stat(dir); err != nil {
		return nil, fmt.Errorf("prod-docker directory not found: %s", dir)
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

// RunImport runs terragrunt import for a single candidate in the prod-docker env.
func RunImport(cfg *config.Config, candidate ImportCandidate) error {
	dir := WorkDir(cfg, EnvDocker)
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("prod-docker directory not found: %s", dir)
	}

	ui.Cyan.Printf("\n  $ terragrunt import %s %s\n", candidate.Entry.TFAddress, candidate.ImportID)
	ui.Dim.Printf("  working dir: %s\n\n", dir)

	cmd := exec.Command("terragrunt", "import", candidate.Entry.TFAddress, candidate.ImportID)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("import of %s failed: %w", candidate.Entry.TFAddress, err)
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

// listDockerImages returns map["repo:tag"]imageID (with sha256: prefix).
func listDockerImages() (map[string]string, error) {
	out, err := exec.Command("docker", "images", "--format", "{{json .}}").Output()
	if err != nil {
		return nil, err
	}
	result := make(map[string]string)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		var img struct {
			Repository string `json:"Repository"`
			Tag        string `json:"Tag"`
			ID         string `json:"ID"`
		}
		if err := json.Unmarshal([]byte(line), &img); err != nil {
			continue
		}
		key := img.Repository + ":" + img.Tag
		// Resolve the short ID to sha256 for Terraform import.
		fullID := fullImageID(img.Repository + ":" + img.Tag)
		if fullID == "" {
			fullID = img.ID
		}
		result[key] = fullID
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

// fullImageID calls docker inspect to get the full sha256 image ID.
func fullImageID(repoTag string) string {
	out, err := exec.Command("docker", "inspect", "--format", "{{.Id}}", repoTag).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// Package deploy - import.go handles terraform state import for prod-docker,
// prod-infra, prod-gateway, and prod-social resources by auto-detecting
// running Docker containers, volumes, networks, Helm releases, Kubernetes
// secrets, and (per-entry) kubectl_manifest objects, then running
// "terragrunt import" per environment with a per-resource confirmation
// step. docker_image resources are the one deliberate exception — see the
// note near the bottom of the catalogs below.
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
	// KindImage is intentionally omitted: the kreuzwerker/docker provider does
	// not support terraform import for docker_image resources. Images are
	// always rebuilt by Terraform on the next apply.
	KindNetwork     ResourceKind = "network"      // prod-gateway
	KindHelmRelease ResourceKind = "helm_release" // prod-social
	KindSecret      ResourceKind = "secret"       // prod-social (kubernetes_secret_v1)
	KindManifest    ResourceKind = "manifest"     // prod-social + prod-infra (kubectl_manifest, gavinbunney provider)
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

// Everything below was re-verified against the current
// environments/<env>/*.tf files (main.tf, shared-data.tf, and the
// per-module `module "<name>" { name = ... }` arguments in
// modules/docker_app and modules/networking). Keep it in step with the
// Terraform: an address that isn't declared any more, or a container name
// that has drifted, makes `terragrunt import` fail against the wrong object.
//
// Resources that now live in environments/*/others.tf (commented out: Jenkins,
// Atlantis, Consul, Selenium) are NOT listed here — importing something the
// config doesn't declare would create an orphan in state. Re-add the entries
// together with the blocks when you un-comment them.
//
// prod-docker volumes: 24 declared in main.tf plus the 3 shared-* ones in
// shared-data.tf. Several are deliberately kept even though nothing mounts
// them any more (notes_*, blog_*, doc_mysql/doc_minio,
// whisper_minio_data, compiler_*_data) — they hold the only remaining copy
// of that old data, so they stay importable so `apply` can't delete them.
var dockerVolumeCatalog = []ImportEntry{
	{EnvDocker, "docker_volume.bank_dist", KindVolume, "gateway_bank-dist"},
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
	{EnvDocker, "docker_volume.compiler_dist", KindVolume, "gateway_compiler-dist"},
	{EnvDocker, "docker_volume.grocery_data", KindVolume, "gateway_grocery-data"},
	{EnvDocker, "docker_volume.housing_data", KindVolume, "gateway_housing-data"},
	{EnvDocker, "docker_volume.api_service_data", KindVolume, "gateway_api-service-data"},
	{EnvDocker, "docker_volume.video_uploads", KindVolume, "gateway_video-uploads"},
	{EnvDocker, "docker_volume.video_data", KindVolume, "gateway_video-data"},
	{EnvDocker, "docker_volume.hospital_data", KindVolume, "gateway_hospital-data"},
	{EnvDocker, "docker_volume.shared_pgdata", KindVolume, "gateway_shared-pgdata"},
	{EnvDocker, "docker_volume.shared_mysql", KindVolume, "gateway_shared-mysql"},
	{EnvDocker, "docker_volume.shared_minio", KindVolume, "gateway_shared-minio"},
}

// dockerContainerCatalog: "support" containers declared directly in
// prod-docker — the one-shot *_frontend_build containers and the shared
// database/storage instances from shared-data.tf (plus their init jobs).
// The app containers each come from a module and are listed separately.
var dockerContainerCatalog = []ImportEntry{
	{EnvDocker, "docker_container.whisper_frontend_build", KindContainer, "whisper-frontend-build"},
	{EnvDocker, "docker_container.bank_frontend_build", KindContainer, "bank-frontend-build"},
	{EnvDocker, "docker_container.compiler_frontend_build", KindContainer, "compiler-frontend-build"},
	{EnvDocker, "docker_container.video_frontend_build", KindContainer, "video-frontend-build"},
	{EnvDocker, "docker_container.api_service_frontend_build", KindContainer, "api-service-frontend-build"},
	{EnvDocker, "docker_container.doc_frontend_build", KindContainer, "doc-frontend-build"},
	{EnvDocker, "docker_container.compiler_db", KindContainer, "compiler-db"},
	{EnvDocker, "docker_container.shared_postgres", KindContainer, "shared-postgres"},
	{EnvDocker, "docker_container.shared_postgres_init", KindContainer, "shared-postgres-init"},
	{EnvDocker, "docker_container.shared_mysql", KindContainer, "shared-mysql"},
	{EnvDocker, "docker_container.shared_mysql_init", KindContainer, "shared-mysql-init"},
	{EnvDocker, "docker_container.shared_minio", KindContainer, "shared-minio"},
	{EnvDocker, "docker_container.shared_minio_init", KindContainer, "shared-minio-init"},
}

// dockerAppContainerCatalog: the docker_container.app resource created by
// each "../../modules/docker_app" instance in prod-docker/main.tf. The
// Docker name is the module's `name` argument, verbatim.
var dockerAppContainerCatalog = []ImportEntry{
	{EnvDocker, "module.whisper_backend.docker_container.app", KindContainer, "whisper_backend"}, // underscore, not a typo
	{EnvDocker, "module.bank_backend.docker_container.app", KindContainer, "bank-backend"},
	{EnvDocker, "module.video_backend.docker_container.app", KindContainer, "video-uploader-backend"},
	{EnvDocker, "module.hospital_management.docker_container.app", KindContainer, "hospital-management"},
	{EnvDocker, "module.blog_website.docker_container.app", KindContainer, "blog-website"},
	{EnvDocker, "module.api_service_backend.docker_container.app", KindContainer, "api-service-backend"},
	{EnvDocker, "module.grocery_backend.docker_container.app", KindContainer, "grocery-backend"},
	{EnvDocker, "module.housing_backend.docker_container.app", KindContainer, "housing-backend"},
	{EnvDocker, "module.doc_backend.docker_container.app", KindContainer, "doc-backend"},
	{EnvDocker, "module.compiler_server.docker_container.app", KindContainer, "compiler-server"},
}

// ─── prod-infra catalog ────────────────────────────────────────────────────
// Jenkins, jenkins-agent, atlantis and their volumes were moved to
// prod-infra/others.tf (commented out), so they are dropped here too —
// `terragrunt import` cannot target an address the config doesn't declare.
var dockerInfraContainerCatalog = []ImportEntry{
	{EnvInfra, "docker_container.otel_gateway", KindContainer, "otel-gateway"},
	{EnvInfra, "docker_container.n8n", KindContainer, "n8n"},
	{EnvInfra, "module.node_exporter.docker_container.app", KindContainer, "node-exporter"},
}

var dockerInfraVolumeCatalog = []ImportEntry{
	{EnvInfra, "docker_volume.n8n_data", KindVolume, "gateway_n8n-data"},
}

// ─── prod-gateway catalog ──────────────────────────────────────────────────
// The five static-content volumes are owned by prod-gateway itself (they sit
// next to the null_resources that fill them), and nginx + nginx-exporter are
// docker_app modules declared in the same main.tf.
var dockerGatewayCatalog = []ImportEntry{
	{EnvGateway, "docker_volume.intro_dist", KindVolume, "gateway_intro-dist"},
	{EnvGateway, "docker_volume.record_dist", KindVolume, "gateway_record-dist"},
	{EnvGateway, "docker_volume.grocery_dist", KindVolume, "gateway_grocery-dist"},
	{EnvGateway, "docker_volume.housing_dist", KindVolume, "gateway_housing-dist"},
	{EnvGateway, "docker_volume.city_core_dist", KindVolume, "gateway_city-core-dist"},
	{EnvGateway, "module.gateway.docker_container.app", KindContainer, "gateway"},
	{EnvGateway, "module.nginx_exporter.docker_container.app", KindContainer, "nginx-exporter"},
}

// ─── network catalog (all environments) ────────────────────────────────────
// `docker network ls` on this host shows: bridge, gateway-net, host, kind,
// none. Only "gateway-net" is a Terraform-managed network — it comes from
// `module "network" { source = "../../modules/networking", name =
// "gateway-net" }` in prod-gateway/main.tf, and modules/networking/main.tf
// declares exactly one docker_network ("this") inside it:
//   - bridge / host / none: Docker's built-in networks, never importable.
//   - kind: created by the `kind` CLI when the cluster bootstraps; no
//     docker_network resource owns it.
var dockerNetworkCatalog = []ImportEntry{
	{EnvGateway, "module.network.docker_network.this", KindNetwork, "gateway-net"},
}

// ─── helm release catalog (prod-social) ────────────────────────────────────
// Import ID format for the hashicorp/helm provider's helm_release is
// "<namespace>/<name>" — confirmed against the provider docs, and it is also
// what `helm list -A` reports, so the same string works as lookup key.
var helmReleaseCatalog = []ImportEntry{
	{EnvSocial, "helm_release.argocd", KindHelmRelease, "argocd/argocd"},
	{EnvSocial, "helm_release.keda", KindHelmRelease, "keda/keda"},
	{EnvSocial, "helm_release.keda_http_add_on", KindHelmRelease, "keda/http-add-on"},
}

// ─── kubernetes_secret_v1 catalog (prod-social) ────────────────────────────
// The hashicorp/kubernetes provider's kubernetes_secret_v1 import ID is
// "<namespace>/<name>", same shape as helm_release. Namespace comes from the
// resource's own metadata block in prod-social/main.tf (name
// "coding-project-repo", namespace "argocd"), not from a guess.
var kubernetesSecretCatalog = []ImportEntry{
	{EnvSocial, "kubernetes_secret_v1.gitops_repo_credentials", KindSecret, "argocd/coding-project-repo"},
}

// ─── kubectl_manifest catalog (prod-social, prod-infra) ────────────────────
// kubectl_manifest (gavinbunney/kubectl provider) resources can be arbitrary
// Kubernetes objects of any Kind, so — unlike volumes/containers/networks/
// secrets — there's no single `kubectl get <something> -A` call that lists
// every possible candidate. Each entry here is fully known up front:
// apiVersion, Kind, name, and namespace read straight out of the yaml_body
// block in main.tf. Where a namespaced object's metadata omits `namespace`
// (the two Secrets below), Kubernetes resolves it to "default".
//
// Import ID format (confirmed against gavinbunney/terraform-provider-kubectl
// docs and source): a "//"-delimited string —
//   "<apiVersion>//<Kind>//<name>"               for cluster-scoped objects
//   "<apiVersion>//<Kind>//<name>//<namespace>"  for namespaced objects
// DockerName below is (ab)used to carry this pre-built ID string directly,
// since — unlike every other Kind above — there's no separate "docker lookup
// name" vs. "import ID" distinction here; they're the same string.
//
// Every entry is checked against the live kind cluster individually by
// manifestExists(), so an object that was never created simply isn't
// offered — no bulk listing needed.
var kubectlManifestCatalog = []ImportEntry{
	{EnvSocial, "kubectl_manifest.postgres_secret", KindManifest, "v1//Secret//postgres-secret//default"},
	{EnvSocial, "kubectl_manifest.social_minio_secret", KindManifest, "v1//Secret//social-minio-secret//default"},
	{EnvSocial, "kubectl_manifest.keda_interceptor_proxy", KindManifest, "v1//Service//keda-interceptor-proxy//argocd"},
	{EnvSocial, "kubectl_manifest.app_of_apps_social", KindManifest, "argoproj.io/v1alpha1//Application//social-media-app-of-apps//argocd"},
	{EnvSocial, "kubectl_manifest.httpscaledobject_argocd_server", KindManifest, "http.keda.sh/v1alpha1//HTTPScaledObject//argocd-server//argocd"},
	{EnvInfra, "kubectl_manifest.app_of_apps_observability", KindManifest, "argoproj.io/v1alpha1//Application//observability-app-of-apps//argocd"},
}

// docker_image resources are NOT in any catalog — the kreuzwerker/docker
// provider does not support import for docker_image. Terraform rebuilds
// them on apply.

// ImportCandidate is a resource that was found in Docker and is ready to import.
type ImportCandidate struct {
	Entry    ImportEntry
	ImportID string // the ID that Terraform needs for import
}

// scannedEnvironments lists every environment DetectImportCandidates scans.
// prod-social is included for Helm release, Kubernetes secret, and
// kubectl_manifest detection. prod-manage is intentionally excluded —
// nothing in this importer targets it.
var scannedEnvironments = []Environment{EnvDocker, EnvInfra, EnvGateway, EnvSocial}

// catalogForEnv returns every ImportEntry declared for a given environment.
func catalogForEnv(env Environment) []ImportEntry {
	var all []ImportEntry
	all = append(all, dockerVolumeCatalog...)
	all = append(all, dockerContainerCatalog...)
	all = append(all, dockerAppContainerCatalog...)
	all = append(all, dockerInfraContainerCatalog...)
	all = append(all, dockerInfraVolumeCatalog...)
	all = append(all, dockerGatewayCatalog...)
	all = append(all, dockerNetworkCatalog...)
	all = append(all, helmReleaseCatalog...)
	all = append(all, kubernetesSecretCatalog...)
	all = append(all, kubectlManifestCatalog...)

	var filtered []ImportEntry
	for _, e := range all {
		if e.Env == env {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// DetectImportCandidates queries Docker and Helm once each, then checks
// every known resource across all scanned environments (prod-docker,
// prod-infra, prod-gateway, prod-social) against each environment's own
// Terraform state, returning those that exist but aren't yet tracked.
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
	existingNetworks, err := listDockerNetworks()
	if err != nil {
		ui.Warn("Could not list docker networks: %v", err)
		existingNetworks = map[string]string{}
	}
	existingHelmReleases, err := listHelmReleases()
	if err != nil {
		ui.Warn("Could not list helm releases: %v", err)
		existingHelmReleases = map[string]string{}
	}
	existingSecrets, err := listKubernetesSecrets()
	if err != nil {
		ui.Warn("Could not list kubernetes secrets: %v", err)
		existingSecrets = map[string]string{}
	}

	var candidates []ImportCandidate

	// Every terragrunt unit is an environment directory: the app containers are
	// `module "<name>"` calls inside that directory's own main.tf, not separate
	// subdirectories, so one `terragrunt state list` per environment covers
	// every entry in its catalog and addresses stay verbatim.
	for _, env := range scannedEnvironments {
		dir := WorkDir(cfg, env)

		inState, err := stateAddressesInDir(dir)
		if err != nil {
			ui.Warn("Could not read terraform state for %s, assuming it's empty: %v", dir, err)
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
			case KindNetwork:
				if id, ok := existingNetworks[entry.DockerName]; ok {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
				}
			case KindHelmRelease:
				if id, ok := existingHelmReleases[entry.DockerName]; ok {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
				}
			case KindSecret:
				if id, ok := existingSecrets[entry.DockerName]; ok {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: id})
				}
			case KindManifest:
				// No bulk "list every kubectl_manifest candidate" call exists
				// (see kubectlManifestCatalog doc comment) — each entry is
				// checked individually against the live cluster instead.
				if manifestExists(entry.DockerName) {
					candidates = append(candidates, ImportCandidate{Entry: entry, ImportID: entry.DockerName})
				}
			}
		}
	}

	// docker_image resources are skipped — the kreuzwerker/docker provider
	// does not support terraform import for docker_image. They are rebuilt
	// on the next apply.

	return candidates, nil
}

// stateAddressesInDir returns the set of resource addresses Terraform
// already manages in a single terragrunt working directory, via
// `terragrunt state list`.
func stateAddressesInDir(dir string) (map[string]bool, error) {
	if _, err := os.Stat(dir); err != nil {
		return nil, fmt.Errorf("directory not found: %s", dir)
	}

	cmd := exec.Command("terragrunt", "state", "list")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		// A never-applied unit has no state file yet -- terragrunt exits
		// non-zero with no output in that case, which just means "nothing
		// is tracked", not a real failure.
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

// RunImport runs terragrunt import for a single candidate inside its own
// environment directory, using the catalog address verbatim.
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

// listDockerNetworks returns map[networkName]networkID.
// kreuzwerker/docker's docker_network resource imports by network ID (the
// short hex ID shown in `docker network ls`), not by name — unlike volumes,
// where name and import ID are the same string. Built-in networks (bridge,
// host, none) are intentionally excluded here since they can never be
// attached to a docker_network resource; if one somehow ends up in
// dockerNetworkCatalog by mistake, it just won't be found in this map and
// will be silently skipped rather than misimported.
func listDockerNetworks() (map[string]string, error) {
	out, err := exec.Command("docker", "network", "ls", "--format", "{{json .}}").Output()
	if err != nil {
		return nil, err
	}
	builtins := map[string]bool{"bridge": true, "host": true, "none": true}
	result := make(map[string]string)
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		var n struct {
			ID   string `json:"ID"`
			Name string `json:"Name"`
		}
		if err := json.Unmarshal([]byte(line), &n); err != nil {
			continue
		}
		if n.Name == "" || n.ID == "" || builtins[n.Name] {
			continue
		}
		result[n.Name] = n.ID
	}
	return result, nil
}

// listHelmReleases returns map["namespace/name"]"namespace/name" for every
// Helm release currently deployed across all namespaces. Unlike volumes,
// containers, and networks — where the Docker lookup name and the import ID
// are different strings — a helm_release resource's import ID (per the
// hashicorp/helm provider) IS "<namespace>/<name>", so DockerName in
// helmReleaseCatalog entries is stored in that same "namespace/name" form
// and doubles as both the lookup key and the resulting ImportID.
func listHelmReleases() (map[string]string, error) {
	if _, err := exec.LookPath("helm"); err != nil {
		return map[string]string{}, nil // helm not installed — nothing to detect, not a hard error
	}

	// --kube-context matches the helm provider's config_context in
	// prod-social: the releases live in the kind cluster, and querying some
	// other current context would offer imports for objects Terraform's own
	// provider can't see.
	out, err := exec.Command("helm", "list", "-A", "-o", "json", "--kube-context", kindContext).Output()
	if err != nil {
		return nil, err
	}

	var releases []struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	}
	if err := json.Unmarshal(out, &releases); err != nil {
		return nil, fmt.Errorf("parsing helm list output: %w", err)
	}

	result := make(map[string]string)
	for _, r := range releases {
		if r.Name == "" || r.Namespace == "" {
			continue
		}
		key := r.Namespace + "/" + r.Name
		result[key] = key
	}
	return result, nil
}

// listKubernetesSecrets returns map["namespace/name"]"namespace/name" for
// every Secret across all namespaces. Same "lookup key == import ID"
// pattern as listHelmReleases — the hashicorp/kubernetes provider's
// kubernetes_secret_v1 import ID is "<namespace>/<name>".
func listKubernetesSecrets() (map[string]string, error) {
	if _, err := exec.LookPath("kubectl"); err != nil {
		return map[string]string{}, nil // kubectl not installed — nothing to detect, not a hard error
	}

	out, err := exec.Command("kubectl", "--context", kindContext,
		"get", "secrets", "-A", "-o", "json").Output()
	if err != nil {
		return nil, err
	}

	var parsed struct {
		Items []struct {
			Metadata struct {
				Name      string `json:"name"`
				Namespace string `json:"namespace"`
			} `json:"metadata"`
		} `json:"items"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil, fmt.Errorf("parsing kubectl get secrets output: %w", err)
	}

	result := make(map[string]string)
	for _, item := range parsed.Items {
		if item.Metadata.Name == "" || item.Metadata.Namespace == "" {
			continue
		}
		key := item.Metadata.Namespace + "/" + item.Metadata.Name
		result[key] = key
	}
	return result, nil
}

// parseManifestID splits a kubectl_manifest import ID of the form
// "<apiVersion>//<Kind>//<name>" or "<apiVersion>//<Kind>//<name>//<namespace>"
// into its Kind, name, and (optional) namespace parts. apiVersion itself is
// discarded here — `kubectl get <kind> <name>` doesn't need it, and kubectl's
// RESTMapper resolves the Kind to the right API group on its own.
func parseManifestID(id string) (kind, name, namespace string, ok bool) {
	parts := strings.Split(id, "//")
	if len(parts) < 3 || parts[1] == "" || parts[2] == "" {
		return "", "", "", false
	}
	kind = parts[1]
	name = parts[2]
	if len(parts) >= 4 {
		namespace = parts[3]
	}
	return kind, name, namespace, true
}

// manifestExists checks whether the live cluster already has the object
// described by a kubectl_manifest-style import ID (see parseManifestID).
// Used instead of a bulk listing call, since kubectl_manifest resources can
// be any Kind — there's no single "list all possible candidates" query.
func manifestExists(importID string) bool {
	if _, err := exec.LookPath("kubectl"); err != nil {
		return false
	}
	kind, name, namespace, ok := parseManifestID(importID)
	if !ok {
		return false
	}

	args := []string{"--context", kindContext, "get", kind, name, "--ignore-not-found", "-o", "name"}
	if namespace != "" {
		args = append(args, "-n", namespace)
	}

	out, err := exec.Command("kubectl", args...).Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) != ""
}
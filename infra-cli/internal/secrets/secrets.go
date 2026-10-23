// Package secrets manages sensitive values via the OS keychain (go-keyring).
// Every secret is stored as a separate keychain entry keyed by
// "social-platform-cli/<env>/<variable_name>".
// The Generate* functions write terraform.tfvars files from keychain + config.
package secrets

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/vars"
	"github.com/zalando/go-keyring"
)

func key(env, variable string) string {
	return fmt.Sprintf("%s/%s/%s", config.KeychainService, env, variable)
}

// dockerHostDefault picks a sane default for the docker_host secret.
//
// Docker Desktop on Linux does NOT listen on the standard
// /var/run/docker.sock -- it listens on ~/.docker/desktop/docker.sock. The
// previous hardcoded default of "unix:///var/run/docker.sock" meant
// Terraform's docker provider silently connected to a DIFFERENT daemon
// instance than whatever `docker` CLI context the terminal was using
// (confirmed via `docker context ls` showing desktop-linux as the active
// context, while prod-infra's stored secret pointed elsewhere). That caused
// Terraform to see containers as "already exists" that `docker inspect`
// couldn't find on the socket the terminal was actually talking to, and
// vice versa.
//
// This checks for the Desktop socket first (since `docker context ls`
// showed desktop-linux as this machine's active context) and only falls
// back to /var/run/docker.sock if it's not present -- e.g. on a machine
// running plain dockerd instead of Docker Desktop.
func dockerHostDefault() string {
	home, err := os.UserHomeDir()
	if err == nil {
		desktopSock := filepath.Join(home, ".docker", "desktop", "docker.sock")
		if _, statErr := os.Stat(desktopSock); statErr == nil {
			return "unix://" + desktopSock
		}
	}
	return "unix:///var/run/docker.sock"
}

// Set stores a secret in the OS keychain. When no keychain is available (WSL
// and headless servers usually have no Secret Service / D-Bus) it falls back to
// a private file (~/.social-platform/secrets.json, mode 0600) instead of
// failing the whole configure run.
func Set(env, variable, value string) error {
	k := key(env, variable)
	if err := keyring.Set(config.KeychainService, k, value); err != nil {
		if ferr := fileSet(k, value); ferr != nil {
			return fmt.Errorf("keychain unavailable (%v) and the file fallback failed: %w", err, ferr)
		}
		warnFallbackOnce(err)
	}
	return nil
}

func Get(env, variable string) string {
	k := key(env, variable)
	if val, err := keyring.Get(config.KeychainService, k); err == nil && val != "" {
		return val
	}
	if val, ok := fileGet(k); ok {
		return val
	}
	return ""
}

func Has(env, variable string) bool {
	return Get(env, variable) != ""
}

// Delete removes a stored value from the keychain and from the file fallback.
func Delete(env, variable string) error {
	k := key(env, variable)
	krErr := keyring.Delete(config.KeychainService, k)
	fErr := fileDelete(k)
	if krErr != nil && !errors.Is(krErr, keyring.ErrNotFound) && fErr != nil {
		return fmt.Errorf("keychain: %v, file fallback: %w", krErr, fErr)
	}
	return nil
}

// KeychainAvailable reports whether the OS keychain answers. A missing entry is
// an answer; a transport error (no Secret Service / D-Bus) is not.
func KeychainAvailable() bool {
	_, err := keyring.Get(config.KeychainService, key("_probe", "_probe"))
	return err == nil || errors.Is(err, keyring.ErrNotFound)
}

// ─── Secret definitions ─────────────────────────────────────────────────────

// What sort of value a secret is. The dashboard's Secrets register is grouped by
// this first and by ward second, because the three kinds are filled in three
// different ways: you invent a password, you paste a key a provider issued, or
// you paste a whole private key file.
const (
	ClassCredential = "credential"
	ClassAPIKey     = "api_key"
	ClassSSHKey     = "ssh_key"
)

type SecretDef struct {
	Env       string
	Key       string
	Label     string
	Multiline bool
	Internal  bool
	Default   string
	Generate  bool
	Class     string // one of the Class* constants; empty means infer from the key
	App       string // the ward this belongs to; empty means infer from the key
	Hint      string // where to obtain the value, for anything issued outside the city
}

var AllSecrets = []SecretDef{
	// prod-docker
	{Env: "prod-docker", Key: "docker_host", Label: "Docker socket path", Internal: true, Class: ClassCredential, App: "Docker", Default: dockerHostDefault()},
	{Env: "prod-docker", Key: "blog_db_password", Label: "Blog DB password", Internal: true, Class: ClassCredential, App: "Inkwell", Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "blog_minio_password", Label: "Blog MinIO password", Internal: true, Class: ClassCredential, App: "Inkwell", Default: "minioadmin"},
	{Env: "prod-docker", Key: "blog_secret_key", Label: "Blog Django secret key", Internal: true, Class: ClassCredential, App: "Inkwell", Generate: true},
	{Env: "prod-docker", Key: "notes_db_password", Label: "Notes DB password", Internal: true, Class: ClassCredential, App: "Notes", Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "bank_db_password", Label: "Bank DB password", Internal: true, Class: ClassCredential, App: "Bank Manager", Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "doc_db_password", Label: "Document Platform DB password", Internal: true, Class: ClassCredential, App: "Documents", Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "doc_minio_password", Label: "Document Platform MinIO password", Internal: true, Class: ClassCredential, App: "Documents", Default: "minioadmin"},
	{Env: "prod-docker", Key: "doc_gemini_api_key", Label: "Gemini API key (Document Platform)", Class: ClassAPIKey, App: "Documents", Hint: "Google AI Studio → API keys → create a key. The Documents ward calls it for embeddings and answers."},
	{Env: "prod-docker", Key: "doc_django_secret_key", Label: "Document Platform Django secret key", Internal: true, Class: ClassCredential, App: "Documents", Default: "saisakthi"},
	{Env: "prod-docker", Key: "api_key_weather", Label: "Weather API key", Class: ClassAPIKey, App: "API & Markets", Hint: "openweathermap.org → your account → API keys (free tier is enough). The API & Markets ward calls it for /weather."},
	{Env: "prod-docker", Key: "whisper_db_password", Label: "Whisper DB password", Internal: true, Class: ClassCredential, App: "Whisper", Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "whisper_minio_password", Label: "Whisper MinIO password", Internal: true, Class: ClassCredential, App: "Whisper", Default: "minioadmin"},
	{Env: "prod-docker", Key: "whisper_jwt_secret", Label: "Whisper JWT secret", Internal: true, Class: ClassCredential, App: "Whisper", Default: "saisakthi"},

	// prod-social
	{Env: "prod-social", Key: "docker_host", Label: "Docker socket path (prod-social)", Internal: true, Class: ClassCredential, App: "Docker", Default: dockerHostDefault()},
	{Env: "prod-social", Key: "social_db_password", Label: "Social Media DB password", Internal: true, Class: ClassCredential, App: "Social", Default: "saisakthi2008"},
	{Env: "prod-social", Key: "social_minio_password", Label: "Social Media MinIO password", Internal: true, Class: ClassCredential, App: "Social", Default: "minioadmin"},
	{Env: "prod-social", Key: "gitops_repo_ssh_key", Label: "ArgoCD deploy SSH private key", Multiline: true, Class: ClassSSHKey, App: "GitOps", Hint: "A read-only deploy key added to the gitops repo's Deploy keys settings. Paste the whole private key, BEGIN LINE included."},

	// prod-infra
	{Env: "prod-infra", Key: "observability_redis_password", Label: "Observability Redis password", Internal: true, Class: ClassCredential, App: "Monitoring", Default: "saisakthi"},
	{Env: "prod-infra", Key: "atlantis_gh_token", Label: "Atlantis GitHub personal access token", Class: ClassAPIKey, App: "Atlantis", Hint: "github.com → Settings → Developer settings → Personal access tokens → fine-grained token allowed on the infra repo with Contents:read and Pull requests:write. Atlantis plans and applies through it."},
	{Env: "prod-infra", Key: "atlantis_gh_webhook_secret", Label: "Atlantis GitHub webhook secret", Internal: true, Class: ClassCredential, App: "Atlantis", Default: "saisakthi@2008"},
	{Env: "prod-infra", Key: "n8n_basic_auth_password", Label: "n8n basic auth password", Internal: true, Class: ClassCredential, App: "n8n", Default: "saisakthi2008"},
	{Env: "prod-infra", Key: "docker_host", Label: "Docker socket path", Internal: true, Class: ClassCredential, App: "Docker", Default: dockerHostDefault()},
}

// ─── Classification ──────────────────────────────────────────────────────────

// ClassOf names what kind of value a declared variable is, for the dashboard's
// Secrets register. Catalogue entries carry a Class of their own; this is the
// fallback for the variables terraform still asks for.
func ClassOf(name string) string {
	n := strings.ToLower(name)
	switch {
	case strings.Contains(n, "ssh_key"), strings.Contains(n, "private_key"), strings.HasSuffix(n, "_pem"):
		return ClassSSHKey
	case strings.HasPrefix(n, "api_key_"), strings.Contains(n, "_api_key"),
		strings.Contains(n, "apikey"), strings.HasSuffix(n, "_token"):
		return ClassAPIKey
	default:
		return ClassCredential
	}
}

// wards maps a variable prefix to the service that consumes it, so each kind can
// be sub-divided by app. The specific prefixes come first.
var wards = []struct{ prefix, app string }{
	{"api_key_weather", "API & Markets"},
	{"observability_", "Monitoring"},
	{"atlantis_", "Atlantis"},
	{"gitops_", "GitOps"},
	{"n8n_", "n8n"},
	{"whisper_", "Whisper"},
	{"blog_", "Inkwell"},
	{"notes_", "Notes"},
	{"bank_", "Bank Manager"},
	{"doc_", "Documents"},
	{"social_", "Social"},
	{"grocery_", "Grocery"},
	{"housing_", "Housing"},
	{"hospital_", "Hospital"},
	{"compiler_", "Cloud Compiler"},
	{"video_", "Video"},
	{"shared_", "Shared services"},
	{"smtp_", "Mail"},
	{"docker_host", "Docker"},
	{"letsencrypt_", "Gateway"},
}

func AppOf(name string) string {
	n := strings.ToLower(name)
	for _, w := range wards {
		if strings.HasPrefix(n, w.prefix) {
			return w.app
		}
	}
	return "City"
}

// HintFor says where an outside credential comes from when the city cannot
// invent it. Catalogue entries carry a sharper hint of their own.
func HintFor(name string) string {
	switch ClassOf(name) {
	case ClassSSHKey:
		return "Paste the whole private key file, the BEGIN line included."
	case ClassAPIKey:
		return "Paste this key from the provider's own dashboard — the city cannot invent it."
	}
	return ""
}

// ─── Interactive prompting ───────────────────────────────────────────────────

func randomSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "fallback-" + filepath.Base(os.TempDir())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func PromptAll(importantOnly bool) error {
	envGroups := map[string][]SecretDef{}
	envOrder := []string{}
	for _, s := range AllSecrets {
		if _, seen := envGroups[s.Env]; !seen {
			envOrder = append(envOrder, s.Env)
		}
		envGroups[s.Env] = append(envGroups[s.Env], s)
	}

	for i, env := range envOrder {
		ui.Step(i+1, fmt.Sprintf("Secrets for %s", env))
		for _, s := range envGroups[env] {
			existing := Has(s.Env, s.Key)

			if importantOnly && s.Internal {
				if existing {
					ui.Dim.Printf("  %s [already set, keeping]\n", s.Label)
					continue
				}
				var val string
				if s.Generate {
					val = randomSecret()
					ui.Dim.Printf("  %s [auto-generated]\n", s.Label)
				} else {
					val = s.Default
					ui.Dim.Printf("  %s [using default: %s]\n", s.Label, val)
				}
				if err := Set(s.Env, s.Key, val); err != nil {
					return fmt.Errorf("storing %s/%s: %w", s.Env, s.Key, err)
				}
				continue
			}

			var val string
			if s.Multiline {
				if existing {
					ui.Dim.Printf("  %s [keep existing, press Enter then EOF to skip]:\n", s.Label)
				}
				val = ui.PromptMultiline(s.Label)
			} else {
				val = ui.PromptSecret(s.Label, existing)
			}
			if val == "" && existing {
				continue
			}
			if val == "" {
				// For internal secrets with a default, set the default rather than leaving empty.
				if s.Internal && s.Default != "" {
					if err := Set(s.Env, s.Key, s.Default); err != nil {
						return fmt.Errorf("storing %s/%s: %w", s.Env, s.Key, err)
					}
					ui.Dim.Printf("  %s [using default]\n", s.Label)
				} else {
					ui.Warn("  Skipping %s (empty)", s.Key)
				}
				continue
			}
			if err := Set(s.Env, s.Key, val); err != nil {
				return fmt.Errorf("storing %s/%s: %w", s.Env, s.Key, err)
			}
		}
	}
	return nil
}

// ─── tfvars generation ───────────────────────────────────────────────────────

// GenerateAll writes terraform.tfvars for the 4 environments that need them.
// prod-manage has no variables and doesn't need a tfvars file.
func GenerateAll(cfg *config.Config) error {
	for _, g := range tfvarsGenerators {
		if err := generateOne(cfg, g); err != nil {
			return err
		}
	}
	return nil
}

type tfvarsGen struct {
	env string
	fn  func(*config.Config, string) error
}

var tfvarsGenerators = []tfvarsGen{
	{"prod-docker", generateDockerTfvars},
	{"prod-social", generateSocialTfvars},
	{"prod-infra", generateInfraTfvars},
	{"prod-gateway", generateGatewayTfvars},
}

// generateOne rewrites one environment's tfvars and then re-applies every
// variable the generator does not know about (see extras.go).
func generateOne(cfg *config.Config, g tfvarsGen) error {
	envPath := filepath.Join(cfg.InfraDir, "environments")
	dir := filepath.Join(envPath, g.env)
	// what is in the file right now (including values you added by hand)
	old, _ := vars.ReadTfvars(filepath.Join(dir, "terraform.tfvars"))
	if err := g.fn(cfg, envPath); err != nil {
		return err
	}
	return reconcileExtras(g.env, dir, old)
}

const generatedMarker = "AUTO-GENERATED by social-platform CLI"

// SyncTfvars is the gentle variant of GenerateAll, used before deploys, after
// switching folders and after a sync:
//   - a missing terraform.tfvars is generated,
//   - a CLI-generated one is regenerated (picking up new variables),
//   - a hand-written one (no AUTO-GENERATED header) is never rewritten; only
//     saved values for blank/absent variables are appended to it.
func SyncTfvars(cfg *config.Config) error {
	envPath := filepath.Join(cfg.InfraDir, "environments")
	for _, g := range tfvarsGenerators {
		dir := filepath.Join(envPath, g.env)
		if st, err := os.Stat(dir); err != nil || !st.IsDir() {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, "terraform.tfvars"))
		switch {
		case err != nil, strings.Contains(string(b), generatedMarker):
			if err := generateOne(cfg, g); err != nil {
				return err
			}
		default:
			if err := reconcileExtras(g.env, dir, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

// projectsDir resolves var.projects_dir, falling back to auto-detection
// relative to InfraDir if it was never explicitly set (e.g. tfvars
// regenerated via --regen before 'configure' ever ran the paths step).
func projectsDir(cfg *config.Config) string {
	if cfg.Paths.ProjectsDir != "" {
		return cfg.Paths.ProjectsDir
	}
	return config.DetectProjectsDir(cfg.InfraDir)
}

func write(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0600)
}

func generateDockerTfvars(cfg *config.Config, envPath string) error {
	d := cfg.ProdDocker
	g := func(k string) string { return Get("prod-docker", k) }

	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually
# Re-generate with: social-platform configure --regen

# ─── PATHS ────────────────────────────────────────────────────
projects_dir = %q

# ─── DOCKER ───────────────────────────────────────────────────
docker_host = %q

# ─── BLOG ─────────────────────────────────────────────────────
blog_db_password    = %q
blog_db_name        = %q
blog_minio_user     = %q
blog_minio_password = %q
blog_secret_key     = %q
blog_allowed_hosts  = %q

# ─── NOTES ────────────────────────────────────────────────────
notes_db_name     = %q
notes_db_user     = %q
notes_db_password = %q

# ─── BANK ─────────────────────────────────────────────────────
bank_db_user     = %q
bank_db_password = %q
bank_db_name     = %q

# ─── DOCUMENT INTELLIGENCE PLATFORM ──────────────────────────
doc_db_password       = %q
doc_db_name           = %q
doc_minio_user        = %q
doc_minio_password    = %q
doc_gemini_api_key    = %q
doc_django_secret_key = %q

# ─── API SERVICE ──────────────────────────────────────────────
api_key_weather = %q

# ─── WHISPER APP ──────────────────────────────────────────────
whisper_db_user        = %q
whisper_db_password    = %q
whisper_db_database    = %q
whisper_db_test_db     = %q
whisper_minio_user     = %q
whisper_minio_password = %q
whisper_jwt_secret     = %q
whisper_domain         = %q

# ─── ONLINE COMPILER ──────────────────────────────────────────
compiler_domain = %q
`,
		projectsDir(cfg),
		g("docker_host"),
		g("blog_db_password"),
		d.BlogDBName,
		d.BlogMinioUser,
		g("blog_minio_password"),
		g("blog_secret_key"),
		d.BlogAllowedHosts,
		d.NotesDBName,
		d.NotesDBUser,
		g("notes_db_password"),
		d.BankDBUser,
		g("bank_db_password"),
		d.BankDBName,
		g("doc_db_password"),
		d.DocDBName,
		d.DocMinioUser,
		g("doc_minio_password"),
		g("doc_gemini_api_key"),
		g("doc_django_secret_key"),
		g("api_key_weather"),
		d.WhisperDBUser,
		g("whisper_db_password"),
		d.WhisperDBName,
		d.WhisperDBTestDB,
		d.WhisperMinioUser,
		g("whisper_minio_password"),
		g("whisper_jwt_secret"),
		fmt.Sprintf("https://%s/whisper", cfg.ProdInfra.Domain),
		fmt.Sprintf("https://%s/compiler/api/", cfg.ProdInfra.Domain),
	)
	return write(filepath.Join(envPath, "prod-docker", "terraform.tfvars"), content)
}

func generateSocialTfvars(cfg *config.Config, envPath string) error {
	s := cfg.ProdSocial
	g := func(k string) string { return Get("prod-social", k) }

	sshKey := g("gitops_repo_ssh_key")
	if sshKey != "" && !strings.HasSuffix(sshKey, "\n") {
		sshKey += "\n"
	}

	loadImages := "false"
	if s.LoadImages {
		loadImages = "true"
	}

	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually

# ─── PATHS ────────────────────────────────────────────────────
projects_dir = %q

# ─── DOCKER ───────────────────────────────────────────────────
docker_host = %q

# ─── SOCIAL MEDIA (Kubernetes) ────────────────────────────────
social_db_password    = %q
social_minio_user     = %q
social_minio_password = %q

load_images = %s

gitops_repo_url = %q
gitops_repo_ssh_key = <<EOF
%sEOF
`,
		projectsDir(cfg),
		Get("prod-social", "docker_host"),
		g("social_db_password"),
		s.SocialMinio,
		g("social_minio_password"),
		loadImages,
		s.GitopsRepoURL,
		sshKey,
	)
	return write(filepath.Join(envPath, "prod-social", "terraform.tfvars"), content)
}

// generateInfraTfvars writes terraform.tfvars for prod-infra.
//
// BUGFIX: this previously passed g("docker_host") as the LAST Sprintf
// argument while the format string's "docker_host = %q" placeholder is the
// SECOND one. Sprintf fills placeholders purely positionally, so every value
// from N8N_PORT onward silently shifted one slot to the left — docker_host
// ended up written as inf.N8NPort's value (e.g. "5678"), which is exactly
// what Terraform's docker provider choked on: `unable to parse docker host
// \`5678\``. Every other field after docker_host was ALSO off by one (e.g.
// N8N_HOST likely got N8NProtocol's value, etc.) — it just didn't error
// loudly for those because they're not host strings the Docker provider
// validates. Fixed by moving g("docker_host") to be the 2nd argument, right
// after projectsDir(cfg), so argument order matches placeholder order.
func generateInfraTfvars(cfg *config.Config, envPath string) error {
	inf := cfg.ProdInfra
	g := func(k string) string { return Get("prod-infra", k) }

	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually

# ─── PATHS ────────────────────────────────────────────────────
projects_dir = %q

# ─── DOCKER ───────────────────────────────────────────────────
docker_host = %q

# ─── n8n ────────────────────────────────────────────────────
n8n_env = {
  N8N_PORT                        = %q
  N8N_HOST                        = %q
  N8N_PROTOCOL                    = %q
  N8N_PATH                        = "/n8n/"
  N8N_PROXY_HOPS                  = "1"
  N8N_EDITOR_BASE_URL             = "https://%s/n8n"
  WEBHOOK_URL                     = "https://%s/n8n"
  N8N_BASIC_AUTH_ACTIVE           = "true"
  N8N_BASIC_AUTH_USER             = %q
  N8N_BASIC_AUTH_PASSWORD         = %q
  GENERIC_TIMEZONE                = "Asia/Kolkata"
  TZ                              = "Asia/Kolkata"
  N8N_METRICS                     = "true"
  N8N_RUNNERS_DISABLED            = "true"
  N8N_ENFORCE_SETTINGS_PERMISSION = "true"
  N8N_DIAGNOSTICS_ENABLED         = "true"
  N8N_TELEMETRY_ENABLED           = "true"
  N8N_AI_ASSISTANT_BASE_URL       = "http://ollama:11434"
  N8N_DISABLE_PUSH_ORIGIN_CHECK   = "true"
}

# ─── Observability ──────────────────────────────────────────
observability_redis_password = %q

gitops_repo_url = %q

# ─── Atlantis ───────────────────────────────────────────────
# Atlantis is switched off. Its container, its docker_volume, its image build
# and the three atlantis_gh_* variable declarations all live, commented, in
# environments/prod-infra/others.tf. Assigning them here would make Terraform
# warn about "values for undeclared variables" on every prod-infra plan.
# To re-enable: un-comment others.tf, then add these three lines back (as
# atlantis_gh_user = "..." style assignments) plus the matching arguments at
# the end of the Sprintf in generateInfraTfvars.
#
# The values themselves stay in the keychain regardless: social-platform
# release reads prod-infra/atlantis_gh_token for its GitHub API calls, and the
# dashboard's Secrets sheet still lists it.
`,
		projectsDir(cfg),
		g("docker_host"), // FIX: was previously passed last; now matches "docker_host = %q" placeholder position
		inf.N8NPort,
		inf.N8NHost,
		inf.N8NProtocol,
		inf.Domain,
		inf.Domain,
		inf.N8NUser,
		g("n8n_basic_auth_password"),
		g("observability_redis_password"),
		inf.GitopsRepoURL,
	)
	return write(filepath.Join(envPath, "prod-infra", "terraform.tfvars"), content)
}

// generateGatewayTfvars writes terraform.tfvars for prod-gateway. Previously
// this environment had no variables at all; it now needs var.projects_dir
// since its main.tf mounts intro/ and security_tests/ from the projects dir.
func generateGatewayTfvars(cfg *config.Config, envPath string) error {
	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually
# Re-generate with: social-platform configure --regen

# ─── PATHS ────────────────────────────────────────────────────
projects_dir = %q

# ─── DOCKER ───────────────────────────────────────────────────
docker_host = %q
`,
		projectsDir(cfg),
		Get("prod-docker", "docker_host"),
	)
	return write(filepath.Join(envPath, "prod-gateway", "terraform.tfvars"), content)
}
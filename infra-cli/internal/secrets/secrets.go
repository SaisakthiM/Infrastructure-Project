// Package secrets manages sensitive values via the OS keychain (go-keyring).
// Every secret is stored as a separate keychain entry keyed by
// "social-platform-cli/<env>/<variable_name>".
// The Generate* functions write terraform.tfvars files from keychain + config.
package secrets

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
	"github.com/zalando/go-keyring"
)

func key(env, variable string) string {
	return fmt.Sprintf("%s/%s/%s", config.KeychainService, env, variable)
}

func Set(env, variable, value string) error {
	return keyring.Set(config.KeychainService, key(env, variable), value)
}

func Get(env, variable string) string {
	val, err := keyring.Get(config.KeychainService, key(env, variable))
	if err != nil {
		return ""
	}
	return val
}

func Has(env, variable string) bool {
	return Get(env, variable) != ""
}

// ─── Secret definitions ─────────────────────────────────────────────────────

type SecretDef struct {
	Env       string
	Key       string
	Label     string
	Multiline bool
	Internal  bool
	Default   string
	Generate  bool
}

var AllSecrets = []SecretDef{
	// prod-docker
	{Env: "prod-docker", Key: "docker_host", Label: "Docker socket path", Internal: true, Default: "unix:///var/run/docker.sock"},
	{Env: "prod-docker", Key: "blog_db_password", Label: "Blog DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "blog_minio_password", Label: "Blog MinIO password", Internal: true, Default: "minioadmin"},
	{Env: "prod-docker", Key: "blog_secret_key", Label: "Blog Django secret key", Internal: true, Generate: true},
	{Env: "prod-docker", Key: "notes_db_password", Label: "Notes DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "bank_db_password", Label: "Bank DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "doc_db_password", Label: "Document Platform DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "doc_minio_password", Label: "Document Platform MinIO password", Internal: true, Default: "minioadmin"},
	{Env: "prod-docker", Key: "doc_gemini_api_key", Label: "Gemini API key (Document Platform)"},
	{Env: "prod-docker", Key: "doc_django_secret_key", Label: "Document Platform Django secret key", Internal: true, Default: "saisakthi"},
	{Env: "prod-docker", Key: "api_key_weather", Label: "Weather API key"},
	{Env: "prod-docker", Key: "whisper_db_password", Label: "Whisper DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-docker", Key: "whisper_minio_password", Label: "Whisper MinIO password", Internal: true, Default: "minioadmin"},
	{Env: "prod-docker", Key: "whisper_jwt_secret", Label: "Whisper JWT secret", Internal: true, Default: "saisakthi"},

	// prod-social
	{Env: "prod-social", Key: "docker_host", Label: "Docker socket path (prod-social)", Internal: true, Default: "unix:///var/run/docker.sock"},
	{Env: "prod-social", Key: "social_db_password", Label: "Social Media DB password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-social", Key: "social_minio_password", Label: "Social Media MinIO password", Internal: true, Default: "minioadmin"},
	{Env: "prod-social", Key: "gitops_repo_ssh_key", Label: "ArgoCD deploy SSH private key", Multiline: true},

	// prod-infra
	{Env: "prod-infra", Key: "observability_redis_password", Label: "Observability Redis password", Internal: true, Default: "saisakthi"},
	{Env: "prod-infra", Key: "atlantis_gh_token", Label: "Atlantis GitHub personal access token"},
	{Env: "prod-infra", Key: "atlantis_gh_webhook_secret", Label: "Atlantis GitHub webhook secret", Internal: true, Default: "saisakthi@2008"},
	{Env: "prod-infra", Key: "n8n_basic_auth_password", Label: "n8n basic auth password", Internal: true, Default: "saisakthi2008"},
	{Env: "prod-infra", Key: "docker_host", Label: "Docker socket path", Internal: true, Default: "unix:///var/run/docker.sock"},
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
	envPath := filepath.Join(cfg.InfraDir, "environments")
	if err := generateDockerTfvars(cfg, envPath); err != nil {
		return err
	}
	if err := generateSocialTfvars(cfg, envPath); err != nil {
		return err
	}
	if err := generateInfraTfvars(cfg, envPath); err != nil {
		return err
	}
	if err := generateGatewayTfvars(cfg, envPath); err != nil {
		return err
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
atlantis_gh_user           = %q
atlantis_gh_token          = %q
atlantis_gh_webhook_secret = %q
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
		inf.AtlantisGHUser,
		g("atlantis_gh_token"),
		g("atlantis_gh_webhook_secret"),
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
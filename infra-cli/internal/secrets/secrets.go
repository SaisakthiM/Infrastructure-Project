// Package secrets manages sensitive values via the OS keychain (go-keyring).
// Every secret is stored as a separate keychain entry keyed by
// "social-platform-cli/<env>/<variable_name>".
// The Generate* functions write terraform.tfvars files from keychain + config.
package secrets

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/zalando/go-keyring"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

// key builds the keychain key for a given env + variable.
func key(env, variable string) string {
	return fmt.Sprintf("%s/%s/%s", config.KeychainService, env, variable)
}

// Set stores a secret in the keychain.
func Set(env, variable, value string) error {
	return keyring.Set(config.KeychainService, key(env, variable), value)
}

// Get retrieves a secret from the keychain. Returns "" if not found.
func Get(env, variable string) string {
	val, err := keyring.Get(config.KeychainService, key(env, variable))
	if err != nil {
		return ""
	}
	return val
}

// Has returns true if the secret exists in the keychain.
func Has(env, variable string) bool {
	return Get(env, variable) != ""
}

// ─── Secret definitions ─────────────────────────────────────────────────────

// SecretDef describes a single secret to prompt for.
type SecretDef struct {
	Env      string
	Key      string
	Label    string
	Multiline bool // true for SSH private keys
}

// AllSecrets is the canonical list derived from all variable.tf / tfvars files.
var AllSecrets = []SecretDef{
	// prod-docker
	{Env: "prod-docker", Key: "blog_db_password", Label: "Blog DB password"},
	{Env: "prod-docker", Key: "blog_minio_password", Label: "Blog MinIO password"},
	{Env: "prod-docker", Key: "blog_secret_key", Label: "Blog Django secret key"},
	{Env: "prod-docker", Key: "notes_db_password", Label: "Notes DB password"},
	{Env: "prod-docker", Key: "bank_db_password", Label: "Bank DB password"},
	{Env: "prod-docker", Key: "doc_db_password", Label: "Document Platform DB password"},
	{Env: "prod-docker", Key: "doc_minio_password", Label: "Document Platform MinIO password"},
	{Env: "prod-docker", Key: "doc_gemini_api_key", Label: "Gemini API key (Document Platform)"},
	{Env: "prod-docker", Key: "doc_django_secret_key", Label: "Document Platform Django secret key"},
	{Env: "prod-docker", Key: "api_key_weather", Label: "Weather API key"},
	{Env: "prod-docker", Key: "whisper_db_password", Label: "Whisper DB password"},
	{Env: "prod-docker", Key: "whisper_minio_password", Label: "Whisper MinIO password"},
	{Env: "prod-docker", Key: "whisper_jwt_secret", Label: "Whisper JWT secret"},

	// prod-social
	{Env: "prod-social", Key: "social_db_password", Label: "Social Media DB password"},
	{Env: "prod-social", Key: "social_minio_password", Label: "Social Media MinIO password"},
	{Env: "prod-social", Key: "gitops_repo_ssh_key", Label: "ArgoCD deploy SSH private key", Multiline: true},

	// prod-infra
	{Env: "prod-infra", Key: "observability_redis_password", Label: "Observability Redis password"},
	{Env: "prod-infra", Key: "atlantis_gh_token", Label: "Atlantis GitHub personal access token"},
	{Env: "prod-infra", Key: "atlantis_gh_webhook_secret", Label: "Atlantis GitHub webhook secret"},
	{Env: "prod-infra", Key: "n8n_basic_auth_password", Label: "n8n basic auth password"},
}

// ─── Interactive prompting ───────────────────────────────────────────────────

// PromptAll walks through all secrets grouped by environment and prompts the
// user. Existing values are kept unless the user enters a new one.
func PromptAll() error {
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
				// User pressed Enter — keep the existing value.
				continue
			}
			if val == "" {
				ui.Warn("  Skipping %s (empty)", s.Key)
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

// GenerateAll writes terraform.tfvars for every environment that needs one.
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
	return nil
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
	// Ensure the SSH key block ends with a newline.
	if sshKey != "" && !strings.HasSuffix(sshKey, "\n") {
		sshKey += "\n"
	}

	loadImages := "false"
	if s.LoadImages {
		loadImages = "true"
	}

	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually

# ─── SOCIAL MEDIA (Kubernetes) ────────────────────────────────
social_db_password    = %q
social_minio_user     = %q
social_minio_password = %q

load_images = %s

gitops_repo_url = %q
gitops_repo_ssh_key = <<EOF
%sEOF
`,
		g("social_db_password"),
		s.SocialMinio,
		g("social_minio_password"),
		loadImages,
		s.GitopsRepoURL,
		sshKey,
	)
	return write(filepath.Join(envPath, "prod-social", "terraform.tfvars"), content)
}

func generateInfraTfvars(cfg *config.Config, envPath string) error {
	inf := cfg.ProdInfra
	g := func(k string) string { return Get("prod-infra", k) }

	n8nPassword := g("n8n_basic_auth_password")

	content := fmt.Sprintf(`# AUTO-GENERATED by social-platform CLI — do not edit manually

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
		inf.N8NPort,
		inf.N8NHost,
		inf.N8NProtocol,
		inf.Domain,
		inf.Domain,
		inf.N8NUser,
		n8nPassword,
		g("observability_redis_password"),
		inf.GitopsRepoURL,
		inf.AtlantisGHUser,
		g("atlantis_gh_token"),
		g("atlantis_gh_webhook_secret"),
	)
	return write(filepath.Join(envPath, "prod-infra", "terraform.tfvars"), content)
}

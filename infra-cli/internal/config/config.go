// Package config manages all persistent CLI configuration via Viper.
// The config file lives at ~/.social-platform/config.yaml.
// Secrets are stored in the OS keychain (go-keyring); only non-sensitive
// values go into the YAML file.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

const (
	appName    = "social-platform"
	configFile = "config.yaml"

	KeychainService = "social-platform-cli"
)

// Config is the in-memory representation of the full CLI configuration.
type Config struct {
	InfraDir   string `mapstructure:"infra_dir"`
	ReleaseTag string `mapstructure:"release_tag"`

	Paths PathsEnv `mapstructure:"paths"`

	ProdDocker  DockerEnv  `mapstructure:"prod_docker"`
	ProdSocial  SocialEnv  `mapstructure:"prod_social"`
	ProdInfra   InfraEnv   `mapstructure:"prod_infra"`
	ProdGateway GatewayEnv `mapstructure:"prod_gateway"`
}

// PathsEnv holds filesystem paths that are machine-specific and therefore
// must never be hardcoded into the Terraform source. Shared by every
// environment that builds Docker images or mounts files from project source
// (prod-docker, prod-gateway, prod-infra, prod-social) — they all take the
// same var.projects_dir.
type PathsEnv struct {
	ProjectsDir string `mapstructure:"projects_dir"`
}

// DockerEnv holds non-secret variables for prod-docker.
// mapstructure tags match the lowercase-no-underscore keys that Viper writes
// when it serialises a nested struct, so Load/Save round-trip correctly.
type DockerEnv struct {
	BlogDBName       string `mapstructure:"blog_db_name"`
	BlogAllowedHosts string `mapstructure:"blog_allowed_hosts"`
	BlogMinioUser    string `mapstructure:"blog_minio_user"`
	NotesDBName      string `mapstructure:"notes_db_name"`
	NotesDBUser      string `mapstructure:"notes_db_user"`
	BankDBUser       string `mapstructure:"bank_db_user"`
	BankDBName       string `mapstructure:"bank_db_name"`
	DocDBName        string `mapstructure:"doc_db_name"`
	DocMinioUser     string `mapstructure:"doc_minio_user"`
	WhisperDBUser    string `mapstructure:"whisper_db_user"`
	WhisperDBName    string `mapstructure:"whisper_db_name"`
	WhisperDBTestDB  string `mapstructure:"whisper_db_test_db"`
	WhisperMinioUser string `mapstructure:"whisper_minio_user"`
}

// SocialEnv holds non-secret variables for prod-social.
type SocialEnv struct {
	LoadImages    bool   `mapstructure:"load_images"`
	GitopsRepoURL string `mapstructure:"gitops_repo_url"`
	SocialMinio   string `mapstructure:"social_minio_user"`
}

// InfraEnv holds non-secret variables for prod-infra.
type InfraEnv struct {
	MainServerIP   string `mapstructure:"main_server_ip"`
	Domain         string `mapstructure:"domain"`
	GitopsRepoURL  string `mapstructure:"gitops_repo_url"`
	AtlantisGHUser string `mapstructure:"atlantis_gh_user"`
	N8NPort        string `mapstructure:"n8n_port"`
	N8NHost        string `mapstructure:"n8n_host"`
	N8NProtocol    string `mapstructure:"n8n_protocol"`
	N8NUser        string `mapstructure:"n8n_basic_auth_user"`
}

// GatewayEnv holds non-secret variables for prod-gateway.
type GatewayEnv struct {
	LetsEncryptPath string `mapstructure:"letsencrypt_path"`
}

func Dir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "."+appName)
}

func Path() string {
	return filepath.Join(Dir(), configFile)
}

// Load reads config from disk. Returns a zero-value Config on first run.
// Automatically migrates old broken key formats (see migrate.go) on first run.
func Load() (*Config, error) {
	MigrateIfNeeded()
	v := viper.New()
	v.SetConfigFile(Path())
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("reading config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}
	return &cfg, nil
}

// Save writes the config to disk using explicit per-field Viper keys so that
// nested struct fields are saved with the exact key names the mapstructure tags
// expect. Using v.Set("prod_docker", struct{}) lets Viper pick key names from
// Go field names (lowercased, no underscores) which don't match the tags and
// causes values to be lost on the next Load().
func Save(cfg *Config) error {
	if err := os.MkdirAll(Dir(), 0700); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	v := viper.New()
	v.SetConfigFile(Path())
	v.SetConfigType("yaml")

	// Top-level scalars.
	v.Set("infra_dir", cfg.InfraDir)
	v.Set("release_tag", cfg.ReleaseTag)

	// paths — machine-specific, never hardcoded into .tf source.
	v.Set("paths.projects_dir", cfg.Paths.ProjectsDir)

	// prod_docker — explicit keys match mapstructure tags exactly.
	v.Set("prod_docker.blog_db_name", cfg.ProdDocker.BlogDBName)
	v.Set("prod_docker.blog_allowed_hosts", cfg.ProdDocker.BlogAllowedHosts)
	v.Set("prod_docker.blog_minio_user", cfg.ProdDocker.BlogMinioUser)
	v.Set("prod_docker.notes_db_name", cfg.ProdDocker.NotesDBName)
	v.Set("prod_docker.notes_db_user", cfg.ProdDocker.NotesDBUser)
	v.Set("prod_docker.bank_db_user", cfg.ProdDocker.BankDBUser)
	v.Set("prod_docker.bank_db_name", cfg.ProdDocker.BankDBName)
	v.Set("prod_docker.doc_db_name", cfg.ProdDocker.DocDBName)
	v.Set("prod_docker.doc_minio_user", cfg.ProdDocker.DocMinioUser)
	v.Set("prod_docker.whisper_db_user", cfg.ProdDocker.WhisperDBUser)
	v.Set("prod_docker.whisper_db_name", cfg.ProdDocker.WhisperDBName)
	v.Set("prod_docker.whisper_db_test_db", cfg.ProdDocker.WhisperDBTestDB)
	v.Set("prod_docker.whisper_minio_user", cfg.ProdDocker.WhisperMinioUser)

	// prod_social
	v.Set("prod_social.load_images", cfg.ProdSocial.LoadImages)
	v.Set("prod_social.gitops_repo_url", cfg.ProdSocial.GitopsRepoURL)
	v.Set("prod_social.social_minio_user", cfg.ProdSocial.SocialMinio)

	// prod_infra
	v.Set("prod_infra.main_server_ip", cfg.ProdInfra.MainServerIP)
	v.Set("prod_infra.domain", cfg.ProdInfra.Domain)
	v.Set("prod_infra.gitops_repo_url", cfg.ProdInfra.GitopsRepoURL)
	v.Set("prod_infra.atlantis_gh_user", cfg.ProdInfra.AtlantisGHUser)
	v.Set("prod_infra.n8n_port", cfg.ProdInfra.N8NPort)
	v.Set("prod_infra.n8n_host", cfg.ProdInfra.N8NHost)
	v.Set("prod_infra.n8n_protocol", cfg.ProdInfra.N8NProtocol)
	v.Set("prod_infra.n8n_basic_auth_user", cfg.ProdInfra.N8NUser)

	// prod_gateway
	v.Set("prod_gateway.letsencrypt_path", cfg.ProdGateway.LetsEncryptPath)

	if err := v.WriteConfigAs(Path()); err != nil {
		return fmt.Errorf("writing config: %w", err)
	}
	return nil
}

// InfraExists returns true if the infra directory from config actually exists.
func (c *Config) InfraExists() bool {
	if c.InfraDir == "" {
		return false
	}
	_, err := os.Stat(filepath.Join(c.InfraDir, "environments"))
	return err == nil
}

func DefaultInfraDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "."+appName, "infra")
}

// knownProjectDirs is a sample of subfolders that only exist inside a real
// "projects" directory. Used to validate a candidate path before trusting it.
var knownProjectDirs = []string{
	"Bank Manager", "Blog Website", "Whatsapp", "Notes App",
	"Social Media App", "Quiz App", "Video Uploader",
}

// looksLikeProjectsDir reports whether dir contains at least one of the
// known project subfolders, i.e. it's actually the "projects/" root and not
// some unrelated directory.
func looksLikeProjectsDir(dir string) bool {
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return false
	}
	for _, name := range knownProjectDirs {
		if st, err := os.Stat(filepath.Join(dir, name)); err == nil && st.IsDir() {
			return true
		}
	}
	return false
}

// DetectProjectsDir scans the usual candidate locations for the "projects"
// directory (sibling of "environments" inside the infra monorepo) and
// returns the first absolute path that looks right. Returns "" if nothing
// was found — callers should fall back to prompting the user.
func DetectProjectsDir(infraDir string) string {
	if infraDir == "" {
		return ""
	}
	candidates := []string{
		filepath.Join(infraDir, "projects"),          // infra-dir/projects (standard layout)
		filepath.Join(filepath.Dir(infraDir), "projects"), // sibling of infra-dir
	}
	for _, c := range candidates {
		abs, err := filepath.Abs(c)
		if err != nil {
			continue
		}
		if looksLikeProjectsDir(abs) {
			return abs
		}
	}
	return ""
}

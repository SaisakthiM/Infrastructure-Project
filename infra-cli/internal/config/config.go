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

	// KeychainService is the identifier used with go-keyring.
	KeychainService = "social-platform-cli"
)

// Config is the in-memory representation of the full CLI configuration.
type Config struct {
	// InfraDir is the local path where infra was extracted.
	InfraDir string `mapstructure:"infra_dir"`
	// ReleaseTag that was last downloaded (e.g. "v1.2.3").
	ReleaseTag string `mapstructure:"release_tag"`

	// Non-secret values per environment.
	ProdDocker  DockerEnv  `mapstructure:"prod_docker"`
	ProdSocial  SocialEnv  `mapstructure:"prod_social"`
	ProdInfra   InfraEnv   `mapstructure:"prod_infra"`
	ProdGateway GatewayEnv `mapstructure:"prod_gateway"`
}

// DockerEnv holds non-secret variables for prod-docker.
type DockerEnv struct {
	BlogDBName       string `mapstructure:"blog_db_name"`
	BlogAllowedHosts string `mapstructure:"blog_allowed_hosts"`
	NotesDBName      string `mapstructure:"notes_db_name"`
	NotesDBUser      string `mapstructure:"notes_db_user"`
	BankDBUser       string `mapstructure:"bank_db_user"`
	BankDBName       string `mapstructure:"bank_db_name"`
	DocDBName        string `mapstructure:"doc_db_name"`
	DocMinioUser     string `mapstructure:"doc_minio_user"`
	BlogMinioUser    string `mapstructure:"blog_minio_user"`
	WhisperDBUser    string `mapstructure:"whisper_db_user"`
	WhisperDBName    string `mapstructure:"whisper_db_database"`
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
	MainServerIP  string `mapstructure:"main_server_ip"`
	Domain        string `mapstructure:"domain"`
	GitopsRepoURL string `mapstructure:"gitops_repo_url"`
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

// Dir returns the CLI config directory (~/.social-platform).
func Dir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "."+appName)
}

// Path returns the full path to the config YAML file.
func Path() string {
	return filepath.Join(Dir(), configFile)
}

// Load reads config from disk into a Config struct. Returns zero-value Config
// if no config file exists yet (first run).
func Load() (*Config, error) {
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

// Save writes the config struct to disk. Creates the config directory if needed.
func Save(cfg *Config) error {
	if err := os.MkdirAll(Dir(), 0700); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	v := viper.New()
	v.SetConfigFile(Path())
	v.SetConfigType("yaml")

	// Marshal struct fields into Viper manually so we don't lose nested keys.
	v.Set("infra_dir", cfg.InfraDir)
	v.Set("release_tag", cfg.ReleaseTag)
	v.Set("prod_docker", cfg.ProdDocker)
	v.Set("prod_social", cfg.ProdSocial)
	v.Set("prod_infra", cfg.ProdInfra)
	v.Set("prod_gateway", cfg.ProdGateway)

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

// DefaultInfraDir returns the default extraction path.
func DefaultInfraDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "."+appName, "infra")
}

package config

// migrateV1Keys handles the one-time migration from the broken key format
// (Viper's default lowercase-no-underscore output, e.g. "blogdbname") to the
// correct underscore format ("blog_db_name") that matches mapstructure tags.
//
// Called automatically at the top of Load(). Safe to call repeatedly — it
// only rewrites the file if old-format keys are detected.

import (
	"os"

	"github.com/spf13/viper"
)

// oldToNew maps the broken YAML keys Viper used to write (Go field name,
// lowercased, underscores stripped) to the correct keys (mapstructure tags).
var oldDockerKeys = map[string]string{
	"blogdbname":       "blog_db_name",
	"blogallowedhosts": "blog_allowed_hosts",
	"blogminiouser":    "blog_minio_user",
	"notesdbname":      "notes_db_name",
	"notesdbuser":      "notes_db_user",
	"bankdbuser":       "bank_db_user",
	"bankdbname":       "bank_db_name",
	"docdbname":        "doc_db_name",
	"docminiouser":     "doc_minio_user",
	"whisperdbuser":    "whisper_db_user",
	"whisperdbname":    "whisper_db_name",
	"whisperdbtestdb":  "whisper_db_test_db",
	"whisperminiouser": "whisper_minio_user",
}

var oldSocialKeys = map[string]string{
	"loadimages":    "load_images",
	"gitopsrepourl": "gitops_repo_url",
	"socialminio":   "social_minio_user",
}

var oldInfraKeys = map[string]string{
	"mainserverip":   "main_server_ip",
	"domain":         "domain",
	"gitopsrepourl":  "gitops_repo_url",
	"atlantisghuser": "atlantis_gh_user",
	"n8nport":        "n8n_port",
	"n8nhost":        "n8n_host",
	"n8nprotocol":    "n8n_protocol",
	"n8nuser":        "n8n_basic_auth_user",
}

var oldGatewayKeys = map[string]string{
	"letsencryptpath": "letsencrypt_path",
}

// MigrateIfNeeded reads the config file, detects broken keys, rewrites with
// correct keys, then returns so Load() can re-read the fixed file.
func MigrateIfNeeded() {
	if _, err := os.Stat(Path()); err != nil {
		return // no config file yet
	}

	v := viper.New()
	v.SetConfigFile(Path())
	v.SetConfigType("yaml")
	if err := v.ReadInConfig(); err != nil {
		return
	}

	// Check whether the OLD key format is present anywhere.
	needsMigration := false
	for old := range oldDockerKeys {
		if v.IsSet("prod_docker." + old) {
			needsMigration = true
			break
		}
	}
	if !needsMigration {
		return
	}

	// Re-read raw values via old keys, write back via new keys.
	vNew := viper.New()
	vNew.SetConfigFile(Path())
	vNew.SetConfigType("yaml")

	vNew.Set("infra_dir", v.GetString("infra_dir"))
	vNew.Set("release_tag", v.GetString("release_tag"))

	for old, new := range oldDockerKeys {
		if val := v.Get("prod_docker." + old); val != nil {
			vNew.Set("prod_docker."+new, val)
		}
	}
	for old, new := range oldSocialKeys {
		if val := v.Get("prod_social." + old); val != nil {
			vNew.Set("prod_social."+new, val)
		}
	}
	for old, new := range oldInfraKeys {
		if val := v.Get("prod_infra." + old); val != nil {
			vNew.Set("prod_infra."+new, val)
		}
	}
	for old, new := range oldGatewayKeys {
		if val := v.Get("prod_gateway." + old); val != nil {
			vNew.Set("prod_gateway."+new, val)
		}
	}

	// Best-effort write — if it fails, Load() will just get empty values again
	// and the user will need to re-run configure. Not fatal.
	_ = vNew.WriteConfigAs(Path())
}

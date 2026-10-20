package vars

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleTF = `
# a comment
variable "docker_host" {
  description = "Docker provider socket/endpoint, e.g. unix:///home/you/.docker/desktop/docker.sock"
}

variable "blog_db_password"    { sensitive = true }
variable "blog_db_name"        {}

variable "shared_pg_admin_password" {
  description = "Superuser ('postgres') password -- only the init container uses it."
  type        = string
  sensitive   = true
  default = "saipostgres"
}

variable "whisper_minio_buckets" {
  description = "Buckets. No default on purpose -- check with: docker exec x ls /data"
  type        = list(string)
  default = [ "whisper-minio" ]
}

variable "n8n_env" {
  type = map(string)
}

variable "load_images" {
  type    = bool
  default = false
}

variable "with_validation" {
  type = string
  validation {
    condition     = length(var.with_validation) > 3
    error_message = "too short } with a brace"
  }
}

resource "x" "y" {
  name = "${var.blog_db_name}-{not a block}"
}
`

func byName(vs []Var) map[string]Var {
	m := map[string]Var{}
	for _, v := range vs {
		m[v.Name] = v
	}
	return m
}

func TestParse(t *testing.T) {
	vs := Parse(sampleTF)
	if len(vs) != 8 {
		t.Fatalf("want 8 variables, got %d: %+v", len(vs), vs)
	}
	m := byName(vs)

	if !m["docker_host"].Required() || !strings.Contains(m["docker_host"].Description, "docker.sock") {
		t.Errorf("docker_host: %+v", m["docker_host"])
	}
	if !m["blog_db_password"].Sensitive || !m["blog_db_password"].Required() {
		t.Errorf("blog_db_password: %+v", m["blog_db_password"])
	}
	if !m["blog_db_name"].Required() || m["blog_db_name"].Sensitive {
		t.Errorf("blog_db_name: %+v", m["blog_db_name"])
	}
	pg := m["shared_pg_admin_password"]
	if pg.Required() || !pg.Sensitive || pg.Default != `"saipostgres"` || pg.Type != "string" {
		t.Errorf("shared_pg_admin_password: %+v", pg)
	}
	if b := m["whisper_minio_buckets"]; b.Required() || b.Type != "list(string)" || !strings.Contains(b.Default, "whisper-minio") {
		t.Errorf("buckets: %+v", b)
	}
	if v := m["n8n_env"]; !v.Required() || v.IsString() {
		t.Errorf("n8n_env: %+v", v)
	}
	if v := m["load_images"]; v.Required() || v.Default != "false" {
		t.Errorf("load_images: %+v", v)
	}
	if v := m["with_validation"]; !v.Required() || v.Type != "string" {
		t.Errorf("with_validation (a validation block must not break parsing): %+v", v)
	}
}

const sampleTfvars = `# AUTO-GENERATED
projects_dir = "/home/me/Infrastructure-Project/projects"
docker_host = "unix:///var/run/docker.sock"
blog_db_password = ""
load_images = false

n8n_env = {
  N8N_PORT      = "5678"
  N8N_PASSWORD  = "x = y"
}

gitops_repo_ssh_key = <<EOF
-----BEGIN KEY-----
abc = def
-----END KEY-----
EOF
smtp_password = "pa$$word"
`

func TestParseTfvars(t *testing.T) {
	m := ParseTfvars(sampleTfvars)
	for _, k := range []string{"projects_dir", "docker_host", "blog_db_password", "load_images", "n8n_env", "gitops_repo_ssh_key", "smtp_password"} {
		if _, ok := m[k]; !ok {
			t.Errorf("missing key %s in %v", k, m)
		}
	}
	if _, ok := m["N8N_PORT"]; ok {
		t.Error("keys of nested maps must not leak to the top level")
	}
	if _, ok := m["abc"]; ok {
		t.Error("heredoc content must not be parsed as assignments")
	}
	if len(m) != 7 {
		t.Errorf("want 7 top-level keys, got %d: %v", len(m), m)
	}
	if IsEmptyValue(m["gitops_repo_ssh_key"]) {
		t.Error("a heredoc with content is not empty")
	}
	if !IsEmptyValue(m["blog_db_password"]) {
		t.Error(`"" must count as no value`)
	}
}

func TestIsEmptyValue(t *testing.T) {
	for raw, want := range map[string]bool{
		``: true, `""`: true, `null`: true, `"x"`: false, "false": false,
		"<<EOF\nEOF": true, "<<EOF\n  \nEOF": true, "<<EOF\nkey\nEOF": false,
	} {
		if got := IsEmptyValue(raw); got != want {
			t.Errorf("IsEmptyValue(%q) = %v, want %v", raw, got, want)
		}
	}
}

func TestMissing(t *testing.T) {
	dir := t.TempDir()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.WriteFile(filepath.Join(dir, "variable.tf"), []byte(`
variable "docker_host" {}
variable "smtp_user" {}
variable "smtp_password" { sensitive = true }
variable "gitops_repo_url" { default = "git@example.com:x/y.git" }
`), 0644))
	must(os.WriteFile(filepath.Join(dir, "terraform.tfvars"), []byte(`
docker_host = "unix:///var/run/docker.sock"
smtp_password = ""
`), 0600))

	miss, err := Missing(dir)
	must(err)
	var names []string
	for _, v := range miss {
		names = append(names, v.Name)
	}
	if got := strings.Join(names, ","); got != "smtp_user,smtp_password" {
		t.Errorf("missing = %s, want smtp_user,smtp_password", got)
	}

	// no tfvars at all: everything required is missing
	must(os.Remove(filepath.Join(dir, "terraform.tfvars")))
	miss, err = Missing(dir)
	must(err)
	if len(miss) != 3 {
		t.Errorf("without tfvars want 3 missing, got %d", len(miss))
	}
}

func TestFormatAssignment(t *testing.T) {
	cases := []struct {
		v     Var
		value string
		want  string
		bad   bool
	}{
		{Var{Name: "a"}, "plain", "a = \"plain\"\n", false},
		{Var{Name: "a", Type: "string"}, `he said "hi" \ ok`, "a = \"he said \\\"hi\\\" \\\\ ok\"\n", false},
		{Var{Name: "a"}, "cost ${x} and %{y}", "a = \"cost $${x} and %%{y}\"\n", false},
		{Var{Name: "b", Type: "bool"}, "TRUE", "b = true\n", false},
		{Var{Name: "b", Type: "bool"}, "yes", "", true},
		{Var{Name: "n", Type: "number"}, "42", "n = 42\n", false},
		{Var{Name: "n", Type: "number"}, "x", "", true},
		{Var{Name: "l", Type: "list(string)"}, `["a","b"]`, "l = [\"a\",\"b\"]\n", false},
		{Var{Name: "k"}, "line1\nline2", "k = <<EOT\nline1\nline2\nEOT\n", false},
		{Var{Name: "k"}, "has EOT inside\nx", "k = <<EOTX\nhas EOT inside\nx\nEOTX\n", false},
	}
	for _, c := range cases {
		got, err := FormatAssignment(c.v, c.value)
		if c.bad {
			if err == nil {
				t.Errorf("%+v %q: expected an error", c.v, c.value)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("%+v %q:\n got %q (err %v)\nwant %q", c.v, c.value, got, err, c.want)
		}
	}
}

func TestFormattedValuesRoundTripThroughTheParser(t *testing.T) {
	v := Var{Name: "smtp_password"}
	for _, value := range []string{"simple", `with "quotes" and \ backslash`, "cost ${not_interp}", "multi\nline\nvalue"} {
		line, err := FormatAssignment(v, value)
		if err != nil {
			t.Fatal(err)
		}
		m := ParseTfvars(line + "next_key = \"after\"\n")
		if _, ok := m["smtp_password"]; !ok || m["next_key"] != `"after"` {
			t.Errorf("value %q broke the file structure: %v", value, m)
		}
	}
}

func TestAppendAssignments(t *testing.T) {
	path := filepath.Join(t.TempDir(), "env", "terraform.tfvars")
	if err := AppendAssignments(path, []string{"a = \"1\"\n"}); err != nil {
		t.Fatal(err)
	}
	if err := AppendAssignments(path, []string{"b = \"2\"\n"}); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(path)
	m := ParseTfvars(string(b))
	if m["a"] != `"1"` || m["b"] != `"2"` {
		t.Errorf("got %q", string(b))
	}
	if st, _ := os.Stat(path); st.Mode().Perm() != 0600 {
		t.Errorf("tfvars must stay private, mode %v", st.Mode().Perm())
	}
}

func TestRemoveKeys(t *testing.T) {
	src := "a = \"1\"\nsmtp_password = \"\"\nn8n_env = {\n  smtp_password = \"nested stays\"\n}\nkey = <<EOF\nsmtp_password = x\nEOF\nb = 2\n"
	got := RemoveKeys(src, "smtp_password", "b")
	m := ParseTfvars(got)
	if _, ok := m["smtp_password"]; ok {
		t.Errorf("top-level smtp_password should be gone:\n%s", got)
	}
	if _, ok := m["b"]; ok {
		t.Errorf("b should be gone:\n%s", got)
	}
	if !strings.Contains(got, "nested stays") || !strings.Contains(got, "smtp_password = x") {
		t.Errorf("nested map and heredoc content must be untouched:\n%s", got)
	}
	if m["a"] != `"1"` || len(m) != 3 {
		t.Errorf("other keys must survive: %v", m)
	}
}

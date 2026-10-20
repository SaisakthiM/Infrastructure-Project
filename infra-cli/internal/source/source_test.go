package source

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func run(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

// newRepos builds: origin (bare) <- seed (pushes commits) and work (the folder under test).
func newRepos(t *testing.T) (work, seed string) {
	t.Helper()
	t.Setenv("GIT_CONFIG_GLOBAL", os.DevNull)
	t.Setenv("GIT_CONFIG_SYSTEM", os.DevNull)
	t.Setenv("GIT_AUTHOR_NAME", "t")
	t.Setenv("GIT_AUTHOR_EMAIL", "t@example.com")
	t.Setenv("GIT_COMMITTER_NAME", "t")
	t.Setenv("GIT_COMMITTER_EMAIL", "t@example.com")

	root := t.TempDir()
	origin := filepath.Join(root, "origin.git")
	seed = filepath.Join(root, "seed")
	work = filepath.Join(root, "work")

	if out, err := exec.Command("git", "init", "--bare", "-b", "main", origin).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	if out, err := exec.Command("git", "clone", origin, seed).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	run(t, seed, "checkout", "-B", "main")
	write(t, filepath.Join(seed, "environments", "prod-docker", "main.tf"), "# v1\n")
	write(t, filepath.Join(seed, "environments", "prod-docker", "variable.tf"), "variable \"a\" {}\n")
	write(t, filepath.Join(seed, "projects", "app", "index.html"), "v1")
	write(t, filepath.Join(seed, ".gitignore"), "terraform.tfstate*\nterraform.tfvars\n.terraform/\n.terragrunt-cache/\n")
	run(t, seed, "add", ".")
	run(t, seed, "commit", "-m", "first")
	run(t, seed, "push", "-u", "origin", "main")

	if out, err := exec.Command("git", "clone", origin, work).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	return work, seed
}

func push(t *testing.T, seed, rel, content, msg string) {
	t.Helper()
	write(t, filepath.Join(seed, rel), content)
	run(t, seed, "add", ".")
	run(t, seed, "commit", "-m", msg)
	run(t, seed, "push", "origin", "main")
}

func TestValidate(t *testing.T) {
	dir := t.TempDir()
	if err := Validate(dir); err == nil {
		t.Error("a folder without environments/ must be rejected")
	}
	os.MkdirAll(filepath.Join(dir, "environments"), 0755)
	if err := Validate(dir); err != nil {
		t.Errorf("unexpected: %v", err)
	}
	if err := Validate(filepath.Join(dir, "nope")); err == nil {
		t.Error("a missing folder must be rejected")
	}
	if err := Validate(""); err == nil {
		t.Error("an empty path must be rejected")
	}
}

func TestAffectedEnvs(t *testing.T) {
	got := AffectedEnvs([]string{
		"environments/prod-infra/main.tf",
		"environments/prod-docker/variable.tf",
		"projects/hospital_management/hospital/views.py",
		"gitops/app.yaml",
		"README.md",
		"environments/not-an-env/x.tf",
	})
	want := []string{"prod-gateway", "prod-docker", "prod-infra"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
	if len(AffectedEnvs([]string{"README.md"})) != 0 {
		t.Error("docs-only changes affect nothing")
	}
}

func TestInspect(t *testing.T) {
	work, seed := newRepos(t)
	info, err := Inspect(work)
	if err != nil || !info.IsGit || info.Branch != "main" || info.Remote != "origin" {
		t.Fatalf("%+v %v", info, err)
	}
	if info.Behind != 0 || info.Dirty {
		t.Errorf("fresh clone should be clean and current: %+v", info)
	}
	push(t, seed, "projects/app/index.html", "v2", "second")
	run(t, work, "fetch")
	info, _ = Inspect(work)
	if info.Behind != 1 {
		t.Errorf("want behind=1, got %+v", info)
	}
	write(t, filepath.Join(work, "projects", "app", "index.html"), "local edit")
	info, _ = Inspect(work)
	if !info.Dirty || len(info.DirtyFiles) != 1 {
		t.Errorf("want one dirty file: %+v", info)
	}

	plain := t.TempDir()
	info, err = Inspect(plain)
	if err != nil || info.IsGit {
		t.Errorf("a plain folder is not git: %+v %v", info, err)
	}
}

func TestSyncAlreadyUpToDate(t *testing.T) {
	work, _ := newRepos(t)
	var out bytes.Buffer
	res, err := Sync(work, SyncOptions{}, &out)
	if err != nil || res.Updated || res.Behind != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	if !strings.Contains(out.String(), "Already up to date") {
		t.Errorf("output: %s", out.String())
	}
}

func TestSyncFastForwardKeepsCachesAndState(t *testing.T) {
	work, seed := newRepos(t)

	// everything the CLI and Terraform keep next to the sources
	state := filepath.Join(work, "environments", "prod-docker", "terraform.tfstate")
	tfvars := filepath.Join(work, "environments", "prod-docker", "terraform.tfvars")
	cache := filepath.Join(work, "environments", "prod-docker", ".terragrunt-cache", "abc", "provider.bin")
	write(t, state, `{"serial":7}`)
	write(t, tfvars, `a = "secret"`)
	write(t, cache, "cached")

	push(t, seed, "environments/prod-docker/main.tf", "# v2\n", "change docker")
	push(t, seed, "projects/app/index.html", "v2", "change app")

	var out bytes.Buffer
	res, err := Sync(work, SyncOptions{}, &out)
	if err != nil {
		t.Fatalf("%v\n%s", err, out.String())
	}
	if !res.Updated || res.Behind != 2 || res.Before == res.After {
		t.Errorf("%+v", res)
	}
	if got := strings.Join(res.AffectedEnvs, ","); got != "prod-gateway,prod-docker" {
		t.Errorf("affected = %s", got)
	}
	b, _ := os.ReadFile(filepath.Join(work, "projects", "app", "index.html"))
	if string(b) != "v2" {
		t.Error("working tree was not updated")
	}
	for path, want := range map[string]string{state: `{"serial":7}`, tfvars: `a = "secret"`, cache: "cached"} {
		got, err := os.ReadFile(path)
		if err != nil || string(got) != want {
			t.Errorf("%s must survive a sync untouched (err %v, got %q)", path, err, got)
		}
	}
}

func TestSyncFlagsVariableChanges(t *testing.T) {
	work, seed := newRepos(t)
	push(t, seed, "environments/prod-docker/variable.tf", "variable \"a\" {}\nvariable \"b\" {}\n", "new variable")
	res, err := Sync(work, SyncOptions{}, nil)
	if err != nil || !res.VariablesTF {
		t.Errorf("a changed variable.tf must be reported: %+v %v", res, err)
	}
}

func TestSyncDryRunChangesNothing(t *testing.T) {
	work, seed := newRepos(t)
	push(t, seed, "projects/app/index.html", "v2", "second")
	before := run(t, work, "rev-parse", "HEAD")
	res, err := Sync(work, SyncOptions{DryRun: true}, nil)
	if err != nil || res.Updated || res.Behind != 1 {
		t.Fatalf("%+v %v", res, err)
	}
	if run(t, work, "rev-parse", "HEAD") != before {
		t.Error("dry run moved HEAD")
	}
}

func TestSyncRefusesToOverwriteLocalEditsUnlessAutostash(t *testing.T) {
	work, seed := newRepos(t)
	push(t, seed, "environments/prod-docker/main.tf", "# v2\n", "remote change")
	write(t, filepath.Join(work, "projects", "app", "index.html"), "my local edit")

	_, err := Sync(work, SyncOptions{}, nil)
	if err == nil || !strings.Contains(err.Error(), "--autostash") {
		t.Fatalf("expected a refusal that mentions --autostash, got %v", err)
	}
	b, _ := os.ReadFile(filepath.Join(work, "projects", "app", "index.html"))
	if string(b) != "my local edit" {
		t.Error("local edit was lost")
	}

	res, err := Sync(work, SyncOptions{AutoStash: true}, nil)
	if err != nil || !res.Updated || !res.Stashed {
		t.Fatalf("%+v %v", res, err)
	}
	b, _ = os.ReadFile(filepath.Join(work, "projects", "app", "index.html"))
	if string(b) != "my local edit" {
		t.Errorf("autostash must re-apply the local edit, got %q", b)
	}
	m, _ := os.ReadFile(filepath.Join(work, "environments", "prod-docker", "main.tf"))
	if string(m) != "# v2\n" {
		t.Error("incoming change missing")
	}
}

func TestSyncDivergedNeedsRebase(t *testing.T) {
	work, seed := newRepos(t)
	push(t, seed, "environments/prod-docker/main.tf", "# remote\n", "remote")
	write(t, filepath.Join(work, "projects", "app", "other.txt"), "mine")
	run(t, work, "add", ".")
	run(t, work, "commit", "-m", "local commit")

	_, err := Sync(work, SyncOptions{}, nil)
	if err == nil || !strings.Contains(err.Error(), "diverged") {
		t.Fatalf("want a divergence error, got %v", err)
	}

	res, err := Sync(work, SyncOptions{Rebase: true}, nil)
	if err != nil || !res.Updated {
		t.Fatalf("rebase sync failed: %+v %v", res, err)
	}
	if _, err := os.Stat(filepath.Join(work, "projects", "app", "other.txt")); err != nil {
		t.Error("local commit lost during rebase")
	}
}

func TestSyncErrors(t *testing.T) {
	plain := t.TempDir()
	if _, err := Sync(plain, SyncOptions{}, nil); err == nil || !strings.Contains(err.Error(), "not a git repository") {
		t.Errorf("got %v", err)
	}
	work, _ := newRepos(t)
	if _, err := Sync(work, SyncOptions{Branch: "does-not-exist"}, nil); err == nil {
		t.Error("an unknown branch must be an error")
	}
}

func TestCarryOverStateNeverOverwrites(t *testing.T) {
	from, to := t.TempDir(), t.TempDir()
	for _, env := range []string{"prod-docker", "prod-infra", "prod-manage"} {
		os.MkdirAll(filepath.Join(from, "environments", env), 0755)
		os.MkdirAll(filepath.Join(to, "environments", env), 0755)
	}
	write(t, filepath.Join(from, "environments", "prod-docker", "terraform.tfstate"), "old-docker")
	write(t, filepath.Join(from, "environments", "prod-docker", "terraform.tfstate.backup"), "old-docker-backup")
	write(t, filepath.Join(from, "environments", "prod-infra", "terraform.tfstate"), "old-infra")
	write(t, filepath.Join(to, "environments", "prod-infra", "terraform.tfstate"), "NEW-infra") // must be kept

	if got := StateCandidates(from, to); !reflect.DeepEqual(got, []string{"prod-docker"}) {
		t.Errorf("candidates = %v", got)
	}
	copied, err := CarryOverState(from, to)
	if err != nil {
		t.Fatal(err)
	}
	if len(copied) != 2 {
		t.Errorf("copied = %v", copied)
	}
	if b, _ := os.ReadFile(filepath.Join(to, "environments", "prod-docker", "terraform.tfstate")); string(b) != "old-docker" {
		t.Errorf("docker state not carried: %q", b)
	}
	if b, _ := os.ReadFile(filepath.Join(to, "environments", "prod-infra", "terraform.tfstate")); string(b) != "NEW-infra" {
		t.Errorf("existing state was overwritten: %q", b)
	}
	if b, _ := os.ReadFile(filepath.Join(from, "environments", "prod-docker", "terraform.tfstate")); string(b) != "old-docker" {
		t.Error("the source state must stay in place")
	}
}

func TestExpandHome(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home dir")
	}
	if got := ExpandHome("~/Infrastructure-Project"); got != filepath.Join(home, "Infrastructure-Project") {
		t.Errorf("got %s", got)
	}
	if got := ExpandHome("/tmp/x/../y"); got != "/tmp/y" {
		t.Errorf("got %s", got)
	}
}

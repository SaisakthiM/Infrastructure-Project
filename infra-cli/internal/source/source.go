// Package source deals with WHERE the infrastructure files come from.
//
// The CLI can deploy from a folder you pick (for example your own git checkout
// in ~/Infrastructure-Project) instead of its private downloaded copy, and it
// can bring that folder up to date with `git fetch` + a fast-forward merge.
// Syncing only ever touches git-tracked files: Terraform state, provider and
// Terragrunt caches and generated terraform.tfvars are untracked/ignored, so
// they survive untouched.
package source

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Environments in the order they must be applied.
var envOrder = []string{"prod-gateway", "prod-docker", "prod-social", "prod-infra", "prod-manage"}

// Validate checks that dir looks like an infrastructure folder.
func Validate(dir string) error {
	if dir == "" {
		return errors.New("no folder given")
	}
	st, err := os.Stat(dir)
	if err != nil {
		return fmt.Errorf("%s: %w", dir, err)
	}
	if !st.IsDir() {
		return fmt.Errorf("%s is not a folder", dir)
	}
	if st, err := os.Stat(filepath.Join(dir, "environments")); err != nil || !st.IsDir() {
		return fmt.Errorf("%s has no environments/ folder — pick the folder that contains environments/ and projects/", dir)
	}
	return nil
}

// Info describes a source folder.
type Info struct {
	Dir        string   `json:"dir"`
	IsGit      bool     `json:"is_git"`
	Branch     string   `json:"branch"`
	Remote     string   `json:"remote"`
	Upstream   string   `json:"upstream"`
	Head       string   `json:"head"`
	Ahead      int      `json:"ahead"`
	Behind     int      `json:"behind"`
	Dirty      bool     `json:"dirty"`
	DirtyFiles []string `json:"dirty_files"`
}

func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	var out, errb bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errb.String())
		if msg == "" {
			msg = err.Error()
		}
		return strings.TrimSpace(out.String()), fmt.Errorf("git %s: %s", strings.Join(args, " "), msg)
	}
	return strings.TrimSpace(out.String()), nil
}

// gitToplevel is the repo root containing dir ("" when dir is not in a repo).
func gitToplevel(dir string) string {
	out, err := git(dir, "rev-parse", "--show-toplevel")
	if err != nil {
		return ""
	}
	return out
}

// Inspect reads the git state of dir. A folder that is not a git repository is
// reported with IsGit == false (that is not an error).
func Inspect(dir string) (*Info, error) {
	info := &Info{Dir: dir}
	if _, err := exec.LookPath("git"); err != nil {
		return info, nil
	}
	if gitToplevel(dir) == "" {
		return info, nil
	}
	info.IsGit = true
	info.Branch, _ = git(dir, "rev-parse", "--abbrev-ref", "HEAD")
	info.Head, _ = git(dir, "rev-parse", "--short", "HEAD")
	info.Remote = remoteFor(dir, info.Branch)
	if info.Branch != "" && info.Branch != "HEAD" {
		up := info.Remote + "/" + info.Branch
		if _, err := git(dir, "rev-parse", "--verify", "--quiet", "refs/remotes/"+up); err == nil {
			info.Upstream = up
			info.Ahead, info.Behind = aheadBehind(dir, up)
		}
	}
	dirty, _ := git(dir, "status", "--porcelain", "--untracked-files=no")
	for _, l := range strings.Split(dirty, "\n") {
		if strings.TrimSpace(l) != "" {
			info.DirtyFiles = append(info.DirtyFiles, strings.TrimSpace(l))
		}
	}
	info.Dirty = len(info.DirtyFiles) > 0
	return info, nil
}

func remoteFor(dir, branch string) string {
	if branch != "" && branch != "HEAD" {
		if r, err := git(dir, "config", "--get", "branch."+branch+".remote"); err == nil && r != "" && r != "." {
			return r
		}
	}
	return "origin"
}

func aheadBehind(dir, upstream string) (ahead, behind int) {
	out, err := git(dir, "rev-list", "--left-right", "--count", "HEAD..."+upstream)
	if err != nil {
		return 0, 0
	}
	f := strings.Fields(out)
	if len(f) == 2 {
		ahead, _ = strconv.Atoi(f[0])
		behind, _ = strconv.Atoi(f[1])
	}
	return ahead, behind
}

// Candidates lists folders worth offering when the user is asked to pick one.
func Candidates(home, cwd, current string) []string {
	var raw []string
	raw = append(raw, current)
	if home != "" {
		raw = append(raw,
			filepath.Join(home, "Infrastructure-Project"),
			filepath.Join(home, "Coding-Project"),
			filepath.Join(home, ".social-platform", "infra"),
		)
	}
	raw = append(raw, cwd)
	if cwd != "" {
		raw = append(raw, filepath.Dir(cwd))
		if top := gitToplevel(cwd); top != "" {
			raw = append(raw, top)
		}
	}
	seen := map[string]bool{}
	var out []string
	for _, c := range raw {
		if c == "" {
			continue
		}
		abs, err := filepath.Abs(c)
		if err != nil || seen[abs] {
			continue
		}
		seen[abs] = true
		if Validate(abs) == nil {
			out = append(out, abs)
		}
	}
	return out
}

// ExpandHome turns "~", "~/x" into absolute paths and cleans the result.
func ExpandHome(p string) string {
	p = strings.TrimSpace(p)
	if p == "~" || strings.HasPrefix(p, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			p = filepath.Join(home, strings.TrimPrefix(p, "~"))
		}
	}
	if abs, err := filepath.Abs(p); err == nil {
		return abs
	}
	return p
}

// ─── sync ───────────────────────────────────────────────────────────────────

// SyncOptions controls Sync.
type SyncOptions struct {
	Remote    string // default: the branch's remote, else "origin"
	Branch    string // default: the checked-out branch
	AutoStash bool   // stash tracked local edits around the update
	Rebase    bool   // rebase local commits instead of requiring a fast-forward
	NoFetch   bool   // compare against what is already fetched
	DryRun    bool   // report what would change, change nothing
}

// SyncResult reports what Sync found or did.
type SyncResult struct {
	Branch       string   `json:"branch"`
	Remote       string   `json:"remote"`
	Before       string   `json:"before"`
	After        string   `json:"after"`
	Ahead        int      `json:"ahead"`
	Behind       int      `json:"behind"`
	Updated      bool     `json:"updated"`
	Commits      []string `json:"commits"`
	Changed      []string `json:"changed"`
	AffectedEnvs []string `json:"affected_envs"`
	VariablesTF  bool     `json:"variables_changed"`
	Stashed      bool     `json:"stashed"`
}

// Sync fetches the remote and brings the checked-out branch up to date.
// Progress is written to out (may be nil). It never runs git clean/reset and
// never touches untracked or ignored files.
func Sync(dir string, opt SyncOptions, out io.Writer) (*SyncResult, error) {
	if out == nil {
		out = io.Discard
	}
	if _, err := exec.LookPath("git"); err != nil {
		return nil, errors.New("git is not installed")
	}
	if gitToplevel(dir) == "" {
		return nil, fmt.Errorf("%s is not a git repository — `sync` needs a git checkout (use `social-platform update` for release installs)", dir)
	}

	branch := opt.Branch
	if branch == "" {
		b, err := git(dir, "rev-parse", "--abbrev-ref", "HEAD")
		if err != nil {
			return nil, err
		}
		branch = b
	}
	if branch == "HEAD" {
		return nil, errors.New("detached HEAD: check out a branch first (or pass --branch)")
	}
	remote := opt.Remote
	if remote == "" {
		remote = remoteFor(dir, branch)
	}
	ref := remote + "/" + branch

	res := &SyncResult{Branch: branch, Remote: remote}
	res.Before, _ = git(dir, "rev-parse", "--short", "HEAD")

	if !opt.NoFetch {
		fmt.Fprintf(out, "$ git fetch --prune %s\n", remote)
		cmd := exec.Command("git", "-C", dir, "fetch", "--prune", remote)
		cmd.Stdout = out
		cmd.Stderr = out
		if err := cmd.Run(); err != nil {
			return nil, fmt.Errorf("git fetch %s failed: %w", remote, err)
		}
	}
	if _, err := git(dir, "rev-parse", "--verify", "--quiet", "refs/remotes/"+ref); err != nil {
		return nil, fmt.Errorf("%s does not exist (is %q the right remote/branch?)", ref, ref)
	}

	res.Ahead, res.Behind = aheadBehind(dir, ref)
	res.After = res.Before

	if res.Behind == 0 {
		fmt.Fprintf(out, "Already up to date with %s", ref)
		if res.Ahead > 0 {
			fmt.Fprintf(out, " (you have %d local commit(s) not pushed)", res.Ahead)
		}
		fmt.Fprintln(out)
		return res, nil
	}

	// what is coming in
	if log, err := git(dir, "log", "--oneline", "--no-decorate", "HEAD.."+ref); err == nil && log != "" {
		res.Commits = strings.Split(log, "\n")
	}
	if names, err := git(dir, "diff", "--name-only", "HEAD...", ref); err == nil && names != "" {
		res.Changed = strings.Split(names, "\n")
	} else if names, err := git(dir, "diff", "--name-only", "HEAD", ref); err == nil && names != "" {
		res.Changed = strings.Split(names, "\n")
	}
	res.AffectedEnvs = AffectedEnvs(res.Changed)
	for _, f := range res.Changed {
		if strings.HasSuffix(f, "variable.tf") || strings.HasSuffix(f, "variables.tf") {
			res.VariablesTF = true
		}
	}

	fmt.Fprintf(out, "%d new commit(s) on %s:\n", res.Behind, ref)
	for _, c := range res.Commits {
		fmt.Fprintf(out, "  %s\n", c)
	}

	if opt.DryRun {
		fmt.Fprintln(out, "(dry run: nothing was changed)")
		return res, nil
	}

	if res.Ahead > 0 && !opt.Rebase {
		return res, fmt.Errorf("your branch and %s have diverged (%d local commit(s), %d incoming) — re-run with --rebase, or merge/rebase yourself", ref, res.Ahead, res.Behind)
	}

	dirty, _ := git(dir, "status", "--porcelain", "--untracked-files=no")
	if strings.TrimSpace(dirty) != "" {
		if !opt.AutoStash {
			return res, fmt.Errorf("you have uncommitted changes to tracked files:\n%s\ncommit them, or re-run with --autostash", dirty)
		}
		fmt.Fprintln(out, "$ git stash push (tracked files only)")
		if _, err := git(dir, "stash", "push", "-m", "social-platform sync autostash"); err != nil {
			return res, err
		}
		res.Stashed = true
	}

	var mergeErr error
	if opt.Rebase {
		fmt.Fprintf(out, "$ git rebase %s\n", ref)
		_, mergeErr = git(dir, "rebase", ref)
		if mergeErr != nil {
			_, _ = git(dir, "rebase", "--abort")
		}
	} else {
		fmt.Fprintf(out, "$ git merge --ff-only %s\n", ref)
		_, mergeErr = git(dir, "merge", "--ff-only", ref)
	}

	if res.Stashed {
		fmt.Fprintln(out, "$ git stash pop")
		if _, err := git(dir, "stash", "pop"); err != nil {
			fmt.Fprintf(out, "WARNING: could not re-apply your stashed edits automatically (%v)\nThey are safe in `git stash list`.\n", err)
		}
	}
	if mergeErr != nil {
		return res, mergeErr
	}

	res.Updated = true
	res.After, _ = git(dir, "rev-parse", "--short", "HEAD")
	fmt.Fprintf(out, "Updated %s → %s\n", res.Before, res.After)
	fmt.Fprintln(out, "Terraform state, caches and terraform.tfvars were not touched.")
	return res, nil
}

// AffectedEnvs maps changed repository paths to the environments that need a
// re-apply: files under environments/<env>/ affect that environment, and
// anything under projects/ affects prod-docker (image builds hash the project
// folders) and prod-gateway (it copies the static front-ends).
func AffectedEnvs(changed []string) []string {
	set := map[string]bool{}
	for _, f := range changed {
		f = filepath.ToSlash(strings.TrimSpace(f))
		switch {
		case strings.HasPrefix(f, "environments/"):
			parts := strings.Split(f, "/")
			if len(parts) >= 3 {
				for _, e := range envOrder {
					if parts[1] == e {
						set[e] = true
					}
				}
			}
		case strings.HasPrefix(f, "projects/"):
			set["prod-docker"] = true
			set["prod-gateway"] = true
		}
	}
	var out []string
	for _, e := range envOrder {
		if set[e] {
			out = append(out, e)
		}
	}
	return out
}

// ─── carrying Terraform state to a new folder ───────────────────────────────

var stateFiles = []string{"terraform.tfstate", "terraform.tfstate.backup"}

// StateCandidates lists environments whose local state exists in `from` but
// not yet in `to`.
func StateCandidates(from, to string) []string {
	var out []string
	envs, err := os.ReadDir(filepath.Join(from, "environments"))
	if err != nil {
		return nil
	}
	for _, e := range envs {
		if !e.IsDir() {
			continue
		}
		src := filepath.Join(from, "environments", e.Name(), "terraform.tfstate")
		dst := filepath.Join(to, "environments", e.Name(), "terraform.tfstate")
		if _, err := os.Stat(src); err != nil {
			continue
		}
		if _, err := os.Stat(dst); err == nil {
			continue // never overwrite existing state
		}
		if _, err := os.Stat(filepath.Dir(dst)); err != nil {
			continue
		}
		out = append(out, e.Name())
	}
	sort.Strings(out)
	return out
}

// CarryOverState copies local Terraform state from one infra folder to another
// so switching folders does not make Terraform forget (and try to re-create)
// containers that already exist. Existing state in `to` is never overwritten.
func CarryOverState(from, to string) ([]string, error) {
	var copied []string
	for _, env := range StateCandidates(from, to) {
		for _, name := range stateFiles {
			src := filepath.Join(from, "environments", env, name)
			if _, err := os.Stat(src); err != nil {
				continue
			}
			dst := filepath.Join(to, "environments", env, name)
			if err := copyFile(src, dst); err != nil {
				return copied, err
			}
			copied = append(copied, filepath.Join(env, name))
		}
	}
	return copied, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

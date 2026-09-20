// Package release handles downloading and extracting infra assets from
// GitHub Releases on SaisakthiM/Infrastructure-Project.
package release

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/secrets"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
)

const (
	githubAPI = "https://api.github.com"
	repoOwner = "SaisakthiM"
	repoName  = "Infrastructure-Project"
	assetName = "infra.tar.gz" // the release asset name
)

// GHRelease is a minimal GitHub release API response.
type GHRelease struct {
	TagName string    `json:"tag_name"`
	Assets  []GHAsset `json:"assets"`
}

type GHAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// githubToken returns a personal access token to authenticate GitHub API
// requests with, if one is available. Reuses the Atlantis GitHub PAT already
// stored in the keychain (secrets.go: prod-infra/atlantis_gh_token) rather
// than introducing a separate credential just for this -- it only needs
// public read access here (listing/fetching releases), which that token
// already has.
//
// FIX: previously every request in this file went out via bare http.Get()
// with no Authorization header at all, so every "Check Prerequisites" /
// install / update click burned against GitHub's UNAUTHENTICATED rate limit
// -- 60 requests/hour per IP. That's exactly what produced the "Bad Gateway"
// shown in the UI: `curl -sI .../releases/latest` came back 403 with
// x-ratelimit-remaining: 0. An authenticated request gets 5,000/hour instead
// (an ~83x increase), which comfortably covers repeated dev iteration.
//
// Returns "" if no token is configured -- callers fall back to an
// unauthenticated request rather than failing outright, so this remains
// usable (just rate-limited) for anyone who hasn't set atlantis_gh_token yet.
func githubToken() string {
	return secrets.Get("prod-infra", "atlantis_gh_token")
}

// newGithubRequest builds a GET request with a User-Agent (GitHub's API
// rejects requests without one, authenticated or not) and, if a token is
// configured, an Authorization header.
func newGithubRequest(url string) (*http.Request, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "social-platform-cli")
	req.Header.Set("Accept", "application/vnd.github+json")
	if tok := githubToken(); tok != "" {
		// "token" scheme, not "Bearer" -- correct for classic GitHub PATs
		// (what ATLANTIS_GH_TOKEN / atlantis_gh_token is). Fine-grained PATs
		// also accept this scheme.
		req.Header.Set("Authorization", "token "+tok)
	}
	return req, nil
}

func doGithubRequest(url string) (*http.Response, error) {
	req, err := newGithubRequest(url)
	if err != nil {
		return nil, err
	}
	return http.DefaultClient.Do(req)
}

// LatestRelease fetches the latest release metadata from the GitHub API.
func LatestRelease() (*GHRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases/latest", githubAPI, repoOwner, repoName)
	resp, err := doGithubRequest(url)
	if err != nil {
		return nil, fmt.Errorf("fetching latest release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("no releases found at %s/%s — publish a release first", repoOwner, repoName)
	}
	if resp.StatusCode == 403 {
		return nil, rateLimitError(resp)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API returned HTTP %d", resp.StatusCode)
	}
	var rel GHRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("parsing release JSON: %w", err)
	}
	return &rel, nil
}

// ListReleases returns the last 10 releases so the user can choose a version.
func ListReleases() ([]GHRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases?per_page=10", githubAPI, repoOwner, repoName)
	resp, err := doGithubRequest(url)
	if err != nil {
		return nil, fmt.Errorf("listing releases: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 403 {
		return nil, rateLimitError(resp)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API returned HTTP %d", resp.StatusCode)
	}
	var releases []GHRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("parsing releases JSON: %w", err)
	}
	return releases, nil
}

// rateLimitError builds a clear error message from GitHub's rate-limit
// headers instead of surfacing a bare "HTTP 403" (which is what the web UI
// was rendering as an unhelpful generic "Bad Gateway").
func rateLimitError(resp *http.Response) error {
	remaining := resp.Header.Get("x-ratelimit-remaining")
	if remaining != "0" {
		// A 403 that isn't rate-limiting (e.g. bad/expired token) -- don't
		// mislabel it.
		return fmt.Errorf("GitHub API returned HTTP 403 (not rate-limit related — check atlantis_gh_token validity)")
	}
	reset := resp.Header.Get("x-ratelimit-reset")
	limit := resp.Header.Get("x-ratelimit-limit")
	tokenSet := githubToken() != ""
	msg := fmt.Sprintf("GitHub API rate limit exceeded (0/%s remaining, resets at unix time %s)", limit, reset)
	if !tokenSet {
		msg += " — no atlantis_gh_token configured; set one via 'configure' to raise the limit from 60/hr to 5,000/hr"
	}
	return fmt.Errorf(msg)
}

// DownloadAndExtract downloads the infra asset for a release and syncs it
// into destDir. destDir itself is the infra root (environments/, modules/,
// gitops/, projects/, atlantis.yaml as direct children) -- there is no
// separate nested "infra/" folder anywhere in this layout.
//
// It extracts into a scratch directory first, then merges into destDir file
// by file (see mergeExtractedInto) rather than wiping destDir and
// re-extracting straight into it. The old wipe-and-replace approach deleted
// everything in destDir on every single call -- including terraform.tfvars,
// terraform.tfstate*, .terraform/, and .terragrunt-cache/ -- which meant
// 'install'/'update' destroyed all local secrets, state, and provider
// caches even for a one-line upstream change. That made it unusable for
// routine syncing; only a from-scratch reinstall could tolerate it.
// Returns the infra root and the list of paths (relative to destDir) that
// were actually added or changed by this call, so callers can decide what,
// if anything, needs to react to the change (e.g. invalidating state only
// for environments whose .tf/.hcl actually changed -- see
// AffectedEnvironments).
func DownloadAndExtract(rel *GHRelease, destDir string) (string, []string, error) {
	var downloadURL string
	usingSourceFallback := false
	for _, a := range rel.Assets {
		if a.Name == assetName {
			downloadURL = a.BrowserDownloadURL
			break
		}
	}
	if downloadURL == "" {
		// Fallback: GitHub's auto-generated source tarball for the tag.
		downloadURL = fmt.Sprintf("https://github.com/%s/%s/archive/refs/tags/%s.tar.gz",
			repoOwner, repoName, rel.TagName)
		ui.Warn("No '%s' asset found in release %s, falling back to source tarball", assetName, rel.TagName)
		usingSourceFallback = true
	}

	ui.Info("Downloading %s (%s)...", assetName, rel.TagName)
	tmpFile, err := os.CreateTemp("", "infra-*.tar.gz")
	if err != nil {
		return "", nil, err
	}
	defer os.Remove(tmpFile.Name())

	if err := download(downloadURL, tmpFile); err != nil {
		return "", nil, err
	}
	tmpFile.Close()

	// Extract into a throwaway scratch dir -- never touch destDir directly
	// until we know exactly what changed.
	scratch, err := os.MkdirTemp("", "infra-extract-*")
	if err != nil {
		return "", nil, err
	}
	defer os.RemoveAll(scratch)

	ui.Info("Extracting release contents...")
	if strings.HasSuffix(downloadURL, ".zip") {
		if err := extractZip(tmpFile.Name(), scratch); err != nil {
			return "", nil, fmt.Errorf("extracting zip: %w", err)
		}
	} else {
		if err := extractTarGz(tmpFile.Name(), scratch); err != nil {
			return "", nil, fmt.Errorf("extracting tar.gz: %w", err)
		}
	}

	if usingSourceFallback {
		// GitHub wraps the source tarball in a single "<repo>-<tag>/"
		// folder. environments/, modules/, gitops/, projects/, and
		// atlantis.yaml live directly at the repo root inside that
		// wrapper (sibling to infra-cli/) -- there's no "infra/" subfolder
		// to dig out, so hoist the wrapper's contents up into scratch and
		// drop the CLI's own source (we don't need it here).
		entries, err := os.ReadDir(scratch)
		if err != nil {
			return "", nil, fmt.Errorf("reading extracted contents: %w", err)
		}
		var wrapper string
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), repoName+"-") {
				wrapper = filepath.Join(scratch, e.Name())
				break
			}
		}
		if wrapper == "" {
			return "", nil, fmt.Errorf("expected a '%s-<tag>' folder inside the source tarball, didn't find one", repoName)
		}
		if err := hoistContents(wrapper, scratch, []string{"infra-cli", "cli", ".git", ".github"}); err != nil {
			return "", nil, fmt.Errorf("rearranging extracted source tree: %w", err)
		}
		_ = os.RemoveAll(wrapper)
	}

	// Verify we actually ended up with something usable before touching
	// destDir at all.
	if _, err := os.Stat(filepath.Join(scratch, "environments")); err != nil {
		return "", nil, fmt.Errorf("extraction finished but environments/ was not found in the release -- repo layout may have changed")
	}

	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", nil, err
	}

	ui.Info("Syncing changes into %s...", destDir)
	changed, err := mergeExtractedInto(scratch, destDir)
	if err != nil {
		return "", nil, fmt.Errorf("syncing into %s: %w", destDir, err)
	}

	return destDir, changed, nil
}

// preservedDirNames are directory names that are always local-only
// (generated by terraform/terragrunt on this machine) -- their contents are
// never touched by a sync in either direction: an upstream copy is never
// used to overwrite what's here, and nothing here is ever deleted for not
// existing upstream.
var preservedDirNames = map[string]bool{
	".terraform":        true,
	".terragrunt-cache": true,
}

// isPreservedFile reports whether base (a file's base name) is something
// generated locally by 'configure'/terraform rather than tracked upstream:
// tfvars (secrets) and tfstate (deployment state). These must survive a
// sync no matter what the upstream release contains.
func isPreservedFile(base string) bool {
	if base == "terraform.tfvars" || base == "terraform.tfvars.json" {
		return true
	}
	if base == "terraform.tfstate" ||
		strings.HasPrefix(base, "terraform.tfstate.") ||
		strings.HasSuffix(base, ".tfstate") ||
		strings.HasSuffix(base, ".tfstate.backup") {
		return true
	}
	return false
}

// isPreservedPath reports whether rel (a path relative to the tree root)
// falls under a preserved directory anywhere along its length.
func isPreservedPath(rel string) bool {
	for _, part := range strings.Split(filepath.ToSlash(rel), "/") {
		if preservedDirNames[part] {
			return true
		}
	}
	return false
}

// mergeExtractedInto copies the freshly-extracted infra tree at srcDir into
// destDir without discarding anything destDir already has that srcDir
// doesn't know about. Local secrets/tfvars, deployment state, and
// provider/module caches (see isPreservedFile/preservedDirNames) are left
// completely alone -- never overwritten, never deleted for "not being in
// this release". Every other file is written only if it's new or its
// content actually differs from what's already there, so a routine sync
// doesn't force Terragrunt to redo caching work it doesn't need to, and the
// returned list reflects only genuine changes.
//
// This intentionally only adds/updates files -- it does not delete
// destDir-only files that the upstream release no longer has. Safer
// default for a mixed tree that also holds locally-generated files; a
// pruning mode can be added later if a release ever needs to remove a
// tracked file outright.
func mergeExtractedInto(srcDir, destDir string) ([]string, error) {
	var changed []string
	err := filepath.Walk(srcDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, relErr := filepath.Rel(srcDir, path)
		if relErr != nil {
			return relErr
		}
		if rel == "." {
			return nil
		}
		if isPreservedPath(rel) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		target := filepath.Join(destDir, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		if isPreservedFile(filepath.Base(rel)) {
			return nil
		}

		same, err := filesIdentical(path, target)
		if err != nil {
			return err
		}
		if same {
			return nil
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		if err := copyFileContents(path, target, info.Mode()); err != nil {
			return err
		}
		changed = append(changed, filepath.ToSlash(rel))
		return nil
	})
	return changed, err
}

// filesIdentical reports whether a and b have identical content. A missing
// b is treated as "not identical" (i.e. needs copying), not an error.
func filesIdentical(a, b string) (bool, error) {
	bi, statErr := os.Stat(b)
	if statErr != nil {
		return false, nil
	}
	ai, err := os.Stat(a)
	if err != nil {
		return false, err
	}
	if ai.Size() != bi.Size() {
		return false, nil
	}
	ah, err := sha256File(a)
	if err != nil {
		return false, err
	}
	bh, err := sha256File(b)
	if err != nil {
		return false, err
	}
	return ah == bh, nil
}

func sha256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func copyFileContents(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// AffectedEnvironments takes the changed-file list returned by
// DownloadAndExtract and returns the top-level environments/<name>/
// directories that had an actual Terraform or Terragrunt config file
// (.tf/.hcl) change, sorted. A doc/comment/script change elsewhere in the
// tree (or in an environment, but not to a .tf/.hcl file) doesn't count.
// Callers use this to scope local-state invalidation to only the
// environments that genuinely need it after a sync, instead of wiping
// every environment's state on every single update.
func AffectedEnvironments(changed []string) []string {
	seen := map[string]bool{}
	for _, f := range changed {
		if !strings.HasSuffix(f, ".tf") && !strings.HasSuffix(f, ".hcl") {
			continue
		}
		parts := strings.SplitN(f, "/", 3)
		if len(parts) >= 2 && parts[0] == "environments" {
			seen[parts[1]] = true
		}
	}
	envs := make([]string, 0, len(seen))
	for e := range seen {
		envs = append(envs, e)
	}
	sort.Strings(envs)
	return envs
}

// hoistContents moves every entry of src (except names in skip) directly
// into dst. Falls back to a recursive copy if os.Rename fails because src
// and dst are on different filesystems (e.g. src under /tmp on a tmpfs).
func hoistContents(src, dst string, skip []string) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	skipSet := make(map[string]bool, len(skip))
	for _, s := range skip {
		skipSet[s] = true
	}
	for _, e := range entries {
		if skipSet[e.Name()] {
			continue
		}
		from := filepath.Join(src, e.Name())
		to := filepath.Join(dst, e.Name())
		_ = os.RemoveAll(to)
		if err := os.Rename(from, to); err != nil {
			if cerr := copyTree(from, to); cerr != nil {
				return fmt.Errorf("moving %s: %w", e.Name(), cerr)
			}
			_ = os.RemoveAll(from)
		}
	}
	return nil
}

// copyTree recursively copies a file or directory tree, used as a fallback
// when os.Rename can't move across filesystem boundaries.
func copyTree(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(target)
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, in)
		return err
	})
}

// download fetches url to dst. Uses an authenticated request when a GitHub
// token is configured -- harmless no-op for public asset/source-tarball
// URLs, but keeps this working uniformly if this repo (or the release
// asset's redirect target) ever becomes private.
func download(url string, dst *os.File) error {
	resp, err := doGithubRequest(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 403 {
		return rateLimitError(resp)
	}
	if resp.StatusCode != 200 {
		return fmt.Errorf("download returned HTTP %d for %s", resp.StatusCode, url)
	}
	_, err = io.Copy(dst, resp.Body)
	return err
}

func extractTarGz(src, dest string) error {
	f, err := os.Open(src)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(dest, filepath.Clean(hdr.Name)) //nolint:gosec
		// Prevent path traversal.
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			continue
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil { //nolint:gosec
				out.Close()
				return err
			}
			out.Close()
		}
	}
	return nil
}

func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		target := filepath.Join(dest, filepath.Clean(f.Name)) //nolint:gosec
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			continue
		}
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(target, 0755)
			continue
		}
		_ = os.MkdirAll(filepath.Dir(target), 0755)
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(target)
		if err != nil {
			rc.Close()
			return err
		}
		_, _ = io.Copy(out, rc) //nolint:gosec
		out.Close()
		rc.Close()
	}
	return nil
}
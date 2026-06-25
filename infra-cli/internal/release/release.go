// Package release handles downloading and extracting infra assets from
// GitHub Releases on SaisakthiM/Infrastruture-Project.
package release

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

const (
	githubAPI  = "https://api.github.com"
	repoOwner  = "SaisakthiM"
	repoName   = "Infrastruture-Project"
	assetName  = "infra.tar.gz" // the release asset name
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

// LatestRelease fetches the latest release metadata from the GitHub API.
func LatestRelease() (*GHRelease, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/releases/latest", githubAPI, repoOwner, repoName)
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return nil, fmt.Errorf("fetching latest release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("no releases found at %s/%s — publish a release first", repoOwner, repoName)
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
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return nil, fmt.Errorf("listing releases: %w", err)
	}
	defer resp.Body.Close()
	var releases []GHRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("parsing releases JSON: %w", err)
	}
	return releases, nil
}

// DownloadAndExtract downloads the infra asset for a release and extracts it
// to destDir. Returns the path to the extracted infra/ directory.
func DownloadAndExtract(rel *GHRelease, destDir string) (string, error) {
	// Find the infra asset in this release.
	var downloadURL string
	for _, a := range rel.Assets {
		if a.Name == assetName {
			downloadURL = a.BrowserDownloadURL
			break
		}
	}
	if downloadURL == "" {
		// Fallback: try the source tarball for the tag.
		downloadURL = fmt.Sprintf("https://github.com/%s/%s/archive/refs/tags/%s.tar.gz",
			repoOwner, repoName, rel.TagName)
		ui.Warn("No '%s' asset found in release %s, falling back to source tarball", assetName, rel.TagName)
	}

	ui.Info("Downloading %s (%s)...", assetName, rel.TagName)
	tmpFile, err := os.CreateTemp("", "infra-*.tar.gz")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmpFile.Name())

	if err := download(downloadURL, tmpFile); err != nil {
		return "", err
	}
	tmpFile.Close()

	// Remove old infra dir.
	infraDest := filepath.Join(destDir, "infra")
	_ = os.RemoveAll(infraDest)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", err
	}

	ui.Info("Extracting to %s...", destDir)
	if strings.HasSuffix(downloadURL, ".zip") {
		if err := extractZip(tmpFile.Name(), destDir); err != nil {
			return "", fmt.Errorf("extracting zip: %w", err)
		}
	} else {
		if err := extractTarGz(tmpFile.Name(), destDir); err != nil {
			return "", fmt.Errorf("extracting tar.gz: %w", err)
		}
	}

	// The source tarball extracts to "Infrastruture-Project-<tag>/", remap.
	entries, _ := os.ReadDir(destDir)
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), "Infrastruture-Project-") {
			oldPath := filepath.Join(destDir, e.Name())
			// Move Projects/Terraform/infra → infra
			src := filepath.Join(oldPath, "Projects", "Terraform", "infra")
			if _, err := os.Stat(src); err == nil {
				_ = os.Rename(src, infraDest)
			}
			_ = os.RemoveAll(oldPath)
			break
		}
	}

	return infraDest, nil
}

func download(url string, dst *os.File) error {
	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return err
	}
	defer resp.Body.Close()
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

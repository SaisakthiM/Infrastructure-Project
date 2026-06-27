// Package dockerhost figures out a sensible default Docker socket/host
// string when the user hasn't set one explicitly, by reading the active
// `docker context`. Falls back to the old hardcoded Desktop path if Docker
// isn't installed or no context is current.
package dockerhost

import (
	"encoding/json"
	"os/exec"
	"strings"
)

// FallbackDefault is used when Docker isn't installed or has no current context.
const FallbackDefault = "unix:///home/saisakthi/.docker/desktop/docker.sock"

type ctxEntry struct {
	Name           string `json:"Name"`
	Current        bool   `json:"Current"`
	DockerEndpoint string `json:"DockerEndpoint"`
}

// Detect runs `docker context ls` and returns the endpoint of whichever
// context is marked current. Returns "" on any failure.
func Detect() string {
	out, err := exec.Command("docker", "context", "ls", "--format", "json").Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var e ctxEntry
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			continue
		}
		if e.Current && e.DockerEndpoint != "" {
			return e.DockerEndpoint
		}
	}
	return ""
}

// Default returns the detected current docker context's endpoint, or
// FallbackDefault if detection fails.
func Default() string {
	if d := Detect(); d != "" {
		return d
	}
	return FallbackDefault
}

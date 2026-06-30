BINARY     := social-platform
WEBUI      := social-platform-webui
MODULE     := github.com/SaisakthiM/Infrastruture-Project/cli
VERSION    ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS    := -s -w -X main.version=$(VERSION)
BUILD_DIR  := dist

.PHONY: all build build-webui build-all clean test lint install install-webui release help

## help: Print this help message
help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## build: Build CLI for current platform
build:
	go build -ldflags="$(LDFLAGS)" -o $(BINARY) .
	@echo "Built: ./$(BINARY)"

## build-webui: Build Web UI for current platform
build-webui:
	go build -ldflags="$(LDFLAGS)" -o $(WEBUI) ./webui/
	@echo "Built: ./$(WEBUI)  →  open http://localhost:8080"

## install: Build and install CLI to /usr/local/bin
install: build
	sudo mv $(BINARY) /usr/local/bin/$(BINARY)
	@echo "Installed: /usr/local/bin/$(BINARY)"

## install-webui: Build and install Web UI to /usr/local/bin
install-webui: build-webui
	sudo mv $(WEBUI) /usr/local/bin/$(WEBUI)
	@echo "Installed: /usr/local/bin/$(WEBUI)"

## build-all: Cross-compile CLI + Web UI for all platforms
build-all:
	@mkdir -p $(BUILD_DIR)
	@echo "── CLI ─────────────────────────────────────────────────"
	GOOS=linux   GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-linux-amd64   .
	GOOS=linux   GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-linux-arm64   .
	GOOS=darwin  GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-darwin-amd64  .
	GOOS=darwin  GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-darwin-arm64  .
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY)-windows-amd64.exe .
	@echo "── Web UI ──────────────────────────────────────────────"
	GOOS=linux   GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(WEBUI)-linux-amd64   ./webui/
	GOOS=linux   GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(WEBUI)-linux-arm64   ./webui/
	GOOS=darwin  GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(WEBUI)-darwin-amd64  ./webui/
	GOOS=darwin  GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(WEBUI)-darwin-arm64  ./webui/
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o $(BUILD_DIR)/$(WEBUI)-windows-amd64.exe ./webui/
	@echo "────────────────────────────────────────────────────────"
	@ls -lh $(BUILD_DIR)/

## package-infra: Create the infra.tar.gz release asset locally
package-infra:
	@mkdir -p $(BUILD_DIR)
	tar --exclude='*/.terraform' \
	    --exclude='*/terraform.tfstate*' \
	    --exclude='*/terraform.tfvars' \
	    --exclude='*/.terraform.lock.hcl' \
	    -czf $(BUILD_DIR)/infra.tar.gz \
	    -C .. environments modules gitops projects atlantis.yaml
	@echo "Packaged: $(BUILD_DIR)/infra.tar.gz"
	@ls -lh $(BUILD_DIR)/infra.tar.gz

## test: Run all tests
test:
	go test ./... -v -count=1

## lint: Run golangci-lint
lint:
	golangci-lint run ./...

## clean: Remove build artifacts
clean:
	rm -rf $(BUILD_DIR) $(BINARY) $(WEBUI)

## release: Tag and push a new version (usage: make release VERSION=v1.2.3)
release:
	@if [ -z "$(VERSION)" ] || [ "$(VERSION)" = "dev" ]; then \
		echo "Usage: make release VERSION=v1.2.3"; exit 1; fi
	git tag -a $(VERSION) -m "Release $(VERSION)"
	git push origin $(VERSION)
	@echo "Tagged $(VERSION) — GitHub Actions will build and publish the release."

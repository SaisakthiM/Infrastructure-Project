package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/deploy"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
)

var importCmd = &cobra.Command{
	Use:   "import-state",
	Short: "Import existing Docker, Helm and Kubernetes resources into Terraform state",
	Long: `Detects running Docker containers, volumes and networks, Helm releases and
in-cluster Kubernetes Secrets/manifests that the prod-docker, prod-infra,
prod-gateway and prod-social environments expect, and imports the ones that
already exist but aren't tracked yet into that environment's Terraform state.

This is useful after modifying resources outside of Terraform (e.g. manual
docker run / docker volume create, or a helm install) to avoid Terraform
trying to recreate them and failing with "already exists".

How it works:
  1. Queries docker ps -a / volume ls / network ls, helm list -A and
     kubectl (all against the kind-social-media context for cluster objects).
  2. Matches results against the per-environment catalogs in
     internal/deploy/import.go and skips anything already in that
     environment's "terragrunt state list".
  3. Shows each match and asks for confirmation before running import.
  4. Runs: terragrunt import <resource_address> <import_id>
     from that environment's own directory.

docker_image resources are never offered: the kreuzwerker/docker provider
doesn't support importing them, and Terraform rebuilds them on apply.`,
	Example: `  social-platform import-state          # interactive, confirm each resource
  social-platform import-state --yes    # auto-confirm all found resources`,
	RunE: runImport,
}

var importAutoConfirm bool

func init() {
	importCmd.Flags().BoolVar(&importAutoConfirm, "yes", false,
		"Auto-confirm all detected resources without prompting")
}

func runImport(cmd *cobra.Command, args []string) error {
	ui.Banner()

	cfg, err := config.Load()
	if err != nil || !cfg.InfraExists() {
		return fmt.Errorf("infrastructure not found — run 'social-platform install' first")
	}

	ui.Info("Scanning Docker, Helm and the kind cluster for importable prod-docker, prod-infra, prod-gateway and prod-social resources...")
	fmt.Println()

	candidates, err := deploy.DetectImportCandidates(cfg)
	if err != nil {
		return fmt.Errorf("detection failed: %w", err)
	}

	if len(candidates) == 0 {
		ui.Warn("No matching Docker resources found.")
		ui.Dim.Println("  (Are the containers/volumes running? Is Docker accessible?)")
		return nil
	}

	ui.Success("Found %d importable resource(s):", len(candidates))
	fmt.Println()

	// Display the full table of candidates.
	ui.Cyan.Printf("  %-6s  %-40s  %s\n", "KIND", "TF ADDRESS", "DOCKER ID")
	ui.Dim.Printf("  %-6s  %-40s  %s\n", "──────", "────────────────────────────────────────", "────────────────────────────────────────")
	for _, c := range candidates {
		importID := c.ImportID
		if len(importID) > 40 {
			importID = importID[:37] + "..."
		}
		fmt.Printf("  %-6s  %-40s  %s\n", c.Entry.Kind, c.Entry.TFAddress, importID)
	}
	fmt.Println()

	// Per-resource confirmation loop.
	imported := 0
	skipped := 0
	failed := 0

	for _, candidate := range candidates {
		fmt.Println()
		ui.Bold.Printf("  Resource: %s\n", candidate.Entry.TFAddress)
		ui.Dim.Printf("  Kind:     %s\n", candidate.Entry.Kind)
		ui.Dim.Printf("  Docker:   %s\n", candidate.Entry.DockerName)
		ui.Dim.Printf("  ImportID: %s\n", candidate.ImportID)

		doImport := importAutoConfirm
		if !importAutoConfirm {
			doImport = ui.Confirm("Import this resource?")
		} else {
			ui.Info("Auto-confirming (--yes)")
		}

		if !doImport {
			ui.Warn("Skipped %s", candidate.Entry.TFAddress)
			skipped++
			continue
		}

		if err := deploy.RunImport(cfg, candidate); err != nil {
			ui.Error("%v", err)
			failed++
			// Continue with next resource rather than aborting.
			continue
		}
		ui.Success("Imported %s", candidate.Entry.TFAddress)
		imported++
	}

	fmt.Println()
	ui.Bold.Printf("  Import summary: %d imported, %d skipped, %d failed\n",
		imported, skipped, failed)

	if failed > 0 {
		return fmt.Errorf("%d resource(s) failed to import", failed)
	}
	return nil
}

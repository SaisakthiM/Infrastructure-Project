// Package cmd contains all Cobra CLI commands.
package cmd

import (
	"os"

	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastruture-Project/cli/internal/ui"
)

var rootCmd = &cobra.Command{
	Use:   "social-platform",
	Short: "CLI for deploying and managing the social-platform infrastructure",
	Long: `social-platform is a single-binary CLI that installs prerequisites,
configures secrets, downloads infrastructure files from GitHub Releases,
and drives Terragrunt to deploy or destroy your full stack.`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute is the entry point called from main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		ui.Error("%v", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(
		installCmd,
		configureCmd,
		cleanCmd,
		deployCmd,
		destroyCmd,
		statusCmd,
		logsCmd,
		importCmd,
		tuiCmd,
	)
}

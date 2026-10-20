// Package cmd contains all Cobra CLI commands.
package cmd

import (
	"os"

	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/config"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/source"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/ui"
	"github.com/spf13/cobra"
)

// dirFlag is the global --dir/-C flag: use this folder for the current command only.
var dirFlag string

var rootCmd = &cobra.Command{
	Use:   "social-platform",
	Short: "CLI for deploying and managing the social-platform infrastructure",
	Long: `social-platform is a single-binary CLI that installs prerequisites,
configures secrets, downloads infrastructure files from GitHub Releases,
and drives Terragrunt to deploy or destroy your full stack.`,
	SilenceUsage:  true,
	SilenceErrors: true,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if dirFlag == "" {
			return nil
		}
		dir := source.ExpandHome(dirFlag)
		if err := source.Validate(dir); err != nil {
			return err
		}
		config.SetInfraDirOverride(dir)
		return nil
	},
}

// Execute is the entry point called from main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		ui.Error("%v", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&dirFlag, "dir", "C", "",
		"Use this folder as the infrastructure source for this command only (nothing is saved)")
	rootCmd.AddCommand(
		useCmd,
		syncCmd,
		installCmd,
		configureCmd,
		updateCmd,
		cleanCmd,
		deployCmd,
		destroyCmd,
		statusCmd,
		logsCmd,
		importCmd,
		tuiCmd,
	)
}

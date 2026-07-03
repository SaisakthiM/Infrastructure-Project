package cmd

import (
	"github.com/spf13/cobra"
	"github.com/SaisakthiM/Infrastructure-Project/cli/internal/tui"
)

var tuiCmd = &cobra.Command{
	Use:   "ui",
	Short: "Launch interactive terminal UI (TUI)",
	Long: `Opens an interactive terminal user interface powered by Bubble Tea.

Provides a menu-driven interface for all CLI operations:
  - Deploy / Destroy infrastructure
  - Check status (plan)
  - Stream logs
  - Import Docker state

Navigate with arrow keys or j/k, select with Enter, go back with Esc.`,
	Example: `  social-platform ui`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return tui.Run()
	},
}
